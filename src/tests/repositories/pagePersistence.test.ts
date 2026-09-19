import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const listByProjectMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('../../utils/runtime', () => ({
  isDesktopRuntime: vi.fn(),
}));

vi.mock('../../repositories/pageRepository', () => ({
  pageRepository: {
    listByProject: listByProjectMock,
  },
}));

vi.mock('../../repositories/projectRepository', () => ({
  projectRepository: {
    update: vi.fn(),
  },
}));

vi.mock('../../repositories/projectDefaults', () => ({
  ensureProjectDomainDefaults: vi.fn(),
}));

vi.mock('../../repositories/regionRepository', () => ({
  regionRepository: {
    deleteByPage: vi.fn(),
  },
}));

describe('page persistence recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    listByProjectMock.mockReset();
  });

  it('uses a recovered embedded image when durable asset loading fails', async () => {
    const runtime = await import('../../utils/runtime');
    vi.mocked(runtime.isDesktopRuntime).mockReturnValue(true);

    invokeMock.mockRejectedValueOnce(new Error('asset missing'));
    listByProjectMock.mockResolvedValueOnce([
      {
        id: 'page-1',
        projectId: 'project-1',
        order: 1,
        imagePath: 'C:\\ScanForge\\assets\\page-1.png',
        width: 800,
        height: 1200,
      },
    ]);

    const { mergePagesWithRepository } = await import('../../repositories/pagePersistence');
    const fallback = {
      id: 'page-1',
      fileName: 'page-1.png',
      imagePath: 'C:\\ScanForge\\assets\\page-1.png',
      imageUrl: 'data:image/png;base64,RECOVERABLE',
      naturalWidth: 800,
      naturalHeight: 1200,
      regions: [],
    };

    const [page] = await mergePagesWithRepository(
      { localProjectId: 'project-1', name: 'test', createdAt: 0, updatedAt: 0 },
      [fallback],
    );

    expect(page.imageUrl).toBe('data:image/png;base64,RECOVERABLE');
    expect(page.imageUrl).not.toBe(page.imagePath);
  });

  it('uses a visible recovery placeholder when both durable and embedded assets are unavailable', async () => {
    const runtime = await import('../../utils/runtime');
    vi.mocked(runtime.isDesktopRuntime).mockReturnValue(true);

    invokeMock.mockRejectedValueOnce(new Error('asset missing'));
    listByProjectMock.mockResolvedValueOnce([
      {
        id: 'page-2',
        projectId: 'project-1',
        order: 2,
        imagePath: 'C:\\ScanForge\\assets\\page-2.png',
        width: 800,
        height: 1200,
      },
    ]);

    const { mergePagesWithRepository } = await import('../../repositories/pagePersistence');
    const [page] = await mergePagesWithRepository(
      { localProjectId: 'project-1', name: 'test', createdAt: 0, updatedAt: 0 },
      [],
    );

    expect(page.imageUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(page.imageUrl)).toContain('Asset unavailable');
    expect(page.imageUrl).not.toBe('C:\\ScanForge\\assets\\page-2.png');
  });

  it('does not call desktop loader for durable data URLs', async () => {
    const runtime = await import('../../utils/runtime');
    vi.mocked(runtime.isDesktopRuntime).mockReturnValue(true);

    listByProjectMock.mockResolvedValueOnce([
      {
        id: 'page-3',
        projectId: 'project-1',
        order: 1,
        imagePath: 'data:image/png;base64,INLINE',
        width: 800,
        height: 1200,
      },
    ]);

    const { mergePagesWithRepository } = await import('../../repositories/pagePersistence');
    const [page] = await mergePagesWithRepository(
      { localProjectId: 'project-1', name: 'test', createdAt: 0, updatedAt: 0 },
      [],
    );

    expect(invokeMock).not.toHaveBeenCalled();
    expect(page.imageUrl).toBe('data:image/png;base64,INLINE');
  });
});
