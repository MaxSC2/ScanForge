interface PdfPageResult {
  dataUrl: string;
  width: number;
  height: number;
}

let pdfjsPromise: Promise<void> | null = null;

function loadPdfJs(): Promise<void> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/lib/pdfjs/pdfjs.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdfjs/pdf.worker.min.js';
        resolve();
      } else {
        reject(new Error('pdfjsLib not found after script load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load pdf.js'));
    document.head.appendChild(script);
  });
  return pdfjsPromise;
}

export async function loadPdfAsDataUrls(
  file: File,
  scale: number = 2,
): Promise<PdfPageResult[]> {
  await loadPdfJs();

  const pdfjsLib = (window as any).pdfjsLib;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const results: PdfPageResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    results.push({
      dataUrl: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
    });
  }

  return results;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
