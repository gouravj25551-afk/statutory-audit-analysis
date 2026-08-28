"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, ResultBadge, StatusBadge } from "@/components/ui";
import { fmt } from "@/lib/engine";

const FIELDS: { key: string; label: string }[] = [
  { key: "voucherNo", label: "Voucher No." },
  { key: "voucherDate", label: "Voucher Date" },
  { key: "transactionDate", label: "Transaction Date" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "party", label: "Party / Person" },
  { key: "department", label: "Department" },
  { key: "approver", label: "Approver" },
  { key: "approvalDate", label: "Approval Date" },
];

export default function VouchersPage() {
  const { vouchers, analyses } = useStore();

  if (vouchers.length === 0) {
    return (
      <>
        <PageHeader title="Vouchers" subtitle="Extracted facts from each uploaded voucher." />
        <EmptyState title="No vouchers uploaded" hint="Upload voucher documents to see extracted facts here." cta />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Vouchers"
        subtitle="Only facts explicitly present in each voucher are shown. Blank cells mean the field is not present in the document."
      />
      <div className="space-y-4">
        {vouchers.map((v) => {
          const a = analyses[v.id];
          return (
            <div key={v.id} className="card fade-in p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {v.fields.voucherNo || v.fileName}
                  </h2>
                  <StatusBadge status={v.status} />
                </div>
                <div className="flex items-center gap-2">
                  {a && <ResultBadge value={a.finalConclusion} />}
                  {v.status === "extracted" && (
                    <Link href={`/working-papers/${v.id}`} className="btn-ghost !py-1 !text-xs">
                      Working paper →
                    </Link>
                  )}
                </div>
              </div>

              {v.status === "failed" ? (
                <p className="text-sm text-rose-600">{v.error || "Extraction failed."}</p>
              ) : v.status !== "extracted" ? (
                <p className="text-sm text-slate-400">Processing…</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
                    {FIELDS.map((f) => (
                      <Field key={f.key} label={f.label} value={(v.fields as any)[f.key]} />
                    ))}
                    <Field
                      label="Amount"
                      value={v.fields.amount != null ? fmt(v.fields.amount) : undefined}
                    />
                    <div className="col-span-2 md:col-span-2">
                      <div className="label">Description / Nature</div>
                      <div className="text-sm text-slate-700">
                        {v.fields.description || v.fields.nature || (
                          <span className="text-slate-400">Not specified in the voucher.</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {v.fields.supportingDocs.length > 0 && (
                    <div className="mt-3">
                      <div className="label">Supporting documents mentioned</div>
                      <ul className="mt-0.5 list-inside list-disc text-sm text-slate-600">
                        {v.fields.supportingDocs.slice(0, 4).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-slate-700">
        {value ? value : <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}
