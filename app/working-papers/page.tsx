"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, ResultBadge } from "@/components/ui";
import { fmt } from "@/lib/engine";

export default function WorkingPapersPage() {
  const { vouchers, analyses } = useStore();
  const list = vouchers.filter((v) => analyses[v.id]);

  if (list.length === 0) {
    return (
      <>
        <PageHeader title="Voucher-wise Working Papers" subtitle="A detailed audit working paper per voucher." />
        <EmptyState title="No working papers yet" hint="Upload and extract vouchers to generate working papers." cta />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Voucher-wise Working Papers"
        subtitle="Open any voucher to see its facts, policy mapping, clause testing, checks and conclusion — each linked to its source."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((v) => {
          const a = analyses[v.id];
          return (
            <Link key={v.id} href={`/working-papers/${v.id}`} className="card fade-in p-4 transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">{v.fields.voucherNo || v.fileName}</h2>
                <ResultBadge value={a.finalConclusion} />
              </div>
              <dl className="mt-2 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <dt>Amount</dt>
                  <dd className="tabular-nums text-slate-700">
                    {v.fields.amount != null ? fmt(v.fields.amount) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Applicable policy</dt>
                  <dd className="text-right text-slate-700">{a.applicablePolicyName || "Cannot Determine"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Observations</dt>
                  <dd className={a.observations.length ? "text-rose-600" : "text-slate-700"}>
                    {a.observations.length}
                  </dd>
                </div>
              </dl>
              <span className="mt-3 block text-xs font-medium text-brand-600">Open working paper →</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
