import { useEffect, useState } from 'react';

/**
 * Loads an image from a URL and returns the HTMLImageElement
 * once ready (for use with Konva <Image />).
 */
export function useImageLoader(url: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.src = url;
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return image;
}
