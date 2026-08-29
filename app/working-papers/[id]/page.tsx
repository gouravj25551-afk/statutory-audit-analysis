"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Evidence, PageHeader, ResultBadge } from "@/components/ui";
import { fmt } from "@/lib/engine";
import { CheckOutcome, VoucherDoc } from "@/lib/types";

export default function WorkingPaperDetail() {
  const params = useParams();
  const id = params?.id as string;
  const { vouchers, analyses } = useStore();
  const v = vouchers.find((x) => x.id === id);
  const a = v ? analyses[v.id] : undefined;

  if (!v || !a) {
    return (
      <>
        <PageHeader title="Working Paper" />
        <div className="card p-6 text-sm text-slate-500">
          This voucher was not found (it may not be extracted yet).{" "}
          <Link href="/working-papers" className="text-brand-600 hover:underline">
            Back to working papers
          </Link>
          .
        </div>
      </>
    );
  }

  const f = v.fields;

  return (
    <>
      <PageHeader
        title={`Working Paper — ${f.voucherNo || v.fileName}`}
        subtitle="Every conclusion links back to the exact source line. Nothing outside the uploaded documents is used."
        actions={
          <div className="flex items-center gap-2">
            <ResultBadge value={a.finalConclusion} />
            <Link href="/working-papers" className="btn-ghost">
              ← All papers
            </Link>
          </div>
        }
      />

      {/* Voucher details */}
      <Section title="1 · Voucher Details">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
          <KV label="Voucher No." value={f.voucherNo} />
          <KV label="Voucher Date" value={f.voucherDate} />
          <KV label="Transaction Date" value={f.transactionDate} />
          <KV label="Invoice Date" value={f.invoiceDate} />
          <KV label="Payment Date" value={f.paymentDate} />
          <KV label="Amount" value={f.amount != null ? fmt(f.amount) : undefined} />
          <KV label="Party / Person" value={f.party} />
          <KV label="Department" value={f.department} />
          <KV label="Approver" value={f.approver} />
          <KV label="Approval Date" value={f.approvalDate} />
          <div className="col-span-2 md:col-span-4">
            <KV label="Description / Nature" value={f.description || f.nature} />
          </div>
        </div>
      </Section>

      {/* Policy mapping */}
      <Section title="2 · Policy Mapping">
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Policy</th>
                <th className="th">Relevant Clause</th>
                <th className="th">Voucher Evidence</th>
                <th className="th text-right">Score</th>
                <th className="th">Result</th>
              </tr>
            </thead>
            <tbody>
              {a.comparisons.map((c) => (
                <tr key={c.policyId} className={`border-b border-slate-50 ${c.policyId === a.applicablePolicyId ? "bg-brand-50/40" : ""}`}>
                  <td className="td font-medium">{c.policyName}</td>
                  <td className="td text-slate-500">{c.relevantClause}</td>
                  <td className="td text-slate-600">{c.voucherEvidence}</td>
                  <td className="td text-right tabular-nums">{c.matchScore}</td>
                  <td className="td"><ResultBadge value={c.match} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <div className="label">Applicable policy &amp; basis</div>
          <p className="mt-0.5 text-sm text-slate-700">{a.mappingBasis}</p>
        </div>
      </Section>

      {/* Clause testing */}
      <Section title="3 · Clause-by-Clause Testing">
        {a.clauseTests.length === 0 ? (
          <p className="text-sm text-slate-500">
            No applicable policy determined, so no clauses were tested. Cannot be determined from the
            provided documents.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th">Clause</th>
                  <th className="th">Policy Requirement</th>
                  <th className="th">Voucher Evidence</th>
                  <th className="th">Result</th>
                  <th className="th">Source</th>
                </tr>
              </thead>
              <tbody>
                {a.clauseTests.map((t, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="td whitespace-nowrap text-slate-500">{t.clause}</td>
                    <td className="td max-w-sm">{t.requirement}</td>
                    <td className="td max-w-sm text-slate-600">{t.voucherEvidence}</td>
                    <td className="td"><ResultBadge value={t.result} /></td>
                    <td className="td"><Evidence source={t.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Checks */}
      <Section title="4 · Compliance Checks">
        <div className="grid gap-3 md:grid-cols-2">
          <CheckCard title="Amount" c={a.amountCheck} />
          <CheckCard title="Approval" c={a.approvalCheck} />
          <CheckCard title="Timing" c={a.timingCheck} />
          <CheckCard title="Supporting Documents" c={a.supportingCheck} />
          <CheckCard title="Eligibility" c={a.eligibilityCheck} />
        </div>
      </Section>

      {/* Observations */}
      <Section title="5 · Observations">
        {a.observations.length === 0 ? (
          <p className="text-sm text-emerald-700">
            No exception identified from the uploaded documents for this voucher.
          </p>
        ) : (
          <ul className="space-y-2">
            {a.observations.map((o) => (
              <li key={o.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {o.exceptionType} · {o.missingKind}
                  </span>
                  <ResultBadge value={o.conclusion} />
                </div>
                <p className="mt-1 text-sm text-slate-700">{o.exactDeviation}</p>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>Evidence:</span>
                  <Evidence source={o.source} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Conclusion */}
      <Section title="6 · Final Conclusion">
        <div className="flex items-center gap-3">
          <ResultBadge value={a.finalConclusion} />
          <span className="text-sm text-slate-600">
            {a.finalConclusion === "Cannot Determine" &&
              "Cannot be determined from the provided documents."}
            {a.finalConclusion === "Compliant" &&
              "All applicable, testable requirements are met per the uploaded policy."}
            {a.finalConclusion === "Non-Compliant" &&
              "At least one applicable requirement in the uploaded policy is not met."}
            {a.finalConclusion === "Not Applicable" &&
              "No applicable requirement in the uploaded policy."}
          </span>
        </div>
      </Section>

      <RawText v={v} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card fade-in mb-4 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-slate-700">
        {value ? value : <span className="text-slate-400">Not specified in the voucher.</span>}
      </div>
    </div>
  );
}

function CheckCard({ title, c }: { title: string; c: CheckOutcome }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <ResultBadge value={c.result} />
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        <div>
          <dt className="label">Policy requirement</dt>
          <dd className="text-slate-700">{c.requirement}</dd>
        </div>
        <div>
          <dt className="label">Voucher evidence</dt>
          <dd className="text-slate-700">{c.voucherEvidence}</dd>
        </div>
        {c.requiredApprover != null && (
          <div className="mt-1 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2">
            <div>
              <dt className="label">Required approver</dt>
              <dd className="text-slate-700">{c.requiredApprover}</dd>
            </div>
            <div>
              <dt className="label">Actual approver</dt>
              <dd className="text-slate-700">{c.actualApprover || "—"}</dd>
            </div>
            <div>
              <dt className="label">Required / actual levels</dt>
              <dd className="text-slate-700">
                {(c.requiredLevels ?? "—")} / {(c.actualLevels ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="label">Correct authority?</dt>
              <dd>{c.correctAuthority ? <ResultBadge value={c.correctAuthority} /> : "—"}</dd>
            </div>
            {c.amountDrivesAuthority && (
              <div className="col-span-2">
                <dt className="label">Amount-driven authority</dt>
                <dd className="text-slate-600">
                  The required approver depends on the transaction amount per the policy&rsquo;s
                  authority matrix.
                </dd>
              </div>
            )}
            {c.authorityBasis && (
              <div className="col-span-2">
                <dt className="label">Authority basis</dt>
                <dd className="text-slate-600">{c.authorityBasis}</dd>
              </div>
            )}
          </div>
        )}
        {c.note && (
          <div>
            <dt className="label">Note</dt>
            <dd className="text-slate-600">{c.note}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function RawText({ v }: { v: VoucherDoc }) {
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Source document text (extracted)
      </summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-600">
        {v.text}
      </pre>
    </details>
  );
}
