import type { ToolCall, ToolDefinition } from './types';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useHistoryStore } from '../../stores/useHistoryStore';

/* ─── Tool Definitions ─── */

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'ocr_page',
    description: 'Run OCR on one or more pages (or specific regions). Uses the configured OCR engine.',
    parameters: {
      type: 'object',
      properties: {
        pageIds: { type: 'array', items: { type: 'string' }, description: 'Page IDs to OCR' },
        regionIds: { type: 'array', items: { type: 'string' }, description: 'Optional: only these region IDs' },
      },
      required: ['pageIds'],
    },
  },
  {
    name: 'translate_page',
    description: 'Translate text on one or more pages (or specific regions).',
    parameters: {
      type: 'object',
      properties: {
        pageIds: { type: 'array', items: { type: 'string' } },
        regionIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['pageIds'],
    },
  },
  {
    name: 'add_region',
    description: 'Create a new region on a page.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        label: { type: 'string' },
        kind: { type: 'string', enum: ['speech', 'thought', 'note'] },
      },
      required: ['pageId', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'update_region',
    description: 'Update properties of an existing region.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        regionId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        label: { type: 'string' },
        kind: { type: 'string', enum: ['speech', 'thought', 'note'] },
        sourceText: { type: 'string' },
        translatedText: { type: 'string' },
        locked: { type: 'boolean' },
        visible: { type: 'boolean' },
      },
      required: ['pageId', 'regionId'],
    },
  },
  {
    name: 'delete_region',
    description: 'Delete a region from a page.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        regionId: { type: 'string' },
      },
      required: ['pageId', 'regionId'],
    },
  },
  {
    name: 'batch_update_regions',
    description: 'Update multiple regions at once with the same patch.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        regionIds: { type: 'array', items: { type: 'string' } },
        patch: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['speech', 'thought', 'note'] },
            locked: { type: 'boolean' },
            visible: { type: 'boolean' },
          },
        },
      },
      required: ['pageId', 'regionIds', 'patch'],
    },
  },
  {
    name: 'auto_number_regions',
    description: 'Re-number all regions on a page by their position (top→left order).',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'stitch_pages',
    description: 'Stitch multiple pages into one combined image.',
    parameters: {
      type: 'object',
      properties: {
        pageIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['pageIds'],
    },
  },
  {
    name: 'export_page',
    description: 'Export a page as rendered PNG.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        outputPath: { type: 'string' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'get_page_info',
    description: 'Get detailed information about a page (dimensions, regions).',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'list_pages',
    description: 'List all pages in the project with their IDs and filenames.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_project',
    description: 'Search for text across pages, regions, sourceText, and translatedText.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'undo',
    description: 'Undo the last action.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'redo',
    description: 'Redo a previously undone action.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

/* ─── Tool Dispatcher ─── */

export async function dispatchTool(toolCall: ToolCall): Promise<string> {
  const args = toolCall.arguments;

  switch (toolCall.name) {
    case 'ocr_page': {
      const pageIds = args.pageIds as string[];
      const regionIds = args.regionIds as string[] | undefined;
      const count = useJobStore.getState().queueOcrJobs(
        pageIds.map((pid: string) => ({ pageId: pid, regionIds })),
      );
      return `Queued ${count} OCR job(s) for page(s): ${pageIds.join(', ')}`;
    }

    case 'translate_page': {
      const pageIds = args.pageIds as string[];
      const regionIds = args.regionIds as string[] | undefined;
      const count = useJobStore.getState().queueTranslationJobs(
        pageIds.map((pid: string) => ({ pageId: pid, regionIds })),
      );
      return `Queued ${count} translation job(s) for page(s): ${pageIds.join(', ')}`;
    }

    case 'add_region': {
      const store = useRegionStore.getState();
      const region = store.addRegion(args.pageId as string, {
        x: Math.round(args.x as number),
        y: Math.round(args.y as number),
        width: Math.round(args.width as number),
        height: Math.round(args.height as number),
      });
      if (typeof args.label === 'string') {
        store.updateRegion(args.pageId as string, region.id, { label: args.label });
      }
      if (typeof args.kind === 'string') {
        store.updateRegion(args.pageId as string, region.id, { kind: args.kind as 'speech' | 'thought' | 'note' });
      }
      return `Created region "${region.label}" (${region.id}) on page ${args.pageId}`;
    }

    case 'update_region': {
      const patch: Record<string, unknown> = {};
      for (const key of ['x', 'y', 'width', 'height', 'label', 'sourceText', 'translatedText', 'locked', 'visible', 'kind']) {
        if (args[key] !== undefined) {
          patch[key] = key === 'x' || key === 'y' || key === 'width' || key === 'height'
            ? Math.round(args[key] as number)
            : args[key];
        }
      }
      useRegionStore.getState().updateRegion(
        args.pageId as string,
        args.regionId as string,
        patch as Record<string, unknown> & { kind?: 'speech' | 'thought' | 'note' },
      );
      return `Updated region ${args.regionId}`;
    }

    case 'delete_region': {
      useRegionStore.getState().deleteRegion(args.pageId as string, args.regionId as string);
      return `Deleted region ${args.regionId}`;
    }

    case 'batch_update_regions': {
      useRegionStore.getState().batchUpdateRegions(
        args.pageId as string,
        args.regionIds as string[],
        args.patch as Record<string, unknown> & { kind?: 'speech' | 'thought' | 'note' },
      );
      return `Batch updated ${(args.regionIds as string[]).length} regions`;
    }

    case 'auto_number_regions': {
      const pageId = args.pageId as string;
      const { pages } = usePageStore.getState();
      const page = pages.find((p) => p.id === pageId);
      if (!page) return `Page ${pageId} not found`;
      useHistoryStore.getState().capture();
      const sorted = [...page.regions].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
      for (let i = 0; i < sorted.length; i++) {
        useRegionStore.getState().updateRegion(pageId, sorted[i].id, { order: i + 1 });
      }
      return `Auto-numbered ${sorted.length} regions on page ${pageId}`;
    }

    case 'stitch_pages': {
      const pageIds = args.pageIds as string[];
      const { stitchPages, stitchOptions } = usePageStore.getState();
      if (pageIds.length < 2) return 'Need at least 2 pages to stitch';
      void stitchPages(pageIds, stitchOptions);
      return `Stitching ${pageIds.length} pages...`;
    }

    case 'export_page': {
      const pageId = args.pageId as string;
      const { pages } = usePageStore.getState();
      const page = pages.find((p) => p.id === pageId);
      if (!page) return `Page ${pageId} not found`;
      useJobStore.getState().queueExportJobs([{ pageId, outputPath: (args.outputPath as string) ?? undefined }]);
      return `Export queued for page ${pageId}`;
    }

    case 'get_page_info': {
      const pageId = args.pageId as string;
      const { pages } = usePageStore.getState();
      const page = pages.find((p) => p.id === pageId);
      if (!page) return `Page ${pageId} not found`;
      return JSON.stringify({
        id: page.id,
        fileName: page.fileName,
        dimensions: `${page.naturalWidth}x${page.naturalHeight}`,
        regionCount: page.regions.length,
        regions: page.regions.map((r) => ({
          id: r.id,
          label: r.label,
          kind: r.kind,
          order: r.order,
          pos: `${r.x},${r.y} ${r.width}x${r.height}`,
          sourceText: r.sourceText ? `${r.sourceText.slice(0, 60)}...` : '',
          ocrStatus: r.ocrStatus,
          translationStatus: r.translationStatus,
          locked: r.locked,
        })),
      });
    }

    case 'list_pages': {
      const { pages } = usePageStore.getState();
      return JSON.stringify(
        pages.map((p) => ({
          id: p.id,
          fileName: p.fileName,
          dimensions: `${p.naturalWidth}x${p.naturalHeight}`,
          regionCount: p.regions.length,
        })),
      );
    }

    case 'search_project': {
      const query = (args.query as string).toLowerCase();
      const { pages } = usePageStore.getState();
      const results: { pageId: string; pageName: string; regionId: string; label: string; matchIn: string }[] = [];
      for (const page of pages) {
        for (const region of page.regions) {
          if (region.label.toLowerCase().includes(query)) {
            results.push({ pageId: page.id, pageName: page.fileName, regionId: region.id, label: region.label, matchIn: 'label' });
          }
          if (region.sourceText.toLowerCase().includes(query)) {
            results.push({ pageId: page.id, pageName: page.fileName, regionId: region.id, label: region.label, matchIn: 'sourceText' });
          }
          if (region.translatedText.toLowerCase().includes(query)) {
            results.push({ pageId: page.id, pageName: page.fileName, regionId: region.id, label: region.label, matchIn: 'translatedText' });
          }
        }
      }
      if (results.length === 0) return `No matches found for "${query}"`;
      return JSON.stringify(results);
    }

    case 'undo': {
      useHistoryStore.getState().undo();
      return 'Undone';
    }

    case 'redo': {
      useHistoryStore.getState().redo();
      return 'Redone';
    }

    default:
      return `Unknown tool: ${toolCall.name}`;
  }
}
