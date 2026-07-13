const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

const GOOGLE_FONTS_ALIAS: Record<string, string> = {
  'Noto Sans': 'Noto+Sans',
  'Noto Sans JP': 'Noto+Sans+JP',
  'Noto Sans SC': 'Noto+Sans+SC',
  'Noto Serif': 'Noto+Serif',
  'Noto Serif JP': 'Noto+Serif+JP',
  'Roboto': 'Roboto',
  'Inter': 'Inter',
  'Open Sans': 'Open+Sans',
  'Lato': 'Lato',
  'Montserrat': 'Montserrat',
  'Oswald': 'Oswald',
  'PT Sans': 'PT+Sans',
  'PT Serif': 'PT+Serif',
  'Ubuntu': 'Ubuntu',
  'Merriweather': 'Merriweather',
  'Playfair Display': 'Playfair+Display',
  'Fira Sans': 'Fira+Sans',
  'Source Sans Pro': 'Source+Sans+Pro',
  'Source Serif Pro': 'Source+Serif+Pro',
  'Nunito': 'Nunito',
  'Raleway': 'Raleway',
};

function isSystemFont(family: string): boolean {
  const system = new Set([
    'arial', 'arial black', 'helvetica', 'courier new', 'georgia',
    'impact', 'tahoma', 'times new roman', 'trebuchet ms', 'verdana',
    'comic sans ms', 'geneva', 'monaco', 'palatino linotype', 'book antiqua',
    'garamond', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
    'inter', 'segoe ui',
  ]);
  return system.has(family.toLowerCase().trim());
}

export function loadFont(family: string): Promise<void> {
  const key = family.trim();
  if (!key || loaded.has(key) || isSystemFont(key)) {
    return Promise.resolve();
  }

  const existing = pending.get(key);
  if (existing) return existing;

  const googleParam = GOOGLE_FONTS_ALIAS[key];
  if (!googleParam) {
    loaded.add(key);
    return Promise.resolve();
  }

  const promise = new Promise<void>((resolve, reject) => {
    const href = `https://fonts.googleapis.com/css2?family=${googleParam}:wght@400;500;700&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => {
      loaded.add(key);
      document.fonts.ready.then(() => resolve()).catch(resolve);
    };
    link.onerror = () => {
      loaded.add(key);
      resolve();
    };
    document.head.appendChild(link);
  });

  pending.set(key, promise);
  return promise;
}

export async function ensureFontsLoaded(
  families: (string | undefined)[],
): Promise<void> {
  const unique = Array.from(new Set(families.filter(Boolean)));
  await Promise.all(unique.map(loadFont));
}
