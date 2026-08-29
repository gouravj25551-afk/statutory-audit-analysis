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
  AuthorityBand,
  AuthorityRule,
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
  if (/\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(name) || file.type.startsWith("image/")) {
    // A photographed / scanned document uploaded as an image — read it with OCR.
    return ocrImage(file);
  }
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
    "Unsupported file type. Please upload a PDF, DOCX, image, or TXT/CSV file."
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
  const text = parts.join("\n").replace(/\n{3,}/g, "\n\n");

  // If the PDF has a real text layer, use it. Otherwise it is a scanned /
  // image-only PDF — render each page and OCR it (still 100% in-browser).
  if (text.replace(/\s/g, "").length >= 20) return text;
  return ocrPdf(doc);
}

// ---- OCR (scanned PDFs & image uploads) -----------------------------------
//
// OCR only converts the pixels of the uploaded document into text. It adds no
// outside information — the document itself remains the sole source.

async function makeOcrWorker(): Promise<any> {
  const Tesseract: any = await import("tesseract.js");
  // Self-hosted worker + core (served from /public/ocr) so OCR does not depend
  // on any third-party CDN. Only the language model is pulled from Tesseract's
  // canonical data host. oem = 1 selects the LSTM engine (the -lstm cores).
  return Tesseract.createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  });
}

async function ocrPdf(doc: any): Promise<string> {
  const worker = await makeOcrWorker();
  try {
    const out: string[] = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      if (data?.text) out.push(data.text.trim());
    }
    return out.join("\n\n").replace(/\n{3,}/g, "\n\n");
  } finally {
    await worker.terminate();
  }
}

async function ocrImage(file: File): Promise<string> {
  const worker = await makeOcrWorker();
  try {
    const { data } = await worker.recognize(file);
    return (data?.text || "").trim();
  } finally {
    await worker.terminate();
  }
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
    authorityRules: parseAuthorityRules(lines),
  };
}

// ---------------------------------------------------------------------------
// Approval-authority ("signatory matrix") parsing.
//
// Recognises designations mentioned in a policy and pairs them with the
// document / action they govern, so the engine can later ask "who did the
// policy require to approve THIS voucher, and did that authority actually
// sign?". Purely text recognition — it adds no requirement of its own.
// ---------------------------------------------------------------------------

// Designation lexicon. Ordered most-specific first so "Managing Director" is
// matched before the generic "Director"/"Manager". Recognition only.
const ROLE_LEXICON: { canon: string; re: RegExp }[] = [
  { canon: "Managing Director", re: /\bmanaging director\b|\bm\.?d\.?\b/i },
  { canon: "Project Director", re: /\bproject director\b|\bp\.?d\.?\b/i },
  { canon: "Associate Director", re: /\bassociate director\b/i },
  { canon: "Director – F&O", re: /\bd[-–\s]?f\s*&?\s*o\b|director\s*[–-]\s*f\s*&?\s*o|finance and operations/i },
  { canon: "Director", re: /\bdirector(?:\/s)?\b/i },
  { canon: "Finance Manager", re: /\bfinance manager\b|\bf\.?m\.?\b|manager[,\s-]*f\s*&?\s*a\b|f\s*&?\s*a manager/i },
  { canon: "HR Manager", re: /\bhr manager\b/i },
  { canon: "CFO", re: /\bcfo\b|chief financial officer/i },
  { canon: "CEO", re: /\bceo\b|chief executive officer/i },
  { canon: "Contract Manager", re: /\bcontract manager\b/i },
  { canon: "Team Lead", re: /\bteam lead(?:s)?\b/i },
  { canon: "Supervisor", re: /\b(?:direct )?supervisor\b/i },
  { canon: "Head of Department", re: /\bhead of department\b|\bhod\b|department head\b/i },
  { canon: "Partner", re: /\bpartner\b/i },
  { canon: "Manager", re: /\bmanager(?:s)?\b/i },
  { canon: "Accountant", re: /\baccountant\b/i },
  { canon: "Officer", re: /\bofficer\b/i },
  { canon: "Coordinator", re: /\bcoordinator\b/i },
  { canon: "Authorised Signatory", re: /\bauthori[sz]ed signatory\b/i },
];

// Return the distinct canonical designations mentioned in a piece of text.
export function rolesIn(text: string): string[] {
  if (!text) return [];
  let work = " " + text + " ";
  const found: string[] = [];
  for (const { canon, re } of ROLE_LEXICON) {
    const m = work.match(re);
    if (m) {
      found.push(canon);
      // mask the matched span so a generic pattern can't re-match it
      work = work.replace(re, " ".repeat(m[0].length));
    }
  }
  return [...new Set(found)];
}

const AUTHORITY_HEADER =
  /(signatory (?:policy|authority)|value threshold|approval (?:matrix|authority)|authorisation matrix|authorization matrix|delegation of authority|approval limits)/i;

// Parse value bands like "up to Rs 40,000", "over INR 8,00,000", "exceeding 40,00,000".
function parseBand(line: string, roles: string[]): AuthorityBand | null {
  const low = line.toLowerCase();
  const amt = parseAmount(line);
  if (!amt) return null;
  const band: AuthorityBand = { roles, raw: line };
  if (/\b(up to|upto|not exceeding|less than|below|maximum of)\b/.test(low)) band.maxAmount = amt.value;
  else if (/\b(over|above|exceeding|more than|greater than)\b/.test(low)) band.minAmount = amt.value;
  else band.maxAmount = amt.value;
  return band;
}

function parseAuthorityRules(lines: string[]): AuthorityRule[] {
  const rules: AuthorityRule[] = [];
  // Locate signatory/authority sections; if none flagged, still scan lines that
  // clearly pair an action with a designation.
  const headerIdx: number[] = [];
  lines.forEach((l, i) => {
    if (AUTHORITY_HEADER.test(l)) headerIdx.push(i);
  });

  const inSection = (i: number) =>
    headerIdx.length === 0 ||
    headerIdx.some((h) => i >= h && i <= h + 80); // matrices are long tables

  for (let i = 0; i < lines.length; i += 1) {
    if (!inSection(i)) continue;
    const l = lines[i];
    // A candidate row: mentions a designation AND reads like an action/label,
    // OR contains a value band with a role nearby.
    const roles = rolesIn(l);
    const hasActionish =
      /(lease|renewal|agreement|mou|purchase|order|requisition|payment|voucher|cheque|check|transfer|bank|contract|advance|expense|reimburse|procure|subaward|subcontract|travel|invoice|writeoff|write-off|disposal|budget)/i.test(
        l
      );
    if (roles.length === 0 && !/\b(up to|over|exceeding|above|not exceeding)\b/i.test(l)) continue;

    // Prefer designation(s) on the same line as the action; only look ahead
    // when the row itself names none (extracted PDF tables sometimes wrap the
    // role onto the next line). This avoids absorbing the next matrix row.
    const windowLines = [l, lines[i + 1] || "", lines[i + 2] || ""];
    const sameLineRoles = rolesIn(l);
    const windowRoles =
      sameLineRoles.length > 0
        ? sameLineRoles
        : [...new Set([rolesIn(lines[i + 1] || ""), rolesIn(lines[i + 2] || "")].flat())];
    if (windowRoles.length === 0) continue;
    if (!hasActionish && !AUTHORITY_HEADER.test(lines[headerIdx.find((h) => i >= h) ?? -1] || "")) {
      // Without an action word and outside an explicit matrix, skip generic mentions.
      if (headerIdx.length === 0) continue;
    }

    // Value bands are taken ONLY from the rule's own line, so a neighbouring
    // matrix row's thresholds cannot bleed into this rule.
    const bands: AuthorityBand[] = [];
    if (/\b(up to|upto|over|above|exceeding|not exceeding|less than)\b/i.test(l)) {
      const b = parseBand(l, rolesIn(l));
      if (b && b.roles.length) bands.push(b);
    }

    const label = l.replace(/\s{2,}/g, " ").replace(/\bn\/a\b/i, "").trim().slice(0, 90);
    // Levels: count distinct roles joined by "and"/"with"/"&" in the row window.
    const joined = windowLines.join(" ");
    const levels = /\b(and|with|then|followed by|&)\b/i.test(joined) && windowRoles.length > 1
      ? Math.min(windowRoles.length, 3)
      : 1;

    rules.push({
      id: newId("auth"),
      label: label || windowRoles.join(", "),
      keywords: keywordsOf(windowLines.join(" ")),
      roles: windowRoles,
      levels,
      bands,
      raw: l,
      clause: clauseOf(l, i),
      lineIndex: i,
    });
  }

  // Merge rows that govern the SAME action (e.g. a "Purchase Request" whose
  // value bands are split across several lines) so their bands/roles combine.
  const byAction = new Map<string, AuthorityRule>();
  const standalone: AuthorityRule[] = [];
  for (const r of rules) {
    const key = actionKey(r.label);
    if (key.length < 4) {
      standalone.push(r);
      continue;
    }
    const existing = byAction.get(key);
    if (!existing) {
      byAction.set(key, { ...r, roles: [...r.roles], bands: [...r.bands] });
    } else {
      existing.roles = [...new Set([...existing.roles, ...r.roles])];
      existing.bands = [...existing.bands, ...r.bands];
      existing.levels = Math.max(existing.levels, r.levels);
      existing.keywords = [...new Set([...existing.keywords, ...r.keywords])];
    }
  }
  return [...byAction.values(), ...standalone];
}

// A stable key for the action a rule governs — strips value bands, amounts and
// designation words so different bands of the same action collapse together.
function actionKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\b(up to|upto|over|above|exceeding|not exceeding|less than|any value|any amount|n\/a)\b/g, " ")
    .replace(/(rs\.?|inr|₹)\s*[0-9,]+/g, " ")
    .replace(/\b[0-9][0-9,]*\b/g, " ")
    .replace(
      /\b(managing director|project director|associate director|contract manager|director|finance manager|manager|supervisor|team lead|cfo|ceo|hod|officer|coordinator|accountant|partner|authori[sz]ed signatory|md|pd|fm|f&o|hr)\b/g,
      " "
    )
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
