import type { RegionTemplate, TemplateCategory } from './types';

export const BUILTIN_TEMPLATES: TemplateCategory[] = [
  {
    id: 'speech',
    name: 'Речь',
    templates: [
      { id: 'speech-lg', name: 'Крупный баллон', kind: 'speech', width: 300, height: 100, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
      { id: 'speech-md', name: 'Средний баллон', kind: 'speech', width: 200, height: 80, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
      { id: 'speech-sm', name: 'Малый баллон', kind: 'speech', width: 120, height: 60, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
      { id: 'speech-vert', name: 'Вертикальный', kind: 'speech', width: 80, height: 200, rotation: 0, orientation: 'vertical', locked: false, visible: true, notes: '' },
    ],
  },
  {
    id: 'sfx',
    name: 'SFX',
    templates: [
      { id: 'sfx-wide', name: 'Широкий SFX', kind: 'sfx', width: 200, height: 80, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
      { id: 'sfx-tall', name: 'Высокий SFX', kind: 'sfx', width: 80, height: 200, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
      { id: 'sfx-bang', name: 'BANG!', kind: 'sfx', width: 150, height: 150, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
    ],
  },
  {
    id: 'narration',
    name: 'Нарратив',
    templates: [
      { id: 'narr-box', name: 'Бокс нарратива', kind: 'narration', width: 250, height: 90, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
      { id: 'narr-wide', name: 'Широкий нарратив', kind: 'narration', width: 400, height: 60, rotation: 0, orientation: 'horizontal', locked: false, visible: true, notes: '' },
    ],
  },
];
