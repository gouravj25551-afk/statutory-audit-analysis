import { fmt } from "./engine";
import { VoucherAnalysis, VoucherDoc } from "./types";

export const CHECKLIST_COLUMNS = [
  "Sr. No.",
  "Voucher No.",
  "Voucher Date",
  "Transaction Date",
  "Description",
  "Amount",
  "Applicable Policy",
  "Basis for Policy Mapping",
  "Policy Clause / Reference",
  "Policy Requirement",
  "Eligibility Requirement",
  "Eligibility Result",
  "Amount Limit",
  "Amount Compliance",
  "Required Approval",
  "Actual Approver",
  "Approval Date",
  "Approval Compliance",
  "Timing Requirement",
  "Timing Compliance",
  "Required Supporting Documents",
  "Documents Available",
  "Other Explicit Policy Requirement",
  "Compliance Status",
  "Exception Identified",
  "Exception Type",
  "Auditor Observation",
  "Source Evidence",
  "Management Explanation",
  "Final Conclusion",
  "Auditor Remarks",
] as const;

export type ChecklistRow = Record<string, string>;

const NS = "Not specified in the provided documents.";

export function buildChecklistRows(
  vouchers: VoucherDoc[],
  analyses: Record<string, VoucherAnalysis>
): ChecklistRow[] {
  const rows: ChecklistRow[] = [];
  let sr = 0;
  for (const v of vouchers) {
    const a = analyses[v.id];
    if (!a) continue;
    sr += 1;
    const f = v.fields;

    const otherReq = a.clauseTests.find((t) => t.requirementType === "other");
    const obs = a.observations[0];
    const exceptionTypes = [...new Set(a.observations.map((o) => o.exceptionType))].join("; ");
    const observationText = a.observations
      .map((o) => o.exactDeviation)
      .slice(0, 2)
      .join(" | ");
    const src = a.observations.find((o) => o.source)?.source;

    rows.push({
      "Sr. No.": String(sr),
      "Voucher No.": f.voucherNo || v.fileName,
      "Voucher Date": f.voucherDate || "",
      "Transaction Date": f.transactionDate || "",
      Description: f.description || f.nature || "",
      Amount: f.amount != null ? fmt(f.amount) : "",
      "Applicable Policy": a.applicablePolicyName || "Cannot Determine",
      "Basis for Policy Mapping": a.mappingBasis,
      "Policy Clause / Reference": a.conclusive
        ? a.clauseTests.map((t) => t.clause).slice(0, 4).join(", ") || NS
        : "—",
      "Policy Requirement": a.conclusive
        ? a.clauseTests.map((t) => t.requirement).slice(0, 2).join(" | ") || NS
        : NS,
      "Eligibility Requirement": a.eligibilityCheck.requirement,
      "Eligibility Result": a.eligibilityCheck.result,
      "Amount Limit": a.amountCheck.applicable ? a.amountCheck.requirement : "No amount limit specified",
      "Amount Compliance": a.amountCheck.result,
      "Required Approval": a.approvalCheck.requirement,
      "Actual Approver": f.approver || "",
      "Approval Date": f.approvalDate || "",
      "Approval Compliance": a.approvalCheck.result,
      "Timing Requirement": a.timingCheck.requirement,
      "Timing Compliance": a.timingCheck.result,
      "Required Supporting Documents": a.supportingCheck.applicable
        ? a.supportingCheck.requirement
        : "Not required by policy",
      "Documents Available":
        f.supportingDocs.length > 0 ? f.supportingDocs.join("; ") : "None mentioned in voucher",
      "Other Explicit Policy Requirement": otherReq ? otherReq.requirement : NS,
      "Compliance Status": a.finalConclusion,
      "Exception Identified": a.observations.length > 0 ? "Yes" : "No",
      "Exception Type": exceptionTypes || "—",
      "Auditor Observation": observationText || "No exception identified from the documents.",
      "Source Evidence": src ? `${src.docName} · ${src.location}` : "—",
      "Management Explanation": "", // to be captured by the auditor; not in documents
      "Final Conclusion": a.finalConclusion,
      "Auditor Remarks": "", // auditor's own note; not derivable from documents
    });
  }
  return rows;
}
