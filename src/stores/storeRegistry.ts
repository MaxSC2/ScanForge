type StoreEntry = { getState: () => any; setState: (fn: any) => void };

const registry = new Map<string, StoreEntry>();

export function register(name: string, store: StoreEntry) {
  registry.set(name, store);
}

export function use(name: string): StoreEntry {
  const entry = registry.get(name);
  if (!entry) throw new Error(`Store '${name}' not registered yet`);
  return entry;
}
