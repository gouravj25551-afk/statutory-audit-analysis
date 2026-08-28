"use client";

import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, ResultBadge } from "@/components/ui";
import { buildChecklistRows, CHECKLIST_COLUMNS } from "@/lib/checklist";

export default function ChecklistPage() {
  const { vouchers, policies, analyses } = useStore();
  const rows = buildChecklistRows(vouchers, analyses);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Master Audit Checklist" subtitle="One working-paper row per voucher." />
        <EmptyState
          title="Nothing to test yet"
          hint="Upload vouchers and policies. Each extracted voucher becomes one row here, populated only from the documents."
          cta
        />
      </>
    );
  }

  const resultCols = new Set([
    "Eligibility Result",
    "Amount Compliance",
    "Approval Compliance",
    "Timing Compliance",
    "Compliance Status",
    "Final Conclusion",
  ]);

  return (
    <>
      <PageHeader
        title="Master Audit Checklist"
        subtitle="Audit working paper. Every cell is populated from the uploaded voucher/policy or marked as not specified / cannot determine. Scroll horizontally to see all 31 columns."
      />
      <div className="card">
        <div className="scroll-x">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0">
              <tr className="border-b border-slate-200 bg-slate-50">
                {CHECKLIST_COLUMNS.map((c) => (
                  <th key={c} className="th sticky-th">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                  {CHECKLIST_COLUMNS.map((c) => (
                    <td key={c} className="td min-w-[120px] max-w-[240px]">
                      {resultCols.has(c) ? (
                        <ResultBadge value={row[c] || "—"} />
                      ) : (
                        <span className={row[c] ? "" : "text-slate-300"}>{row[c] || "—"}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {policies.filter((p) => p.status === "extracted").length === 0 && (
        <p className="mt-3 text-sm text-amber-700">
          No policy is loaded, so mapping and compliance columns read “Cannot Determine”. Upload a
          policy to complete the checklist.
        </p>
      )}
    </>
  );
}
