# Sample test documents

Use these to try the app end-to-end. On the **Upload Documents** page, drop the
files from `vouchers/` into the **Vouchers** area and the files from `policies/`
into the **Policies** area.

These are plain-text samples so extraction is 100% reliable. Your real PDFs/DOCX
work the same way (as long as the PDF has selectable text, not a scan).

## Policies
- **Travel and Conveyance Policy** — limit ₹10,000, Manager approval, within 15 days, original bills.
- **Entertainment Expense Policy** — Sales dept, limit ₹5,000 per event, Director approval.
- **Capital Expenditure Policy** — limit ₹1,00,000, CFO approval, purchase order + invoice.

## Vouchers — and what the engine should conclude (from the documents only)
| Voucher | Maps to | Expected result | Why |
|--------|---------|-----------------|-----|
| V-01 | Travel | Non-Compliant | ₹12,500 > ₹10,000; approver "Team Lead" ≠ Manager; 18 days > 15 |
| V-02 | Travel | Compliant | ₹8,000, Manager, within window, bills attached |
| V-03 | Entertainment | Compliant | ₹4,500, Sales, Director approved, bill attached |
| V-04 | Entertainment | Non-Compliant | ₹7,000 > ₹5,000 limit |
| V-05 | Capital Expenditure | Compliant | ₹45,000, CFO approved, PO + invoice |
| V-06 | Capital Expenditure | Non-Compliant | approver "Manager" ≠ CFO |
| V-07 | Travel | Cannot Determine | no approver in voucher (not evidenced) |
| V-08 | (inconclusive) | Cannot Determine | office stationery — no distinctive policy term matches |
| V-09 | Travel | Non-Compliant | transaction 15-Apr → voucher 05-May = 20 days > 15 |
| V-10 | Entertainment | Cannot Determine | no approver in voucher (not evidenced) |

Exact wording of every deviation is shown on each voucher's Working Paper, with a
link back to the source line. Nothing here is hard-coded in the app — the results
are computed live from these files.
