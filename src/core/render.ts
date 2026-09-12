import { colorPack, colorUnpack, kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathAbs, mathAtan2, mathClamp, mathCos, mathMax, mathMod, mathSin, mathTan, vec2New, type Vec2 } from "../math";
import type { Camera } from "../core/camera";
import { canvas, ctxCreateOffscreenCanvas, ctx, ctxGetCanvasImageData } from "../sys/context";
import type { Entity } from "./entity";

export interface RenderState {
  mVerTanTable: number[];
  mHorTanTable: number[];

  mTerrainPixels: Uint32Array | 0;
  mCloudsPixels: Uint32Array | 0;
  mTrackPixels: Uint32Array | 0;

  mTerrainOffset: Vec2;
  mCloudsOffset: Vec2;

  mSkyColor: number;
  mGroundColor: number;

  mSkyCloudsHeight: number;
  mCloudsHeight: number;
  mTerrainHeight: number;

  mTerrainWidth: number;
  mCloudsWidth: number;
  mTrackWidth: number;

  mFogDistance: number;
  mFogIntensity: number;

  mPrevVerticalFov: number;
  mPrevCanvasWidth: number;
  mPrevCanvasHeight: number;
}

export interface Renderable extends Entity {
  mScreenPos: Vec2;
}

export interface RenderableCommand<R extends Renderable> {
  mRenderables: R[];
  mScale: number;
  mAlpha: number;
  mCommand: (self: R, ctx: CanvasRenderingContext2D, x: number, y: number, invZ: number, angle: number, scale: number, alpha: number) => void;
}

interface RenderFrameCache {
  mCamAngleSin: number;
  mCamAngleCos: number;
  mCamPitchSin: number;
  mCamPitchCos: number;
}

interface SortedRenderable<R extends Renderable = Renderable> {
  mRenderable: R;
  mInvZ: number;
  mX: number;
  mY: number;
  mAngle: number;
  mScale: number;
  mAlpha: number;
}

const renderState: RenderState = {
  mVerTanTable: [],
  mHorTanTable: [],

  mTerrainPixels: 0,
  mCloudsPixels: 0,
  mTrackPixels: 0,

  mTerrainOffset: vec2New(),
  mCloudsOffset: vec2New(),

  mSkyColor: 0,
  mGroundColor: 0,

  mSkyCloudsHeight: 0,
  mCloudsHeight: 0,
  mTerrainHeight: 0,

  mTerrainWidth: 0,
  mCloudsWidth: 0,
  mTrackWidth: 0,

  mFogDistance: 0.2,
  mFogIntensity: 1.1,

  mPrevVerticalFov: 0,
  mPrevCanvasWidth: 0,
  mPrevCanvasHeight: 0,
};
const renderFrameCache: RenderFrameCache = {
  mCamAngleSin: 0,
  mCamAngleCos: 0,
  mCamPitchSin: 0,
  mCamPitchCos: 0,
}
const workSortedRenderables: SortedRenderable[] = [];

const {
  mCanvas: projectedPlaneCanvas,
  mCtx: projectedPlaneCtx,
} = ctxCreateOffscreenCanvas(canvas.width, canvas.height, false, false);
let {
  mImage: planeImageData,
  mPixels: planePixels,
} = ctxGetCanvasImageData(projectedPlaneCtx, canvas.width, canvas.height);

const blendAbgr = (src: number, dst: number, t: number): number => {
  const invT = 1 - t;

  const {
    r: srcR,
    g: srcG,
    b: srcB,
    a: srcA
  } = colorUnpack(src);
  const {
    r: dstR,
    g: dstG,
    b: dstB,
    a: dstA
  } = colorUnpack(dst);

  return colorPack(
    (srcR * invT) + (dstR * t),
    (srcG * invT) + (dstG * t),
    (srcB * invT) + (dstB * t),
    (srcA * invT) + (dstA * t)
  );
}

const overAbgr = (top: number, bottom: number): number => {
  const {
    r: topR,
    g: topG,
    b: topB,
    a: topA
  } = colorUnpack(top);
  if (topA === 0xff) return top;
  if (topA === 0) return bottom;

  const invTopA = 255 - topA;
  const {
    r: botR,
    g: botG,
    b: botB,
    a: botA
  } = colorUnpack(bottom);

  const outR = ((topR * topA) + (botR * invTopA)) / 255;
  const outG = ((topG * topA) + (botG * invTopA)) / 255;
  const outB = ((topB * topA) + (botB * invTopA)) / 255;
  const outA = topA + ((botA * invTopA) / 255);

  return colorPack(
    outR & 255,
    outG & 255,
    outB & 255,
    outA & 255,
  );
}

const renderProjectedPlane = (camera: Camera) => {
  const width = canvas.width;
  const height = canvas.height;

  const camPitchSin = renderFrameCache.mCamPitchSin;
  const camPitchCos = renderFrameCache.mCamPitchCos;
  const camYawSin = renderFrameCache.mCamAngleSin;
  const camYawCos = renderFrameCache.mCamAngleCos;

  const trackRowStride = renderState.mTrackWidth
  const cloudsRowStride = renderState.mCloudsWidth;
  const terrainRowStride = renderState.mTerrainWidth;
  const cloudsMask = cloudsRowStride - 1;
  const terrainkMask = terrainRowStride - 1;

  const cloudsPixels = renderState.mCloudsPixels;
  const terrainPixels = renderState.mTerrainPixels;
  const trackPixels = renderState.mTrackPixels;

  for (let j = 0; j < height; ++j) {
    const outputRow = (height - 1 - j);
    const sy = renderState.mVerTanTable[j];

    const rayY = -camPitchCos - (sy * camPitchSin);
    const rayZ = -camPitchSin + (sy * camPitchCos);
    const fogValue = mathClamp(
      (1 - mathAbs(rayZ / renderState.mFogDistance)) * renderState.mFogIntensity, 0, 1
    );

    if (rayZ >= -kMathEpsilon) {
      if (cloudsPixels && renderState.mSkyCloudsHeight > 0) {
        const skyRayZ = mathMax(rayZ, kMathEpsilon);
        const skyInvZ = 1 / skyRayZ;
        const skyCloudsT = renderState.mSkyCloudsHeight * skyInvZ; // Clouds are at a fixed height relative to the camera

        const skyCloudsLocalY = skyCloudsT * rayY;
        const outputRowOffset = outputRow * width;

        for (let i = 0; i < width; ++i) {
          const sx = renderState.mHorTanTable[i];
          const skyCloudsLocalX = skyCloudsT * sx;
          const cloudsWorldX = (camYawCos * skyCloudsLocalX) - (camYawSin * skyCloudsLocalY) + renderState.mCloudsOffset.x;
          const cloudsWorldY = (camYawSin * skyCloudsLocalX) + (camYawCos * skyCloudsLocalY) + renderState.mCloudsOffset.y;
          const cloudsTexX = (camera.mPos.x + cloudsWorldX) | 0;
          const cloudsTexY = (camera.mPos.y + cloudsWorldY) | 0;
          const cloudsRowOffset = (cloudsTexY & cloudsMask) * cloudsRowStride;
          const cloudsTextureIdx = cloudsRowOffset + (cloudsTexX & cloudsMask);

          const cloudColor = cloudsPixels[cloudsTextureIdx];
          const cloudsFogged = (fogValue > 0)
            ? blendAbgr(cloudColor, renderState.mSkyColor, fogValue)
            : cloudColor;

          planePixels[outputRowOffset + i] = overAbgr(cloudsFogged, renderState.mSkyColor);
        }
      } else {
        planePixels.fill(renderState.mSkyColor, outputRow * width, (outputRow + 1) * width);
      }

      continue;
    }

    const invZ = 1 / -rayZ;
    const t = camera.mHeight * invZ;
    const cloudsT = (camera.mHeight + renderState.mCloudsHeight) * invZ;
    const terrainT = (camera.mHeight + renderState.mTerrainHeight) * invZ;
    const localY = t * rayY;
    const cloudsLocalY = cloudsT * rayY;
    const terrainLocalY = terrainT * rayY;

    for (let i = 0; i < width; ++i) {
      const sx = renderState.mHorTanTable[i];
      const localX = t * sx;

      const worldX = (camYawCos * localX) - (camYawSin * localY);
      const worldY = (camYawSin * localX) + (camYawCos * localY);

      let outputColor: number;
      if (terrainPixels) {
        const terrainLocalX = terrainT * sx;
        const terrainWorldX = (camYawCos * terrainLocalX) - (camYawSin * terrainLocalY);
        const terrainWorldY = (camYawSin * terrainLocalX) + (camYawCos * terrainLocalY);
        const terrainTexX = (camera.mPos.x + worldX + renderState.mTerrainOffset.x + terrainWorldX) | 0;
        const terrainTexY = (camera.mPos.y + worldY + renderState.mTerrainOffset.y + terrainWorldY) | 0;
        const terrainRowOffset = (terrainTexY & terrainkMask) * terrainRowStride;
        const terrainTextureIdx = terrainRowOffset + (terrainTexX & terrainkMask);

        outputColor = (fogValue > 0)
          ? blendAbgr(terrainPixels[terrainTextureIdx], renderState.mSkyColor, fogValue)
          : terrainPixels[terrainTextureIdx];
      } else {
        outputColor = (fogValue > 0)
          ? blendAbgr(renderState.mGroundColor, renderState.mSkyColor, fogValue)
          : renderState.mGroundColor;
      }

      if (cloudsPixels && renderState.mCloudsHeight > 0) {
        const cloudsLocalX = cloudsT * sx;
        const cloudsWorldX = (camYawCos * cloudsLocalX) - (camYawSin * cloudsLocalY) + renderState.mCloudsOffset.x;
        const cloudsWorldY = (camYawSin * cloudsLocalX) + (camYawCos * cloudsLocalY) + renderState.mCloudsOffset.y;
        const cloudsTexX = (camera.mPos.x + cloudsWorldX) | 0;
        const cloudsTexY = (camera.mPos.y + cloudsWorldY) | 0;
        const cloudsRowOffset = (cloudsTexY & cloudsMask) * cloudsRowStride;
        const cloudsTextureIdx = cloudsRowOffset + (cloudsTexX & cloudsMask);
        const cloudsFogged = (fogValue > 0)
          ? blendAbgr(cloudsPixels[cloudsTextureIdx], renderState.mSkyColor, fogValue)
          : cloudsPixels[cloudsTextureIdx];
        
        outputColor = overAbgr(cloudsFogged, outputColor);
      }
      
      if (trackPixels) {
        const texX = mathClamp((camera.mPos.x + worldX) | 0, 0, trackRowStride);
        const texY = mathClamp((camera.mPos.y + worldY) | 0, 0, trackRowStride);
        
        const rowOffset = texY * trackRowStride;
        const textureIdx = rowOffset + texX;
        const trackColor = textureIdx < trackPixels.length ? trackPixels[textureIdx] : 0;
        const trackFogged = (fogValue > 0)
          ? blendAbgr(trackColor, renderState.mSkyColor, fogValue)
          : trackColor;
        
        outputColor = overAbgr(trackFogged, outputColor);
      }

      const outputIdx = (width * outputRow) + i;
      planePixels[outputIdx] = outputColor;
    }
  }

  projectedPlaneCtx.putImageData(planeImageData, 0, 0);
}

const renderRenderables = <R extends Renderable>(camera: Camera, renderableCmd: RenderableCommand<R>) => {
  const sortedRenderables = workSortedRenderables as SortedRenderable<R>[];
  let renderableCount = 0;

  const tanHalfVFov = mathTan(camera.mVerticalFov * 0.5);
  const tanHalfHFov = tanHalfVFov * (canvas.width / canvas.height);
  const halfWidth = canvas.width * 0.5;
  const halfHeight = canvas.height * 0.5;
  const yawSin = renderFrameCache.mCamAngleSin;
  const yawCos = renderFrameCache.mCamAngleCos;
  const pitchSin = renderFrameCache.mCamPitchSin;
  const pitchCos = renderFrameCache.mCamPitchCos;
  const focalY = halfHeight / tanHalfVFov;

  for (const renderable of renderableCmd.mRenderables) {
    const dx = renderable.mPos.x - camera.mPos.x;
    const dy = renderable.mPos.y - camera.mPos.y;

    const xCam = (yawCos * dx) + (yawSin * dy);
    const zBase = (-yawSin * dx) + (yawCos * dy);
    const yCam = (-camera.mHeight * pitchCos) - (zBase * pitchSin);
    const zCam = (-camera.mHeight * pitchSin) + (zBase * pitchCos);
    const zDepth = -zCam;
    const safeZ = (zDepth > kMathEpsilon) ? zDepth : kMathEpsilon;
    const ndcX = xCam / (safeZ * tanHalfHFov);
    const ndcY = yCam / (safeZ * tanHalfVFov);
    const x = (ndcX * halfWidth) + halfWidth - 0.5;
    const y = halfHeight - (ndcY * halfHeight) - 0.5;

    renderable.mScreenPos.x = x;
    renderable.mScreenPos.y = y;

    const invZ = 1 / safeZ;
    const camFromRacerAngle = mathAtan2(-dy, -dx);
    const relAngle = renderable.mAngle - camFromRacerAngle - kMathHalfPi;
    const angle = mathMod((relAngle + kMathPi), kMathTau) - kMathPi;
    const scale = renderableCmd.mScale * focalY * invZ;

    const offscreenOffset = 12 * scale;
    if (
      x < -offscreenOffset || x > canvas.width + offscreenOffset ||
      y < 0 || y > canvas.height + offscreenOffset
    ) {
      continue;
    }

    const sy = yCam / safeZ;
    const rayZ = -pitchSin + (sy * pitchCos);
    const fogValue = mathClamp(
      (1 - mathAbs(rayZ / renderState.mFogDistance)) * renderState.mFogIntensity, 0, 1,
    );
    const fogAlpha = 1 - fogValue;

    if (zBase > -5 || fogAlpha < kMathEpsilon) {
      continue;
    }

    if (renderableCount < sortedRenderables.length) {
      sortedRenderables[renderableCount] = {
        mRenderable: renderable,
        mInvZ: invZ,
        mX: x,
        mY: y,
        mAngle: angle,
        mScale: scale,
        mAlpha: fogAlpha
      };
    } else {
      sortedRenderables.push({
        mRenderable: renderable,
        mInvZ: invZ,
        mX: x,
        mY: y,
        mAngle: angle,
        mScale: scale,
        mAlpha: fogAlpha
      });
    }

    renderableCount++;
  }

  // Insertion sort on active slice only, so we do not touch stale buffer entries.
  for (let i = 1; i < renderableCount; ++i) {
    const item = sortedRenderables[i];
    let j = i - 1;

    while (j >= 0 && sortedRenderables[j].mInvZ > item.mInvZ) {
      sortedRenderables[j + 1] = sortedRenderables[j];
      j--;
    }

    sortedRenderables[j + 1] = item;
  }

  for (let i = 0; i < renderableCount; ++i) {
    const item = sortedRenderables[i];
    renderableCmd.mCommand(
      item.mRenderable,
      ctx,
      item.mX,
      item.mY,
      item.mInvZ,
      item.mAngle,
      item.mScale,
      item.mAlpha * renderableCmd.mAlpha,
    );
  }
}

const renderUpdateTanTable = (size: number, tanHalfFov: number, outArray: number[]) => {
  const halfSize = size / 2;

  outArray.length = 0;
  for (let n = 0; n < size; ++n) {
    const ndc = ((n + 0.5) - halfSize) / halfSize;
    outArray.push(ndc * tanHalfFov);
  }
};

export const renderAssignPlanes = (
  trackPixels: Uint32Array | 0,
  cloudsPixels: Uint32Array | 0,
  terrainPixels: Uint32Array | 0,
  trackWidth: number,
  cloudsWidth: number,
  terrainWidth: number,
  skyCloudsHeight: number,
  cloudsHeight: number,
  terrainHeight: number
) => {
  renderState.mTrackPixels = trackPixels;
  renderState.mCloudsPixels = cloudsPixels;
  renderState.mTerrainPixels = terrainPixels;

  renderState.mTrackWidth = trackWidth;
  renderState.mCloudsWidth = cloudsWidth;
  renderState.mTerrainWidth = terrainWidth;

  renderState.mSkyCloudsHeight = skyCloudsHeight;
  renderState.mCloudsHeight = cloudsHeight;
  renderState.mTerrainHeight = terrainHeight;
}

export const renderSetFogValues = (distance: number, intensity: number) => {
  renderState.mFogDistance = distance;
  renderState.mFogIntensity = intensity;
}

export const renderSetColors = (skyColor: number, groundColor: number) => {
  renderState.mSkyColor = skyColor;
  renderState.mGroundColor = groundColor;
}

export const renderGetTerrainOffsetRef = () => renderState.mTerrainOffset;
export const renderGetCloudsOffsetRef = () => renderState.mCloudsOffset;

export const render = <R extends Renderable>(camera: Camera, renderableCmd: RenderableCommand<R>) => {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const canvasSizeChanged = 
    canvasWidth !== renderState.mPrevCanvasWidth ||
    canvasHeight !== renderState.mPrevCanvasHeight;
  
  if (
    canvasSizeChanged || camera.mVerticalFov !== renderState.mPrevVerticalFov
  ) {
    const tanHalfVFov = mathTan(camera.mVerticalFov / 2);
    const tanHalfHFov = tanHalfVFov * (canvasWidth / canvasHeight);

    renderUpdateTanTable(canvasHeight, tanHalfVFov, renderState.mVerTanTable);
    renderUpdateTanTable(canvasWidth, tanHalfHFov, renderState.mHorTanTable);

    if (canvasSizeChanged) {
      projectedPlaneCanvas.width = canvasWidth;
      projectedPlaneCanvas.height = canvasHeight;

      const newImageData = ctxGetCanvasImageData(projectedPlaneCtx, canvasWidth, canvasHeight);
      planeImageData = newImageData.mImage;
      planePixels = newImageData.mPixels;
    }

    renderState.mPrevCanvasWidth = canvasWidth;
    renderState.mPrevCanvasHeight = canvasHeight;
    renderState.mPrevVerticalFov = camera.mVerticalFov;
  }

  renderFrameCache.mCamAngleSin = mathSin(camera.mAngle);
  renderFrameCache.mCamAngleCos = mathCos(camera.mAngle);
  renderFrameCache.mCamPitchSin = mathSin(camera.mPitch);
  renderFrameCache.mCamPitchCos = mathCos(camera.mPitch);

  renderProjectedPlane(camera);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(projectedPlaneCanvas, 0, 0);
  
  renderRenderables(camera, renderableCmd);
}
