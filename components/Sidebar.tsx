"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "Upload Documents" },
  { href: "/vouchers", label: "Vouchers" },
  { href: "/policies", label: "Policies" },
  { href: "/mapping", label: "Policy Mapping" },
  { href: "/checklist", label: "Audit Checklist" },
  { href: "/working-papers", label: "Working Papers" },
  { href: "/observations", label: "Observations" },
  { href: "/evidence", label: "Source Evidence" },
  { href: "/summary", label: "Final Summary" },
  { href: "/export", label: "Export / Report" },
];

const ICON: Record<string, string> = {
  "/": "▤",
  "/upload": "⬆",
  "/vouchers": "🧾",
  "/policies": "📘",
  "/mapping": "⇄",
  "/checklist": "☑",
  "/working-papers": "📄",
  "/observations": "⚑",
  "/evidence": "🔎",
  "/summary": "∑",
  "/export": "⤓",
};

export function Sidebar() {
  const pathname = usePathname();
  const { vouchers, policies } = useStore();

  const counts: Record<string, number> = {
    "/vouchers": vouchers.length,
    "/policies": policies.length,
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          SA
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Statutory Audit</div>
          <div className="text-[11px] text-slate-500">Document Comparison</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="w-4 text-center text-[13px]">{ICON[item.href]}</span>
                {item.label}
              </span>
              {counts[item.href] != null && counts[item.href] > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">
                  {counts[item.href]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-4 py-3 text-[11px] leading-snug text-slate-400">
        Sources: uploaded vouchers &amp; policies only. No external references.
      </div>
    </aside>
  );
}
