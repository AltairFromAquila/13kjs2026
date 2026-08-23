import { clamp, mathJs, vec2New } from "../math";
import { canvas, ctx } from "../sys/context";

// TODO: Refactor
const camPos = vec2New();
let camHeight = 500;
let camAngle = 0;
let camPitch = 0;

const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  heightDown: false,
  heightUp: false,
  turnLeft: false,
  turnRight: false,
  pitchNegative: false,
  pitchPositive: false,
};
const kCamSpeed = 250;
const kHeightSpeed = 300;
const kPitchSpeed = mathJs.PI * 0.25;
const kTurnSpeed = mathJs.PI * 0.75;
const kPitchMaxAbs = mathJs.PI * 0.5;
const kCamHeightMin = 1;
const kVerticalFov = mathJs.PI * 0.3;
const kTau = mathJs.PI * 2;
let prevInputUpdateTime = performance.now();

function handleMovementInput(deltaMs: number) {
  const distance = kCamSpeed * (deltaMs / 1000);
  const heightDelta = kHeightSpeed * (deltaMs / 1000);
  const pitchDelta = kPitchSpeed * (deltaMs / 1000);
  const turnDelta = kTurnSpeed * (deltaMs / 1000);

  if (moveState.forward) camPos.y -= distance;
  if (moveState.backward) camPos.y += distance;
  if (moveState.left) camPos.x -= distance;
  if (moveState.right) camPos.x += distance;
  if (moveState.heightDown) camHeight -= heightDelta;
  if (moveState.heightUp) camHeight += heightDelta;
  if (moveState.turnLeft) camAngle -= turnDelta;
  if (moveState.turnRight) camAngle += turnDelta;
  if (moveState.pitchNegative) camPitch -= pitchDelta;
  if (moveState.pitchPositive) camPitch += pitchDelta;

  camHeight = mathJs.max(kCamHeightMin, camHeight);
  camAngle = ((camAngle % kTau) + kTau) % kTau;
  camPitch = mathJs.max(-kPitchMaxAbs, mathJs.min(kPitchMaxAbs, camPitch));
}

window.addEventListener("keydown", (ev) => {
  switch (ev.code) {
    case "KeyW":
      moveState.forward = true;
      break;
    case "KeyS":
      moveState.backward = true;
      break;
    case "KeyQ":
      moveState.left = true;
      break;
    case "KeyE":
      moveState.right = true;
      break;
    case "KeyZ":
      moveState.heightDown = true;
      break;
    case "KeyX":
      moveState.heightUp = true;
      break;
    case "KeyA":
      moveState.turnLeft = true;
      break;
    case "KeyD":
      moveState.turnRight = true;
      break;
    case "KeyR":
      moveState.pitchNegative = true;
      break;
    case "KeyF":
      moveState.pitchPositive = true;
      break;
  }
});

window.addEventListener("keyup", (ev) => {
  switch (ev.code) {
    case "KeyW":
      moveState.forward = false;
      break;
    case "KeyS":
      moveState.backward = false;
      break;
    case "KeyQ":
      moveState.left = false;
      break;
    case "KeyE":
      moveState.right = false;
      break;
    case "KeyZ":
      moveState.heightDown = false;
      break;
    case "KeyX":
      moveState.heightUp = false;
      break;
    case "KeyA":
      moveState.turnLeft = false;
      break;
    case "KeyD":
      moveState.turnRight = false;
      break;
    case "KeyR":
      moveState.pitchNegative = false;
      break;
    case "KeyF":
      moveState.pitchPositive = false;
      break;
  }
});

window.addEventListener("blur", () => {
  moveState.forward = false;
  moveState.backward = false;
  moveState.left = false;
  moveState.right = false;
  moveState.heightDown = false;
  moveState.heightUp = false;
  moveState.turnLeft = false;
  moveState.turnRight = false;
  moveState.pitchNegative = false;
  moveState.pitchPositive = false;
});

const projectedPlaneCanvas: OffscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
const projectedPlaneCtx: OffscreenCanvasRenderingContext2D = projectedPlaneCanvas.getContext('2d')!;

export function render(a: any) {
  const now = performance.now();
  handleMovementInput(now - prevInputUpdateTime);
  prevInputUpdateTime = now;

  renderProjectedPlane(a);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(projectedPlaneCanvas, 0, 0);
}

const verTanTable = (() => {
  const halfHeight = canvas.height * 0.5;
  const tanHalfFov = mathJs.tan(kVerticalFov * 0.5);
  const ret: number[] = [];

  for (let y = 0; y < canvas.height; ++y) {
    const ndcY = ((y + 0.5) - halfHeight) / halfHeight;
    ret.push(ndcY * tanHalfFov);
  }

  return ret;
})();
const horTanTable = (() => {
  const halfWidth = canvas.width * 0.5;
  const tanHalfVFov = mathJs.tan(kVerticalFov * 0.5);
  const tanHalfHFov = tanHalfVFov * (canvas.width / canvas.height);
  const ret: number[] = [];

  for (let x = 0; x < canvas.width; ++x) {
    const ndcX = ((x + 0.5) - halfWidth) / halfWidth;
    ret.push(ndcX * tanHalfHFov);
  }

  return ret;
})();

let trackPixels: Uint32Array | null = null;
const outputData = projectedPlaneCtx.createImageData(canvas.width, canvas.height);
const outputPixels = new Uint32Array(outputData.data.buffer);
const kMask = (2048 * 2) - 1; // Track texture is always power of two, and mod operator tanks the frame rate
const kSkyColor = 0xffebce87;
function renderProjectedPlane(a: any) {
  if (!trackPixels) {
    const trackCanvas = a.textureCanvas as OffscreenCanvas;
    const trackImage = a.textureCtx.getImageData(0, 0, trackCanvas.width, trackCanvas.height);

    trackPixels = new Uint32Array(trackImage.data.buffer);
  }

  const width = canvas.width;
  const height = canvas.height;

  const camSin = mathJs.sin(camPitch);
  const camCos = mathJs.cos(camPitch);
  const yawSin = mathJs.sin(camAngle);
  const yawCos = mathJs.cos(camAngle);
  const rowStride = kMask + 1;

  for (let j = 0; j < height; ++j) {
    const outputRow = (height - 1 - j);
    const sy = verTanTable[j];

    const rayY = -camCos - (sy * camSin);
    const rayZ = -camSin + (sy * camCos);

    if (rayZ >= -1e-6) {
      outputPixels.fill(kSkyColor, outputRow * width, (outputRow + 1) * width);
      continue;
    }

    const t = camHeight / -rayZ;

    for (let i = 0; i < width; ++i) {
      const sx = horTanTable[i];
      const localX = t * sx;
      const localY = t * rayY;

      const worldX = (yawCos * localX) - (yawSin * localY);
      const worldY = (yawSin * localX) + (yawCos * localY);

      const texX = (camPos.x + worldX) | 0;
      const texY = (camPos.y + worldY) | 0;
      const rowOffset = (texY & kMask) * rowStride;
      const textureIdx = rowOffset + (texX & kMask);
      const outputIdx = (width * outputRow) + i;

      outputPixels[outputIdx] = trackPixels[textureIdx];
    }
  }

  projectedPlaneCtx.putImageData(outputData, 0, 0);
}