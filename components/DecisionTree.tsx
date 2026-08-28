"use client";

// The fixed policy decision flow (Section 4). It never introduces an external
// requirement — it is the procedure the engine follows for every voucher.

const STEPS = [
  "Voucher",
  "Extract Facts",
  "Compare with Each Policy",
  "Determine Applicable Policy",
  "Identify Applicable Clauses",
  "Test Voucher",
  "Identify Deviation",
  "Attach Evidence",
  "Conclusion",
];

export function DecisionTree() {
  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Policy Decision Flow</h2>
      <div className="scroll-x">
        <div className="flex min-w-max items-center gap-1.5 pb-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  i === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : i === STEPS.length - 1
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {s}
              </div>
              {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        This flow is applied identically to every voucher. No step introduces a requirement that is
        not present in the uploaded policies.
      </p>
    </div>
  );
}
