const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('./vendor/xlsx.full.min.js');
const {
  BATCH_LIMIT,
  parseBatchValues,
  parseCsv,
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
} = require('./barcode-tools.js');

const root = path.resolve(__dirname, '..');
const generatorHtml = fs.readFileSync(path.join(root, 'barcode-generator', 'index.html'), 'utf8');
const toolsSource = fs.readFileSync(path.join(__dirname, 'barcode-tools.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'barcode-tools.css'), 'utf8');

assert.deepEqual(
  parseBatchValues('A,B\n"C,D",extra\n"Q""R",extra', 'csv').values,
  ['A', 'C,D', 'Q"R'],
);
assert.deepEqual(
  parseBatchValues('A,B\n"C,D"', 'lines').values,
  ['A,B', '"C,D"'],
);
assert.deepEqual(parseBatchValues('  ONE  \n\n中文-!@#', 'lines').values, ['ONE', '中文-!@#']);
assert.equal(parseBatchValues('', 'lines').total, 0);

const csvRows = parseCsv('\uFEFFsku,label,note\r\nA-1,"Shelf, A","Line 1\nLine 2"\r\nA-1,"Label ""two""",x\r\n,,empty');
assert.deepEqual(csvRows, [
  ['sku', 'label', 'note'],
  ['A-1', 'Shelf, A', 'Line 1\nLine 2'],
  ['A-1', 'Label "two"', 'x'],
  ['', '', 'empty'],
]);
assert.equal(looksLikeHeader(csvRows), true);
assert.equal(looksLikeHeader([['ABC', 'One'], ['DEF', 'Two']]), false);
assert.deepEqual(mapCsvRows(csvRows, true, 0, 1, 2), {
  records: [
    { value: 'A-1', label: 'Shelf, A', extra: 'Line 1\nLine 2', sourceRow: 2 },
    { value: 'A-1', label: 'Label "two"', extra: 'x', sourceRow: 3 },
  ],
  total: 2,
  empty: 1,
  duplicates: 1,
  truncated: false,
});
const mappedLimit = mapCsvRows(
  [['id'], ...Array.from({ length: 101 }, (_, index) => [`ID-${index}`])],
  true,
  0,
);
assert.equal(mappedLimit.total, 101);
assert.equal(mappedLimit.records.length, 100);
assert.equal(mappedLimit.truncated, true);

const tooMany = parseBatchValues(Array.from({ length: 101 }, (_, i) => `ITEM-${i}`).join('\n'));
assert.equal(tooMany.total, 101);
assert.equal(tooMany.values.length, 100);
assert.equal(tooMany.truncated, true);
const exactlyLimit = parseBatchValues(Array.from({ length: 100 }, (_, i) => `ITEM-${i}`).join('\n'));
assert.equal(exactlyLimit.values.length, 100);
assert.equal(exactlyLimit.truncated, false);
const mappedAtLimit = mapCsvRows(
  [['id'], ...Array.from({ length: 100 }, (_, index) => [`ID-${index}`])],
  true,
  0,
);
assert.equal(mappedAtLimit.records.length, 100);
assert.equal(mappedAtLimit.truncated, false);
assert.equal(BATCH_LIMIT, 100);
assert.equal(batchLimitMessage(101), '101 values detected. The current limit is 100; split this into smaller batches.');

assert.equal(hasValidCheckDigit('5901234123457'), true);
assert.equal(hasValidCheckDigit('012345678905'), true);
assert.equal(validateValue('upca', '012345678906'), 'The UPC-A check digit is not valid.');
assert.equal(validateValue('ean13', 'ABC'), 'EAN-13 needs 12 or 13 digits.');
assert.equal(validateValue('pdf417', 'X'.repeat(901)), 'Keep PDF417 data under 900 characters for this online tool.');
assert.equal(validateValue('code128', 'ORDER-001'), '');
assert.equal(validateValue('code128', ''), 'Add data to encode.');
assert.equal(validateValue('qrcode', 'https://batchbarcode.com'), '');
assert.equal(validateValue('qrcode', ''), 'Add data to encode.');
assert.equal(validateValue('pdf417', 'DOC-001'), '');
assert.equal(validateValue('pdf417', ''), 'Add data to encode.');
assert.equal(pageCountFor(10, 3, 3), 2);
assert.equal(pageCountFor(8, 2, 4), 1);
assert.equal(pageCountFor(0, 2, 4), 0);
assert.deepEqual([0, 1, 2, 10, 11, 50, 51, 100, 101].map(countBucket), [
  '0', '1', '2_10', '2_10', '11_50', '11_50', '51_100', '51_100', '101_plus',
]);
assert.deepEqual(normalizeLayoutPreferences({
  preset: 'custom', pageSize: 'letter', margin: 12, columns: 3, rows: 6, gap: 5, scale: 4, showText: false, textPosition: 'top',
}), {
  preset: 'custom', pageSize: 'letter', margin: 12, columns: 3, rows: 6, gap: 5, scale: 4, showText: false, textPosition: 'top',
});
assert.deepEqual(normalizeLayoutPreferences({ margin: -1, columns: 9, rows: 'bad', gap: 21, scale: 0 }), {
  preset: 'a4-2x4', pageSize: 'a4', margin: 10, columns: 2, rows: 4, gap: 4, scale: 3, showText: true, textPosition: 'bottom',
});
assert.deepEqual(normalizeLayoutPreferences({ preset: 'letter-3x3' }), {
  preset: 'letter-3x3', pageSize: 'letter', margin: 12, columns: 3, rows: 3, gap: 5, scale: 3, showText: true, textPosition: 'top',
});

const highVolumeParams = highVolumeEventParams({
  batchSizeBucket: '101_500',
  frequency: 'weekly',
  printerType: 'zebra',
  pageType: 'batch_barcode_generator',
  inputSource: 'csv_file',
  email: 'private@example.com',
  workflow: 'SECRET-BARCODE-VALUE',
  barcodeValue: 'SECRET-BARCODE-VALUE',
});
assert.deepEqual(highVolumeParams, {
  batch_size_bucket: '101_500',
  frequency: 'weekly',
  printer_type: 'zebra',
  page_type: 'batch_barcode_generator',
  input_source: 'csv_file',
});
assert.equal(Object.keys(highVolumeParams).includes('email'), false);
assert.equal(Object.keys(highVolumeParams).includes('email_provided'), false);
assert.equal(Object.keys(highVolumeParams).includes('workflow'), false);
assert.equal(Object.values(highVolumeParams).includes('SECRET-BARCODE-VALUE'), false);
assert.equal((generatorHtml.match(/name="(?:batch_size_bucket|frequency|printer_type)"/g) || []).length, 3);
assert.doesNotMatch(generatorHtml, /highVolumeEmail|highVolumeWorkflow|name="email"|name="workflow"/);
assert.doesNotMatch(toolsSource, /highVolumeEmail|highVolumeWorkflow|name="email"|name="workflow"/);
assert.match(toolsSource, /Thanks — your anonymous interest was recorded\.<br>If you want us to contact you, use the <a href="\/contact\/">Contact page<\/a>\./);

assert.doesNotMatch(generatorHtml, /<script[^>]+vendor\/(xlsx|jszip|jspdf)/i);
assert.match(toolsSource, /await ensureLibrary\('xlsx'\)/);
assert.match(toolsSource, /await ensureLibrary\('zip'\)/);
assert.match(toolsSource, /await ensureLibrary\('pdf'\)/);
assert.match(toolsSource, /Excel library did not load\. Check the network and try again\./);
assert.match(toolsSource, /ZIP library did not load\. Check the network and try again\./);
assert.match(toolsSource, /PDF library did not load\. Check the network and try again\./);
assert.deepEqual(Object.keys(librarySources).sort(), ['pdf', 'xlsx', 'zip']);

for (const page of ['privacy', 'contact']) {
  const html = fs.readFileSync(path.join(root, page, 'index.html'), 'utf8');
  assert.match(html, new RegExp(`rel="canonical" href="https://www\\.batchbarcode\\.com/${page}/"`));
  assert.match(html, /href="\/barcode-faq\/"/);
  if (page === 'contact') assert.match(html, /mailto:dennyho0917@gmail\.com/);
  if (page === 'privacy') assert.doesNotMatch(html, /optional email|free-text/i);
}
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, 11);
assert.equal(sitemapUrls.includes('https://www.batchbarcode.com/privacy/'), true);
assert.equal(sitemapUrls.includes('https://www.batchbarcode.com/contact/'), true);
const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
sitemapUrls.forEach((url) => assert.equal(llms.includes(`](${url})`), true));
const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
assert.match(ci, /name: BatchBarcode CI/);
assert.match(ci, /push:/);
assert.match(ci, /pull_request:/);
assert.match(ci, /node assets\/barcode-tools\.test\.js/);
assert.match(ci, /node scripts\/audit-site\.js/);
assert.match(cssSource, /overflow-x:\s*hidden/);
assert.match(cssSource, /high-volume-grid[\s\S]*grid-template-columns:\s*1fr/);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['sku', 'label', 'location'],
  [1001, 'Blue widget', 'A-01'],
  [1002, 'Red widget', 'B-02'],
]), 'Labels');
const workbookCopy = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
const worksheetRows = XLSX.utils.sheet_to_json(workbookCopy.Sheets.Labels, {
  header: 1, raw: false, defval: '', blankrows: false,
});
assert.deepEqual(worksheetRows, [
  ['sku', 'label', 'location'],
  ['1001', 'Blue widget', 'A-01'],
  ['1002', 'Red widget', 'B-02'],
]);
assert.equal(looksLikeHeader(worksheetRows), true);

async function testLazyLoader() {
  const scripts = [];
  const fakeDocument = {
    head: { append: (script) => scripts.push(script) },
    createElement: () => ({
      listeners: {},
      addEventListener(type, listener) { this.listeners[type] = listener; },
    }),
  };
  const target = {};
  const loader = createLibraryLoader(fakeDocument, target, {
    xlsx: { src: '/xlsx', global: 'XLSX', label: 'Excel' },
    zip: { src: '/zip', global: 'JSZip', label: 'ZIP' },
    pdf: { src: '/pdf', global: 'jspdf', label: 'PDF' },
  });

  const xlsxLoad = loader('xlsx');
  assert.equal(loader('xlsx'), xlsxLoad);
  assert.equal(scripts.length, 1);
  target.XLSX = {};
  scripts[0].listeners.load();
  await xlsxLoad;
  assert.equal(scripts.length, 1);
  await loader('xlsx');
  assert.equal(scripts.length, 1);

  const zipLoad = loader('zip');
  assert.equal(scripts.length, 2);
  scripts[1].listeners.error();
  await assert.rejects(zipLoad, (error) => error.code === 'library_unavailable' && /ZIP library did not load/.test(error.message));
  const zipRetry = loader('zip');
  assert.notEqual(zipRetry, zipLoad);
  assert.equal(scripts.length, 3);
  target.JSZip = {};
  scripts[2].listeners.load();
  await zipRetry;
  assert.equal(scripts.length, 3);

  const pdfLoad = loader('pdf');
  const pdfLoadAgain = loader('pdf');
  assert.equal(pdfLoadAgain, pdfLoad);
  assert.equal(scripts.length, 4);
  target.jspdf = {};
  scripts[3].listeners.load();
  await Promise.all([pdfLoad, pdfLoadAgain]);

  const missingScripts = [];
  const missingDocument = {
    head: { append: (script) => missingScripts.push(script) },
    createElement: () => ({
      listeners: {},
      addEventListener(type, listener) { this.listeners[type] = listener; },
    }),
  };
  const missingTarget = {};
  const missingLoader = createLibraryLoader(missingDocument, missingTarget, {
    pdf: { src: '/missing-pdf', global: 'jspdf', label: 'PDF' },
  });
  const missingLoad = missingLoader('pdf');
  missingScripts[0].listeners.load();
  await assert.rejects(missingLoad, (error) => error.code === 'library_unavailable');
  const recoveredLoad = missingLoader('pdf');
  assert.notEqual(recoveredLoad, missingLoad);
  assert.equal(missingScripts.length, 2);
  missingTarget.jspdf = {};
  missingScripts[1].listeners.load();
  await recoveredLoad;
}

testLazyLoader()
  .then(() => console.log('barcode-tools tests passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
