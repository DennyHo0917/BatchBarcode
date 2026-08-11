# GA4 event plan

The site sends only low-cardinality workflow metadata. It never sends barcode values, label text, file names, worksheet names or source column names.

## Events

| Event | When | Core parameters |
| --- | --- | --- |
| `import_result` | A CSV/XLSX import succeeds or fails | `result`, `error_code`, `file_type`, `count_bucket`, `row_count`, `column_count`, `page_type` |
| `mapping_complete` | The first successful generation after a file is mapped | `barcode_type`, `input_source`, `count_bucket`, `has_header`, `has_label`, `has_extra` |
| `generate_result` | A user-triggered generation succeeds or fails | `result`, `error_code`, `barcode_type`, `input_source`, `count_bucket`, `barcode_count`, final layout parameters |
| `limit_reached` | The 100-row or 5 MB limit blocks the workflow | `limit_type`, `input_source`, `count_bucket`, `page_type` |
| `layout_commit` | A batch is successfully generated with a printable layout | `layout_preset`, `page_size`, `page_count`, rows/columns and text settings |
| `export_result` | PNG, PNG ZIP or PDF export succeeds or fails | `result`, `error_code`, `export_type`, barcode/count/layout parameters |
| `print_open` | The browser print dialog is opened | barcode/count/layout parameters |
| `high_volume_interest_open` | A user opens the larger-batch request form after hitting the 100-row limit | `page_type`, `input_source` |
| `high_volume_interest` | A user submits the larger-batch request form | `batch_size_bucket`, `frequency`, `printer_type`, `page_type`, `input_source` |

The larger-batch form is currently analytics-only and sends only the listed low-cardinality choices; the submit handler is the narrow interface to replace if a future backend is added.

`page_view` remains the automatically collected entry event. Print completion cannot be observed reliably from browser JavaScript, so the event is intentionally named `print_open`.

## Error codes

Stable codes include `none`, `invalid_file_type`, `file_too_large`, `read_error`, `empty_file`, `library_unavailable`, `batch_limit`, `empty_input`, `invalid_scale`, `invalid_layout`, `invalid_value`, `value_too_long`, `renderer_error`, `png_error`, `zip_error` and `pdf_error`.

## GA4 custom definitions

Register these event-scoped custom dimensions first:

- `barcode_type`
- `input_source`
- `count_bucket`
- `result`
- `error_code`
- `export_type`
- `limit_type`
- `layout_preset`
- `page_size`
- `batch_size_bucket`
- `frequency`
- `printer_type`

Register `barcode_count` and `page_count` as event-scoped custom metrics only if numeric reporting is needed. The remaining parameters can stay unregistered until a concrete report needs them.

## Verification

1. Deploy the updated JavaScript.
2. Use GA4 Realtime or DebugView to run one success and one error for import, generation and export.
3. Confirm barcode values, file names, worksheet names and column names are absent.
4. Build the funnel: `page_view` → optional `import_result(success)` → `generate_result(success)` → `export_result(success)` or `print_open`.
