# Product roadmap

Living checklist for the household budget PWA. Update this file when major capabilities ship.

## Done

- [x] Two-user auth, monthly overview, income & next paycheck
- [x] Expenses, bills, budget envelopes with rolled-in + copy from prior month + `/budgets` page
- [x] Receipt upload, OCR (images + PDF raster fallback), parsed lines
- [x] Receipt → **single** expense and **batch** parsed lines → expenses (split group, shared `receiptId`)
- [x] Shopping memory, suggestions, trip logging, **edit trip** (replace line items)
- [x] Paycheck coach, cash flow, insights, debt, net worth snapshots
- [x] CSV / OFX / QIF import, merchant rules, CSV exports (expenses, bills, budgets)
- [x] Goals: add, update saved, **edit goal**, **delete adjustments**, delete goal
- [x] Overview **savings goals** strip (top goals + link to `/goals`)
- [x] Shopping: **duplicate trip** as a new draft (same lines, today’s date, “(copy)” in store name)
- [x] Receipts: **move receipt** to another calendar month (±6 months picker)
- [x] Expenses: **bulk tags** (append or replace) and **bulk budget link** (or clear) for selected rows

- [x] Shopping: **Start from last trip** one-click (`/shopping?from=last` + prominent button); duplicates last lines as a new unsaved draft

## Next (suggested)

- [ ] Optional Plaid or file-based bank sync (high complexity; needs credentials)
- [ ] PWA offline shell / push reminders (optional)

## Principles

- **Photos first** for receipts; bank sync is optional later.
- **No surprise data loss**: destructive actions use clear labels; duplicates guarded where it matters.
- **Household-wide** data: two users, one shared ledger.
