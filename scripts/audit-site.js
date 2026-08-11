const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const errors = [];
const seen = { title: new Map(), description: new Map(), h1: new Map() };
const batchTypes = new Map([
  ['index.html', 'pdf417'],
  ['code-128-barcode-generator/index.html', 'code128'],
  ['data-matrix-barcode-generator/index.html', 'datamatrix'],
  ['ean-13-barcode-generator/index.html', 'ean13'],
  ['micro-pdf417-generator/index.html', 'micropdf417'],
  ['qr-code-generator/index.html', 'qrcode'],
  ['upc-a-barcode-generator/index.html', 'upca'],
]);

function addSeen(kind, value, file) {
  if (!value) return;
  const previous = seen[kind].get(value);
  if (previous) errors.push(`Duplicate ${kind}: ${previous} and ${file}`);
  seen[kind].set(value, file);
}

for (const url of urls) {
  if (!llms.includes(`](${url})`)) errors.push(`Missing llms.txt URL: ${url}`);
  const parsed = new URL(url);
  const relative = parsed.pathname === '/' ? 'index.html' : `${parsed.pathname.slice(1)}index.html`;
  const file = path.join(root, relative);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.batchbarcode.com') {
    errors.push(`Non-canonical sitemap URL: ${url}`);
  }
  if (!fs.existsSync(file)) {
    errors.push(`Missing sitemap target: ${relative}`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]+)"/i)?.[1]?.trim();
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/i)?.[1];
  const internalLinks = [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1].split(/[?#]/)[0]);

  for (const [kind, value] of [['title', title], ['description', description], ['h1', h1]]) {
    if (!value) errors.push(`Missing ${kind}: ${relative}`);
    addSeen(kind, value, relative);
  }
  if (canonical !== url) errors.push(`Canonical mismatch in ${relative}: ${canonical || 'missing'} != ${url}`);
  if (ogUrl !== url) errors.push(`Open Graph URL mismatch in ${relative}: ${ogUrl || 'missing'} != ${url}`);
  if (!html.includes('href="/barcode-faq/"')) errors.push(`Missing FAQ navigation link in ${relative}`);
  if (relative === 'barcode-faq/index.html' && (html.match(/<details/g) || []).length < 12) {
    errors.push('FAQ hub has fewer than 12 visible questions');
  }

  const batchType = batchTypes.get(relative);
  if (batchType && !html.includes('href="?mode=batch"')) {
    errors.push(`Missing batch A4 mode link in ${relative}`);
  }
  if (relative === 'barcode-generator/index.html' && !html.includes('id="singleModeLink"')) {
    errors.push('Missing single-mode return link in barcode-generator/index.html');
  }

  for (const link of internalLinks) {
    const target = link === '/'
      ? path.join(root, 'index.html')
      : path.extname(link)
        ? path.join(root, link.slice(1))
        : path.join(root, link.slice(1), 'index.html');
    if (!fs.existsSync(target)) errors.push(`Broken internal link in ${relative}: ${link}`);
  }

  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(block[1]);
      const inspect = (value, key = '') => {
        if (key === 'item' && typeof value === 'string' && !/^https:\/\/www\.batchbarcode\.com\//.test(value)) {
          errors.push(`Invalid structured-data item URL in ${relative}: ${value}`);
        }
        if (value && typeof value === 'object') {
          for (const [childKey, childValue] of Object.entries(value)) inspect(childValue, childKey);
        }
      };
      inspect(data);
    } catch (error) {
      errors.push(`Invalid JSON-LD in ${relative}: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Site audit passed: ${urls.length} canonical pages, unique metadata, valid links and JSON-LD.`);
