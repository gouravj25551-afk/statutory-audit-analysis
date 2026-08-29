// ---------------------------------------------------------------------------
// The comparison engine.
//
// Golden rule enforced here: every conclusion is derived ONLY from text found
// in an uploaded voucher or an uploaded policy. When the documents do not
// support a conclusion, the engine returns an explicit "Not specified" /
// "Not evidenced" / "Cannot Determine" outcome instead of guessing.
// ---------------------------------------------------------------------------

import { newId, rolesIn } from "./extract";
import {
  AuthorityRule,
  CheckOutcome,
  ClauseTest,
  EvidenceRef,
  Observation,
  PolicyComparison,
  PolicyDoc,
  PolicyRequirement,
  Result,
  VoucherAnalysis,
  VoucherDoc,
} from "./types";

const NOT_SPECIFIED = "Not specified in the provided documents.";
const NOT_EVIDENCED = "Not evidenced in the provided voucher.";
const CANNOT = "Cannot be determined from the provided documents.";

function policyEv(p: PolicyDoc, req: PolicyRequirement): EvidenceRef {
  return {
    docId: p.id,
    docName: p.name || p.fileName,
    docKind: "policy",
    snippet: req.raw,
    location: req.clause,
  };
}

// Distinctive terms of a policy: its own keywords minus terms shared by *all*
// policies (so mapping keys on what makes a policy different, e.g. "travel").
function distinctiveTerms(policy: PolicyDoc, all: PolicyDoc[]): string[] {
  const others = all.filter((p) => p.id !== policy.id);
  const shared = new Set<string>();
  for (const term of policy.keywords) {
    const inAll = others.length > 0 && others.every((p) => p.keywords.includes(term));
    if (inAll) shared.add(term);
  }
  const nameTerms = (policy.name || "")
    .toLowerCase()
    .match(/[a-z]{3,}/g) || [];
  return [...new Set([...nameTerms, ...policy.keywords])].filter(
    (t) => !shared.has(t) && t !== "policy"
  );
}

// ---- Policy <-> Voucher mapping ------------------------------------------

function compareToPolicy(
  voucher: VoucherDoc,
  policy: PolicyDoc,
  all: PolicyDoc[]
): PolicyComparison {
  const terms = distinctiveTerms(policy, all);
  const vtext = voucher.text.toLowerCase();
  const matched = terms.filter((t) => new RegExp(`\\b${escapeRe(t)}\\b`).test(vtext));

  // Locate the most relevant requirement (one whose keyword appears in voucher).
  let relevant: PolicyRequirement | undefined = policy.requirements.find((r) =>
    r.keywords.some((k) => matched.includes(k))
  );
  if (!relevant) relevant = policy.requirements[0];

  const score = matched.length;
  let match: PolicyComparison["match"] = "Cannot Determine";
  if (score >= 2) match = "Match";
  else if (score === 0) match = "No Match";

  return {
    policyId: policy.id,
    policyName: policy.name || policy.fileName,
    matchScore: score,
    matchedTerms: matched.slice(0, 8),
    relevantClause: relevant?.clause || NOT_SPECIFIED,
    requirement: relevant?.raw || NOT_SPECIFIED,
    voucherEvidence:
      matched.length > 0
        ? `Voucher text contains: ${matched.slice(0, 6).join(", ")}`
        : "No distinctive term of this policy appears in the voucher.",
    match,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- Individual compliance checks ----------------------------------------

function amountCheck(v: VoucherDoc, reqs: PolicyRequirement[]): CheckOutcome {
  const limitReq = reqs.find((r) => r.type === "amountLimit" && r.amountLimit != null);
  if (!limitReq) {
    return {
      applicable: false,
      requirement: "No amount limit specified in the provided policy.",
      clause: "-",
      voucherEvidence:
        v.fields.amount != null ? `Voucher amount: ${fmt(v.fields.amount)}` : NOT_EVIDENCED,
      result: "Not Applicable",
    };
  }
  const limit = limitReq.amountLimit!;
  if (v.fields.amount == null) {
    return {
      applicable: true,
      requirement: `Limit ${fmt(limit)} (${limitReq.clause})`,
      clause: limitReq.clause,
      voucherEvidence: "Amount not found in the voucher.",
      result: "Cannot Determine",
      note: CANNOT,
    };
  }
  const withinLimit = v.fields.amount <= limit;
  return {
    applicable: true,
    requirement: `Amount must not exceed ${fmt(limit)} (${limitReq.clause})`,
    clause: limitReq.clause,
    voucherEvidence: `Voucher amount ${fmt(v.fields.amount)}`,
    result: withinLimit ? "Compliant" : "Non-Compliant",
    note: withinLimit
      ? undefined
      : `${limitReq.clause} sets a limit of ${fmt(limit)}, whereas the voucher shows ${fmt(v.fields.amount)}.`,
  };
}

// Words describing what the voucher transaction actually is — used to match
// the voucher to the right row of the policy's approval-authority matrix.
function categoryWords(v: VoucherDoc): Set<string> {
  const src =
    (v.fields.description || "") + " " + (v.fields.nature || "") + " " + v.text.slice(0, 700);
  const out = new Set<string>();
  for (const w of src.toLowerCase().match(/[a-z][a-z]{3,}/g) || []) out.add(w);
  return out;
}

// Count how many independent approval sign-offs the voucher evidences
// (Approved by / Verified by / Checked by / Authorised signatory / Sanctioned).
function countSignoffs(text: string): number {
  const t = text.toLowerCase();
  let n = 0;
  for (const re of [
    /approved by/,
    /verified by/,
    /checked by/,
    /authori[sz]ed signatory/,
    /sanctioned by/,
    /counter-?signed/,
  ]) {
    if (re.test(t)) n += 1;
  }
  return n;
}

// Choose the authority-matrix row that best fits this voucher.
function matchAuthorityRule(v: VoucherDoc, rules: AuthorityRule[]): AuthorityRule | null {
  if (!rules || rules.length === 0) return null;
  const words = categoryWords(v);
  let best: AuthorityRule | null = null;
  let bestScore = 0;
  for (const r of rules) {
    let score = 0;
    for (const k of r.keywords) if (words.has(k)) score += 1;
    for (const lw of (r.label.toLowerCase().match(/[a-z]{4,}/g) || []))
      if (words.has(lw)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore > 0 ? best : null;
}

function rolesSatisfied(required: string[], actual: string[]): boolean {
  if (required.length === 0) return true;
  const set = new Set(actual.map((r) => r.toLowerCase()));
  return required.some((r) => set.has(r.toLowerCase()));
}

function approvalCheck(
  v: VoucherDoc,
  reqs: PolicyRequirement[],
  rules: AuthorityRule[] = []
): CheckOutcome {
  const req = reqs.find((r) => r.type === "approval");
  const rule = matchAuthorityRule(v, rules);

  // Nothing in the policy requires approval for this voucher.
  if (!req && !rule) {
    return {
      applicable: false,
      requirement: "Approval requirement not specified in the provided policy.",
      clause: "-",
      voucherEvidence: v.fields.approver ? `Approved by: ${v.fields.approver}` : "No approval detail in voucher.",
      result: "Not Applicable",
      requiredApprover: "Not specified in the provided documents.",
      actualApprover: v.fields.approver || "Not evidenced in the provided voucher.",
      correctAuthority: "Not Applicable",
    };
  }

  // Required designation(s): from the matched authority row (amount-banded if
  // the row is value-dependent), else any designation named in the approval line.
  let requiredRoles: string[] = [];
  let amountDrives = false;
  let basis = req ? `${req.clause}` : "";
  if (rule) {
    basis = `${rule.label} (${rule.clause})`;
    if (rule.bands.length > 0 && v.fields.amount != null) {
      amountDrives = true;
      const band = rule.bands.find(
        (b) =>
          (b.minAmount == null || v.fields.amount! > b.minAmount) &&
          (b.maxAmount == null || v.fields.amount! <= b.maxAmount)
      );
      requiredRoles = band ? band.roles : rule.roles;
    } else {
      requiredRoles = rule.roles;
      amountDrives = rule.bands.length > 0;
    }
  }
  if (requiredRoles.length === 0 && req) requiredRoles = rolesIn(req.raw);

  const requiredLevels = rule ? rule.levels : requiredRoles.length > 1 ? requiredRoles.length : 1;
  const priorApprovalRequired =
    /(prior|advance|before (?:the )?(?:transaction|payment|purchase|commitment))/i.test(
      (req?.raw || "") + " " + (rule?.raw || "")
    );

  const actualApprover = v.fields.approver || "";
  const actualRoles = rolesIn(actualApprover);
  const actualLevels = Math.max(countSignoffs(v.text), actualApprover ? 1 : 0);

  const requiredLabel =
    requiredRoles.length > 0 ? requiredRoles.join(" / ") : "Approval required (designation not specified in policy)";

  // No approver recorded on the voucher.
  if (!actualApprover) {
    return {
      applicable: true,
      requirement: `Approval by ${requiredLabel}${requiredLevels > 1 ? ` — ${requiredLevels} levels` : ""}${basis ? ` [${basis}]` : ""}`,
      clause: rule?.clause || req?.clause || "-",
      voucherEvidence: "Approval cannot be verified from the provided voucher.",
      result: "Cannot Determine",
      note: "Policy requires approval, but the voucher provides no named approver to test against the required authority.",
      requiredApprover: requiredLabel,
      actualApprover: "Not evidenced in the provided voucher.",
      requiredLevels,
      actualLevels,
      correctAuthority: "Cannot Determine",
      authorityBasis: basis || undefined,
      amountDrivesAuthority: amountDrives,
      priorApprovalRequired,
    };
  }

  // Policy names an approver but the voucher lists a name without a designation.
  if (requiredRoles.length > 0 && actualRoles.length === 0) {
    return {
      applicable: true,
      requirement: `Approval by ${requiredLabel}${basis ? ` [${basis}]` : ""}`,
      clause: rule?.clause || req?.clause || "-",
      voucherEvidence: `Approved by: ${actualApprover}`,
      result: "Cannot Determine",
      note: `${basis || "The policy"} requires approval by ${requiredLabel}; the voucher records approver "${actualApprover}" but states no designation, so the authority cannot be confirmed from the documents.`,
      requiredApprover: requiredLabel,
      actualApprover,
      requiredLevels,
      actualLevels,
      correctAuthority: "Cannot Determine",
      authorityBasis: basis || undefined,
      amountDrivesAuthority: amountDrives,
      priorApprovalRequired,
    };
  }

  // Policy specifies no designation — we can only confirm an approver exists.
  if (requiredRoles.length === 0) {
    return {
      applicable: true,
      requirement: `${req ? req.raw : "Approval required"}${req ? ` (${req.clause})` : ""}`,
      clause: req?.clause || rule?.clause || "-",
      voucherEvidence: `Approved by: ${actualApprover}`,
      result: "Compliant",
      note: "Policy requires approval and the voucher records an approver; the policy does not name a required designation.",
      requiredApprover: "Approval required (designation not specified in policy).",
      actualApprover,
      requiredLevels,
      actualLevels,
      correctAuthority: "Cannot Determine",
      authorityBasis: basis || undefined,
      amountDrivesAuthority: amountDrives,
      priorApprovalRequired,
    };
  }

  // Full designation comparison.
  const ok = rolesSatisfied(requiredRoles, actualRoles);
  return {
    applicable: true,
    requirement: `Approval by ${requiredLabel}${requiredLevels > 1 ? ` — ${requiredLevels} levels` : ""}${basis ? ` [${basis}]` : ""}`,
    clause: rule?.clause || req?.clause || "-",
    voucherEvidence: `Approved by: ${actualApprover} (designation${actualRoles.length > 1 ? "s" : ""}: ${actualRoles.join(", ")})`,
    result: ok ? "Compliant" : "Non-Compliant",
    note: ok
      ? undefined
      : `${basis || "The policy"} requires approval by ${requiredLabel}, whereas the voucher's approver is "${actualApprover}" (${actualRoles.join(", ")}). The required authority is not evidenced.`,
    requiredApprover: requiredLabel,
    actualApprover,
    requiredLevels,
    actualLevels,
    correctAuthority: ok ? "Compliant" : "Non-Compliant",
    authorityBasis: basis || undefined,
    amountDrivesAuthority: amountDrives,
    priorApprovalRequired,
  };
}

function timingCheck(v: VoucherDoc, reqs: PolicyRequirement[]): CheckOutcome {
  const req = reqs.find((r) => r.type === "timing");
  if (!req) {
    return {
      applicable: false,
      requirement: "No applicable timing requirement specified in the provided policy.",
      clause: "-",
      voucherEvidence: datesLine(v),
      result: "Not Applicable",
    };
  }
  // Prior-approval rule.
  if (/prior|advance|before/i.test(req.raw) && !/within/i.test(req.raw)) {
    const ad = parseDate(v.fields.approvalDate);
    const td = parseDate(v.fields.transactionDate) || parseDate(v.fields.voucherDate);
    if (!ad || !td) {
      return {
        applicable: true,
        requirement: `Prior approval required (${req.clause})`,
        clause: req.clause,
        voucherEvidence: datesLine(v),
        result: "Cannot Determine",
        note: "Transaction date and/or approval date not both available in the voucher.",
      };
    }
    const prior = ad.getTime() <= td.getTime();
    return {
      applicable: true,
      requirement: `Approval must be prior to the transaction (${req.clause})`,
      clause: req.clause,
      voucherEvidence: datesLine(v),
      result: prior ? "Compliant" : "Non-Compliant",
      note: prior
        ? undefined
        : `${req.clause} requires prior approval, whereas the voucher's approval date is after the transaction date.`,
    };
  }
  // "within N days" rule.
  if (req.timingDays != null) {
    const start = parseDate(v.fields.transactionDate) || parseDate(v.fields.invoiceDate);
    const end = parseDate(v.fields.voucherDate) || parseDate(v.fields.paymentDate);
    if (!start || !end) {
      return {
        applicable: true,
        requirement: `Must be recorded within ${req.timingDays} days (${req.clause})`,
        clause: req.clause,
        voucherEvidence: datesLine(v),
        result: "Cannot Determine",
        note: "The two dates needed to test this are not both available in the voucher.",
      };
    }
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    const ok = days <= req.timingDays && days >= 0;
    return {
      applicable: true,
      requirement: `Within ${req.timingDays} days (${req.clause})`,
      clause: req.clause,
      voucherEvidence: `${datesLine(v)} — elapsed ${days} day(s)`,
      result: ok ? "Compliant" : "Non-Compliant",
      note: ok
        ? undefined
        : `${req.clause} requires action within ${req.timingDays} days, whereas the voucher dates are ${days} day(s) apart.`,
    };
  }
  return {
    applicable: true,
    requirement: `${req.raw} (${req.clause})`,
    clause: req.clause,
    voucherEvidence: datesLine(v),
    result: "Cannot Determine",
    note: "Policy states a timing rule that cannot be quantified from the voucher dates.",
  };
}

function supportingCheck(v: VoucherDoc, reqs: PolicyRequirement[]): CheckOutcome {
  const req = reqs.find((r) => r.type === "supportingDoc");
  if (!req) {
    return {
      applicable: false,
      requirement: "No supporting-document requirement specified in the provided policy.",
      clause: "-",
      voucherEvidence:
        v.fields.supportingDocs.length > 0
          ? v.fields.supportingDocs.join("; ")
          : "None mentioned in voucher.",
      result: "Not Applicable",
    };
  }
  const has = v.fields.supportingDocs.length > 0;
  return {
    applicable: true,
    requirement: `${req.raw} (${req.clause})`,
    clause: req.clause,
    voucherEvidence: has ? v.fields.supportingDocs.join("; ") : "No supporting document mentioned in the voucher.",
    result: has ? "Compliant" : "Cannot Determine",
    note: has
      ? undefined
      : "Policy requires supporting documents; the voucher does not mention any. (Not evidenced — not necessarily missing.)",
  };
}

function eligibilityCheck(v: VoucherDoc, reqs: PolicyRequirement[]): CheckOutcome {
  const req = reqs.find((r) => r.type === "eligibility");
  if (!req) {
    return {
      applicable: false,
      requirement: "No eligibility condition specified in the provided policy.",
      clause: "-",
      voucherEvidence: v.fields.party || v.fields.description || NOT_EVIDENCED,
      result: "Not Applicable",
    };
  }
  // We can only confirm eligibility if the voucher text overlaps the condition.
  const terms = req.keywords.filter((k) => k.length > 3);
  const vtext = v.text.toLowerCase();
  const hit = terms.filter((t) => vtext.includes(t));
  return {
    applicable: true,
    requirement: `${req.raw} (${req.clause})`,
    clause: req.clause,
    voucherEvidence:
      hit.length > 0 ? `Voucher references: ${hit.slice(0, 5).join(", ")}` : "No matching eligibility evidence in voucher.",
    result: hit.length > 0 ? "Compliant" : "Cannot Determine",
    note:
      hit.length > 0
        ? undefined
        : "Eligibility condition exists in policy but cannot be confirmed from the voucher.",
  };
}

// ---- Clause-by-clause testing --------------------------------------------

function clauseTests(v: VoucherDoc, policy: PolicyDoc): ClauseTest[] {
  return policy.requirements.map((req) => {
    let outcome: CheckOutcome;
    switch (req.type) {
      case "amountLimit":
        outcome = amountCheck(v, [req]);
        break;
      case "approval":
        outcome = approvalCheck(v, [req], policy.authorityRules);
        break;
      case "timing":
        outcome = timingCheck(v, [req]);
        break;
      case "supportingDoc":
        outcome = supportingCheck(v, [req]);
        break;
      case "eligibility":
        outcome = eligibilityCheck(v, [req]);
        break;
      default: {
        // Generic rule: look for the requirement's keywords in the voucher.
        const vtext = v.text.toLowerCase();
        const hit = req.keywords.filter((k) => k.length > 3 && vtext.includes(k));
        outcome = {
          applicable: true,
          requirement: req.raw,
          clause: req.clause,
          voucherEvidence:
            hit.length > 0 ? `Voucher references: ${hit.slice(0, 5).join(", ")}` : "No related evidence in voucher.",
          result: hit.length > 0 ? "Cannot Determine" : "Cannot Determine",
          note: "General policy requirement — compared on wording only.",
        };
      }
    }
    return {
      clause: req.clause,
      requirementType: req.type,
      requirement: req.raw,
      voucherEvidence: outcome.voucherEvidence,
      result: outcome.result,
      source: policyEv(policy, req),
    };
  });
}

// ---- Observations ---------------------------------------------------------

function buildObservations(
  v: VoucherDoc,
  policy: PolicyDoc | undefined,
  checks: { key: string; type: string; c: CheckOutcome; req?: PolicyRequirement }[]
): Observation[] {
  const out: Observation[] = [];
  const voucherNo = v.fields.voucherNo || v.fileName;
  for (const { type, c, req } of checks) {
    if (c.result === "Non-Compliant" || c.result === "Cannot Determine") {
      const missingKind =
        c.result === "Cannot Determine"
          ? c.voucherEvidence.toLowerCase().includes("not")
            ? "Not evidenced"
            : "Cannot Determine"
          : "OK";
      out.push({
        id: newId("obs"),
        voucherId: v.id,
        voucherNo,
        policyName: policy?.name || NOT_SPECIFIED,
        clause: c.clause,
        policyRequirement: c.requirement,
        voucherEvidence: c.voucherEvidence,
        exactDeviation: c.note || `${c.clause} requirement vs. voucher evidence.`,
        conclusion: c.result,
        exceptionType: exceptionType(type, c.result),
        missingKind: missingKind as Observation["missingKind"],
        source: req && policy ? policyEv(policy, req) : null,
      });
    }
  }
  return out;
}

function exceptionType(type: string, result: Result): string {
  if (result === "Cannot Determine") return "Cannot verify";
  switch (type) {
    case "amount":
      return "Amount limit exceeded";
    case "approval":
      return "Approval requirement not met";
    case "timing":
      return "Approval timing requirement not met";
    case "supporting":
      return "Required document missing";
    case "eligibility":
      return "Eligibility condition not met";
    default:
      return "Policy requirement not met";
  }
}

// ---- Top-level per-voucher analysis --------------------------------------

export function analyseVoucher(
  v: VoucherDoc,
  policies: PolicyDoc[]
): VoucherAnalysis {
  const comparisons = policies.map((p) => compareToPolicy(v, p, policies));
  const sorted = [...comparisons].sort((a, b) => b.matchScore - a.matchScore);

  let applicable: PolicyDoc | undefined;
  let mappingBasis = "Applicable policy cannot be conclusively determined from the provided documents.";
  let conclusive = false;

  if (sorted.length > 0 && sorted[0].matchScore > 0) {
    const top = sorted[0];
    const tie = sorted[1] && sorted[1].matchScore === top.matchScore;
    if (!tie) {
      applicable = policies.find((p) => p.id === top.policyId);
      conclusive = true;
      mappingBasis = `Voucher ${v.fields.voucherNo || v.fileName} contains ${top.matchedTerms
        .slice(0, 4)
        .join(", ")}. Policy "${top.policyName}" (${top.relevantClause}) uses the same term(s). Based only on the uploaded documents, this voucher maps to "${top.policyName}".`;
    } else {
      mappingBasis = `Two policies match the voucher equally (score ${top.matchScore}). ${CANNOT}`;
    }
  }

  const reqs = applicable?.requirements || [];
  const amount = amountCheck(v, reqs);
  const approval = approvalCheck(v, reqs, applicable?.authorityRules || []);
  const timing = timingCheck(v, reqs);
  const supporting = supportingCheck(v, reqs);
  const eligibility = eligibilityCheck(v, reqs);
  const tests = applicable ? clauseTests(v, applicable) : [];

  const observations = buildObservations(v, applicable, [
    { key: "eligibility", type: "eligibility", c: eligibility, req: reqs.find((r) => r.type === "eligibility") },
    { key: "amount", type: "amount", c: amount, req: reqs.find((r) => r.type === "amountLimit") },
    { key: "approval", type: "approval", c: approval, req: reqs.find((r) => r.type === "approval") },
    { key: "timing", type: "timing", c: timing, req: reqs.find((r) => r.type === "timing") },
    { key: "supporting", type: "supporting", c: supporting, req: reqs.find((r) => r.type === "supportingDoc") },
  ]);

  const finalConclusion = concludeVoucher(conclusive, [amount, approval, timing, supporting, eligibility]);

  return {
    voucherId: v.id,
    comparisons,
    applicablePolicyId: applicable?.id,
    applicablePolicyName: applicable?.name,
    mappingBasis,
    conclusive,
    clauseTests: tests,
    amountCheck: amount,
    approvalCheck: approval,
    timingCheck: timing,
    supportingCheck: supporting,
    eligibilityCheck: eligibility,
    observations,
    finalConclusion,
  };
}

function concludeVoucher(conclusive: boolean, checks: CheckOutcome[]): Result {
  if (!conclusive) return "Cannot Determine";
  const active = checks.filter((c) => c.applicable);
  if (active.length === 0) return "Cannot Determine";
  if (active.some((c) => c.result === "Non-Compliant")) return "Non-Compliant";
  if (active.some((c) => c.result === "Cannot Determine")) return "Cannot Determine";
  if (active.every((c) => c.result === "Compliant")) return "Compliant";
  return "Cannot Determine";
}

// ---- small utils ----------------------------------------------------------

export function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function datesLine(v: VoucherDoc): string {
  const parts: string[] = [];
  if (v.fields.transactionDate) parts.push(`Txn ${v.fields.transactionDate}`);
  if (v.fields.invoiceDate) parts.push(`Invoice ${v.fields.invoiceDate}`);
  if (v.fields.voucherDate) parts.push(`Voucher ${v.fields.voucherDate}`);
  if (v.fields.approvalDate) parts.push(`Approval ${v.fields.approvalDate}`);
  if (v.fields.paymentDate) parts.push(`Payment ${v.fields.paymentDate}`);
  return parts.length ? parts.join(" · ") : "No dates found in voucher.";
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseDate(s?: string): Date | null {
  if (!s) return null;
  let m = s.match(/(\d{1,2})[\/\-.\s]([a-z]{3,})[\/\-.\s](\d{2,4})/i);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon != null) return mk(+m[1], mon, +m[3]);
  }
  m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) return mk(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return mk(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function mk(day: number, month: number, year: number): Date | null {
  if (year < 100) year += 2000;
  const d = new Date(year, month, day);
  return Number.isNaN(d.getTime()) ? null : d;
}
