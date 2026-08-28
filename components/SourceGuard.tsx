"use client";

// A persistent banner that reminds the user (and documents the system's
// contract) that ONLY the uploaded documents are used as sources.

import { useStore } from "@/lib/store";

export function SourceGuard() {
  const { vouchers, policies } = useStore();
  const v = vouchers.filter((x) => x.status === "extracted").length;
  const p = policies.filter((x) => x.status === "extracted").length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[12.5px] text-amber-900 md:px-8">
      <span>
        <strong>Source-restricted engine.</strong> Analysis uses{" "}
        <strong>only the uploaded vouchers and policies</strong> — no internet,
        no statutes, no external guidance, no assumptions.
      </span>
      <span className="whitespace-nowrap font-medium text-amber-800">
        {v} voucher{v === 1 ? "" : "s"} · {p} polic{p === 1 ? "y" : "ies"} loaded
      </span>
    </div>
  );
}
