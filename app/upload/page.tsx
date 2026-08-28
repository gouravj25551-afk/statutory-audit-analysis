"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, StatusBadge } from "@/components/ui";

const ACCEPT = ".pdf,.docx,.txt,.csv,.md,.json";

export default function UploadPage() {
  const {
    vouchers,
    policies,
    addVoucherFiles,
    addPolicyFiles,
    removeVoucher,
    removePolicy,
    clearAll,
  } = useStore();

  return (
    <>
      <PageHeader
        title="Upload Documents"
        subtitle="Upload the vouchers and the policies. Files are read in your browser only — nothing is sent to any server. Supported: PDF, DOCX, TXT, CSV."
        actions={
          (vouchers.length > 0 || policies.length > 0) && (
            <button
              onClick={() => {
                if (confirm("Remove all uploaded documents and analysis?")) clearAll();
              }}
              className="btn-ghost"
            >
              Clear all
            </button>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <DropCard
          title="Vouchers"
          hint="Upload your voucher documents (e.g. 10 vouchers)."
          onFiles={addVoucherFiles}
          kind="voucher"
        >
          {vouchers.length === 0 ? (
            <p className="px-1 py-3 text-sm text-slate-400">No vouchers uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {vouchers.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{v.fileName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {v.fields?.voucherNo && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                          {v.fields.voucherNo}
                        </span>
                      )}
                      {v.status === "extracted" && v.fields?.amount != null && (
                        <span>Amt: {v.fields.amount.toLocaleString("en-IN")}</span>
                      )}
                      {v.error && <span className="text-rose-600">{v.error}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={v.status} />
                    <button
                      onClick={() => removeVoucher(v.id)}
                      className="text-slate-300 hover:text-rose-500"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DropCard>

        <DropCard
          title="Policies"
          hint="Upload your policy documents (e.g. 3 policies)."
          onFiles={addPolicyFiles}
          kind="policy"
        >
          {policies.length === 0 ? (
            <p className="px-1 py-3 text-sm text-slate-400">No policies uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {policies.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {p.status === "extracted" ? p.name : p.fileName}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{p.fileName}</span>
                      {p.status === "extracted" && (
                        <span>· {p.requirements.length} requirement(s) found</span>
                      )}
                      {p.error && <span className="text-rose-600">{p.error}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={p.status} />
                    <button
                      onClick={() => removePolicy(p.id)}
                      className="text-slate-300 hover:text-rose-500"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DropCard>
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Tip: text-based PDFs and DOCX extract best. Scanned/image-only PDFs contain no selectable
        text and will report an extraction failure — re-save them as a text PDF or upload a TXT copy.
      </p>
    </>
  );
}

function DropCard({
  title,
  hint,
  kind,
  onFiles,
  children,
}: {
  title: string;
  hint: string;
  kind: "voucher" | "policy";
  onFiles: (files: FileList | File[]) => Promise<void>;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      await onFiles(files);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            kind === "voucher" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"
          }`}
        >
          {kind === "voucher" ? "Voucher area" : "Policy area"}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) handle(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-7 text-center transition ${
          drag ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <div className="text-2xl text-slate-300">⬆</div>
        <div className="mt-1 text-sm font-medium text-slate-700">
          {busy ? "Reading files…" : "Drag & drop or click to browse"}
        </div>
        <div className="text-xs text-slate-400">PDF · DOCX · TXT · CSV — multiple files allowed</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3">{children}</div>
    </section>
  );
}
