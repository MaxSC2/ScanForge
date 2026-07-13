import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPluginFromSource } from '../../plugins/loader';
import { usePluginRegistry } from '../../plugins/registry';

describe('plugin loader', () => {
  afterEach(() => {
    usePluginRegistry.setState({ plugins: [] });
    localStorage.clear();
  });

  it('loads a valid plugin', async () => {
    const src = `/* @id test-plugin @name Test Plugin @version 1.0 */
(ctx) => {
  ctx.api.showToast('hello');
};`;
    const manifest = await loadPluginFromSource(src);
    expect(manifest).toBeTruthy();
    expect(manifest!.id).toBe('test-plugin');
    expect(manifest!.name).toBe('Test Plugin');
    expect(manifest!.version).toBe('1.0');
  });

  it('fails without @id tag', async () => {
    const src = `/* @name No ID */ (ctx) => {};`;
    const manifest = await loadPluginFromSource(src);
    expect(manifest).toBeNull();
  });

  it('fails without @name tag', async () => {
    const src = `/* @id no-name @version 1.0 */ (ctx) => {};`;
    const manifest = await loadPluginFromSource(src);
    expect(manifest).toBeNull();
  });

  it('fails without @version tag', async () => {
    const src = `/* @id no-ver @name No Version */ (ctx) => {};`;
    const manifest = await loadPluginFromSource(src);
    expect(manifest).toBeNull();
  });

  it('extracts description and author', async () => {
    const src = `/* @id desc-plugin @name Desc @version 2.0 @description Hello World @author Me */ (ctx) => {};`;
    const manifest = await loadPluginFromSource(src);
    expect(manifest!.description).toBe('Hello World');
    expect(manifest!.author).toBe('Me');
  });

  it('registers plugin in registry', async () => {
    const src = `/* @id reg-plugin @name Reg @version 1.0 */ (ctx) => {};`;
    await loadPluginFromSource(src);
    const registry = usePluginRegistry.getState();
    expect(registry.plugins.length).toBe(1);
    expect(registry.plugins[0].manifest.id).toBe('reg-plugin');
    expect(registry.plugins[0].enabled).toBe(true);
  });

  it('calls factory on load', async () => {
    const src = `/* @id call-plugin @name Call @version 1.0 */
(ctx) => {
  ctx.api.showToast('hello');
};`;
    const manifest = await loadPluginFromSource(src);
    expect(manifest).toBeTruthy();
  });
});
