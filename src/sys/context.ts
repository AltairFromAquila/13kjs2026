export type AnyCanvasRenderingContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const doc = document;

export const canvas = doc.getElementById('c') as HTMLCanvasElement;
export const overlay = doc.getElementById('o') as HTMLCanvasElement;
export const ctx = getContext2D(canvas, false, false)!;
export const overlayCtx = getContext2D(overlay, true, false)!;

const kAvailableScreenHeights = [480, 720, 900, 1080, 1440]
function onResize() {
  const docEl = doc.documentElement;
  const height = docEl.clientHeight;
  const scrHeightIdx = kAvailableScreenHeights.findIndex(v => v > height) - 1;
  const targetHeight = (scrHeightIdx > -1)
    ? kAvailableScreenHeights[scrHeightIdx]
    : (scrHeightIdx === -1) ? 480 : 1440;
  
  const width = docEl.clientWidth;
  const wideWidth = targetHeight * 16/9;
  
  canvas.width = overlay.width = (wideWidth > width) ? (targetHeight * 4/3) : wideWidth;
  canvas.height = overlay.height = targetHeight;
}

function getContext2D(canvas: HTMLCanvasElement, alpha: boolean, read: boolean) {
  return canvas.getContext('2d', { alpha, willReadFrequently: read });
}

export const ctxBeginPath = (ctx: AnyCanvasRenderingContext2D) => ctx.beginPath();
export const ctxClosePathAndFill = (ctx: AnyCanvasRenderingContext2D) => (ctx.closePath(), ctx.fill());

export const ctxSetTextAlign = (ctx: AnyCanvasRenderingContext2D, align: CanvasTextAlign) => ctx.textAlign = align;
export const ctxFillText = (ctx: AnyCanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number | undefined) => ctx.fillText(text, x, y, maxWidth);

export const ctxMoveTo = (ctx: AnyCanvasRenderingContext2D, x: number, y: number) => ctx.moveTo(x, y);
export const ctxLineTo = (ctx: AnyCanvasRenderingContext2D, x: number, y: number) => ctx.lineTo(x, y);

export const ctxGetRainbowGradient = (ctx: AnyCanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, alpha: string) => {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
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

export const ctxSetFillStyle = (ctx: AnyCanvasRenderingContext2D, color: string | CanvasGradient | CanvasPattern) => ctx.fillStyle = color;

export const ctxCreateOffscreenCanvas = (width: number, height: number, alpha: boolean, read: boolean) => {
  const offscreenCanvas = new OffscreenCanvas(width, height);
  const offscreenCtx = offscreenCanvas.getContext('2d', { alpha, willReadFrequently: read })!;

  return {
    mCanvas: offscreenCanvas,
    mCtx: offscreenCtx,
  };
}

export const ctxGetCanvasImageData = (ctx: AnyCanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = new Uint32Array(imageData.data.buffer);

  return {
    mImage: imageData,
    mPixels: pixels,
  };
}


window.addEventListener('resize', onResize);
onResize();
