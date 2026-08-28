"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader } from "@/components/ui";

// Source-traceability view: browse the raw extracted text of any uploaded
// document, so every finding can be verified against its origin.

export default function EvidencePage() {
  const { vouchers, policies } = useStore();
  const docs = [
    ...vouchers
      .filter((v) => v.status === "extracted")
      .map((v) => ({ id: v.id, name: v.fields.voucherNo || v.fileName, kind: "Voucher", text: v.text })),
    ...policies
      .filter((p) => p.status === "extracted")
      .map((p) => ({ id: p.id, name: p.name, kind: "Policy", text: p.text })),
  ];
  const [active, setActive] = useState(0);
  const [q, setQ] = useState("");

  if (docs.length === 0) {
    return (
      <>
        <PageHeader title="Source Evidence" subtitle="Verify any finding against the original document text." />
        <EmptyState title="No documents to inspect" hint="Upload documents to browse their extracted source text here." cta />
      </>
    );
  }

  const doc = docs[Math.min(active, docs.length - 1)];
  const lines = doc.text.split(/\r?\n/);
  const query = q.trim().toLowerCase();

  return (
    <>
      <PageHeader
        title="Source Evidence"
        subtitle="The full extracted text of every uploaded document. This is the sole source the engine draws on — Source → Section → Fact → Comparison → Conclusion."
      />
      <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
        <div className="card h-fit p-2">
          {docs.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActive(i)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                i === active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="min-w-0 truncate">{d.name}</span>
              <span
                className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  d.kind === "Policy" ? "bg-brand-100 text-brand-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {d.kind}
              </span>
            </button>
          ))}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {doc.name} <span className="font-normal text-slate-400">· {doc.kind}</span>
            </h2>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search within document…"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed">
            {lines.map((ln, i) => {
              const match = query && ln.toLowerCase().includes(query);
              return (
                <div
                  key={i}
                  className={`flex gap-3 ${match ? "rounded bg-amber-100 px-1" : ""}`}
                >
                  <span className="w-10 shrink-0 select-none text-right text-slate-300">{i + 1}</span>
                  <span className="whitespace-pre-wrap text-slate-700">{ln || " "}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
