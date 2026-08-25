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
  const yawSin = mathJs.sin(camAngle);
  const yawCos = mathJs.cos(camAngle);

  // Camera-local basis in world space.
  const forwardX = yawSin;
  const forwardY = -yawCos;
  const rightX = yawCos;
  const rightY = yawSin;

  if (moveState.forward) {
    camPos.x += forwardX * distance;
    camPos.y += forwardY * distance;
  }
  if (moveState.backward) {
    camPos.x -= forwardX * distance;
    camPos.y -= forwardY * distance;
  }
  if (moveState.left) {
    camPos.x -= rightX * distance;
    camPos.y -= rightY * distance;
  }
  if (moveState.right) {
    camPos.x += rightX * distance;
    camPos.y += rightY * distance;
  }
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
const kFogFactor = 0.1;
const kGroundBaseColor = 0xff2b8f2b;
const kGroundSkyTint = 0.2;
const kGroundColor = blendAbgr(kGroundBaseColor, kSkyColor, kGroundSkyTint);

function blendAbgr(src: number, dst: number, t: number): number {
  const invT = 1 - t;

  const srcR = src & 0xff;
  const srcG = (src >>> 8) & 0xff;
  const srcB = (src >>> 16) & 0xff;
  const srcA = (src >>> 24) & 0xff;

  const dstR = dst & 0xff;
  const dstG = (dst >>> 8) & 0xff;
  const dstB = (dst >>> 16) & 0xff;
  const dstA = (dst >>> 24) & 0xff;

  const outR = ((srcR * invT) + (dstR * t)) | 0;
  const outG = ((srcG * invT) + (dstG * t)) | 0;
  const outB = ((srcB * invT) + (dstB * t)) | 0;
  const outA = ((srcA * invT) + (dstA * t)) | 0;

  return (outA << 24) | (outB << 16) | (outG << 8) | outR;
}

function overAbgr(top: number, bottom: number): number {
  const topA = (top >>> 24) & 0xff;
  if (topA === 0xff) return top;
  if (topA === 0) return bottom;

  const invTopA = 255 - topA;

  const topR = top & 0xff;
  const topG = (top >>> 8) & 0xff;
  const topB = (top >>> 16) & 0xff;

  const botR = bottom & 0xff;
  const botG = (bottom >>> 8) & 0xff;
  const botB = (bottom >>> 16) & 0xff;
  const botA = (bottom >>> 24) & 0xff;

  const outR = ((topR * topA) + (botR * invTopA)) / 255;
  const outG = ((topG * topA) + (botG * invTopA)) / 255;
  const outB = ((topB * topA) + (botB * invTopA)) / 255;
  const outA = topA + ((botA * invTopA) / 255);

  return (((outA | 0) & 0xff) << 24)
    | (((outB | 0) & 0xff) << 16)
    | (((outG | 0) & 0xff) << 8)
    | ((outR | 0) & 0xff);
}

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

    const invZ = 1 / -rayZ;
    const t = camHeight * invZ;
    const localY = t * rayY;
    const linearFogValue = clamp((invZ * kFogFactor) - 1, 0, 1);
    const fogValue = 1 - (1 - linearFogValue) * (1 - linearFogValue);

    for (let i = 0; i < width; ++i) {
      const sx = horTanTable[i];
      const localX = t * sx;

      const worldX = (yawCos * localX) - (yawSin * localY);
      const worldY = (yawSin * localX) + (yawCos * localY);

      const texX = (camPos.x + worldX) | 0;
      const texY = (camPos.y + worldY) | 0;
      const rowOffset = (texY & kMask) * rowStride;
      const textureIdx = rowOffset + (texX & kMask);
      const outputIdx = (width * outputRow) + i;

      const trackColor = trackPixels[textureIdx];
      const groundFogged = (fogValue > 0)
        ? blendAbgr(kGroundColor, kSkyColor, fogValue)
        : kGroundColor;
      const trackFogged = (fogValue > 0)
        ? blendAbgr(trackColor, kSkyColor, linearFogValue)
        : trackColor;

      outputPixels[outputIdx] = overAbgr(trackFogged, groundFogged);
    }
  }

  projectedPlaneCtx.putImageData(outputData, 0, 0);
}