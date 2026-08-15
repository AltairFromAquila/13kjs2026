const doc = document;

const canvas = doc.getElementById('c') as HTMLCanvasElement;
const overlay = doc.getElementById('o') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const overlayCtx = overlay.getContext('2d', { alpha: true })!;

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

const perfObj = performance;
const targetTickTime = 1/120;
let currentTime = perfObj.now();
let accTime = 0;

function run() {
  requestAnimationFrame(run);

  const newTime = perfObj.now();
  const delta = newTime - currentTime;
  
  accTime += delta;

  if (accTime > targetTickTime) {
    for (; accTime > 0; accTime -= targetTickTime) {}
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

run();