import { invoke } from '@tauri-apps/api/core';
import { isDesktopRuntime } from '../utils/runtime';

export interface ImagickOptions {
  format: 'jpg' | 'png' | 'webp';
  quality: number;
  resizePercent?: number;
  inputPath: string;
  outputPath: string;
}

export interface ImagickResult {
  success: boolean;
  outputPath: string;
  error: string | null;
}

export async function checkImagick(): Promise<boolean> {
  if (!isDesktopRuntime()) return false;
  return invoke<boolean>('check_imagick');
}

export async function convertWithImagick(options: ImagickOptions): Promise<ImagickResult> {
  if (!isDesktopRuntime()) throw new Error('ImageMagick requires Tauri');
  return invoke<ImagickResult>('convert_with_imagick', { options });
}
