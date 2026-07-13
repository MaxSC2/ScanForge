import { isDesktopRuntime } from '../utils/runtime';

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif',
]);

function isImageFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export async function importFolder(): Promise<File[]> {
  try {
    if (isDesktopRuntime()) {
      return importFolderDesktop();
    }
    return importFolderBrowser();
  } catch {
    return [];
  }
}

async function importFolderDesktop(): Promise<File[]> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readDir, readFile } = await import('@tauri-apps/plugin-fs');

  const folder = await open({
    title: 'Выбери папку с изображениями главы',
    directory: true,
    multiple: false,
  });

  if (!folder) {
    return [];
  }

  const entries = await readDir(folder);
  const imageFiles = entries
    .filter((e) => e.isFile && isImageFile(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const files: File[] = [];
  for (const entry of imageFiles) {
    try {
      const data = await readFile(`${folder}/${entry.name}`);
      const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : ext === '.bmp' ? 'image/bmp' : 'image/jpeg';
      files.push(new File([data], entry.name, { type: mime }));
    } catch {
      continue;
    }
  }

  return files;
}

async function importFolderBrowser(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;
    input.accept = 'image/*';

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      resolve(files.filter((f) => isImageFile(f.name)));
    };

    input.click();
  });
}
