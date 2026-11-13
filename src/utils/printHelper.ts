export const printOfficialDocument = (targetIdOrHtml: string, title: string = 'Dokumen') => {
  let content = targetIdOrHtml;
  try {
    const el = document.getElementById(targetIdOrHtml);
    if (el) {
      content = el.innerHTML;
    }
  } catch (e) {
    // ignore
  }

  // Collect host document style tags and stylesheet links
  let hostStyles = '';
  try {
    const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleNodes.forEach((node) => {
      hostStyles += node.outerHTML + '\n';
    });
  } catch (e) {
    // ignore
  }

  const printHtml = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${hostStyles}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 20mm; /* Margin kiri 20mm khusus binder & lubang perforator */
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #0f172a;
            font-family: 'Times New Roman', Times, serif, 'Segoe UI', sans-serif;
            font-size: 10px;
            line-height: 1.35;
          }
          body {
            padding: 2px 4px;
          }
          img {
            max-width: 100%;
            height: auto;
            display: block;
            image-rendering: auto;
          }
          table:not(.no-print-border) {
            width: 100%;
            border-collapse: collapse;
          }
          table:not(.no-print-border) th,
          table:not(.no-print-border) td {
            border: 1px solid #000000;
            padding: 3px 5px;
            text-align: left;
            font-size: 9px;
            vertical-align: middle;
            line-height: 1.25;
          }
          table:not(.no-print-border) th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #000000;
          }
          .table-compact th,
          .table-compact td {
            padding: 2.5px 3.5px !important;
            font-size: 8.5px !important;
            line-height: 1.2 !important;
          }
          /* KTA Card styling isolation so no black borders or giant table padding ever leak into ID cards */
          .kta-card-root, .kta-card-root * {
            box-sizing: border-box;
          }
          .kta-card-root table,
          .kta-card-root th,
          .kta-card-root td,
          .kta-card-root tr {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          .no-print {
            display: none !important;
          }
          @media print {
            body {
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-document-root">
          ${content}
        </div>
        <script>
          async function executePrint() {
            try {
              const imgs = Array.from(document.querySelectorAll('img'));
              if (imgs.length > 0) {
                await Promise.all(imgs.map((img) => {
                  if (img.complete && img.naturalWidth > 0) {
                    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
                  }
                  return new Promise((resolve) => {
                    const done = () => {
                      if (img.decode) {
                        img.decode().catch(() => {}).then(resolve);
                      } else {
                        resolve();
                      }
                    };
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                  });
                }));
              }
            } catch (e) {
              console.warn('Image preload warning:', e);
            }
            setTimeout(() => {
              window.focus();
              window.print();
            }, 300);
          }

          if (document.readyState === 'complete') {
            executePrint();
          } else {
            window.addEventListener('load', executePrint);
          }
        </script>
      </body>
    </html>
  `;

  // Print via hidden iframe directly to avoid iframe/popup blocker issues
  try {
    const existingIframe = document.getElementById('__print_iframe_helper__');
    if (existingIframe && existingIframe.parentNode) {
      existingIframe.parentNode.removeChild(existingIframe);
    }

    const iframe = document.createElement('iframe');
    iframe.id = '__print_iframe_helper__';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();
    } else {
      window.print();
    }
  } catch (err) {
    console.error('Print helper fallback error:', err);
    window.print();
  }
};

/**
 * Directly downloads the HTML report element as a .pdf file using html2pdf.js
 */
export const downloadPdfDocument = async (targetIdOrHtml: string, filename = 'Dokumen_PKK.pdf') => {
  let elementToRender: HTMLElement | null = null;
  let tempCreated = false;

  if (targetIdOrHtml.startsWith('<')) {
    elementToRender = document.createElement('div');
    elementToRender.innerHTML = targetIdOrHtml;
    elementToRender.style.padding = '15px';
    elementToRender.style.background = '#ffffff';
    document.body.appendChild(elementToRender);
    tempCreated = true;
  } else {
    elementToRender = document.getElementById(targetIdOrHtml);
  }

  if (!elementToRender) {
    console.warn('Element not found for PDF download:', targetIdOrHtml);
    printOfficialDocument(targetIdOrHtml, filename);
    return;
  }

  try {
    // Preload & decode images inside element
    const imgs = Array.from(elementToRender.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    const opt = {
      margin: [10, 20, 10, 10], // top, left, bottom, right in mm
      filename: cleanFilename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    // Dynamic import html2pdf
    // @ts-ignore
    const html2pdfModule = await import('html2pdf.js');
    const html2pdfFn = html2pdfModule.default || html2pdfModule;
    await html2pdfFn().set(opt).from(elementToRender).save();
  } catch (err) {
    console.warn('html2pdf download warning, falling back to print Official Document:', err);
    printOfficialDocument(targetIdOrHtml, filename);
  } finally {
    if (tempCreated && elementToRender && document.body.contains(elementToRender)) {
      document.body.removeChild(elementToRender);
    }
  }
};
