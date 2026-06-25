(function () {
  const fixedType = document.body.dataset.bcid || '';
  const pageType = document.body.dataset.pageType || 'barcode_tool';
  const els = {
    type: document.querySelector('#barcodeType'),
    data: document.querySelector('#barcodeData'),
    scale: document.querySelector('#scale'),
    generate: document.querySelector('#generate'),
    download: document.querySelector('#download'),
    print: document.querySelector('#print'),
    status: document.querySelector('#status'),
    preview: document.querySelector('#preview'),
  };

  const names = {
    code128: 'Code 128',
    ean13: 'EAN-13',
    pdf417: 'PDF417',
    qrcode: 'QR code',
    datamatrix: 'Data Matrix',
  };

  let canvas = null;

  function barcodeType() {
    return fixedType || els.type.value;
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = `status ${kind || ''}`;
  }

  function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') gtag('event', name, params);
  }

  function validate(type, text) {
    if (!text) return 'Add data to encode.';
    if (type === 'ean13' && !/^\d{12,13}$/.test(text)) return 'EAN-13 needs 12 or 13 digits.';
    if (type === 'pdf417' && text.length > 900) return 'Keep PDF417 data under 900 characters for this online tool.';
    return '';
  }

  function optionsFor(type, text) {
    const opts = {
      bcid: type,
      text,
      scale: Number(els.scale.value) || 3,
      paddingwidth: 8,
      paddingheight: 8,
      backgroundcolor: 'FFFFFF',
    };

    if (type === 'code128' || type === 'ean13') {
      opts.includetext = true;
      opts.textxalign = 'center';
    }

    if (type === 'qrcode') opts.eclevel = 'M';
    if (type === 'pdf417') {
      opts.columns = 6;
      opts.eclevel = 2;
    }

    return opts;
  }

  function render(track = false) {
    if (!window.bwipjs) {
      setStatus('Barcode library did not load. Check the network and refresh.', 'warn');
      return;
    }

    const type = barcodeType();
    const text = els.data.value.trim();
    const problem = validate(type, text);
    if (problem) {
      setStatus(problem, 'warn');
      return;
    }

    canvas = document.createElement('canvas');
    try {
      bwipjs.toCanvas(canvas, optionsFor(type, text));
    } catch (err) {
      setStatus(err.message || 'Could not generate this barcode.', 'warn');
      return;
    }

    els.preview.innerHTML = '';
    els.preview.append(canvas);
    const payload = document.createElement('div');
    payload.className = 'payload';
    payload.textContent = text;
    els.preview.append(payload);
    els.download.disabled = false;
    els.print.disabled = false;
    setStatus(`${names[type] || 'Barcode'} generated locally.`, 'ok');

    if (track) {
      trackEvent('generate_barcode', {
        barcode_type: type,
        page_type: pageType,
        text_length: text.length,
      });
    }
  }

  function downloadPng() {
    if (!canvas) return;
    const type = barcodeType();
    trackEvent('download_barcode_png', {
      barcode_type: type,
      page_type: pageType,
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${type}-barcode.png`;
    a.click();
  }

  els.generate.addEventListener('click', () => render(true));
  els.download.addEventListener('click', downloadPng);
  els.print.addEventListener('click', () => {
    trackEvent('print_barcode', {
      barcode_type: barcodeType(),
      page_type: pageType,
    });
    window.print();
  });
  if (els.type) els.type.addEventListener('change', () => render(false));
  els.scale.addEventListener('change', () => render(false));

  render(false);
}());
