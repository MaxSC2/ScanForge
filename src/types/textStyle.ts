export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  id: string;
  projectId: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  align: TextAlign;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export const DEFAULT_TEXT_STYLE_NAME = 'Default';

export function createDefaultTextStyle(projectId: string): TextStyle {
  return {
    id: `${projectId}:default-style`,
    projectId,
    name: DEFAULT_TEXT_STYLE_NAME,
    fontFamily: 'Arial',
    fontSize: 28,
    lineHeight: 1.15,
    letterSpacing: 0,
    align: 'center',
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 3,
  };
}
