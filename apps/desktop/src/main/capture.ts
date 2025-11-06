import { desktopCapturer, screen, nativeImage } from 'electron';
import { getRoi } from './index';

export interface CaptureResult {
  imageData: Buffer;
  width: number;
  height: number;
}

export async function captureRoi(): Promise<CaptureResult | null> {
  const roi = getRoi();
  if (!roi || roi.width <= 0 || roi.height <= 0) {
    return null;
  }

  try {
    const displaySize = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: displaySize
    });

    if (sources.length === 0) {
      return null;
    }

    const source = sources[0];
    const thumbnail = source.thumbnail;

    if (!thumbnail) {
      return null;
    }

    // nativeImage로 ROI 영역만 크롭
    const img = nativeImage.createFromDataURL(thumbnail.toDataURL());
    const cropped = img.crop({
      x: roi.x,
      y: roi.y,
      width: roi.width,
      height: roi.height
    });
    
    const imageData = cropped.toPNG();
    
    return {
      imageData,
      width: roi.width,
      height: roi.height
    };
  } catch (error) {
    console.error('Capture error:', error);
    return null;
  }
}

