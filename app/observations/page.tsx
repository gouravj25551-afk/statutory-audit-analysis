"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Evidence, EmptyState, PageHeader, ResultBadge } from "@/components/ui";
import { Observation } from "@/lib/types";

export default function ObservationsPage() {
  const { vouchers, analyses } = useStore();
  const [filter, setFilter] = useState<string>("All");

  const observations = useMemo(() => {
    const out: { obs: Observation; voucherId: string }[] = [];
    for (const v of vouchers) {
      const a = analyses[v.id];
      if (!a) continue;
      for (const o of a.observations) out.push({ obs: o, voucherId: v.id });
    }
    return out;
  }, [vouchers, analyses]);

  const filtered =
    filter === "All" ? observations : observations.filter((o) => o.obs.conclusion === filter);

  if (observations.length === 0) {
    const anyAnalysis = Object.keys(analyses).length > 0;
    return (
      <>
        <PageHeader title="Observation Register" subtitle="Every observation is drawn only from a voucher + policy pair." />
        {anyAnalysis ? (
          <div className="card p-8 text-center">
            <div className="text-2xl">✓</div>
            <h3 className="mt-2 text-base font-semibold text-emerald-700">No exceptions identified</h3>
            <p className="mt-1 text-sm text-slate-500">
              Based only on the uploaded documents, no deviation was found. As more documents are
              uploaded this register updates automatically.
            </p>
          </div>
        ) : (
          <EmptyState title="No observations yet" hint="Upload vouchers and policies to generate observations." cta />
        )}
      </>
    );
  }

  const FILTERS = ["All", "Non-Compliant", "Cannot Determine"];

  return (
    <>
      <PageHeader
        title="Observation Register"
        subtitle="Each row states what the policy requires, what the voucher shows, the exact deviation, and links to the source."
        actions={
          <div className="flex gap-1">
            {FILTERS.map((ff) => (
              <button
                key={ff}
                onClick={() => setFilter(ff)}
                className={`btn ${filter === ff ? "bg-brand-600 text-white" : "btn-ghost"} !py-1 !text-xs`}
              >
                {ff}
              </button>
            ))}
          </div>
        }
      />
      <div className="card">
        <div className="scroll-x">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">#</th>
                <th className="th">Voucher</th>
                <th className="th">Policy</th>
                <th className="th">Clause</th>
                <th className="th">Policy Requirement</th>
                <th className="th">Voucher Evidence</th>
                <th className="th">Exact Deviation</th>
                <th className="th">Conclusion</th>
                <th className="th">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ obs, voucherId }, i) => (
                <tr key={obs.id} className="border-b border-slate-50 align-top">
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td whitespace-nowrap font-medium">
                    <Link href={`/working-papers/${voucherId}`} className="text-brand-600 hover:underline">
                      {obs.voucherNo}
                    </Link>
                  </td>
                  <td className="td whitespace-nowrap">{obs.policyName}</td>
                  <td className="td whitespace-nowrap text-slate-500">{obs.clause}</td>
                  <td className="td max-w-xs">{obs.policyRequirement}</td>
                  <td className="td max-w-xs text-slate-600">{obs.voucherEvidence}</td>
                  <td className="td max-w-xs">{obs.exactDeviation}</td>
                  <td className="td"><ResultBadge value={obs.conclusion} /></td>
                  <td className="td"><Evidence source={obs.source} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
