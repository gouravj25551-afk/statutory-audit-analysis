"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EvidenceRef, Result } from "@/lib/types";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="fade-in mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const RESULT_STYLES: Record<string, string> = {
  Compliant: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Non-Compliant": "bg-rose-50 text-rose-700 ring-rose-200",
  "Cannot Determine": "bg-amber-50 text-amber-700 ring-amber-200",
  "Not Applicable": "bg-slate-100 text-slate-500 ring-slate-200",
  Match: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "No Match": "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ResultBadge({ value }: { value: string }) {
  const style = RESULT_STYLES[value] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {value}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  extracted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  processing: "bg-blue-50 text-blue-700 ring-blue-200",
  uploaded: "bg-slate-100 text-slate-600 ring-slate-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status }: { status: string }) {
  const label =
    status === "extracted"
      ? "Successfully extracted"
      : status === "processing"
      ? "Processing…"
      : status === "failed"
      ? "Failed"
      : "Uploaded";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.uploaded
      }`}
    >
      {status === "processing" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
      )}
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta?: boolean;
}) {
  return (
    <div className="card fade-in flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
        ▢
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{hint}</p>
      {cta && (
        <Link href="/upload" className="btn-primary mt-4">
          Upload documents
        </Link>
      )}
    </div>
  );
}

// A small inline evidence chip that expands to show the exact source text.
export function Evidence({ source }: { source: EvidenceRef | null }) {
  const [open, setOpen] = useState(false);
  if (!source) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
        title="View source text"
      >
        <span className={source.docKind === "policy" ? "text-brand-600" : "text-emerald-600"}>
          ◆
        </span>
        {source.docName.length > 22 ? source.docName.slice(0, 20) + "…" : source.docName}
        <span className="text-slate-400">· {source.location}</span>
      </button>
      {open && (
        <span className="absolute left-0 top-full z-20 mt-1 block w-72 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
          <span className="label block">
            {source.docKind === "policy" ? "Policy source" : "Voucher source"} · {source.location}
          </span>
          <span className="mt-1 block text-xs text-slate-500">{source.docName}</span>
          <span className="mt-2 block rounded bg-slate-50 p-2 text-xs italic text-slate-700">
            “{source.snippet}”
          </span>
        </span>
      )}
    </span>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    good: "text-emerald-600",
    bad: "text-rose-600",
    warn: "text-amber-600",
  };
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  );
}

export function conclusionTone(r: Result): "good" | "bad" | "warn" | "default" {
  if (r === "Compliant") return "good";
  if (r === "Non-Compliant") return "bad";
  if (r === "Cannot Determine") return "warn";
  return "default";
}
