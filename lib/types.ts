// ---------------------------------------------------------------------------
// Type definitions for the document-driven statutory audit analysis engine.
//
// Every conclusion the engine produces must be traceable to text that exists
// in an uploaded voucher or an uploaded policy. There is no third source.
// ---------------------------------------------------------------------------

export type DocStatus = "uploaded" | "processing" | "extracted" | "failed";

export type Result =
  | "Compliant"
  | "Non-Compliant"
  | "Cannot Determine"
  | "Not Applicable";

export type MatchResult = "Match" | "No Match" | "Cannot Determine";

// A pointer back to the exact place a fact was found.
export interface EvidenceRef {
  docId: string;
  docName: string;
  docKind: "voucher" | "policy";
  snippet: string; // the actual line/text from the document
  location: string; // e.g. "Line 12" or "Clause 3.2"
}

// ---- Vouchers -------------------------------------------------------------

export interface VoucherFields {
  voucherNo?: string;
  voucherDate?: string;
  transactionDate?: string;
  invoiceDate?: string;
  paymentDate?: string;
  amount?: number;
  amountRaw?: string;
  description?: string;
  nature?: string;
  party?: string; // employee / vendor / customer / person
  department?: string;
  approver?: string;
  approvalDate?: string;
  supportingDocs: string[];
  invoiceDetails?: string;
  policyReference?: string;
}

export interface VoucherDoc {
  id: string;
  fileName: string;
  status: DocStatus;
  error?: string;
  text: string;
  lines: string[];
  fields: VoucherFields;
  fieldEvidence: Record<string, EvidenceRef>;
}

// ---- Policies -------------------------------------------------------------

export type RequirementType =
  | "amountLimit"
  | "approval"
  | "eligibility"
  | "supportingDoc"
  | "timing"
  | "other";

export interface PolicyRequirement {
  id: string;
  type: RequirementType;
  label: string; // human-readable requirement text
  clause: string; // clause / section reference where possible
  amountLimit?: number; // parsed limit for amountLimit requirements
  timingDays?: number; // parsed number of days for timing requirements
  keywords: string[]; // distinctive terms used for mapping / testing
  raw: string; // the exact source line
  lineIndex: number;
}

export interface PolicyDoc {
  id: string;
  name: string;
  fileName: string;
  status: DocStatus;
  error?: string;
  text: string;
  lines: string[];
  effectiveDate?: string;
  scope?: string;
  keywords: string[]; // distinctive vocabulary of the whole policy
  requirements: PolicyRequirement[];
  authorityRules: AuthorityRule[]; // parsed signatory / approval-authority matrix
}

// A single row of an approval-authority ("signatory") matrix found in a policy:
// e.g. "Office & Warehouse Leases → MD", or a value-banded rule
// "Purchase Request: up to 40,000 → Managers; over 800,000 → MD".
export interface AuthorityRule {
  id: string;
  label: string; // the document / action the rule governs
  keywords: string[]; // words used to match this rule to a voucher
  roles: string[]; // required approver designation(s), canonicalised
  levels: number; // number of distinct approval levels the rule states
  bands: AuthorityBand[]; // value-dependent authority, if any
  raw: string;
  clause: string;
  lineIndex: number;
}

export interface AuthorityBand {
  minAmount?: number;
  maxAmount?: number;
  roles: string[];
  raw: string;
}

// ---- Analysis output ------------------------------------------------------

export interface PolicyComparison {
  policyId: string;
  policyName: string;
  matchScore: number;
  matchedTerms: string[];
  relevantClause: string;
  requirement: string;
  voucherEvidence: string;
  match: MatchResult;
}

export interface ClauseTest {
  clause: string;
  requirementType: RequirementType;
  requirement: string;
  voucherEvidence: string;
  result: Result;
  source: EvidenceRef | null;
}

export interface CheckOutcome {
  applicable: boolean; // does the policy state such a requirement?
  requirement: string; // what the policy requires (or "not specified")
  clause: string;
  voucherEvidence: string; // what the voucher shows (or "not evidenced")
  result: Result;
  note?: string;

  // --- richer approval-authority reasoning (populated for approvalCheck) ---
  requiredApprover?: string; // designation(s) the policy requires, human-readable
  actualApprover?: string; // approver named on the voucher
  requiredLevels?: number; // approval levels the policy states
  actualLevels?: number; // approval sign-offs evidenced on the voucher
  correctAuthority?: Result; // was the correct designation involved?
  authorityBasis?: string; // which authority-matrix row / clause drove this
  amountDrivesAuthority?: boolean; // does the amount change the required approver?
  priorApprovalRequired?: boolean; // must approval precede the transaction?
}

export type MissingKind =
  | "Not specified"
  | "Not evidenced"
  | "Cannot Determine"
  | "Contradictory"
  | "OK";

export interface Observation {
  id: string;
  voucherId: string;
  voucherNo: string;
  policyName: string;
  clause: string;
  policyRequirement: string;
  voucherEvidence: string;
  exactDeviation: string;
  conclusion: Result;
  exceptionType: string;
  missingKind: MissingKind;
  source: EvidenceRef | null;
}

export interface VoucherAnalysis {
  voucherId: string;
  comparisons: PolicyComparison[];
  applicablePolicyId?: string;
  applicablePolicyName?: string;
  mappingBasis: string;
  conclusive: boolean;
  clauseTests: ClauseTest[];
  amountCheck: CheckOutcome;
  approvalCheck: CheckOutcome;
  timingCheck: CheckOutcome;
  supportingCheck: CheckOutcome;
  eligibilityCheck: CheckOutcome;
  observations: Observation[];
  finalConclusion: Result;
}
