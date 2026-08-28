"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, ResultBadge } from "@/components/ui";
import { DecisionTree } from "@/components/DecisionTree";

export default function MappingPage() {
  const { vouchers, policies, analyses } = useStore();
  const extractedV = vouchers.filter((v) => analyses[v.id]);
  const extractedP = policies.filter((p) => p.status === "extracted");

  if (extractedV.length === 0 || extractedP.length === 0) {
    return (
      <>
        <PageHeader title="Policy Mapping" subtitle="Each voucher is compared against every policy to determine which one applies." />
        <div className="mb-4">
          <DecisionTree />
        </div>
        <EmptyState
          title="Mapping needs vouchers and policies"
          hint="Upload at least one voucher and one policy. The engine will compare each voucher against every policy using only their text."
          cta
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Policy Mapping"
        subtitle="For every voucher the engine compares against each policy and determines the applicable one — strictly from overlapping terms in the documents."
      />
      <div className="mb-5">
        <DecisionTree />
      </div>

      <div className="space-y-4">
        {extractedV.map((v) => {
          const a = analyses[v.id];
          return (
            <div key={v.id} className="card fade-in p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  {v.fields.voucherNo || v.fileName}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    a.conclusive
                      ? "bg-brand-50 text-brand-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {a.conclusive
                    ? `Applicable: ${a.applicablePolicyName}`
                    : "Applicable policy cannot be conclusively determined"}
                </span>
              </div>

              <div className="scroll-x">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="th">Policy</th>
                      <th className="th">Relevant Clause</th>
                      <th className="th">Policy Requirement</th>
                      <th className="th">Voucher Evidence</th>
                      <th className="th text-right">Score</th>
                      <th className="th">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.comparisons.map((c) => (
                      <tr
                        key={c.policyId}
                        className={`border-b border-slate-50 ${
                          c.policyId === a.applicablePolicyId ? "bg-brand-50/40" : ""
                        }`}
                      >
                        <td className="td font-medium text-slate-800">{c.policyName}</td>
                        <td className="td whitespace-nowrap text-slate-500">{c.relevantClause}</td>
                        <td className="td max-w-xs">{c.requirement}</td>
                        <td className="td max-w-xs text-slate-600">{c.voucherEvidence}</td>
                        <td className="td text-right tabular-nums">{c.matchScore}</td>
                        <td className="td">
                          <ResultBadge value={c.match} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <div className="label">Basis of mapping</div>
                <p className="mt-0.5 text-sm text-slate-700">{a.mappingBasis}</p>
              </div>

              <div className="mt-2 text-right">
                <Link href={`/working-papers/${v.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                  Open full working paper →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
