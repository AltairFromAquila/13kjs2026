export const doc = document;

export const canvas = doc.getElementById('c') as HTMLCanvasElement;
export const overlay = doc.getElementById('o') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d')!;
export const overlayCtx = overlay.getContext('2d', { alpha: true })!;

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

window.addEventListener('resize', onResize);
onResize();
