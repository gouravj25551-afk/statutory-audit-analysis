// ---------------------------------------------------------------------------
// Excel working-paper generator.
//
// This turns the SAME structured audit result the website already computes
// (lib/engine.ts -> VoucherAnalysis, held in the store) into a professional
// multi-sheet .xlsx. It performs NO analysis of its own and calls NO AI — it
// only formats the existing `analyses` object. Website result == Excel result.
// ---------------------------------------------------------------------------

import { aggregate } from "./aggregate";
import { fmt } from "./engine";
import { buildPolicyStudy } from "./policyStudy";
import {
  CheckOutcome,
  PolicyDoc,
  VoucherAnalysis,
  VoucherDoc,
} from "./types";

const NS = "Not specified in the provided documents.";
const CND = "Cannot be determined from the provided documents.";

// A column definition for a standard tabular sheet.
interface Col {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
}

const TEAL = "FF0B5D51";
const TEAL_SOFT = "FFE4EFEC";
const ZEBRA = "FFF4F6F5";
const BORDER = "FFD8DDDA";

function srcOf(a: VoucherAnalysis): string {
  const withSrc = a.observations.find((o) => o.source) || null;
  if (withSrc && withSrc.source)
    return `${withSrc.source.docName} · ${withSrc.source.location}`;
  const ct = a.clauseTests.find((t) => t.source);
  if (ct && ct.source) return `${ct.source.docName} · ${ct.source.location}`;
  return "-";
}

function datesOf(v: VoucherDoc): string {
  const f = v.fields;
  const parts: string[] = [];
  if (f.transactionDate) parts.push(`Txn ${f.transactionDate}`);
  if (f.invoiceDate) parts.push(`Invoice ${f.invoiceDate}`);
  if (f.approvalDate) parts.push(`Approval ${f.approvalDate}`);
  if (f.paymentDate) parts.push(`Payment ${f.paymentDate}`);
  return parts.length ? parts.join(" · ") : "Not evidenced in the provided voucher.";
}

// ---------------------------------------------------------------------------

export async function buildAuditWorkbook(
  vouchers: VoucherDoc[],
  policies: PolicyDoc[],
  analyses: Record<string, VoucherAnalysis>
): Promise<ArrayBuffer> {
  const ExcelJS: any = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Statutory Audit Analysis";
  wb.created = new Date();

  const rows = vouchers.filter((v) => analyses[v.id]);
  const agg = aggregate(vouchers, policies, analyses);

  buildExecutiveSummary(wb, ExcelJS, agg);
  buildPolicyStudySheet(wb, ExcelJS, policies);
  buildMapping(wb, ExcelJS, rows, analyses);
  buildChecklist(wb, ExcelJS, rows, analyses);
  buildApproval(wb, ExcelJS, rows, analyses);
  buildClauseTesting(wb, ExcelJS, rows, analyses);
  buildObservations(wb, ExcelJS, rows, analyses);
  buildEvidence(wb, ExcelJS, rows, analyses);

  return wb.xlsx.writeBuffer();
}

// ---- shared formatting helpers -------------------------------------------

function thinBorder() {
  const s = { style: "thin", color: { argb: BORDER } };
  return { top: s, left: s, bottom: s, right: s };
}

// Create a standard filtered, frozen, bordered table sheet.
function addTableSheet(
  wb: any,
  ExcelJS: any,
  name: string,
  cols: Col[],
  data: Record<string, any>[]
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape" },
  });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Header styling
  const header = ws.getRow(1);
  header.height = 30;
  header.eachCell((cell: any) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = thinBorder();
  });

  data.forEach((d, i) => {
    const row = ws.addRow(d);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell: any, colNumber: number) => {
      cell.border = thinBorder();
      cell.font = { size: 10, name: "Calibri" };
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      const meta = cols[colNumber - 1];
      if (meta && meta.numFmt) cell.numFmt = meta.numFmt;
    });
  });

  // Auto filter across the header, freeze already set.
  ws.autoFilter = { from: "A1", to: `${colLetter(cols.length)}1` };
  return ws;
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---- Sheet 1: Executive Summary ------------------------------------------

function buildExecutiveSummary(wb: any, ExcelJS: any, agg: ReturnType<typeof aggregate>) {
  const ws = wb.addWorksheet("1. Executive Summary", {
    pageSetup: { orientation: "portrait", fitToPage: true },
  });
  ws.columns = [
    { width: 40 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
  ];

  // Title band
  ws.mergeCells("A1:F1");
  const t = ws.getCell("A1");
  t.value = "Statutory Audit — Working Paper (Auto-generated)";
  t.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:F2");
  const sub = ws.getCell("A2");
  sub.value =
    "Source-restricted: computed only from the uploaded vouchers and policies. Figures below are calculated from the analysis — no external source, no sample data.";
  sub.font = { italic: true, size: 9.5, color: { argb: "FF42504A" } };
  sub.alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(2).height = 28;

  let r = 4;
  const kv = (label: string, value: any, tone?: string) => {
    const lc = ws.getCell(`A${r}`);
    lc.value = label;
    lc.font = { bold: true, size: 10.5 };
    const vc = ws.getCell(`B${r}`);
    vc.value = value;
    vc.font = { size: 10.5, color: tone ? { argb: tone } : undefined };
    vc.alignment = { horizontal: "left" };
    lc.border = thinBorder();
    vc.border = thinBorder();
    r += 1;
  };
  ws.getCell(`A${r}`).value = "Overall";
  ws.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: TEAL } };
  r += 1;
  kv("Total vouchers", agg.totalVouchers);
  kv("Total policies", agg.totalPolicies);
  kv("Vouchers analysed (extracted)", agg.extractedVouchers);
  kv("Compliant", agg.byResult.Compliant, "FF1F7A4D");
  kv("Non-Compliant", agg.byResult["Non-Compliant"], "FFB23B3B");
  kv("Cannot Determine", agg.byResult["Cannot Determine"], "FF9A6412");
  kv("Not Applicable", agg.byResult["Not Applicable"]);
  kv("Inconclusive policy mappings", agg.inconclusiveMappings, "FF9A6412");
  kv("Total observations", agg.totalObservations, "FFB23B3B");

  r += 1;
  ws.getCell(`A${r}`).value = "Policy-wise breakdown";
  ws.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: TEAL } };
  r += 1;

  const headers = ["Policy", "Vouchers", "Compliant", "Non-Compliant", "Cannot Determine", "Observations"];
  headers.forEach((h, i) => {
    const c = ws.getCell(`${colLetter(i + 1)}${r}`);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.alignment = { wrapText: true, vertical: "middle" };
    c.border = thinBorder();
  });
  ws.getRow(r).height = 26;
  r += 1;
  const startPolicyRows = r;
  agg.perPolicy.forEach((p) => {
    const vals = [p.policyName, p.vouchers, p.compliant, p.nonCompliant, p.cannotDetermine, p.observations];
    vals.forEach((v, i) => {
      const c = ws.getCell(`${colLetter(i + 1)}${r}`);
      c.value = v;
      c.font = { size: 10 };
      c.border = thinBorder();
      c.alignment = { wrapText: true, vertical: "top" };
    });
    r += 1;
  });
  if (agg.unmapped > 0) {
    const vals = ["Unmapped / inconclusive", agg.unmapped, "-", "-", "-", "-"];
    vals.forEach((v, i) => {
      const c = ws.getCell(`${colLetter(i + 1)}${r}`);
      c.value = v;
      c.font = { size: 10, italic: true };
      c.border = thinBorder();
    });
    r += 1;
  }
  if (r === startPolicyRows) {
    ws.getCell(`A${r}`).value = "No extracted policies.";
    ws.getCell(`A${r}`).font = { italic: true, size: 10 };
  }

  ws.views = [{ state: "frozen", ySplit: 3 }];
}

// ---- Sheet 1b: Policy Study ----------------------------------------------

function buildPolicyStudySheet(wb: any, ExcelJS: any, policies: PolicyDoc[]) {
  const cols: Col[] = [
    { header: "Policy", key: "pol", width: 26 },
    { header: "Effective Date", key: "eff", width: 16 },
    { header: "Study Section", key: "sec", width: 30 },
    { header: "Requirement (as stated in the policy)", key: "req", width: 70 },
    { header: "Reference", key: "ref", width: 18 },
  ];
  const data: Record<string, any>[] = [];
  policies
    .filter((p) => p.status === "extracted")
    .forEach((p) => {
      const study = buildPolicyStudy(p);
      if (study.sections.length === 0) {
        data.push({
          pol: study.name,
          eff: study.effectiveDate || "Not specified",
          sec: "-",
          req: "No structured requirements extracted from this document.",
          ref: "-",
        });
        return;
      }
      let firstOfPolicy = true;
      study.sections.forEach((s) => {
        s.entries.forEach((e, i) => {
          data.push({
            pol: firstOfPolicy ? study.name : "",
            eff: firstOfPolicy ? study.effectiveDate || "Not specified" : "",
            sec: i === 0 ? s.title : "",
            req: e.text,
            ref: e.ref,
          });
          firstOfPolicy = false;
        });
      });
    });
  addTableSheet(wb, ExcelJS, "1b. Policy Study", cols, data);
}

// ---- Sheet 2: Voucher–Policy Mapping -------------------------------------

function buildMapping(
  wb: any,
  ExcelJS: any,
  rows: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
) {
  const cols: Col[] = [
    { header: "Voucher No.", key: "no", width: 16 },
    { header: "Voucher Date", key: "date", width: 14 },
    { header: "Description", key: "desc", width: 40 },
    { header: "Amount", key: "amt", width: 16, numFmt: "#,##0.00" },
    { header: "Applicable Policy", key: "pol", width: 26 },
    { header: "Basis of Mapping", key: "basis", width: 60 },
    { header: "Policy Reference", key: "ref", width: 24 },
    { header: "Mapping Result", key: "res", width: 16 },
  ];
  const data = rows.map((v) => {
    const a = analyses[v.id];
    return {
      no: v.fields.voucherNo || v.fileName,
      date: v.fields.voucherDate || "",
      desc: v.fields.description || v.fields.nature || NS,
      amt: v.fields.amount ?? null,
      pol: a.applicablePolicyName || CND,
      basis: a.mappingBasis,
      ref: a.conclusive
        ? a.clauseTests.map((t) => t.clause).slice(0, 4).join(", ") || NS
        : "-",
      res: a.conclusive ? "Mapped" : "Inconclusive",
    };
  });
  addTableSheet(wb, ExcelJS, "2. Voucher-Policy Mapping", cols, data);
}

// ---- Sheet 3: Detailed Audit Checklist (32 columns) ----------------------

function buildChecklist(
  wb: any,
  ExcelJS: any,
  rows: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
) {
  const cols: Col[] = [
    { header: "Sr. No.", key: "sr", width: 7 },
    { header: "Voucher No.", key: "vno", width: 14 },
    { header: "Voucher Date", key: "vdate", width: 13 },
    { header: "Transaction Date", key: "tdate", width: 14 },
    { header: "Description", key: "desc", width: 34 },
    { header: "Amount", key: "amt", width: 15, numFmt: "#,##0.00" },
    { header: "Applicable Policy", key: "pol", width: 22 },
    { header: "Policy Clause / Reference", key: "clause", width: 22 },
    { header: "Policy Requirement", key: "preq", width: 40 },
    { header: "Voucher Evidence", key: "vev", width: 36 },
    { header: "Eligibility Requirement", key: "elreq", width: 30 },
    { header: "Eligibility Result", key: "elres", width: 15 },
    { header: "Amount Requirement", key: "amreq", width: 28 },
    { header: "Amount Compliance", key: "amres", width: 15 },
    { header: "Approval Required", key: "aprq", width: 14 },
    { header: "Required Approver(s)", key: "reqapp", width: 30 },
    { header: "Actual Approver(s)", key: "actapp", width: 24 },
    { header: "Required Approval Level", key: "reqlvl", width: 22 },
    { header: "Actual Approval Level", key: "actlvl", width: 22 },
    { header: "Required Approval Timing", key: "reqtim", width: 28 },
    { header: "Actual Approval Date/Time", key: "acttim", width: 22 },
    { header: "Approval Compliance", key: "apres", width: 16 },
    { header: "Supporting Document Requirement", key: "sdreq", width: 30 },
    { header: "Supporting Document Available", key: "sdav", width: 30 },
    { header: "Other Policy Requirement", key: "oreq", width: 30 },
    { header: "Compliance Status", key: "cstat", width: 16 },
    { header: "Exception", key: "exc", width: 10 },
    { header: "Exception Type", key: "exct", width: 26 },
    { header: "Auditor Observation", key: "obs", width: 44 },
    { header: "Source Reference", key: "src", width: 26 },
    { header: "Final Conclusion", key: "fin", width: 16 },
    { header: "Auditor Remarks", key: "rem", width: 24 },
  ];
  const data = rows.map((v, idx) => {
    const a = analyses[v.id];
    const f = v.fields;
    const other = a.clauseTests.find((t) => t.requirementType === "other");
    const exTypes = [...new Set(a.observations.map((o) => o.exceptionType))].join("; ");
    const obsText = a.observations.map((o) => o.exactDeviation).slice(0, 3).join("  |  ");
    return {
      sr: idx + 1,
      vno: f.voucherNo || v.fileName,
      vdate: f.voucherDate || "",
      tdate: f.transactionDate || "",
      desc: f.description || f.nature || NS,
      amt: f.amount ?? null,
      pol: a.applicablePolicyName || CND,
      clause: a.conclusive ? a.clauseTests.map((t) => t.clause).slice(0, 5).join(", ") || NS : "-",
      preq: a.conclusive ? a.clauseTests.map((t) => t.requirement).slice(0, 3).join("  |  ") || NS : NS,
      vev: evidenceSummary(a),
      elreq: a.eligibilityCheck.requirement,
      elres: a.eligibilityCheck.result,
      amreq: a.amountCheck.applicable ? a.amountCheck.requirement : "No amount limit specified in the provided policy.",
      amres: a.amountCheck.result,
      aprq: a.approvalCheck.applicable ? "Yes" : "Approval requirement not specified in the provided policy.",
      reqapp: a.approvalCheck.applicable
        ? a.approvalCheck.requiredApprover || a.approvalCheck.requirement
        : NS,
      actapp: a.approvalCheck.actualApprover || f.approver || "Approval cannot be verified from the provided voucher.",
      reqlvl: a.approvalCheck.applicable && a.approvalCheck.requiredLevels
        ? `${a.approvalCheck.requiredLevels} level(s)`
        : NS,
      actlvl: a.approvalCheck.actualLevels
        ? `${a.approvalCheck.actualLevels} sign-off(s) on voucher`
        : "Not evidenced in the provided voucher.",
      reqtim: a.timingCheck.applicable ? a.timingCheck.requirement : "No applicable timing requirement specified in the provided policy.",
      acttim: f.approvalDate || datesOf(v),
      apres: a.approvalCheck.result,
      sdreq: a.supportingCheck.applicable ? a.supportingCheck.requirement : "Not required by the provided policy.",
      sdav: f.supportingDocs.length ? f.supportingDocs.join("; ") : "None mentioned in the voucher.",
      oreq: other ? other.requirement : NS,
      cstat: a.finalConclusion,
      exc: a.observations.length ? "Yes" : "No",
      exct: exTypes || "-",
      obs: obsText || "No exception identified from the provided documents.",
      src: srcOf(a),
      fin: a.finalConclusion,
      rem: "",
    };
  });
  const ws = addTableSheet(wb, ExcelJS, "3. Detailed Audit Checklist", cols, data);
  // Color-code the Final Conclusion + Compliance Status columns.
  colorResultColumn(ws, cols, "cstat", data.length);
  colorResultColumn(ws, cols, "fin", data.length);
  colorResultColumn(ws, cols, "apres", data.length);
}

function evidenceSummary(a: VoucherAnalysis): string {
  const bits: string[] = [];
  if (a.amountCheck.voucherEvidence) bits.push(a.amountCheck.voucherEvidence);
  if (a.approvalCheck.voucherEvidence) bits.push(a.approvalCheck.voucherEvidence);
  return bits.filter(Boolean).slice(0, 2).join("  |  ") || "See working paper.";
}

// ---- Sheet 4: Approval Verification --------------------------------------

function buildApproval(
  wb: any,
  ExcelJS: any,
  rows: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
) {
  const cols: Col[] = [
    { header: "Voucher", key: "v", width: 16 },
    { header: "Applicable Policy", key: "pol", width: 24 },
    { header: "Approval Required?", key: "req", width: 30 },
    { header: "Required Approver(s)", key: "reqapp", width: 34 },
    { header: "Actual Approver(s)", key: "actapp", width: 26 },
    { header: "Required Approval Level", key: "reqlvl", width: 22 },
    { header: "Actual Approval Level", key: "actlvl", width: 22 },
    { header: "Required Timing", key: "reqtim", width: 30 },
    { header: "Actual Approval Date/Time", key: "acttim", width: 24 },
    { header: "Correct Authority?", key: "auth", width: 18 },
    { header: "Timing Compliant?", key: "tim", width: 18 },
    { header: "Approval Evidence", key: "ev", width: 34 },
    { header: "Conclusion", key: "conc", width: 18 },
  ];
  const data = rows.map((v) => {
    const a = analyses[v.id];
    const f = v.fields;
    const ap = a.approvalCheck;
    const tc = a.timingCheck;
    const ev = f.approver
      ? `Approved by: ${f.approver}${f.approvalDate ? ` on ${f.approvalDate}` : ""}`
      : "Approval cannot be verified from the provided voucher.";
    const reqTiming = ap.priorApprovalRequired
      ? "Prior approval required (before the transaction)"
      : tc.applicable
      ? tc.requirement
      : "No applicable timing requirement specified in the provided policy.";
    return {
      v: f.voucherNo || v.fileName,
      pol: a.applicablePolicyName || CND,
      req: ap.applicable
        ? (ap.amountDrivesAuthority ? "Yes (approver depends on amount)" : "Yes")
        : "Approval requirement not specified in the provided policy.",
      reqapp: ap.applicable ? ap.requiredApprover || ap.requirement : NS,
      actapp: ap.actualApprover || f.approver || "Not evidenced in the provided voucher.",
      reqlvl: ap.applicable && ap.requiredLevels ? `${ap.requiredLevels} level(s)` : NS,
      actlvl: ap.actualLevels ? `${ap.actualLevels} sign-off(s)` : "Not evidenced",
      reqtim: reqTiming,
      acttim: f.approvalDate || datesOf(v),
      auth: ap.applicable ? ap.correctAuthority || ap.result : "Not Applicable",
      tim: tc.applicable ? tc.result : "Not Applicable",
      ev,
      conc: a.finalConclusion,
    };
  });
  const ws = addTableSheet(wb, ExcelJS, "4. Approval Verification", cols, data);
  colorResultColumn(ws, cols, "auth", data.length);
  colorResultColumn(ws, cols, "tim", data.length);
  colorResultColumn(ws, cols, "conc", data.length);
}

// ---- Sheet 5: Clause-by-Clause Testing -----------------------------------

function buildClauseTesting(
  wb: any,
  ExcelJS: any,
  rows: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
) {
  const cols: Col[] = [
    { header: "Voucher", key: "v", width: 16 },
    { header: "Policy", key: "pol", width: 24 },
    { header: "Clause / Section", key: "clause", width: 18 },
    { header: "Policy Requirement", key: "req", width: 52 },
    { header: "Voucher Evidence", key: "ev", width: 46 },
    { header: "Compliance Status", key: "res", width: 16 },
    { header: "Source Reference", key: "src", width: 28 },
  ];
  const data: Record<string, any>[] = [];
  rows.forEach((v) => {
    const a = analyses[v.id];
    const vno = v.fields.voucherNo || v.fileName;
    if (a.clauseTests.length === 0) {
      data.push({
        v: vno,
        pol: a.applicablePolicyName || CND,
        clause: "-",
        req: "No applicable policy determined — no clauses tested.",
        ev: CND,
        res: "Cannot Determine",
        src: "-",
      });
      return;
    }
    a.clauseTests.forEach((t) => {
      data.push({
        v: vno,
        pol: a.applicablePolicyName || CND,
        clause: t.clause,
        req: t.requirement,
        ev: t.voucherEvidence,
        res: t.result,
        src: t.source ? `${t.source.docName} · ${t.source.location}` : "-",
      });
    });
  });
  const ws = addTableSheet(wb, ExcelJS, "5. Clause-by-Clause Testing", cols, data);
  colorResultColumn(ws, cols, "res", data.length);
}

// ---- Sheet 6: Observation Register ---------------------------------------

function buildObservations(
  wb: any,
  ExcelJS: any,
  rows: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
) {
  const cols: Col[] = [
    { header: "Observation No.", key: "n", width: 14 },
    { header: "Voucher No.", key: "v", width: 16 },
    { header: "Policy", key: "pol", width: 24 },
    { header: "Policy Clause", key: "clause", width: 16 },
    { header: "Policy Requirement", key: "req", width: 46 },
    { header: "Actual Evidence", key: "ev", width: 40 },
    { header: "Exact Deviation", key: "dev", width: 50 },
    { header: "Conclusion", key: "conc", width: 18 },
    { header: "Source Reference", key: "src", width: 28 },
  ];
  const data: Record<string, any>[] = [];
  let n = 0;
  rows.forEach((v) => {
    const a = analyses[v.id];
    a.observations.forEach((o) => {
      n += 1;
      data.push({
        n,
        v: o.voucherNo,
        pol: o.policyName,
        clause: o.clause,
        req: o.policyRequirement,
        ev: o.voucherEvidence,
        dev: o.exactDeviation,
        conc: o.conclusion,
        src: o.source ? `${o.source.docName} · ${o.source.location}` : "-",
      });
    });
  });
  if (data.length === 0) {
    data.push({
      n: "-", v: "-", pol: "-", clause: "-",
      req: "-", ev: "-",
      dev: "No exception identified from the provided documents.",
      conc: "-", src: "-",
    });
  }
  const ws = addTableSheet(wb, ExcelJS, "6. Observation Register", cols, data);
  colorResultColumn(ws, cols, "conc", data.length);
}

// ---- Sheet 7: Evidence Matrix --------------------------------------------

function buildEvidence(
  wb: any,
  ExcelJS: any,
  rows: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
) {
  const cols: Col[] = [
    { header: "Voucher", key: "v", width: 16 },
    { header: "Policy", key: "pol", width: 24 },
    { header: "Requirement", key: "type", width: 20 },
    { header: "Required Evidence", key: "req", width: 46 },
    { header: "Evidence Available", key: "av", width: 40 },
    { header: "Verification Result", key: "res", width: 16 },
    { header: "Source Reference", key: "src", width: 28 },
  ];
  const data: Record<string, any>[] = [];
  const push = (
    v: VoucherDoc,
    a: VoucherAnalysis,
    label: string,
    c: CheckOutcome
  ) => {
    data.push({
      v: v.fields.voucherNo || v.fileName,
      pol: a.applicablePolicyName || CND,
      type: label,
      req: c.requirement,
      av: c.voucherEvidence,
      res: c.result,
      src: c.clause && c.clause !== "-" ? c.clause : srcOf(a),
    });
  };
  rows.forEach((v) => {
    const a = analyses[v.id];
    push(v, a, "Eligibility", a.eligibilityCheck);
    push(v, a, "Amount limit", a.amountCheck);
    push(v, a, "Approval", a.approvalCheck);
    push(v, a, "Timing", a.timingCheck);
    push(v, a, "Supporting documents", a.supportingCheck);
  });
  const ws = addTableSheet(wb, ExcelJS, "7. Evidence Matrix", cols, data);
  colorResultColumn(ws, cols, "res", data.length);
}

// ---- result colour coding -------------------------------------------------

function colorResultColumn(ws: any, cols: Col[], key: string, count: number) {
  const idx = cols.findIndex((c) => c.key === key);
  if (idx < 0) return;
  const letter = colLetter(idx + 1);
  for (let i = 0; i < count; i += 1) {
    const cell = ws.getCell(`${letter}${i + 2}`);
    const v = String(cell.value || "");
    let argb: string | null = null;
    if (v === "Compliant") argb = "FF1F7A4D";
    else if (v === "Non-Compliant") argb = "FFB23B3B";
    else if (v === "Cannot Determine") argb = "FF9A6412";
    else if (v === "Not Applicable") argb = "FF5F6B66";
    if (argb) cell.font = { size: 10, bold: true, color: { argb } };
  }
}
