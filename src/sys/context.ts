import { windowAddEventListener } from "./window";

export type AnyCanvasRenderingContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const doc = document;

export const canvas = doc.getElementById('c') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false })!;

const kAvailableScreenHeights = [480, 720, 900, 1080, 1440]
const onResize = () => {
  const docEl = doc.documentElement;
  const height = docEl.clientHeight;
  const scrHeightIdx = kAvailableScreenHeights.findIndex(v => v > height) - 1;
  const targetHeight = (scrHeightIdx > -1)
    ? kAvailableScreenHeights[scrHeightIdx]
    : (scrHeightIdx === -1) ? 480 : 1440;
  
  const width = docEl.clientWidth;
  const wideWidth = targetHeight * 16/9;
  
  canvas.width = (wideWidth > width) ? (targetHeight * 4/3) : wideWidth;
  canvas.height = targetHeight;
}

export const ctxBeginPath = (context: AnyCanvasRenderingContext2D = ctx) => context.beginPath();
export const ctxClosePathAndFill = (context: AnyCanvasRenderingContext2D = ctx) => (context.closePath(), context.fill());

export const ctxSetTextAlign = (align: CanvasTextAlign) => ctx.textAlign = align;
export const ctxFillText = (text: string, x: number, y: number, maxWidth?: number | undefined) => ctx.fillText(text, x, y, maxWidth);

export const ctxMoveTo = (x: number, y: number, context: AnyCanvasRenderingContext2D = ctx) => context.moveTo(x, y);
export const ctxLineTo = (x: number, y: number, context: AnyCanvasRenderingContext2D = ctx) => context.lineTo(x, y);

export const ctxGetRainbowGradient = (x0: number, y0: number, x1: number, y1: number, alpha: string, context: AnyCanvasRenderingContext2D = ctx) => {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  const addStop = (offset: number, color: string) => gradient.addColorStop(offset, color + alpha);

  addStop(0.00, '#f00');
  addStop(0.17, '#f80');
  addStop(0.33, '#ff0');
  addStop(0.50, '#0f0');
  addStop(0.67, '#00f');
  addStop(0.83, '#408');
  addStop(1.00, '#80f');

  return gradient;
};

export const ctxSetGlobalAlpha = (alpha: number) => ctx.globalAlpha = alpha;
export const ctxSetFillStyle = (color: string | CanvasGradient | CanvasPattern, context: AnyCanvasRenderingContext2D = ctx) => context.fillStyle = color;

export const ctxCreateOffscreenCanvas = (width: number, height: number, alpha: boolean, read: boolean) => {
  const offscreenCanvas = new OffscreenCanvas(width, height);
  const offscreenCtx = offscreenCanvas.getContext('2d', { alpha, willReadFrequently: read })!;

  return {
    mCanvas: offscreenCanvas,
    mCtx: offscreenCtx,
  };
}

export const ctxGetCanvasImageData = (width: number, height: number, ctx: AnyCanvasRenderingContext2D) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = new Uint32Array(imageData.data.buffer);

  return {
    mImage: imageData,
    mPixels: pixels,
  };
}


windowAddEventListener('resize', onResize);
onResize();
