import { colorBlend, colorPack, colorUnpack, kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathAbs, mathAtan2, mathClamp, mathCos, mathMax, mathMod, mathSin, mathTan, vec2New, type Vec2 } from "../math";
import type { Camera } from "../core/camera";
import { canvas, ctxCreateOffscreenCanvas, ctx, ctxGetCanvasImageData } from "../sys/context";
import type { Entity } from "./entity";
import { renderRenderProjection, type BaseRenderState, type RenderFrameCache } from "./base-render";

interface RenderState extends BaseRenderState {
  mPrevVerticalFov: number;
  mPrevCanvasWidth: number;
  mPrevCanvasHeight:number;
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
};
const workSortedRenderables: SortedRenderable[] = [];

const {
  mCanvas: projectionCanvas,
  mCtx: projectionCtx,
} = ctxCreateOffscreenCanvas(canvas.width, canvas.height, false, false);
let {
  mImage: projectionImageData,
  mPixels: projectionPixels,
} = ctxGetCanvasImageData(canvas.width, canvas.height, projectionCtx);

const renderProjectedPlane = (camera: Camera) => {
  renderRenderProjection(
    renderState,
    canvas.width, 0, canvas.height, 
    camera.mPos.x, camera.mPos.y, camera.mHeight,
    renderFrameCache.mCamAngleSin, renderFrameCache.mCamAngleCos,
    renderFrameCache.mCamPitchSin, renderFrameCache.mCamPitchCos,
    projectionPixels
  );

  projectionCtx.putImageData(projectionImageData, 0, 0);
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
      projectionCanvas.width = canvasWidth;
      projectionCanvas.height = canvasHeight;

      const newImageData = ctxGetCanvasImageData(canvasWidth, canvasHeight, projectionCtx);
      projectionImageData = newImageData.mImage;
      projectionPixels = newImageData.mPixels;
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
  ctx.drawImage(projectionCanvas, 0, 0);
  
  renderRenderables(camera, renderableCmd);
}
