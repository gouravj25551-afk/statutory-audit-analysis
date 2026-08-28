// ---------------------------------------------------------------------------
// Extraction layer.
//
//  1. fileToText()  -> pulls raw text out of PDF / DOCX / TXT / CSV files,
//                      entirely in the browser. No file ever leaves the device.
//  2. parseVoucher() / parsePolicy() -> turn raw text into structured facts,
//                      using ONLY what the text contains. Nothing is inferred
//                      from outside the document.
// ---------------------------------------------------------------------------

import {
  EvidenceRef,
  PolicyDoc,
  PolicyRequirement,
  RequirementType,
  VoucherDoc,
  VoucherFields,
} from "./types";

const PDF_VERSION = "4.4.168";

let uid = 0;
export function newId(prefix: string): string {
  uid += 1;
  return `${prefix}-${Date.now().toString(36)}-${uid}`;
}

// ---- File -> text ---------------------------------------------------------

export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return pdfToText(file);
  if (name.endsWith(".docx")) return docxToText(file);
  if (
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md") ||
    name.endsWith(".json")
  ) {
    return file.text();
  }
  // Last resort: try reading as plain text.
  const text = await file.text();
  if (text && /[a-z0-9]/i.test(text)) return text;
  throw new Error(
    "Unsupported file type. Please upload a PDF, DOCX, or TXT/CSV file."
  );
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Reconstruct line breaks from the y-position of each text item.
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items as any[]) {
      const y = item.transform ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        parts.push(line.trim());
        line = "";
      }
      line += item.str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    if (line.trim()) parts.push(line.trim());
    parts.push(""); // page break
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function docxToText(file: File): Promise<string> {
  const mammoth: any = await import("mammoth");
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value as string;
}

// ---- helpers --------------------------------------------------------------

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
}

// Find the first line matching any of the label patterns and pull the value
// that follows the label (after ":" / "-" or on the same line).
function findLabelled(
  lines: string[],
  labels: RegExp
): { value: string; line: string; index: number } | null {
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(labels);
    if (m) {
      const after = lines[i].slice(m.index! + m[0].length).replace(/^[:\-–—\s]+/, "").trim();
      if (after) return { value: after, line: lines[i], index: i };
      // value may be on the next line
      if (i + 1 < lines.length) {
        return { value: lines[i + 1], line: lines[i], index: i };
      }
    }
  }
  return null;
}

const DATE_RE =
  /(\d{1,2}[\/\-.\s](?:\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\/\-.\s]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i;

function firstDate(s: string): string | undefined {
  const m = s.match(DATE_RE);
  return m ? m[1] : undefined;
}

// Parse an amount from a line. Handles "Rs. 12,500.00", "INR 5000", "₹1,20,000".
function parseAmount(s: string): { value: number; raw: string } | null {
  const m = s.match(
    /(?:rs\.?|inr|₹|amount|total)[^0-9]{0,12}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  );
  const capture = m ? m[1] : (s.match(/\b([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?)\b/) || [])[1];
  if (!capture) return null;
  const value = parseFloat(capture.replace(/,/g, ""));
  if (Number.isNaN(value)) return null;
  return { value, raw: (m ? m[0] : capture).trim() };
}

// A compact set of "stop words" so keyword overlap is meaningful.
const STOP = new Set(
  "the a an and or of to for in on at by with as is are be this that these those from into shall must will may per each any all no not it its their his her our your rs inr amount date no dr cr rupees only paid received being account voucher policy".split(
    " "
  )
);

function keywordsOf(text: string): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z][a-z]{2,}/g) || []) {
    if (STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([w]) => w);
}

function ev(
  doc: { id: string; fileName?: string; name?: string },
  kind: "voucher" | "policy",
  line: string,
  index: number
): EvidenceRef {
  return {
    docId: doc.id,
    docName: (doc.fileName || doc.name || "document") as string,
    docKind: kind,
    snippet: line,
    location: `Line ${index + 1}`,
  };
}

// ---- Voucher parsing ------------------------------------------------------

export function parseVoucher(
  id: string,
  fileName: string,
  text: string
): VoucherDoc {
  const lines = splitLines(text);
  const fields: VoucherFields = { supportingDocs: [] };
  const fieldEvidence: Record<string, EvidenceRef> = {};
  const base = { id, fileName };

  const set = (
    key: keyof VoucherFields,
    hit: { value: string; line: string; index: number } | null
  ) => {
    if (hit && hit.value) {
      (fields as any)[key] = hit.value.replace(/\s{2,}/g, " ").trim();
      fieldEvidence[key] = ev(base, "voucher", hit.line, hit.index);
    }
  };

  set("voucherNo", findLabelled(lines, /voucher\s*(?:no\.?|number|#)/i));
  set("voucherDate", findLabelled(lines, /voucher\s*date/i));
  set("transactionDate", findLabelled(lines, /transaction\s*date/i));
  set("invoiceDate", findLabelled(lines, /invoice\s*date/i));
  set("paymentDate", findLabelled(lines, /payment\s*date/i));
  set("description", findLabelled(lines, /(?:description|particulars|narration)/i));
  set("nature", findLabelled(lines, /(?:nature|purpose|head of account)/i));
  set("party", findLabelled(lines, /(?:employee|vendor|customer|payee|paid to|name|party)/i));
  set("department", findLabelled(lines, /(?:department|category|cost cent(?:re|er)|dept)/i));
  set("approver", findLabelled(lines, /(?:approved by|authorised by|authorized by|sanctioned by|approver)/i));
  set("approvalDate", findLabelled(lines, /approval\s*date/i));
  set("invoiceDetails", findLabelled(lines, /invoice\s*(?:no\.?|number|details|#)/i));
  set("policyReference", findLabelled(lines, /policy\s*(?:ref|reference|no)/i));

  // Amount: prefer a line labelled amount/total, else the largest currency figure.
  let amtHit: { value: number; raw: string; line: string; index: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (/(amount|total|net payable|grand total|rs\.?|inr|₹)/i.test(lines[i])) {
      const a = parseAmount(lines[i]);
      if (a && (!amtHit || a.value > amtHit.value)) {
        amtHit = { ...a, line: lines[i], index: i };
      }
    }
  }
  if (amtHit) {
    fields.amount = amtHit.value;
    fields.amountRaw = amtHit.raw;
    fieldEvidence["amount"] = ev(base, "voucher", amtHit.line, amtHit.index);
  }

  // Supporting documents: collect explicit mentions.
  for (let i = 0; i < lines.length; i += 1) {
    if (
      /(enclosed|attached|supporting|annexure|receipt|bill|invoice copy|voucher copy)/i.test(
        lines[i]
      )
    ) {
      fields.supportingDocs.push(lines[i]);
      if (!fieldEvidence["supportingDocs"])
        fieldEvidence["supportingDocs"] = ev(base, "voucher", lines[i], i);
    }
  }

  // Derive dates from labelled fields if the labelled value itself is a date.
  for (const k of ["voucherDate", "transactionDate", "invoiceDate", "approvalDate", "paymentDate"] as const) {
    const v = fields[k];
    if (v) fields[k] = firstDate(v) || v;
  }

  return {
    id,
    fileName,
    status: "extracted",
    text,
    lines,
    fields,
    fieldEvidence,
  };
}

// ---- Policy parsing -------------------------------------------------------

const CLAUSE_RE = /^(?:clause\s+)?(\d+(?:\.\d+)*)[\.\)]?\s/i;

function clauseOf(line: string, index: number): string {
  const m = line.match(CLAUSE_RE);
  if (m) return `Clause ${m[1]}`;
  return `Line ${index + 1}`;
}

export function parsePolicy(
  id: string,
  fileName: string,
  text: string,
  nameHint?: string
): PolicyDoc {
  const lines = splitLines(text);
  const requirements: PolicyRequirement[] = [];

  // Policy name: explicit "Policy Name:" label, else first heading-ish line,
  // else the supplied hint (file name).
  const nameHit = findLabelled(lines, /policy\s*(?:name|title)/i);
  let name =
    nameHit?.value ||
    lines.find((l) => /policy/i.test(l) && l.length < 80) ||
    nameHint ||
    fileName;
  name = name.replace(/\s{2,}/g, " ").trim();

  const effHit = findLabelled(lines, /(?:effective|w\.e\.f\.?|with effect from)\s*date?/i);
  const scopeHit = findLabelled(lines, /(?:scope|applicability|applicable to|coverage)/i);

  const addReq = (
    type: RequirementType,
    label: string,
    line: string,
    i: number,
    extra: Partial<PolicyRequirement> = {}
  ) => {
    requirements.push({
      id: newId("req"),
      type,
      label,
      clause: clauseOf(line, i),
      keywords: keywordsOf(line),
      raw: line,
      lineIndex: i,
      ...extra,
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    const low = l.toLowerCase();

    // Amount limit.
    if (
      /(limit|maximum|max\.?|not exceed|shall not exceed|upto|up to|ceiling|cap of|per (?:transaction|day|month|claim))/.test(
        low
      )
    ) {
      const a = parseAmount(l);
      if (a) {
        addReq("amountLimit", l, l, i, { amountLimit: a.value });
        continue;
      }
    }

    // Timing.
    const timing = low.match(/within\s+(\d{1,3})\s*(day|days|working days)/);
    if (timing || /(prior approval|advance|before (?:the )?(?:transaction|payment)|retrospective)/.test(low)) {
      addReq("timing", l, l, i, {
        timingDays: timing ? parseInt(timing[1], 10) : undefined,
      });
      continue;
    }

    // Approval.
    if (/(approv|authoris|authoriz|sanction|sign-?off|counter-?sign)/.test(low)) {
      addReq("approval", l, l, i);
      continue;
    }

    // Supporting documents.
    if (
      /(supporting document|must be (?:supported|accompanied)|attach|enclose|original (?:bill|receipt|invoice)|documentary evidence|proof of)/.test(
        low
      )
    ) {
      addReq("supportingDoc", l, l, i);
      continue;
    }

    // Eligibility.
    if (/(eligib|entitled|applicable to|covered|only (?:for|employees)|shall be reimbursed|permitted)/.test(low)) {
      addReq("eligibility", l, l, i);
      continue;
    }

    // Other explicit requirement — lines that read like a rule.
    if (/(shall|must|required to|is mandatory|should not|are not allowed|prohibited)/.test(low)) {
      addReq("other", l, l, i);
    }
  }

  return {
    id,
    name,
    fileName,
    status: "extracted",
    text,
    lines,
    effectiveDate: effHit ? firstDate(effHit.value) || effHit.value : undefined,
    scope: scopeHit?.value,
    keywords: keywordsOf(text),
    requirements,
  };
}
