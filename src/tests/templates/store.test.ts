import { afterEach, describe, expect, it } from 'vitest';
import { useTemplateStore } from '../../templates/store';

describe('useTemplateStore', () => {
  afterEach(() => {
    useTemplateStore.setState({ customTemplates: [] });
  });

  it('starts with no custom templates', () => {
    expect(useTemplateStore.getState().customTemplates).toHaveLength(0);
  });

  it('adds a custom template', () => {
    useTemplateStore.getState().addTemplate({
      name: 'Test TM',
      kind: 'speech',
      width: 100,
      height: 50,
      rotation: 0,
      orientation: 'horizontal',
      locked: false,
      visible: true,
      notes: '',
    });
    expect(useTemplateStore.getState().customTemplates).toHaveLength(1);
    expect(useTemplateStore.getState().customTemplates[0].name).toBe('Test TM');
  });

  it('assigns unique IDs to added templates', () => {
    useTemplateStore.getState().addTemplate({ name: 'A', kind: 'speech', width: 100, height: 50, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' });
    useTemplateStore.getState().addTemplate({ name: 'B', kind: 'sfx', width: 200, height: 80, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' });
    const ids = useTemplateStore.getState().customTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('removes a template', () => {
    useTemplateStore.getState().addTemplate({ name: 'X', kind: 'speech', width: 100, height: 50, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' });
    const id = useTemplateStore.getState().customTemplates[0].id;
    useTemplateStore.getState().removeTemplate(id);
    expect(useTemplateStore.getState().customTemplates).toHaveLength(0);
  });

  it('getAllTemplates returns builtins + custom', () => {
    useTemplateStore.getState().addTemplate({ name: 'Custom', kind: 'speech', width: 100, height: 50, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' });
    const all = useTemplateStore.getState().getAllTemplates();
    // 4 speech + 3 sfx + 2 narration + 1 custom = 10
    expect(all.length).toBeGreaterThanOrEqual(10);
  });
});
