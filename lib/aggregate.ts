import { PolicyDoc, Result, VoucherAnalysis, VoucherDoc } from "./types";

export interface Aggregate {
  totalVouchers: number;
  totalPolicies: number;
  extractedVouchers: number;
  extractedPolicies: number;
  byResult: Record<Result, number>;
  inconclusiveMappings: number;
  totalObservations: number;
  perPolicy: {
    policyId: string;
    policyName: string;
    vouchers: number;
    compliant: number;
    nonCompliant: number;
    cannotDetermine: number;
    observations: number;
  }[];
  unmapped: number;
}

export function aggregate(
  vouchers: VoucherDoc[],
  policies: PolicyDoc[],
  analyses: Record<string, VoucherAnalysis>
): Aggregate {
  const byResult: Record<Result, number> = {
    Compliant: 0,
    "Non-Compliant": 0,
    "Cannot Determine": 0,
    "Not Applicable": 0,
  };
  let inconclusiveMappings = 0;
  let totalObservations = 0;
  let unmapped = 0;

  const perPolicyMap = new Map<string, Aggregate["perPolicy"][number]>();
  for (const p of policies.filter((x) => x.status === "extracted")) {
    perPolicyMap.set(p.id, {
      policyId: p.id,
      policyName: p.name || p.fileName,
      vouchers: 0,
      compliant: 0,
      nonCompliant: 0,
      cannotDetermine: 0,
      observations: 0,
    });
  }

  for (const v of vouchers) {
    const a = analyses[v.id];
    if (!a) continue;
    byResult[a.finalConclusion] += 1;
    totalObservations += a.observations.length;
    if (!a.conclusive) inconclusiveMappings += 1;
    if (a.applicablePolicyId && perPolicyMap.has(a.applicablePolicyId)) {
      const row = perPolicyMap.get(a.applicablePolicyId)!;
      row.vouchers += 1;
      row.observations += a.observations.length;
      if (a.finalConclusion === "Compliant") row.compliant += 1;
      else if (a.finalConclusion === "Non-Compliant") row.nonCompliant += 1;
      else if (a.finalConclusion === "Cannot Determine") row.cannotDetermine += 1;
    } else {
      unmapped += 1;
    }
  }

  return {
    totalVouchers: vouchers.length,
    totalPolicies: policies.length,
    extractedVouchers: vouchers.filter((v) => v.status === "extracted").length,
    extractedPolicies: policies.filter((p) => p.status === "extracted").length,
    byResult,
    inconclusiveMappings,
    totalObservations,
    perPolicy: [...perPolicyMap.values()],
    unmapped,
  };
}
