import type { Region } from './region';

export interface Page {
  id: string;
  /** File name shown in the sidebar */
  fileName: string;
  /** Object URL or data-url of the loaded image */
  imageUrl: string;
  /** Natural pixel width of the source image */
  naturalWidth: number;
  /** Natural pixel height of the source image */
  naturalHeight: number;
  /** Ordered list of regions on this page */
  regions: Region[];
}
