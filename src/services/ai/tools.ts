import type { ToolCall, ToolDefinition } from './types';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { graphQuery, graphPath, graphExplain } from './graph';
import { memorySave, memoryRecall } from './memory';

interface PlanStep {
  id: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
}

interface Plan {
  id: string;
  description: string;
  steps: PlanStep[];
  currentStep: number;
}

let currentPlan: Plan | null = null;
let planIdCounter = 0;

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
  {
    name: 'graph_query',
    description: 'Query the project knowledge graph. Finds nodes related to a topic and explores their connections. Use this to understand code architecture, find related files, or discover dependencies between components.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term — node label, file name, or concept name' },
        budget: { type: 'number', description: 'Max nodes to return (default 30)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'graph_path',
    description: 'Find the shortest dependency/call path between two components or files in the project knowledge graph. Use this to understand how two parts of the codebase relate.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Starting component/file name' },
        to: { type: 'string', description: 'Target component/file name' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'graph_explain',
    description: 'Get detailed information about a code entity from the knowledge graph: its file location, community, connections to other entities, and peers in the same module group.',
    parameters: {
      type: 'object',
      properties: {
        node: { type: 'string', description: 'Node name to explain — component, function, or file name' },
      },
      required: ['node'],
    },
  },
  {
    name: 'memory_save',
    description: 'Save a fact or preference to long-term memory. The AI will remember it across conversations. Use for project conventions, user preferences, important decisions.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique key for the memory (e.g. "project_name", "ocr_engine", "user_preference")' },
        value: { type: 'string', description: 'The fact or preference to remember' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'memory_recall',
    description: 'Retrieve saved facts from long-term memory. Call with no query to list all memories, or with a query to search by keyword.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword to search for' },
      },
    },
  },
  {
    name: 'analyze_project',
    description: 'Get comprehensive project statistics: page count, region count by kind and status, OCR/translation progress, and job queue state.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'find_overlaps',
    description: 'Detect overlapping regions on a page. Helps identify layout issues where regions cover each other.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID to check (omit for all pages)' },
        threshold: { type: 'number', description: 'Overlap threshold in pixels (default 5)' },
      },
    },
  },
  {
    name: 'find_issues',
    description: 'Find regions with problems: empty source text, failed OCR/translation, locked regions, or missing translations.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID to check (omit for all pages)' },
      },
    },
  },
  {
    name: 'start_plan',
    description: 'Create a multi-step plan to track progress across multiple tool calls. Use when the user asks for a complex workflow (e.g. "OCR all pages then translate"). Each step will be marked as you complete it.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Overall plan description' },
        steps: { type: 'array', items: { type: 'string' }, description: 'List of step labels in order' },
      },
      required: ['description', 'steps'],
    },
  },
  {
    name: 'plan_step',
    description: 'Mark a step as done or failed in the current plan. Call this after completing each step of a multi-step task.',
    parameters: {
      type: 'object',
      properties: {
        stepNumber: { type: 'number', description: 'Step number (1-based)' },
        status: { type: 'string', enum: ['done', 'failed'], description: 'Completion status' },
        note: { type: 'string', description: 'Optional result summary' },
      },
      required: ['stepNumber', 'status'],
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

    case 'graph_query': {
      return await graphQuery(args.query as string, args.budget as number | undefined);
    }

    case 'graph_path': {
      return await graphPath(args.from as string, args.to as string);
    }

    case 'graph_explain': {
      return await graphExplain(args.node as string);
    }

    case 'memory_save': {
      return memorySave(args.key as string, args.value as string);
    }

    case 'memory_recall': {
      return memoryRecall(args.query as string | undefined);
    }

    case 'analyze_project': {
      const { pages } = usePageStore.getState();
      const { jobs } = useJobStore.getState();

      let totalRegions = 0;
      const kindCount: Record<string, number> = {};
      const statusCount: Record<string, number> = {};
      let ocrDone = 0;
      let translated = 0;
      let locked = 0;

      for (const page of pages) {
        totalRegions += page.regions.length;
        for (const r of page.regions) {
          kindCount[r.kind] = (kindCount[r.kind] ?? 0) + 1;
          statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
          if (r.ocrStatus === 'done') ocrDone++;
          if (r.translationStatus === 'done') translated++;
          if (r.locked) locked++;
        }
      }

      const jobSummary = {
        queued: jobs.filter(j => j.status === 'queued').length,
        running: jobs.filter(j => j.status === 'running').length,
        done: jobs.filter(j => j.status === 'done').length,
        failed: jobs.filter(j => j.status === 'failed').length,
      };

      return JSON.stringify({
        project: { pages: pages.length, regions: totalRegions },
        regionsByKind: kindCount,
        regionsByStatus: statusCount,
        progress: { ocrDone, translated, locked },
        jobs: jobSummary,
      }, null, 2);
    }

    case 'find_overlaps': {
      const { pages } = usePageStore.getState();
      const threshold = (args.threshold as number) ?? 5;
      const targetPageId = args.pageId as string | undefined;
      const overlaps: { pageId: string; pageName: string; a: string; b: string; overlapPx: number }[] = [];

      const checkOverlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
        const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        return overlapX * overlapY;
      };

      for (const page of pages) {
        if (targetPageId && page.id !== targetPageId) continue;
        for (let i = 0; i < page.regions.length; i++) {
          for (let j = i + 1; j < page.regions.length; j++) {
            const a = page.regions[i];
            const b = page.regions[j];
            const overlap = checkOverlap(a, b);
            if (overlap > threshold * threshold) {
              overlaps.push({ pageId: page.id, pageName: page.fileName, a: a.label, b: b.label, overlapPx: overlap });
            }
          }
        }
      }

      if (overlaps.length === 0) return 'No overlapping regions found.';
      return JSON.stringify({ overlapsFound: overlaps.length, overlaps }, null, 2);
    }

    case 'start_plan': {
      const description = args.description as string;
      const stepLabels = args.steps as string[];
      planIdCounter++;
      currentPlan = {
        id: `plan-${planIdCounter}`,
        description,
        steps: stepLabels.map((label, i) => ({ id: i + 1, label, status: 'pending' as const })),
        currentStep: 0,
      };
      const stepList = currentPlan.steps.map((s) => `  ${s.id}. ${s.label} — ожидает`).join('\n');
      return `План создан: ${description}\n${stepList}`;
    }

    case 'plan_step': {
      if (!currentPlan) return 'Нет активного плана. Сначала вызови start_plan.';
      const stepNumber = args.stepNumber as number;
      const status = args.status as 'done' | 'failed';
      const note = args.note as string | undefined;

      const step = currentPlan.steps.find((s) => s.id === stepNumber);
      if (!step) return `Шаг ${stepNumber} не найден.`;
      step.status = status;
      currentPlan.currentStep = stepNumber;

      const progress = currentPlan.steps
        .map((s) => `  ${s.id}. ${s.label} — ${s.status === 'done' ? '✓' : s.status === 'failed' ? '✗' : '…'}`)
        .join('\n');

      const allDone = currentPlan.steps.every((s) => s.status === 'done');
      const summary = note ? `\nЗаметка: ${note}` : '';
      const doneMsg = allDone ? '\n\n✅ Все шаги выполнены!' : `\n\nПрогресс: ${currentPlan.steps.filter((s) => s.status === 'done').length}/${currentPlan.steps.length}`;

      return `Шаг ${stepNumber} завершён: ${status}${summary}\n${progress}${doneMsg}`;
    }

    case 'find_issues': {
      const { pages } = usePageStore.getState();
      const targetPageId = args.pageId as string | undefined;
      const issues: { pageId: string; pageName: string; regionId: string; label: string; issue: string }[] = [];

      for (const page of pages) {
        if (targetPageId && page.id !== targetPageId) continue;
        for (const r of page.regions) {
          if (!r.sourceText && r.ocrStatus !== 'idle') {
            issues.push({ pageId: page.id, pageName: page.fileName, regionId: r.id, label: r.label, issue: 'OCR failed — no source text' });
          }
          if (r.ocrStatus === 'failed') {
            issues.push({ pageId: page.id, pageName: page.fileName, regionId: r.id, label: r.label, issue: 'OCR failed' });
          }
          if (r.translationStatus === 'failed') {
            issues.push({ pageId: page.id, pageName: page.fileName, regionId: r.id, label: r.label, issue: 'Translation failed' });
          }
          if (r.sourceText && !r.translatedText && r.translationStatus === 'idle') {
            issues.push({ pageId: page.id, pageName: page.fileName, regionId: r.id, label: r.label, issue: 'OCR done but not translated' });
          }
        }
      }

      if (issues.length === 0) return 'No issues found.';
      return JSON.stringify({ issuesFound: issues.length, issues }, null, 2);
    }

    default:
      return `Unknown tool: ${toolCall.name}`;
  }
}
