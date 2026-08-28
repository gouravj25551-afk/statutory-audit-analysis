"use client";

import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, ResultBadge, StatusBadge } from "@/components/ui";
import { fmt } from "@/lib/engine";
import { RequirementType } from "@/lib/types";

const TYPE_LABEL: Record<RequirementType, string> = {
  amountLimit: "Amount limit",
  approval: "Approval",
  eligibility: "Eligibility",
  supportingDoc: "Supporting document",
  timing: "Timing",
  other: "Other requirement",
};

const TYPE_STYLE: Record<RequirementType, string> = {
  amountLimit: "bg-purple-50 text-purple-700",
  approval: "bg-blue-50 text-blue-700",
  eligibility: "bg-emerald-50 text-emerald-700",
  supportingDoc: "bg-amber-50 text-amber-700",
  timing: "bg-cyan-50 text-cyan-700",
  other: "bg-slate-100 text-slate-600",
};

export default function PoliciesPage() {
  const { policies } = useStore();

  if (policies.length === 0) {
    return (
      <>
        <PageHeader title="Policies" subtitle="Explicit requirements extracted from each policy." />
        <EmptyState title="No policies uploaded" hint="Upload policy documents to see extracted requirements here." cta />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Policies"
        subtitle="Only requirements explicitly stated in each policy are captured, with their clause / line reference."
      />
      <div className="space-y-4">
        {policies.map((p) => (
          <div key={p.id} className="card fade-in p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  {p.status === "extracted" ? p.name : p.fileName}
                </h2>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span>File: {p.fileName}</span>
                  {p.effectiveDate && <span>Effective: {p.effectiveDate}</span>}
                  {p.scope && <span>Scope: {p.scope}</span>}
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            {p.status === "failed" ? (
              <p className="text-sm text-rose-600">{p.error || "Extraction failed."}</p>
            ) : p.status !== "extracted" ? (
              <p className="text-sm text-slate-400">Processing…</p>
            ) : p.requirements.length === 0 ? (
              <p className="text-sm text-amber-700">
                No explicit requirement lines detected in this document. Testing against it will
                return “Not specified in the provided documents”.
              </p>
            ) : (
              <div className="scroll-x">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="th">Type</th>
                      <th className="th">Clause / Ref</th>
                      <th className="th">Requirement (verbatim)</th>
                      <th className="th text-right">Parsed value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.requirements.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="td">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_STYLE[r.type]}`}
                          >
                            {TYPE_LABEL[r.type]}
                          </span>
                        </td>
                        <td className="td whitespace-nowrap text-slate-500">{r.clause}</td>
                        <td className="td">{r.raw}</td>
                        <td className="td whitespace-nowrap text-right text-slate-600">
                          {r.amountLimit != null
                            ? fmt(r.amountLimit)
                            : r.timingDays != null
                            ? `${r.timingDays} day(s)`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
