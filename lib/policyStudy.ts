// ---------------------------------------------------------------------------
// Policy Study — a structured breakdown of each uploaded policy, mirroring
// "Step 1: Policy study" of the audit working paper. Built deterministically
// from the already-parsed requirements + authority matrix. No external source.
// ---------------------------------------------------------------------------

import { fmt } from "./engine";
import { PolicyDoc } from "./types";

export interface StudyEntry {
  text: string;
  ref: string;
}
export interface StudySection {
  title: string;
  entries: StudyEntry[];
}
export interface PolicyStudy {
  policyId: string;
  name: string;
  fileName: string;
  effectiveDate?: string;
  scope?: string;
  sections: StudySection[];
}

export function buildPolicyStudy(p: PolicyDoc): PolicyStudy {
  const sections: StudySection[] = [];
  const add = (title: string, entries: StudyEntry[]) => {
    if (entries.length) sections.push({ title, entries });
  };

  const byType = (t: string) =>
    p.requirements
      .filter((r) => r.type === t)
      .map((r) => ({ text: r.raw, ref: r.clause }));

  // Scope & applicability (declared header + any eligibility-style lines)
  const scopeEntries: StudyEntry[] = [];
  if (p.scope) scopeEntries.push({ text: p.scope, ref: "declared scope" });
  add("Scope & Applicability", scopeEntries);

  // Eligibility / covered categories
  add("Eligibility & Covered Categories", byType("eligibility"));

  // Approval authority — the parsed signatory matrix is the centrepiece
  const authEntries: StudyEntry[] = p.authorityRules.map((r) => {
    const roles = r.roles.length ? r.roles.join(" / ") : "designation not stated";
    const bands = r.bands.length
      ? " · bands: " +
        r.bands
          .map(
            (b) =>
              `${b.minAmount != null ? `over ${fmt(b.minAmount)}` : b.maxAmount != null ? `up to ${fmt(b.maxAmount)}` : "any"} → ${b.roles.join(" / ")}`
          )
          .join("; ")
      : "";
    const levels = r.levels > 1 ? ` · ${r.levels} approval levels` : "";
    return { text: `${cleanLabel(r.label)} → ${roles}${levels}${bands}`, ref: r.clause };
  });
  // Also include approval requirement lines that aren't authority-matrix rows.
  byType("approval").forEach((e) => {
    if (!authEntries.some((a) => a.ref === e.ref)) authEntries.push(e);
  });
  add("Approval Requirements & Authority", authEntries);

  // Amount limits / thresholds
  add("Amount Limits & Thresholds", byType("amountLimit"));

  // Supporting documents
  add("Required Supporting Documents", byType("supportingDoc"));

  // Timing
  add("Timing Requirements", byType("timing"));

  // Other explicit requirements
  add("Other Explicit Requirements", byType("other"));

  return {
    policyId: p.id,
    name: p.name || p.fileName,
    fileName: p.fileName,
    effectiveDate: p.effectiveDate,
    scope: p.scope,
    sections,
  };
}

function cleanLabel(s: string): string {
  return s.replace(/\s{2,}/g, " ").replace(/\s+$/g, "").trim();
}
