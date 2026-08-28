"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { aggregate } from "@/lib/aggregate";
import { EmptyState, PageHeader, Stat } from "@/components/ui";

export default function SummaryPage() {
  const { vouchers, policies, analyses } = useStore();
  const agg = useMemo(() => aggregate(vouchers, policies, analyses), [vouchers, policies, analyses]);

  if (agg.extractedVouchers === 0) {
    return (
      <>
        <PageHeader title="Final Summary" subtitle="Overall and policy-wise results, computed from the documents." />
        <EmptyState title="Nothing to summarise yet" hint="Upload and extract vouchers and policies to see the final summary." cta />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Final Summary"
        subtitle="Every figure is calculated from the actual analysis of the uploaded documents. No sample data."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Vouchers" value={agg.totalVouchers} />
        <Stat label="Policies" value={agg.totalPolicies} />
        <Stat label="Compliant" value={agg.byResult.Compliant} tone="good" />
        <Stat label="Non-Compliant" value={agg.byResult["Non-Compliant"]} tone="bad" />
        <Stat label="Cannot Determine" value={agg.byResult["Cannot Determine"]} tone="warn" />
        <Stat label="Not Applicable" value={agg.byResult["Not Applicable"]} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Mapped Vouchers" value={agg.totalVouchers - agg.unmapped} />
        <Stat label="Inconclusive Mappings" value={agg.inconclusiveMappings} tone="warn" />
        <Stat label="Total Observations" value={agg.totalObservations} tone="bad" />
      </section>

      <section className="card mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Policy-wise Breakdown</h2>
        {agg.perPolicy.length === 0 ? (
          <p className="text-sm text-slate-500">No extracted policies.</p>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th">Policy</th>
                  <th className="th text-right">Vouchers</th>
                  <th className="th text-right">Compliant</th>
                  <th className="th text-right">Non-Compliant</th>
                  <th className="th text-right">Cannot Determine</th>
                  <th className="th text-right">Observations</th>
                </tr>
              </thead>
              <tbody>
                {agg.perPolicy.map((p) => (
                  <tr key={p.policyId} className="border-b border-slate-50">
                    <td className="td font-medium text-slate-800">{p.policyName}</td>
                    <td className="td text-right tabular-nums">{p.vouchers}</td>
                    <td className="td text-right tabular-nums text-emerald-600">{p.compliant}</td>
                    <td className="td text-right tabular-nums text-rose-600">{p.nonCompliant}</td>
                    <td className="td text-right tabular-nums text-amber-600">{p.cannotDetermine}</td>
                    <td className="td text-right tabular-nums">{p.observations}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="td">Total</td>
                  <td className="td text-right tabular-nums">{agg.totalVouchers - agg.unmapped}</td>
                  <td className="td text-right tabular-nums text-emerald-600">{agg.byResult.Compliant}</td>
                  <td className="td text-right tabular-nums text-rose-600">{agg.byResult["Non-Compliant"]}</td>
                  <td className="td text-right tabular-nums text-amber-600">{agg.byResult["Cannot Determine"]}</td>
                  <td className="td text-right tabular-nums">{agg.totalObservations}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Materiality, severity and financial impact are intentionally not assigned. They are shown only
        where the uploaded documents themselves establish them; otherwise the engine records
        “Impact/consequence cannot be determined from the provided documents.”
      </p>
    </>
  );
}
