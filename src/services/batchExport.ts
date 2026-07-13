import JSZip from 'jszip';
import type { Page } from '../types';
import { renderPageToBlob } from '../features/export/renderExport';

export async function exportAsCbz(pages: Page[]): Promise<void> {
  const zip = new JSZip();
  const numDigits = String(pages.length).length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const result = await renderPageToBlob(page, { inpaint: true });
    const fileName = `page_${String(i + 1).padStart(numDigits, '0')}.png`;
    zip.file(fileName, result.blob);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `export_${Date.now()}.cbz`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAsPdf(pages: Page[]): Promise<void> {
  const { jsPDF } = await import('jspdf');

  if (!jsPDF) {
    throw new Error('jsPDF library not available');
  }

  const pdf = new jsPDF();
  let first = true;

  for (const page of pages) {
    const result = await renderPageToBlob(page, { inpaint: true });
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(result.blob);
    });

    if (!first) {
      pdf.addPage();
    }
    first = false;

    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (page.naturalHeight / page.naturalWidth) * imgWidth;
    pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
  }

  pdf.save(`export_${Date.now()}.pdf`);
}
