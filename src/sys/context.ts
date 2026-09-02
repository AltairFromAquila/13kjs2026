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

export const ctxBeginPath = (ctx: CanvasRenderingContext2D) => ctx.beginPath();
export const ctxClosePathAndFill = (ctx: CanvasRenderingContext2D) => (ctx.closePath(), ctx.fill());
export const ctxMoveTo = (ctx: CanvasRenderingContext2D, x: number, y: number) => ctx.moveTo(x, y);
export const ctxLineTo = (ctx: CanvasRenderingContext2D, x: number, y: number) => ctx.lineTo(x, y);

export const ctxSetFillStyle = (ctx: CanvasRenderingContext2D, color: string | CanvasGradient | CanvasPattern) => ctx.fillStyle = color;

export function createOffscreenCanvas(width: number, height: number, alpha: boolean, read: boolean) {
  const offscreenCanvas = new OffscreenCanvas(width, height);
  const offscreenCtx = offscreenCanvas.getContext('2d', { alpha, willReadFrequently: read })!;
  return { offscreenCanvas, offscreenCtx };
}

window.addEventListener('resize', onResize);
onResize();
