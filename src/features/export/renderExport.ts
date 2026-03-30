import { isTauri } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { loadProjectDomainContext, pageRepository, regionRepository } from '../../repositories';
import { ensureProjectDomainStatePersisted } from '../../services/projectSync';
import { type Page, type RegionRecord, type RenderedExportResult, type TextStyleRecord } from '../../types';
import { buildRenderedPngName, computeSha256Hex, resolveTextStyle } from './renderHelpers';

interface RenderTextLayout {
  fontSize: number;
  lineHeightPx: number;
  lines: string[];
}

interface SavedBlobResult {
  saved: boolean;
  canceled: boolean;
  outputPath?: string;
}

async function saveBlob(
  blob: Blob,
  suggestedName: string,
  explicitPath?: string,
): Promise<SavedBlobResult> {
  if (isTauri()) {
    const path =
      explicitPath ??
      (await save({
        title: 'Export rendered page',
        defaultPath: suggestedName,
        filters: [{ name: 'PNG image', extensions: ['png'] }],
      }));
    if (!path) {
      return { saved: false, canceled: true };
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, bytes);
    return {
      saved: true,
      canceled: false,
      outputPath: path,
    };
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return {
    saved: true,
    canceled: false,
  };
}

export async function pickRenderedPageExportPath(page: Page): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  return save({
    title: 'Export rendered page',
    defaultPath: buildRenderedPngName(page.fileName),
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load page image for render export'));
    image.src = src;
  });
}

function tokenizeText(text: string) {
  return text
    .split(/\r?\n/)
    .flatMap((line, lineIndex, allLines) => [
      ...line.split(/\s+/).filter(Boolean),
      ...(lineIndex < allLines.length - 1 ? ['\n'] : []),
    ]);
}

function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const tokens = tokenizeText(text);
  if (tokens.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    if (token === '\n') {
      lines.push(current.trimEnd());
      current = '';
      continue;
    }

    const next = current ? `${current} ${token}` : token;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = token;
  }

  if (current || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

function buildTextLayout(
  context: CanvasRenderingContext2D,
  text: string,
  style: TextStyleRecord,
  width: number,
  height: number,
): RenderTextLayout {
  const minFontSize = 10;
  let fontSize = Math.max(minFontSize, style.fontSize);
  let lines = [text];
  let lineHeightPx = fontSize * style.lineHeight;
  const maxWidth = Math.max(16, width - 12);
  const maxHeight = Math.max(16, height - 12);

  while (fontSize >= minFontSize) {
    context.font = `${fontSize}px "${style.fontFamily}"`;
    lines = wrapLines(context, text, maxWidth);
    lineHeightPx = fontSize * style.lineHeight;

    const longestLine = Math.max(
      ...lines.map((line) => context.measureText(line).width),
      0,
    );
    const totalHeight = lineHeightPx * lines.length;

    if (longestLine <= maxWidth && totalHeight <= maxHeight) {
      break;
    }

    fontSize -= 1;
  }

  return {
    fontSize,
    lineHeightPx,
    lines,
  };
}

function drawRegionText(
  context: CanvasRenderingContext2D,
  region: RegionRecord,
  style: TextStyleRecord,
) {
  const text = region.translatedText.trim();
  if (!text || !region.visible) {
    return;
  }

  const width = Math.max(1, region.width);
  const height = Math.max(1, region.height);
  const layout = buildTextLayout(context, text, style, width, height);
  const padding = 6;
  const align = style.align;

  context.save();
  context.translate(region.x + width / 2, region.y + height / 2);
  if (region.rotation) {
    context.rotate((region.rotation * Math.PI) / 180);
  }

  context.font = `${layout.fontSize}px "${style.fontFamily}"`;
  context.textBaseline = 'middle';
  context.textAlign = align;
  context.lineJoin = 'round';
  context.strokeStyle = style.stroke;
  context.fillStyle = style.fill;
  context.lineWidth = style.strokeWidth;

  const blockHeight = layout.lineHeightPx * layout.lines.length;
  const startY = -(blockHeight / 2) + layout.lineHeightPx / 2;
  const x =
    align === 'left'
      ? -width / 2 + padding
      : align === 'right'
        ? width / 2 - padding
        : 0;

  for (let index = 0; index < layout.lines.length; index += 1) {
    const line = layout.lines[index];
    const y = startY + layout.lineHeightPx * index;
    if (style.strokeWidth > 0) {
      context.strokeText(line, x, y, width - padding * 2);
    }
    context.fillText(line, x, y, width - padding * 2);
  }

  context.restore();
}

async function renderPageToBlob(page: Page) {
  await ensureProjectDomainStatePersisted();

  const pageRecord = await pageRepository.getById(page.id);
  if (!pageRecord) {
    throw new Error('Page is not available in domain storage');
  }

  const [image, regionRecords, domainContext] = await Promise.all([
    loadImage(pageRecord.imagePath),
    regionRepository.getByPage(page.id),
    loadProjectDomainContext(pageRecord.projectId),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || pageRecord.width;
  canvas.height = image.naturalHeight || pageRecord.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const visibleTranslatedRegions = regionRecords
    .filter((region) => region.visible && region.translatedText.trim())
    .sort((left, right) => (left.order || 0) - (right.order || 0));

  for (const region of visibleTranslatedRegions) {
    const style = resolveTextStyle(
      region,
      domainContext.textStyles,
      pageRecord.projectId,
      domainContext.settings.defaultTextStyleId,
    );
    drawRegionText(context, region, style);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) {
    throw new Error('Failed to create rendered export image');
  }

  return {
    blob,
    translatedRegions: visibleTranslatedRegions.length,
  };
}

export async function exportRenderedPageAsPng(
  page: Page,
  options: { outputPath?: string } = {},
): Promise<RenderedExportResult> {
  const { blob, translatedRegions } = await renderPageToBlob(page);
  const suggestedName = buildRenderedPngName(page.fileName);
  const outputSha256 = await computeSha256Hex(await blob.arrayBuffer());
  const saveResult = await saveBlob(blob, suggestedName, options.outputPath);

  return {
    saved: saveResult.saved,
    canceled: saveResult.canceled,
    suggestedName,
    translatedRegions,
    renderedRegions: saveResult.saved ? translatedRegions : 0,
    outputSha256,
    ...(saveResult.outputPath ? { outputPath: saveResult.outputPath } : {}),
  };
}
