# Statutory Audit Analysis — Document Comparison Engine

A production website for a CA / statutory-audit professional that analyses
**uploaded vouchers against uploaded policies — and nothing else.**

> **Source restriction (the core rule).** The only inputs used for any
> conclusion are the documents the user uploads: the vouchers and the policies.
> The engine never uses the internet, ICAI guidance, the Companies Act, GST /
> Income-tax law, Ind AS, industry practice, or general knowledge. When the
> documents do not answer a question it says **“Not specified in the provided
> documents.”** or **“Cannot be determined from the provided documents.”** — it
> never guesses.

## How it works

```
Documents → Extraction → Structured facts → Policy mapping →
Clause testing → Evidence → Observations → Summary
```

Everything runs **in the browser**. Uploaded files are parsed locally
(pdf.js for PDF, mammoth for DOCX, plain read for TXT/CSV) and never leave the
device. Because the comparison logic is a deterministic string/threshold engine
rather than a general-purpose LLM, it is structurally incapable of introducing
an outside rule — the most faithful implementation of the source-restriction
requirement, and it needs **no API keys**.

## Features

- **Upload** — separate voucher and policy drop-zones, per-file status
  (processing / successfully extracted / failed).
- **Extraction** — pulls only facts explicitly present (voucher no., dates,
  amount, approver, supporting docs…) and policy requirements (limits,
  approvals, timing, supporting-doc and eligibility rules) with clause/line refs.
- **Policy mapping** — compares each voucher against every policy and determines
  the applicable one from overlapping terms, or reports it as inconclusive.
- **Clause-by-clause testing** with results limited to *Compliant /
  Non-Compliant / Cannot Determine / Not Applicable*.
- **Amount, approval, timing, supporting-document and eligibility checks** — each
  applied only when the policy explicitly states the requirement.
- **31-column master audit checklist**, per-voucher working papers, an
  observation register, and full **source-text traceability**.
- **Dashboard & final summary** — every number computed from the actual analysis.
- **Export** — CSV of the checklist and observation register, printable report.
- Proper empty / loading / processing / error states throughout.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start
```

## Deploy to Vercel

1. Push this repository to GitHub (already done if you cloned it from there).
2. In Vercel → **Add New… → Project → Import** this GitHub repo.
3. Framework preset **Next.js** is detected automatically. No environment
   variables are required (there is no backend and no API key).
4. **Deploy.**

## Tech

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · pdf.js ·
mammoth. No server, no database, no external API.

## A note on scope

Impact, materiality and severity are **not** auto-assigned. Risk language
(fraud, penalty, misstatement…) appears only if the uploaded documents
themselves establish it. Missing information is classified precisely as
*Not specified*, *Not evidenced*, *Cannot Determine* or *Contradictory* — and is
never silently converted into a negative finding.
