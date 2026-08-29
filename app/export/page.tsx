"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { aggregate } from "@/lib/aggregate";
import { buildChecklistRows, CHECKLIST_COLUMNS } from "@/lib/checklist";
import { buildAuditWorkbook } from "@/lib/excel";
import { EmptyState, PageHeader } from "@/components/ui";

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(headers: string[], rows: string[][]): string {
  const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

function download(name: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { vouchers, policies, analyses } = useStore();
  const agg = useMemo(() => aggregate(vouchers, policies, analyses), [vouchers, policies, analyses]);
  const checklistRows = useMemo(() => buildChecklistRows(vouchers, analyses), [vouchers, analyses]);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [xlsxError, setXlsxError] = useState<string | null>(null);

  const generateWorkbook = async () => {
    setXlsxBusy(true);
    setXlsxError(null);
    try {
      // Built entirely from the existing `analyses` — no re-analysis, no AI.
      const buffer = await buildAuditWorkbook(vouchers, policies, analyses);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`Audit-Working-Paper-${stamp}.xlsx`, blob);
    } catch (e: any) {
      setXlsxError(e?.message || "Could not generate the Excel workbook.");
    } finally {
      setXlsxBusy(false);
    }
  };

  if (checklistRows.length === 0) {
    return (
      <>
        <PageHeader title="Export / Report" subtitle="Download the audit working papers and observations." />
        <EmptyState title="Nothing to export yet" hint="Upload and analyse documents first." cta />
      </>
    );
  }

  const exportChecklist = () => {
    const rows = checklistRows.map((r) => CHECKLIST_COLUMNS.map((c) => r[c] || ""));
    download("master-audit-checklist.csv", toCsv([...CHECKLIST_COLUMNS], rows));
  };

  const exportObservations = () => {
    const headers = [
      "Voucher",
      "Policy",
      "Clause",
      "Policy Requirement",
      "Voucher Evidence",
      "Exact Deviation",
      "Conclusion",
      "Exception Type",
      "Missing Kind",
      "Source",
    ];
    const rows: string[][] = [];
    for (const v of vouchers) {
      const a = analyses[v.id];
      if (!a) continue;
      for (const o of a.observations) {
        rows.push([
          o.voucherNo,
          o.policyName,
          o.clause,
          o.policyRequirement,
          o.voucherEvidence,
          o.exactDeviation,
          o.conclusion,
          o.exceptionType,
          o.missingKind,
          o.source ? `${o.source.docName} · ${o.source.location}` : "",
        ]);
      }
    }
    download("observation-register.csv", toCsv(headers, rows));
  };

  return (
    <>
      <PageHeader
        title="Export / Report"
        subtitle="Export the working papers as CSV or print a report. All content is generated from the uploaded documents."
      />

      <section className="card mb-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-brand-600 px-5 py-4">
          <div className="min-w-0 text-white">
            <h2 className="text-base font-semibold">Audit Working Paper (Excel)</h2>
            <p className="mt-0.5 max-w-2xl text-[13px] text-brand-100">
              One professional <strong>.xlsx</strong> — 7 sheets: Executive Summary, Voucher-Policy
              Mapping, Detailed Audit Checklist (32 columns), Approval Verification, Clause-by-Clause
              Testing, Observation Register and Evidence Matrix. Built directly from this analysis —
              no copy-paste, no second AI pass.
            </p>
          </div>
          <button
            onClick={generateWorkbook}
            disabled={xlsxBusy}
            className="btn shrink-0 bg-white px-4 py-2.5 font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-70"
          >
            {xlsxBusy ? "Generating…" : "Generate Audit Working Paper"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-xs text-slate-500">
          <span>{checklistRows.length} voucher(s)</span>
          <span>{agg.totalPolicies} polic{agg.totalPolicies === 1 ? "y" : "ies"}</span>
          <span>{agg.totalObservations} observation(s)</span>
          <span className="text-slate-400">Website result = Excel result (same structured data)</span>
        </div>
        {xlsxError && (
          <div className="border-t border-rose-200 bg-rose-50 px-5 py-2 text-xs text-rose-700">
            {xlsxError}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Master Audit Checklist"
          desc={`${checklistRows.length} voucher row(s), all 31 working-paper columns.`}
          action="Download CSV"
          onClick={exportChecklist}
        />
        <Card
          title="Observation Register"
          desc={`${agg.totalObservations} observation(s), each with source reference.`}
          action="Download CSV"
          onClick={exportObservations}
        />
        <Card
          title="Printable Report"
          desc="Open the browser print dialog to save the current summary as PDF."
          action="Print / Save PDF"
          onClick={() => window.print()}
        />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-base font-semibold text-slate-800">Audit Report — Summary</h2>
        <p className="mt-1 text-xs text-slate-500">
          Prepared solely from the uploaded documents. No external source used.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
          <Row k="Total vouchers" v={agg.totalVouchers} />
          <Row k="Total policies" v={agg.totalPolicies} />
          <Row k="Compliant" v={agg.byResult.Compliant} />
          <Row k="Non-Compliant" v={agg.byResult["Non-Compliant"]} />
          <Row k="Cannot Determine" v={agg.byResult["Cannot Determine"]} />
          <Row k="Not Applicable" v={agg.byResult["Not Applicable"]} />
          <Row k="Inconclusive mappings" v={agg.inconclusiveMappings} />
          <Row k="Total observations" v={agg.totalObservations} />
        </dl>
      </section>
    </>
  );
}

function Card({
  title,
  desc,
  action,
  onClick,
}: {
  title: string;
  desc: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="card flex flex-col p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 flex-1 text-xs text-slate-500">{desc}</p>
      <button onClick={onClick} className="btn-primary mt-3">
        {action}
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold tabular-nums text-slate-800">{v}</dd>
    </div>
  );
}
