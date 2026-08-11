(async function (root) {
  function parseCsv(input) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"' && !cell.trim()) {
        cell = '';
        quoted = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n') {
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else if (char !== '\r') {
        cell += char;
      }
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows[0] && rows[0][0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    return rows;
  }

  function csvFirstCell(line) {
    return parseCsv(line)[0]?.[0] || '';
  }

  const BATCH_LIMIT = 100;
  const librarySources = {
    xlsx: { src: '/assets/vendor/xlsx.full.min.js?v=0.20.3', global: 'XLSX', label: 'Excel' },
    zip: { src: '/assets/vendor/jszip.min.js?v=3.10.1', global: 'JSZip', label: 'ZIP' },
    pdf: { src: '/assets/vendor/jspdf.umd.min.js?v=4.2.1', global: 'jspdf', label: 'PDF' },
  };

  function libraryError(label) {
    const error = new Error(`${label} library did not load.`);
    error.code = 'library_unavailable';
    return error;
  }

  function createLibraryLoader(doc, target, sources = librarySources) {
    const loads = new Map();
    function loadScript(src, ready, label) {
      if (ready()) return Promise.resolve();
      if (loads.has(src)) return loads.get(src);
      const load = new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', () => ready() ? resolve() : reject(libraryError(label)), { once: true });
        script.addEventListener('error', () => reject(libraryError(label)), { once: true });
        doc.head.append(script);
      });
      loads.set(src, load);
      return load;
    }
    return function ensureLibrary(name) {
      const source = sources[name];
      if (!source) return Promise.reject(libraryError(name));
      return loadScript(source.src, () => Boolean(target[source.global]), source.label);
    };
  }

  function parseBatchValues(input, mode = 'lines', limit = BATCH_LIMIT) {
    const values = (mode === 'csv'
      ? parseCsv(input).map((row) => row[0])
      : input.split(/\r?\n/).map((line) => line.trim()))
      .filter(Boolean);

    return {
      values: values.slice(0, limit),
      total: values.length,
      truncated: values.length > limit,
    };
  }

  function hasValidCheckDigit(text) {
    const body = text.slice(0, -1);
    let sum = 0;
    for (let i = body.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
      sum += Number(body[i]) * weight;
    }
    return Number(text[text.length - 1]) === (10 - (sum % 10)) % 10;
  }

  function validateValue(type, text) {
    if (!text) return 'Add data to encode.';
    if (type === 'ean13' && !/^\d{12,13}$/.test(text)) return 'EAN-13 needs 12 or 13 digits.';
    if (type === 'ean13' && text.length === 13 && !hasValidCheckDigit(text)) return 'The EAN-13 check digit is not valid.';
    if (type === 'upca' && !/^\d{11,12}$/.test(text)) return 'UPC-A needs 11 or 12 digits.';
    if (type === 'upca' && text.length === 12 && !hasValidCheckDigit(text)) return 'The UPC-A check digit is not valid.';
    if (type === 'pdf417' && text.length > 900) return 'Keep PDF417 data under 900 characters for this online tool.';
    return '';
  }

  function pageCountFor(total, columns, rows) {
    return total ? Math.ceil(total / (columns * rows)) : 0;
  }

  function countBucket(total) {
    if (total <= 0) return '0';
    if (total === 1) return '1';
    if (total <= 10) return '2_10';
    if (total <= 50) return '11_50';
    if (total <= 100) return '51_100';
    return '101_plus';
  }

  const layoutDefaults = {
    preset: 'a4-2x4',
    pageSize: 'a4',
    margin: 10,
    columns: 2,
    rows: 4,
    gap: 4,
    scale: 3,
    showText: true,
    textPosition: 'bottom',
  };

  const layoutPresets = {
    'a4-2x4': { ...layoutDefaults },
    'letter-3x3': {
      preset: 'letter-3x3',
      pageSize: 'letter',
      margin: 12,
      columns: 3,
      rows: 3,
      gap: 5,
      scale: 3,
      showText: true,
      textPosition: 'top',
    },
  };

  function normalizeLayoutPreferences(value = {}) {
    const preset = value.preset === 'custom' || Object.prototype.hasOwnProperty.call(layoutPresets, value.preset)
      ? value.preset
      : layoutDefaults.preset;
    const fallback = layoutPresets[preset] || layoutDefaults;
    const numberInRange = (candidate, minimum, maximum, fallbackValue) => {
      const number = Number(candidate);
      return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallbackValue;
    };
    return {
      preset,
      pageSize: value.pageSize === 'a4' || value.pageSize === 'letter' ? value.pageSize : fallback.pageSize,
      margin: numberInRange(value.margin, 0, 25, fallback.margin),
      columns: numberInRange(value.columns, 1, 4, fallback.columns),
      rows: numberInRange(value.rows, 1, 10, fallback.rows),
      gap: numberInRange(value.gap, 0, 20, fallback.gap),
      scale: numberInRange(value.scale, 1, 8, fallback.scale),
      showText: typeof value.showText === 'boolean' ? value.showText : fallback.showText,
      textPosition: value.textPosition === 'top' || value.textPosition === 'bottom' ? value.textPosition : fallback.textPosition,
    };
  }

  function looksLikeHeader(rows) {
    if (rows.length < 2) return false;
    const commonHeader = /^(barcode|barcode value|code|id|sku|value|label|label text|name|description|title)$/i;
    return rows[0].some((cell) => commonHeader.test(cell.trim()));
  }

  function mapCsvRows(rows, hasHeader, valueIndex, labelIndex = -1, extraIndex = -1, limit = BATCH_LIMIT) {
    const dataRows = rows.slice(hasHeader ? 1 : 0);
    const seen = new Set();
    let empty = 0;
    let duplicates = 0;
    const records = [];

    dataRows.forEach((row, index) => {
      const value = (row[valueIndex] || '').trim();
      if (!value) {
        empty += 1;
        return;
      }
      if (seen.has(value)) duplicates += 1;
      seen.add(value);
      records.push({
        value,
        label: labelIndex >= 0 ? (row[labelIndex] || '').trim() || value : value,
        extra: extraIndex >= 0 ? (row[extraIndex] || '').trim() : '',
        sourceRow: index + (hasHeader ? 2 : 1),
      });
    });

    return {
      records: records.slice(0, limit),
      total: records.length,
      empty,
      duplicates,
      truncated: records.length > limit,
    };
  }

  function batchLimitMessage(total) {
    return `${total} values detected. The current limit is ${BATCH_LIMIT}; split this into smaller batches.`;
  }

  function highVolumeEventParams({
    batchSizeBucket,
    frequency,
    printerType,
    emailProvided,
    pageType,
    inputSource,
  }) {
    return {
      batch_size_bucket: String(batchSizeBucket || ''),
      frequency: String(frequency || ''),
      printer_type: String(printerType || ''),
      email_provided: emailProvided ? 'yes' : 'no',
      page_type: String(pageType || 'unknown'),
      input_source: String(inputSource || 'unknown'),
    };
  }

  const api = {
    BATCH_LIMIT,
    csvFirstCell,
    parseCsv,
    parseBatchValues,
    looksLikeHeader,
    mapCsvRows,
    hasValidCheckDigit,
    validateValue,
    pageCountFor,
    countBucket,
    normalizeLayoutPreferences,
    batchLimitMessage,
    highVolumeEventParams,
    librarySources,
    createLibraryLoader,
  };
  root.BatchBarcodeTools = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const formatNames = {
    code128: 'Code 128',
    ean13: 'EAN-13',
    upca: 'UPC-A',
    pdf417: 'PDF417',
    micropdf417: 'MicroPDF417',
    qrcode: 'QR code',
    datamatrix: 'Data Matrix',
  };
  const singleToolPaths = {
    code128: '/code-128-barcode-generator/',
    ean13: '/ean-13-barcode-generator/',
    upca: '/upc-a-barcode-generator/',
    pdf417: '/',
    micropdf417: '/micro-pdf417-generator/',
    qrcode: '/qr-code-generator/',
    datamatrix: '/data-matrix-barcode-generator/',
  };
  const sampleValues = {
    ean13: '5901234123457\n4006381333931',
    upca: '012345678905\n036000291452',
    qrcode: 'https://www.batchbarcode.com/\nhttps://www.batchbarcode.com/qr-code-generator/',
    pdf417: 'SHIP-2026-0001\nINV-AX9-4821\nDOC-LOCAL-DEMO',
    micropdf417: 'DOC-2026-0001\nDOC-2026-0002',
    datamatrix: 'PART-AX9-001\nPART-AX9-002',
    code128: 'BATCH-2026-0001\nBATCH-2026-0002\nBATCH-2026-0003',
  };

  function mountFixedBatchUi(type) {
    const controls = document.querySelector('.controls');
    const workspace = document.querySelector('.workspace');
    if (!controls || !workspace) return;
    const name = formatNames[type] || 'Barcode';
    controls.innerHTML = `
      <h1>${name} Batch Label Generator</h1>
      <p class="subhead">Create multiple ${name} labels on an A4 or Letter sheet without leaving this format.</p>
      <nav class="generator-mode" aria-label="Generator mode">
        <a id="singleModeLink" href="${singleToolPaths[type] || '/'}">Single barcode</a>
        <span aria-current="page">Batch &amp; A4 PDF</span>
      </nav>
      <label for="inputMode">Input format</label>
      <select id="inputMode">
        <option value="lines">One value per line</option>
        <option value="csv">CSV first column</option>
      </select>
      <div class="section">
        <label for="barcodeData">Barcode data</label>
        <textarea id="barcodeData" spellcheck="false">${sampleValues[type] || sampleValues.code128}</textarea>
        <p class="hint">Up to 100 values. One barcode is created for each usable row.</p>
      </div>
      <div class="section csv-import">
        <label for="csvFile">Or upload CSV / Excel</label>
        <input id="csvFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
        <p class="hint">CSV or .xlsx, maximum 5 MB and 100 usable rows. Files stay in this browser.</p>
        <div id="csvMapping" class="csv-mapping" hidden>
          <div class="mapping-head"><strong id="csvFileName"></strong><button id="clearCsv" type="button">Clear file</button></div>
          <label class="checkbox-field" for="headerRow"><input id="headerRow" type="checkbox" checked> First row contains column names</label>
          <div class="layout-grid">
            <div><label for="barcodeColumn">Barcode value</label><select id="barcodeColumn"></select></div>
            <div><label for="labelColumn">Label text</label><select id="labelColumn"></select></div>
            <div><label for="extraColumn">Extra text</label><select id="extraColumn"></select></div>
          </div>
          <p class="csv-summary" id="csvSummary"></p>
          <div class="csv-preview" id="csvPreview" aria-label="CSV data preview"></div>
        </div>
      </div>
      <div class="section"><label for="scale">Barcode scale</label><input id="scale" type="number" min="1" max="8" value="3"></div>
      <div class="actions">
        <button class="primary" id="generate" type="button">Generate batch</button>
        <button id="download" type="button" disabled>Download first PNG</button>
        <button id="downloadAll" type="button" disabled>Download PNG ZIP</button>
        <button id="downloadPdf" type="button" disabled>Download PDF</button>
        <button id="print" type="button" disabled>Print batch</button>
      </div>
      <p class="status" id="status"></p>
      <section id="highVolumeCta" class="high-volume-interest section" hidden aria-labelledby="highVolumeTitle">
        <p><strong id="highVolumeTitle">Need more than 100 labels?</strong><br>Tell us about your workflow — larger batch support is being evaluated.</p>
        <button id="highVolumeOpen" type="button">Request larger batches</button>
        <div id="highVolumeInterest" hidden>
          <form id="highVolumeForm">
            <div class="high-volume-grid">
              <div>
                <label for="highVolumeSize">Batch size</label>
                <select id="highVolumeSize" name="batch_size_bucket" required>
                  <option value="">Choose one</option>
                  <option value="101_500">101–500</option>
                  <option value="501_5000">501–5,000</option>
                  <option value="5001_plus">5,001+</option>
                </select>
              </div>
              <div>
                <label for="highVolumeFrequency">Frequency</label>
                <select id="highVolumeFrequency" name="frequency" required>
                  <option value="">Choose one</option>
                  <option value="one_time">One time</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <label for="highVolumePrinter">Printer type</label>
                <select id="highVolumePrinter" name="printer_type" required>
                  <option value="">Choose one</option>
                  <option value="office_printer">Office printer</option>
                  <option value="zebra">Zebra</option>
                  <option value="brother">Brother</option>
                  <option value="dymo">DYMO</option>
                  <option value="other">Other</option>
                  <option value="not_sure">Not sure</option>
                </select>
              </div>
              <div>
                <label for="highVolumeEmail">Optional email</label>
                <input id="highVolumeEmail" name="email" type="email" autocomplete="email">
              </div>
            </div>
            <label for="highVolumeWorkflow">What are you trying to print? (optional)</label>
            <textarea id="highVolumeWorkflow" name="workflow" maxlength="300" rows="3"></textarea>
            <p class="hint">No barcode data, file names or column names are sent. This static version records an anonymous interest signal only; the optional email is not sent yet.</p>
            <button class="primary" type="submit">Submit request</button>
            <p class="status" id="highVolumeStatus" role="status" aria-live="polite"></p>
          </form>
        </div>
      </section>
      <details class="layout-settings section" open>
        <summary>Label layout</summary>
        <label for="layoutPreset">Layout preset</label>
        <select id="layoutPreset">
          <option value="a4-2x4">A4 · 2 columns × 4 rows</option>
          <option value="letter-3x3">Letter · 3 columns × 3 rows</option>
          <option value="custom">Custom</option>
        </select>
        <div class="layout-grid">
          <div><label for="pageSize">Page size</label><select id="pageSize"><option value="a4">A4</option><option value="letter">Letter</option></select></div>
          <div><label for="pageMargin">Margin (mm)</label><input id="pageMargin" type="number" min="0" max="25" value="10"></div>
          <div><label for="labelColumns">Columns</label><input id="labelColumns" type="number" min="1" max="4" value="2"></div>
          <div><label for="labelRows">Rows</label><input id="labelRows" type="number" min="1" max="10" value="4"></div>
          <div><label for="labelGap">Gap (mm)</label><input id="labelGap" type="number" min="0" max="20" value="4"></div>
          <div><label for="textPosition">Text position</label><select id="textPosition"><option value="bottom">Below barcode</option><option value="top">Above barcode</option></select></div>
        </div>
        <label class="checkbox-field" for="showText"><input id="showText" type="checkbox" checked> Show label text</label>
        <div class="layout-footer"><p class="hint">Saved in this browser. Test one page before a large run.</p><button id="resetLayout" type="button">Restore defaults</button></div>
      </details>
      <p class="hint section">Generated locally. Barcode data is not uploaded.</p>`;

    workspace.querySelector('.preview-head')?.remove();
    workspace.querySelector('#preview, #sheet')?.remove();
    workspace.insertAdjacentHTML('afterbegin', `
      <div class="preview-head"><h2>${name} batch preview</h2><p class="hint" id="count">No barcodes yet</p></div>
      <div id="preview" class="preview batch-preview">Batch preview will appear here.</div>`);
  }

  const ensureLibrary = createLibraryLoader(document, root);

  const fixedType = document.body.dataset.bcid || '';
  const fixedBatchMode = fixedType && new URLSearchParams(root.location.search).get('mode') === 'batch';
  if (fixedBatchMode) {
    document.body.dataset.batch = 'true';
    document.body.dataset.layout = 'true';
    document.body.dataset.pageType = `${fixedType}_batch_generator`;
    mountFixedBatchUi(fixedType);
  }
  if (document.body.dataset.batch === 'true') {
    document.querySelectorAll('.site-nav a').forEach((link) => {
      const url = new URL(link.href, root.location.href);
      if (Object.values(singleToolPaths).includes(url.pathname)) {
        url.searchParams.set('mode', 'batch');
        link.href = `${url.pathname}${url.search}`;
      }
    });
  }
  const batchMode = document.body.dataset.batch === 'true';
  const layoutEnabled = document.body.dataset.layout === 'true';
  const pageType = document.body.dataset.pageType || 'barcode_tool';
  const els = {
    type: document.querySelector('#barcodeType'),
    inputMode: document.querySelector('#inputMode'),
    data: document.querySelector('#barcodeData'),
    csvFile: document.querySelector('#csvFile'),
    csvMapping: document.querySelector('#csvMapping'),
    csvFileName: document.querySelector('#csvFileName'),
    clearCsv: document.querySelector('#clearCsv'),
    headerRow: document.querySelector('#headerRow'),
    barcodeColumn: document.querySelector('#barcodeColumn'),
    labelColumn: document.querySelector('#labelColumn'),
    extraColumn: document.querySelector('#extraColumn'),
    csvSummary: document.querySelector('#csvSummary'),
    csvPreview: document.querySelector('#csvPreview'),
    scale: document.querySelector('#scale'),
    generate: document.querySelector('#generate'),
    download: document.querySelector('#download'),
    downloadAll: document.querySelector('#downloadAll'),
    downloadPdf: document.querySelector('#downloadPdf'),
    print: document.querySelector('#print'),
    status: document.querySelector('#status'),
    highVolumeCta: document.querySelector('#highVolumeCta'),
    highVolumeOpen: document.querySelector('#highVolumeOpen'),
    highVolumeInterest: document.querySelector('#highVolumeInterest'),
    highVolumeForm: document.querySelector('#highVolumeForm'),
    highVolumeStatus: document.querySelector('#highVolumeStatus'),
    preview: document.querySelector('#preview'),
    count: document.querySelector('#count'),
    pageSize: document.querySelector('#pageSize'),
    pageMargin: document.querySelector('#pageMargin'),
    labelColumns: document.querySelector('#labelColumns'),
    labelRows: document.querySelector('#labelRows'),
    labelGap: document.querySelector('#labelGap'),
    showText: document.querySelector('#showText'),
    textPosition: document.querySelector('#textPosition'),
    layoutPreset: document.querySelector('#layoutPreset'),
    resetLayout: document.querySelector('#resetLayout'),
  };

  // The PDF417 homepage only reuses the parsing helpers above.
  if (!els.data) return;

  const names = formatNames;
  const requestedType = new URLSearchParams(root.location.search).get('type');
  if (!fixedType && els.type && names[requestedType]) els.type.value = requestedType;

  const singleModeLink = document.querySelector('#singleModeLink');
  function syncSingleModeLink() {
    if (singleModeLink) singleModeLink.href = singleToolPaths[barcodeType()] || '/';
  }

  let firstCanvas = null;
  let currentCount = 0;
  let csvState = null;
  let currentExport = null;
  let mappingTracked = false;
  let highVolumeInterestOpened = false;
  const layoutStorageKey = 'batchbarcode.layout.v1';

  function barcodeType() {
    return fixedType || els.type.value;
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = `status ${kind || ''}`;
  }

  function setHighVolumeCtaVisible(visible) {
    if (!els.highVolumeCta) return;
    els.highVolumeCta.hidden = !visible;
    if (!visible) {
      els.highVolumeInterest.hidden = true;
      els.highVolumeOpen.hidden = false;
    }
  }

  function trackEvent(name, params = {}) {
    if (typeof root.gtag === 'function') root.gtag('event', name, params);
  }

  function inputSource() {
    if (csvState) return `${csvState.kind}_file`;
    if (!batchMode) return 'manual_single';
    return els.inputMode?.value === 'csv' ? 'csv_paste' : 'manual_lines';
  }

  function eventContext(count, extra = {}) {
    return {
      page_type: pageType,
      barcode_type: barcodeType(),
      input_source: inputSource(),
      count_bucket: countBucket(count),
      ...extra,
    };
  }

  function openHighVolumeForm() {
    if (!els.highVolumeInterest) return;
    els.highVolumeInterest.hidden = false;
    els.highVolumeOpen.hidden = true;
    if (!highVolumeInterestOpened) {
      highVolumeInterestOpened = true;
      trackEvent('high_volume_interest_open', {
        page_type: pageType,
        input_source: inputSource(),
      });
    }
  }

  function submitHighVolumeForm(event) {
    event.preventDefault();
    const form = els.highVolumeForm;
    const email = form.elements.email.value.trim();
    // ponytail: analytics-only until a backend is justified by demand.
    trackEvent('high_volume_interest', highVolumeEventParams({
      batchSizeBucket: form.elements.batch_size_bucket.value,
      frequency: form.elements.frequency.value,
      printerType: form.elements.printer_type.value,
      emailProvided: Boolean(email),
      pageType,
      inputSource: inputSource(),
    }));
    form.reset();
    els.highVolumeStatus.textContent = 'Thanks — your anonymous interest was recorded. No barcode data or email was sent.';
    els.highVolumeStatus.className = 'status ok';
  }

  function layoutContext(layout, count) {
    if (!layout?.enabled) return {};
    return {
      layout_preset: layout.preset,
      page_size: layout.pageSize,
      page_count: pageCountFor(count, layout.columns, layout.rows),
      label_columns: layout.columns,
      label_rows: layout.rows,
      show_text: layout.showText ? 'yes' : 'no',
      text_position: layout.showText ? layout.textPosition : 'hidden',
    };
  }

  function trackGenerateResult(result, errorCode, count, layout) {
    trackEvent('generate_result', eventContext(count, {
      result,
      error_code: errorCode || 'none',
      barcode_count: count,
      ...layoutContext(layout, count),
    }));
  }

  function selectedColumn(select) {
    return select ? Number(select.value) : -1;
  }

  function csvColumns() {
    const hasHeader = els.headerRow.checked;
    const width = csvState.rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    return Array.from({ length: width }, (_, index) => ({
      index,
      name: hasHeader && csvState.rows[0][index] ? csvState.rows[0][index] : `Column ${index + 1}`,
    }));
  }

  function setColumnOptions(select, columns, emptyLabel) {
    select.replaceChildren();
    if (emptyLabel) select.add(new Option(emptyLabel, '-1'));
    columns.forEach((column) => select.add(new Option(column.name, String(column.index))));
  }

  function refreshCsvMapping() {
    const columns = csvColumns();
    const valueDefault = columns.find((column) => /^(barcode|barcode value|code|id|sku|value)$/i.test(column.name))?.index ?? 0;
    const labelDefault = columns.find((column) => /^(label|label text|name|description|title)$/i.test(column.name))?.index ?? -1;
    setColumnOptions(els.barcodeColumn, columns);
    setColumnOptions(els.labelColumn, columns, 'Same as barcode value');
    setColumnOptions(els.extraColumn, columns, 'None');
    els.barcodeColumn.value = String(valueDefault);
    els.labelColumn.value = String(labelDefault);
    els.extraColumn.value = '-1';
    renderCsvPreview();
  }

  function renderCsvPreview() {
    if (!csvState) return;
    const hasHeader = els.headerRow.checked;
    const valueIndex = selectedColumn(els.barcodeColumn);
    const labelIndex = selectedColumn(els.labelColumn);
    const extraIndex = selectedColumn(els.extraColumn);
    const mapped = mapCsvRows(csvState.rows, hasHeader, valueIndex, labelIndex, extraIndex, Number.MAX_SAFE_INTEGER);
    const invalid = mapped.records.filter((record) => validateValue(barcodeType(), record.value)).length;
    const parts = [
      `${csvState.rows.length - (hasHeader ? 1 : 0)} data rows`,
      `${mapped.total} usable`,
      `${mapped.empty} empty skipped`,
      `${mapped.duplicates} duplicate${mapped.duplicates === 1 ? '' : 's'} kept`,
      `${invalid} invalid for ${names[barcodeType()] || 'this format'}`,
    ];
    els.csvSummary.textContent = parts.join(' · ');

    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    [csvState.kind === 'xlsx' ? 'Sheet row' : 'CSV row', 'Barcode value', 'Label text', 'Extra', 'Status'].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      head.append(th);
    });

    const body = table.createTBody();
    const seen = new Set();
    csvState.rows.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 8).forEach((row, index) => {
      const sourceRow = index + (hasHeader ? 2 : 1);
      const value = (row[valueIndex] || '').trim();
      const label = labelIndex >= 0 ? (row[labelIndex] || '').trim() || value : value;
      const extra = extraIndex >= 0 ? (row[extraIndex] || '').trim() : '';
      const problem = validateValue(barcodeType(), value);
      let status = 'Ready';
      if (!value) status = 'Skipped: empty';
      else if (problem) status = problem;
      else if (seen.has(value)) status = 'Duplicate: kept';
      if (value) seen.add(value);
      const tr = body.insertRow();
      [sourceRow, value || '(empty)', label || '—', extra || '—', status].forEach((text) => {
        const td = tr.insertCell();
        td.textContent = text;
      });
      if (status !== 'Ready') tr.className = 'csv-row-warning';
    });
    els.csvPreview.replaceChildren(table);
  }

  async function loadCsvFile() {
    const file = els.csvFile.files[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (extension !== 'csv' && extension !== 'xlsx') {
      setStatus('Choose a .csv or .xlsx file.', 'warn');
      trackEvent('import_result', { result: 'error', error_code: 'invalid_file_type', file_type: extension || 'unknown', page_type: pageType });
      els.csvFile.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus('CSV and Excel files are limited to 5 MB.', 'warn');
      trackEvent('import_result', { result: 'error', error_code: 'file_too_large', file_type: extension, page_type: pageType });
      trackEvent('limit_reached', { limit_type: 'file_size', input_source: `${extension}_file`, page_type: pageType });
      els.csvFile.value = '';
      return;
    }

    let rows;
    let sheetName = '';
    try {
      if (extension === 'xlsx') {
        await ensureLibrary('xlsx');
        if (!root.XLSX) throw libraryError('Excel');
        const workbook = root.XLSX.read(await file.arrayBuffer(), { type: 'array' });
        sheetName = workbook.SheetNames[0] || '';
        if (!sheetName) throw new Error('No worksheet');
        rows = root.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
          raw: false,
          defval: '',
          blankrows: false,
        });
      } else {
        rows = parseCsv(await file.text());
      }
    } catch (error) {
      const errorCode = error.code === 'library_unavailable' ? 'library_unavailable' : 'read_error';
      const message = errorCode === 'library_unavailable'
        ? 'Excel library did not load. Check the network and try again.'
        : `Could not read this ${extension === 'xlsx' ? 'Excel' : 'CSV'} file.`;
      setStatus(message, 'warn');
      trackEvent('import_result', { result: 'error', error_code: errorCode, file_type: extension, page_type: pageType });
      els.csvFile.value = '';
      return;
    }
    if (!rows.length) {
      setStatus(`This ${extension === 'xlsx' ? 'Excel worksheet' : 'CSV file'} has no data rows.`, 'warn');
      trackEvent('import_result', { result: 'error', error_code: 'empty_file', file_type: extension, page_type: pageType });
      els.csvFile.value = '';
      return;
    }

    // ponytail: both formats become the same row array and reuse one mapping workflow.
    csvState = { rows, name: file.name, kind: extension, sheetName };
    mappingTracked = false;
    els.data.disabled = true;
    els.inputMode.disabled = true;
    els.csvMapping.hidden = false;
    els.csvFileName.textContent = sheetName ? `${file.name} · ${sheetName}` : file.name;
    els.headerRow.checked = looksLikeHeader(rows);
    refreshCsvMapping();
    render(false);
    const imported = inputValues();
    if (imported.truncated) {
      setStatus(batchLimitMessage(imported.total), 'warn');
    } else {
      setStatus(`${file.name} loaded locally${sheetName ? ` from “${sheetName}”` : ''}. Review the field mapping and preview.`, 'ok');
    }
    trackEvent('import_result', {
      result: 'success',
      error_code: 'none',
      file_type: extension,
      row_count: rows.length,
      count_bucket: countBucket(rows.length),
      column_count: rows.reduce((maximum, row) => Math.max(maximum, row.length), 0),
      page_type: pageType,
    });
  }

  function clearCsvFile() {
    csvState = null;
    mappingTracked = false;
    els.csvFile.value = '';
    els.data.disabled = false;
    els.inputMode.disabled = false;
    els.csvMapping.hidden = true;
    render(false);
  }

  function inputValues() {
    if (!batchMode) {
      const value = els.data.value.trim();
      return { records: value ? [{ value, label: value, extra: '', sourceRow: 1 }] : [], total: value ? 1 : 0, truncated: false };
    }
    if (csvState) {
      return mapCsvRows(
        csvState.rows,
        els.headerRow.checked,
        selectedColumn(els.barcodeColumn),
        selectedColumn(els.labelColumn),
        selectedColumn(els.extraColumn),
        BATCH_LIMIT,
      );
    }
    const parsed = parseBatchValues(els.data.value, els.inputMode ? els.inputMode.value : 'lines', BATCH_LIMIT);
    return {
      ...parsed,
      records: parsed.values.map((value, index) => ({ value, label: value, extra: '', sourceRow: index + 1 })),
    };
  }

  function scaleValue() {
    const scale = Number(els.scale.value);
    return Number.isInteger(scale) && scale >= 1 && scale <= 8 ? scale : 0;
  }

  function applyLayoutPreferences(preferences) {
    const value = normalizeLayoutPreferences(preferences);
    els.layoutPreset.value = value.preset;
    els.pageSize.value = value.pageSize;
    els.pageMargin.value = value.margin;
    els.labelColumns.value = value.columns;
    els.labelRows.value = value.rows;
    els.labelGap.value = value.gap;
    els.scale.value = value.scale;
    els.showText.checked = value.showText;
    els.textPosition.value = value.textPosition;
  }

  function restoreLayoutPreferences() {
    if (!layoutEnabled) return;
    try {
      applyLayoutPreferences(JSON.parse(root.localStorage.getItem(layoutStorageKey) || '{}'));
    } catch (error) {
      applyLayoutPreferences(layoutDefaults);
    }
  }

  function saveLayoutPreferences() {
    if (!layoutEnabled) return;
    const layout = layoutSettings();
    const scale = scaleValue();
    if (layout.problem || !scale) return;
    try {
      root.localStorage.setItem(layoutStorageKey, JSON.stringify({ ...layout, scale }));
    } catch (error) {
      // Browser privacy settings may disable local storage; generation still works.
    }
  }

  function applyLayoutPreset() {
    const preset = layoutPresets[els.layoutPreset.value];
    if (!preset) return;
    applyLayoutPreferences(preset);
    saveLayoutPreferences();
    render(false);
    setStatus(`${els.layoutPreset.selectedOptions[0].textContent} applied.`, 'ok');
  }

  function resetLayoutPreferences() {
    applyLayoutPreferences(layoutDefaults);
    try {
      root.localStorage.removeItem(layoutStorageKey);
    } catch (error) {
      // Keep the reset usable even when storage is unavailable.
    }
    render(false);
    setStatus('Default label layout restored.', 'ok');
  }

  function layoutSettings() {
    if (!layoutEnabled) return { enabled: false };

    const margin = Number(els.pageMargin.value);
    const columns = Number(els.labelColumns.value);
    const rows = Number(els.labelRows.value);
    const gap = Number(els.labelGap.value);
    if (!Number.isInteger(margin) || margin < 0 || margin > 25) return { problem: 'Page margin must be a whole number from 0 to 25 mm.' };
    if (!Number.isInteger(columns) || columns < 1 || columns > 4) return { problem: 'Label columns must be a whole number from 1 to 4.' };
    if (!Number.isInteger(rows) || rows < 1 || rows > 10) return { problem: 'Label rows must be a whole number from 1 to 10.' };
    if (!Number.isInteger(gap) || gap < 0 || gap > 20) return { problem: 'Label gap must be a whole number from 0 to 20 mm.' };

    return {
      enabled: true,
      preset: els.layoutPreset ? els.layoutPreset.value : 'custom',
      pageSize: els.pageSize.value === 'letter' ? 'letter' : 'a4',
      margin,
      columns,
      rows,
      gap,
      showText: els.showText.checked,
      textPosition: els.textPosition.value === 'top' ? 'top' : 'bottom',
    };
  }

  function createPages(cards, layout) {
    const fragment = document.createDocumentFragment();
    const capacity = layout.columns * layout.rows;
    const pageCount = pageCountFor(cards.length, layout.columns, layout.rows);

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = document.createElement('section');
      page.className = `label-page text-${layout.showText ? layout.textPosition : 'hidden'}`;
      page.dataset.pageSize = layout.pageSize;
      page.setAttribute('aria-label', `Label page ${pageIndex + 1}`);
      page.style.setProperty('--label-columns', layout.columns);
      page.style.setProperty('--label-rows', layout.rows);
      page.style.setProperty('--page-margin-mm', layout.margin);
      page.style.setProperty('--label-gap-mm', layout.gap);
      cards.slice(pageIndex * capacity, (pageIndex + 1) * capacity).forEach((card) => page.append(card));
      fragment.append(page);
    }

    let printStyle = document.querySelector('#print-page-style');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'print-page-style';
      document.head.append(printStyle);
    }
    printStyle.textContent = `@page { size: ${layout.pageSize === 'letter' ? 'Letter' : 'A4'}; margin: 0; }`;
    return { fragment, pageCount };
  }

  function optionsFor(type, text, scale) {
    const opts = {
      bcid: type,
      text,
      scale,
      paddingwidth: 8,
      paddingheight: 8,
      backgroundcolor: 'FFFFFF',
    };

    if (type === 'code128' || type === 'ean13' || type === 'upca') {
      opts.includetext = !layoutEnabled;
      if (opts.includetext) opts.textxalign = 'center';
    }

    if (type === 'qrcode') opts.eclevel = 'M';
    if (type === 'pdf417') {
      opts.columns = 6;
      opts.eclevel = 2;
    }

    return opts;
  }

  function saveCanvas(canvas, type, row) {
    const suffix = row ? `-${String(row).padStart(3, '0')}` : '';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${type}-barcode${suffix}.png`;
    link.click();
  }

  function trackExportResult(exportType, result, errorCode, count, layout) {
    trackEvent('export_result', eventContext(count, {
      result,
      error_code: errorCode || 'none',
      export_type: exportType,
      barcode_count: count,
      ...layoutContext(layout, count),
    }));
  }

  function downloadPng(canvas, type, row, exportType) {
    try {
      saveCanvas(canvas, type, row);
      trackExportResult(exportType, 'success', 'none', 1, currentExport?.layout);
    } catch (error) {
      setStatus('Could not create the PNG.', 'warn');
      trackExportResult(exportType, 'error', 'png_error', 1, currentExport?.layout);
    }
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create PNG.'));
    }, 'image/png'));
  }

  async function downloadAllPng() {
    if (!currentExport) return;
    const exportData = currentExport;
    els.downloadAll.disabled = true;
    try {
      await ensureLibrary('zip');
      if (!root.JSZip) throw libraryError('ZIP');
      setStatus(`Packaging ${exportData.canvases.length} PNG files locally…`, 'ok');
      const zip = new root.JSZip();
      const blobs = await Promise.all(exportData.canvases.map(canvasBlob));
      blobs.forEach((blob, index) => {
        zip.file(`${exportData.type}-barcode-${String(index + 1).padStart(3, '0')}.png`, blob);
      });
      const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(archive);
      link.href = url;
      link.download = `${exportData.type}-barcodes.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${blobs.length} PNG files downloaded as a ZIP.`, 'ok');
      trackExportResult('png_zip', 'success', 'none', blobs.length, exportData.layout);
    } catch (error) {
      const errorCode = error.code === 'library_unavailable' ? 'library_unavailable' : 'zip_error';
      setStatus(errorCode === 'library_unavailable' ? 'ZIP library did not load. Check the network and try again.' : (error.message || 'Could not create the PNG ZIP.'), 'warn');
      trackExportResult('png_zip', 'error', errorCode, exportData.canvases.length, exportData.layout);
    } finally {
      els.downloadAll.disabled = false;
    }
  }

  function fitTextLines(context, text, maximumWidth, maximumLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maximumWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (!lines.length) lines.push('');
    return lines.slice(0, maximumLines).map((visibleLine, index) => {
      if (context.measureText(visibleLine).width <= maximumWidth && !(index === maximumLines - 1 && lines.length > maximumLines)) return visibleLine;
      let shortened = visibleLine;
      while (shortened && context.measureText(`${shortened}…`).width > maximumWidth) shortened = shortened.slice(0, -1);
      return `${shortened}…`;
    });
  }

  function labelTextCanvas(record, widthMm, heightMm) {
    const ratio = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(widthMm * ratio));
    canvas.height = Math.max(1, Math.round(heightMm * ratio));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#1d2528';
    context.font = '12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const text = record.extra ? `${record.label} · ${record.extra}` : record.label;
    const lines = fitTextLines(context, text, canvas.width - 12, 2);
    const lineHeight = 15;
    const startY = (canvas.height - (lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2, startY + index * lineHeight));
    return canvas;
  }

  async function downloadPdf() {
    if (!currentExport) return;
    const exportData = currentExport;
    els.downloadPdf.disabled = true;
    try {
      await ensureLibrary('pdf');
      const Pdf = root.jspdf?.jsPDF;
      if (!Pdf) throw libraryError('PDF');
      const { layout, canvases, records, type } = exportData;
      const format = layout.pageSize === 'letter' ? 'letter' : 'a4';
      const pdf = new Pdf({ unit: 'mm', format, orientation: 'portrait', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const cellWidth = (pageWidth - 2 * layout.margin - (layout.columns - 1) * layout.gap) / layout.columns;
      const cellHeight = (pageHeight - 2 * layout.margin - (layout.rows - 1) * layout.gap) / layout.rows;
      const capacity = layout.columns * layout.rows;

      canvases.forEach((canvas, index) => {
        if (index && index % capacity === 0) pdf.addPage(format, 'portrait');
        const position = index % capacity;
        const column = position % layout.columns;
        const row = Math.floor(position / layout.columns);
        const x = layout.margin + column * (cellWidth + layout.gap);
        const y = layout.margin + row * (cellHeight + layout.gap);
        const textHeight = layout.showText ? Math.min(12, cellHeight * 0.24) : 0;
        const barcodeAreaHeight = cellHeight - 6 - textHeight;
        const scale = Math.min((cellWidth - 6) / canvas.width, barcodeAreaHeight / canvas.height);
        const imageWidth = canvas.width * scale;
        const imageHeight = canvas.height * scale;
        const imageX = x + (cellWidth - imageWidth) / 2;
        const barcodeTop = y + 3 + (layout.showText && layout.textPosition === 'top' ? textHeight : 0);
        const imageY = barcodeTop + (barcodeAreaHeight - imageHeight) / 2;

        pdf.setDrawColor(217, 210, 197);
        pdf.rect(x, y, cellWidth, cellHeight);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imageX, imageY, imageWidth, imageHeight, undefined, 'FAST');
        if (layout.showText) {
          const textY = layout.textPosition === 'top' ? y + 1 : y + cellHeight - textHeight - 1;
          const textCanvas = labelTextCanvas(records[index], cellWidth - 4, textHeight);
          pdf.addImage(textCanvas.toDataURL('image/png'), 'PNG', x + 2, textY, cellWidth - 4, textHeight, undefined, 'FAST');
        }
      });

      pdf.save(`${type}-barcodes.pdf`);
      setStatus(`${canvases.length} barcodes downloaded as PDF.`, 'ok');
      trackExportResult('pdf', 'success', 'none', canvases.length, layout);
    } catch (error) {
      const errorCode = error.code === 'library_unavailable' ? 'library_unavailable' : 'pdf_error';
      setStatus(errorCode === 'library_unavailable' ? 'PDF library did not load. Check the network and try again.' : (error.message || 'Could not create the PDF.'), 'warn');
      trackExportResult('pdf', 'error', errorCode, exportData.canvases.length, exportData.layout);
    } finally {
      els.downloadPdf.disabled = false;
    }
  }

  function render(track = false) {
    if (!root.bwipjs) {
      setStatus('Barcode library did not load. Check the network and refresh.', 'warn');
      if (track) trackGenerateResult('error', 'library_unavailable', 0);
      return;
    }

    const parsed = inputValues();
    setHighVolumeCtaVisible(parsed.truncated);
    if (parsed.truncated) {
      setStatus(batchLimitMessage(parsed.total), 'warn');
      if (track) {
        trackGenerateResult('error', 'batch_limit', parsed.total);
        trackEvent('limit_reached', eventContext(parsed.total, { limit_type: 'batch_count' }));
      }
      return;
    }
    if (!parsed.records.length) {
      setStatus('Add at least one value.', 'warn');
      if (track) trackGenerateResult('error', 'empty_input', 0);
      return;
    }

    const scale = scaleValue();
    if (!scale) {
      setStatus('Scale must be a whole number from 1 to 8.', 'warn');
      if (track) trackGenerateResult('error', 'invalid_scale', parsed.records.length);
      return;
    }

    const layout = layoutSettings();
    if (layout.problem) {
      setStatus(layout.problem, 'warn');
      if (track) trackGenerateResult('error', 'invalid_layout', parsed.records.length);
      return;
    }

    const type = barcodeType();
    const fragment = document.createDocumentFragment();
    const canvases = [];
    const cards = [];

    for (let index = 0; index < parsed.records.length; index += 1) {
      const record = parsed.records[index];
      const value = record.value;
      const problem = validateValue(type, value);
      if (problem) {
        setStatus(`${batchMode ? `${csvState ? (csvState.kind === 'xlsx' ? 'Sheet row' : 'CSV row') : 'Row'} ${record.sourceRow}: ` : ''}${problem}`, 'warn');
        if (track) trackGenerateResult('error', 'invalid_value', parsed.records.length, layout);
        return;
      }

      const canvas = document.createElement('canvas');
      try {
        root.bwipjs.toCanvas(canvas, optionsFor(type, value, scale));
      } catch (err) {
        setStatus(`${batchMode ? `${csvState ? (csvState.kind === 'xlsx' ? 'Sheet row' : 'CSV row') : 'Row'} ${record.sourceRow}: ` : ''}${err.message || 'Could not generate this barcode.'}`, 'warn');
        if (track) trackGenerateResult('error', 'renderer_error', parsed.records.length, layout);
        return;
      }

      canvases.push(canvas);
      const payload = document.createElement('div');
      payload.className = 'payload';
      payload.textContent = record.label;
      if (record.extra) {
        const extra = document.createElement('span');
        extra.className = 'payload-extra';
        extra.textContent = record.extra;
        payload.append(extra);
      }

      if (batchMode) {
        const card = document.createElement('div');
        card.className = 'barcode-card';
        const cardDownload = document.createElement('button');
        cardDownload.className = 'card-download';
        cardDownload.type = 'button';
        cardDownload.textContent = 'Download PNG';
        cardDownload.addEventListener('click', () => {
          downloadPng(canvas, type, index + 1, 'single_png');
        });
        card.append(canvas, payload, cardDownload);
        cards.push(card);
      } else {
        fragment.append(canvas, payload);
      }
    }

    let pageCount = 0;
    if (batchMode && layout.enabled) {
      const pages = createPages(cards, layout);
      fragment.append(pages.fragment);
      pageCount = pages.pageCount;
    } else if (batchMode) {
      cards.forEach((card) => fragment.append(card));
    }

    els.preview.className = batchMode ? 'preview batch-preview' : 'preview';
    els.preview.innerHTML = '';
    els.preview.append(fragment);
    firstCanvas = canvases[0] || null;
    currentCount = parsed.records.length;
    currentExport = batchMode ? { canvases, records: parsed.records, type, layout } : null;
    els.download.disabled = !firstCanvas;
    if (els.downloadAll) els.downloadAll.disabled = !firstCanvas;
    if (els.downloadPdf) els.downloadPdf.disabled = !firstCanvas;
    els.print.disabled = !firstCanvas;
    if (els.count) {
      const barcodeCount = `${parsed.records.length} barcode${parsed.records.length === 1 ? '' : 's'}`;
      els.count.textContent = pageCount ? `${barcodeCount} · ${pageCount} page${pageCount === 1 ? '' : 's'}` : barcodeCount;
    }
    const importNote = csvState
      ? ` ${parsed.empty} empty row${parsed.empty === 1 ? '' : 's'} skipped; ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? '' : 's'} kept.`
      : '';
    setStatus(batchMode
      ? `${parsed.records.length} ${names[type] || 'barcode'} item${parsed.records.length === 1 ? '' : 's'} generated locally.${importNote}`
      : `${names[type] || 'Barcode'} generated locally.`, 'ok');

    if (track) {
      if (csvState && !mappingTracked) {
        trackEvent('mapping_complete', eventContext(parsed.records.length, {
          has_header: els.headerRow.checked ? 'yes' : 'no',
          has_label: selectedColumn(els.labelColumn) >= 0 ? 'yes' : 'no',
          has_extra: selectedColumn(els.extraColumn) >= 0 ? 'yes' : 'no',
        }));
        mappingTracked = true;
      }
      trackGenerateResult('success', 'none', parsed.records.length, layout);
      if (layout.enabled) {
        trackEvent('layout_commit', eventContext(parsed.records.length, {
          barcode_count: parsed.records.length,
          ...layoutContext(layout, parsed.records.length),
        }));
      }
    }
  }

  function downloadFirstPng() {
    if (!firstCanvas) return;
    const type = barcodeType();
    downloadPng(firstCanvas, type, batchMode ? 1 : 0, 'first_png');
  }

  els.generate.addEventListener('click', () => render(true));
  els.download.addEventListener('click', downloadFirstPng);
  if (els.downloadAll) els.downloadAll.addEventListener('click', downloadAllPng);
  if (els.downloadPdf) els.downloadPdf.addEventListener('click', downloadPdf);
  if (els.highVolumeOpen) els.highVolumeOpen.addEventListener('click', openHighVolumeForm);
  if (els.highVolumeForm) els.highVolumeForm.addEventListener('submit', submitHighVolumeForm);
  if (batchMode && els.data) els.data.addEventListener('input', () => {
    const parsed = inputValues();
    setHighVolumeCtaVisible(parsed.truncated);
    if (parsed.truncated) setStatus(batchLimitMessage(parsed.total), 'warn');
  });
  els.print.addEventListener('click', () => {
    const layout = currentExport?.layout || layoutSettings();
    trackEvent('print_open', eventContext(currentCount, {
      barcode_count: currentCount,
      ...layoutContext(layout, currentCount),
    }));
    root.print();
  });
  if (els.type) els.type.addEventListener('change', () => {
    syncSingleModeLink();
    renderCsvPreview();
    render(false);
  });
  if (els.inputMode) els.inputMode.addEventListener('change', () => render(false));
  if (els.csvFile) els.csvFile.addEventListener('change', loadCsvFile);
  if (els.clearCsv) els.clearCsv.addEventListener('click', clearCsvFile);
  if (els.headerRow) els.headerRow.addEventListener('change', () => {
    mappingTracked = false;
    refreshCsvMapping();
    render(false);
  });
  [els.barcodeColumn, els.labelColumn, els.extraColumn]
    .filter(Boolean)
    .forEach((control) => control.addEventListener('change', () => {
      mappingTracked = false;
      renderCsvPreview();
      render(false);
    }));
  [els.scale, els.pageSize, els.pageMargin, els.labelColumns, els.labelRows, els.labelGap, els.showText, els.textPosition]
    .filter(Boolean)
    .forEach((control) => control.addEventListener('change', () => {
      if (layoutEnabled) els.layoutPreset.value = 'custom';
      saveLayoutPreferences();
      render(false);
    }));
  if (els.layoutPreset) els.layoutPreset.addEventListener('change', applyLayoutPreset);
  if (els.resetLayout) els.resetLayout.addEventListener('click', resetLayoutPreferences);

  restoreLayoutPreferences();
  syncSingleModeLink();
  render(false);
}(typeof window !== 'undefined' ? window : globalThis));
