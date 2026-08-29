"use client";

import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, ResultBadge, StatusBadge } from "@/components/ui";
import { fmt } from "@/lib/engine";
import { buildPolicyStudy } from "@/lib/policyStudy";
import { PolicyDoc, RequirementType } from "@/lib/types";

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
              <>
                <PolicyStudyView p={p} />
                <details className="mt-4 rounded-lg border border-slate-200">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600">
                    All extracted requirement lines ({p.requirements.length}) — verbatim, with references
                  </summary>
                  <div className="scroll-x border-t border-slate-100">
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
                </details>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function PolicyStudyView({ p }: { p: PolicyDoc }) {
  const study = buildPolicyStudy(p);
  if (study.sections.length === 0) {
    return (
      <p className="text-sm text-amber-700">
        No structured requirements could be extracted for a policy study.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-700">Policy Study</h3>
        <span className="text-[11px] text-slate-400">
          structured breakdown — captured only from this document
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {study.sections.map((s) => (
          <div key={s.title} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="label mb-1">{s.title}</div>
            <ul className="space-y-1.5">
              {s.entries.map((e, i) => (
                <li key={i} className="text-[13px] text-slate-700">
                  <span>{e.text}</span>{" "}
                  <span className="whitespace-nowrap text-[11px] text-slate-400">· {e.ref}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
