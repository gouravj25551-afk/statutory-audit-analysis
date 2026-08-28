"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { aggregate } from "@/lib/aggregate";
import { EmptyState, PageHeader, ResultBadge, Stat } from "@/components/ui";

export default function DashboardPage() {
  const { vouchers, policies, analyses, ready } = useStore();
  const agg = useMemo(
    () => aggregate(vouchers, policies, analyses),
    [vouchers, policies, analyses]
  );

  if (!ready) return <Loading />;

  if (vouchers.length === 0 && policies.length === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          subtitle="Upload the vouchers and policies to begin. Every result shown here is computed live from those documents only."
        />
        <EmptyState
          title="No documents yet"
          hint="Upload up to 10 vouchers and 3 policies. The engine will map each voucher to a policy and test it clause-by-clause — using nothing but the uploaded files."
          cta
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit Dashboard"
        subtitle="All figures are calculated from the uploaded documents. Nothing is sampled or hard-coded."
        actions={
          <Link href="/upload" className="btn-primary">
            Manage documents
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Vouchers" value={agg.totalVouchers} />
        <Stat label="Total Policies" value={agg.totalPolicies} />
        <Stat label="Compliant" value={agg.byResult.Compliant} tone="good" />
        <Stat label="Non-Compliant" value={agg.byResult["Non-Compliant"]} tone="bad" />
        <Stat label="Cannot Determine" value={agg.byResult["Cannot Determine"]} tone="warn" />
        <Stat label="Not Applicable" value={agg.byResult["Not Applicable"]} />
        <Stat label="Inconclusive Mapping" value={agg.inconclusiveMappings} tone="warn" />
        <Stat label="Total Observations" value={agg.totalObservations} tone="bad" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Policy-wise Summary</h2>
          {agg.perPolicy.length === 0 ? (
            <p className="text-sm text-slate-500">No extracted policies yet.</p>
          ) : (
            <div className="scroll-x">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">Policy</th>
                    <th className="th text-right">Vouchers</th>
                    <th className="th text-right">Compliant</th>
                    <th className="th text-right">Non-Comp.</th>
                    <th className="th text-right">Cannot Det.</th>
                    <th className="th text-right">Obs.</th>
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
                  {agg.unmapped > 0 && (
                    <tr className="border-b border-slate-50">
                      <td className="td italic text-slate-500">Unmapped / inconclusive</td>
                      <td className="td text-right tabular-nums">{agg.unmapped}</td>
                      <td className="td text-right">—</td>
                      <td className="td text-right">—</td>
                      <td className="td text-right">—</td>
                      <td className="td text-right">—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Voucher Conclusions</h2>
          {agg.extractedVouchers === 0 ? (
            <p className="text-sm text-slate-500">No extracted vouchers yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {vouchers
                .filter((v) => analyses[v.id])
                .map((v) => {
                  const a = analyses[v.id];
                  return (
                    <li key={v.id}>
                      <Link
                        href={`/working-papers/${v.id}`}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      >
                        <span className="min-w-0 truncate text-sm text-slate-700">
                          <span className="font-medium">{v.fields.voucherNo || v.fileName}</span>
                          <span className="text-slate-400">
                            {" "}
                            → {a.applicablePolicyName || "unmapped"}
                          </span>
                        </span>
                        <ResultBadge value={a.finalConclusion} />
                      </Link>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </section>

      {(agg.extractedVouchers === 0 || agg.extractedPolicies === 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Analysis needs at least one extracted voucher <strong>and</strong> one extracted policy.
          {agg.extractedVouchers === 0 && " No vouchers extracted yet."}
          {agg.extractedPolicies === 0 && " No policies extracted yet."}
        </div>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card h-20 animate-pulse bg-slate-50" />
      ))}
    </div>
  );
}
