import type { RegionKind } from '../types/region';

export interface RegionTemplate {
  id: string;
  name: string;
  kind: RegionKind;
  width: number;
  height: number;
  rotation: number;
  orientation: 'horizontal' | 'vertical';
  locked: boolean;
  visible: boolean;
  notes: string;
  textStyleId?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  templates: RegionTemplate[];
}
