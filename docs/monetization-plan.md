# Monetization plan

## First audience hypothesis

Start with warehouse, inventory and small e-commerce operators who already keep item, order or asset IDs in CSV/Excel and need printable labels without uploading internal data. This is a hypothesis to validate, not a proven segment.

## Free product boundary

Keep the complete acquisition loop free: import CSV/XLSX, map fields, validate up to 100 rows, preview A4/Letter sheets, download a PNG ZIP or PDF, and print locally. Do not remove the useful SEO promise behind a paywall.

## Paid moment to test

The strongest first paid candidate is repeated high-volume work: batches above 100 rows plus named reusable label templates and batch history stored locally or in an optional account. Do not build team collaboration, API access, or cloud storage until interviews show recurring demand.

Test willingness to pay at these moments:

1. A batch exceeds 100 rows.
2. A user repeats the same layout every week.
3. A user needs an exact commercial label-sheet or thermal-printer preset.
4. A user wants branded templates, job history, or shared team presets.

## Pricing hypotheses

- One-time desktop/local upgrade for occasional operators.
- Subscription only if saved history, synchronization or team workflows are validated.
- Usage pricing only if an API or server-side rendering becomes a proven need.

Do not select a pricing model until 5-10 workflow interviews and funnel data identify repeat frequency and the actual paid moment.

## Funnel events

The current implementation records page view, import/generation/export success and failure, mapping completion, limit hits, committed layout and print intent. Events include low-cardinality workflow metadata but never barcode values, label text, file names, worksheet names or source column names. The full schema is in `docs/analytics-plan.md`.

Weekly review:

- Tool entry to generation.
- Generation to layout interaction.
- Generation to PNG ZIP / PDF export or print.
- Batch-size distribution and file-import share.

## Interview script

Ask the user to complete a real job with their own non-sensitive sample file, then ask:

1. What created this barcode job and how often does it recur?
2. Which columns are in the source file?
3. Which printer and label stock are used?
4. Where did the workflow slow down or fail?
5. Which current tool or manual workaround does this replace?
6. At what batch size or repeat frequency would paying be easier than continuing manually?
7. Which one missing feature would make this usable next week?

Record source format, batch size, printer, paper, failure point, alternative, frequency and willingness-to-pay trigger. Do not record barcode payloads.

## Recruitment message draft

> I am testing a browser-only batch barcode label tool for CSV/Excel workflows. It creates printable A4/Letter PDF sheets locally without uploading the data. I am looking for warehouse, inventory, e-commerce or office operators willing to try one real label task and share where it fails. No sales pitch; the session takes about 15 minutes.

Publishing this message or contacting users requires the owner's chosen communities/accounts and explicit approval.
