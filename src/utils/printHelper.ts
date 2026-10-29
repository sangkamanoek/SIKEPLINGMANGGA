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
            margin: 10mm 12mm 12mm 12mm;
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
            font-size: 11px;
            line-height: 1.5;
          }
          body {
            padding: 10px 14px;
          }
          img {
            max-width: 100%;
            height: auto;
            display: block;
            image-rendering: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #000000;
            padding: 6px 8px;
            text-align: left;
            font-size: 10px;
            vertical-align: top;
          }
          th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #000000;
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

  // Try opening a popup window first
  let w: Window | null = null;
  try {
    w = window.open('', '_blank');
  } catch {
    w = null;
  }

  if (w) {
    w.document.open();
    w.document.write(printHtml);
    w.document.close();
  } else {
    // Fallback using an invisible iframe if popup blocked
    try {
      let iframe = document.getElementById('__print_iframe_helper__') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = '__print_iframe_helper__';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
      }
    } catch (err) {
      console.error('Print helper fallback error:', err);
      window.print();
    }
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
      margin: [8, 10, 10, 10], // top, left, bottom, right in mm
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
