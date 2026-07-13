import { vi } from 'vitest';

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, val: string) { this.store.set(key, val); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
  get length() { return this.store.size; }
  key(n: number) { return [...this.store.keys()][n] ?? null; }
}

vi.stubGlobal('localStorage', new MockStorage());

class MockDocument {
  documentElement = new MockElement();
  createElement() { return { href: '', download: '', click() {} }; }
}
class MockElement {
  style = new MockStyle();
}
class MockStyle {
  private props = new Map<string, string>();
  setProperty(k: string, v: string) { this.props.set(k, v); }
  getPropertyValue(k: string) { return this.props.get(k) ?? ''; }
  removeProperty(k: string) { this.props.delete(k); }
}

vi.stubGlobal('document', new MockDocument() as unknown as Document);
