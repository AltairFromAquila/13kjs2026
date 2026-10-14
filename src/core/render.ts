import { kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathAbs, mathAtan2, mathClamp, mathCos, mathMin, mathMod, mathSin, mathTan, vec2New, type Vec2 } from "../math";
import type { Camera } from "../core/camera";
import { canvas, ctxCreateOffscreenCanvas, ctx, ctxGetCanvasImageData } from "../sys/context";
import { isCrossOriginIsolated } from "../sys/window";
import type { Entity } from "./entity";
import {
  kRenderWorkerOpRenderProjectionFragment,
  kRenderWorkerOpAssignPlanes,
  kRenderWorkerOpSetColors,
  kRenderWorkerOpSetFogValues,
  kRenderWorkerOpSetTanTables,
  renderRenderProjection,
  type AssignPlanesData,
  type BaseRenderState,
  type RenderProjectionFragmentData,
  type SetColorsData,
  type SetFogValuesData,
  type SetTanTablesData
} from "./base-render";

interface RenderState extends BaseRenderState {
  mPrevVerticalFov: number;
  mPrevCanvasWidth: number;
  mPrevCanvasHeight:number;
}

export interface RenderFrameCache {
  mCamAngleSin: number;
  mCamAngleCos: number;
  mCamPitchSin: number;
  mCamPitchCos: number;
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

interface RenderWorker {
  mWorker: Worker;
  mInFlightBuffer: Uint32Array | 0;
  mStartLine: number;
  mLines: number;
}

interface RenderWorkerPoolState {
  mWorkers: RenderWorker[];
  mWorkerCount: number;
  mFrameInFlight: boolean;
  mDiscardFrame: boolean;
  mPendingCount: number;
  mInFlightWidth: number;
  mInFlightHeight: number;
}

type RenderWorkersArgs =
  RenderProjectionFragmentData |
  AssignPlanesData |
  SetFogValuesData |
  SetColorsData |
  SetTanTablesData;

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
let projectionSharedPixels: Uint32Array | 0 = 0;

const kRenderWorkersCap = 16;
const kRenderCanUseSharedBuffers =
  typeof SharedArrayBuffer === "function" &&
  isCrossOriginIsolated;

const renderCreateSharedPixels = (pixels: Uint32Array | 0): Uint32Array | 0 => {
  if (!pixels || !kRenderCanUseSharedBuffers) {
    return pixels;
  }

  if (pixels.buffer instanceof SharedArrayBuffer) {
    return pixels;
  }

  const sharedBuffer = new SharedArrayBuffer(pixels.byteLength);
  const sharedPixels = new Uint32Array(sharedBuffer);
  sharedPixels.set(pixels);
  return sharedPixels;
}

const renderEnsureSharedProjectionPixels = (width: number, height: number) => {
  if (!kRenderCanUseSharedBuffers) {
    projectionSharedPixels = 0;
    return;
  }

  const pixelCount = width * height;
  if (projectionSharedPixels && projectionSharedPixels.length === pixelCount) {
    return;
  }

  projectionSharedPixels = new Uint32Array(
    new SharedArrayBuffer(pixelCount * Uint32Array.BYTES_PER_ELEMENT)
  );
}

renderEnsureSharedProjectionPixels(canvas.width, canvas.height);

export const renderWorkerPoolState: RenderWorkerPoolState = (() => {
  const workers: RenderWorker[] = [];
  const availableThreads = (typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0)
    ? navigator.hardwareConcurrency
    : 1;
  const workerCount = (typeof Worker === "function")
    ? mathClamp(availableThreads - 1, 0, kRenderWorkersCap)
    : 0;

  for (let i = 0; i < workerCount; ++i) {
    workers.push({
      mWorker: new Worker(new URL("./render-worker.ts", import.meta.url), { type: "module" }),
      mInFlightBuffer: 0,
      mStartLine: 0,
      mLines: 0,
    });
  }

  return {
    mWorkerCount: workerCount,
    mWorkers: workers,
    mFrameInFlight: false,
    mDiscardFrame: false,
    mPendingCount: 0,
    mInFlightWidth: 0,
    mInFlightHeight: 0,
  };
})();

for (let idx = 0; idx < renderWorkerPoolState.mWorkerCount; ++idx) {
  const renderWorker = renderWorkerPoolState.mWorkers[idx];
  const worker = renderWorker.mWorker;

  worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (!(event.data instanceof Uint32Array) && event.data !== kRenderWorkerOpRenderProjectionFragment) {
      return;
    }

    if (!kRenderCanUseSharedBuffers) {
      renderWorker.mInFlightBuffer = event.data;
    }
    if (!renderWorkerPoolState.mFrameInFlight) {
      return;
    }

    if (!kRenderCanUseSharedBuffers && !renderWorkerPoolState.mDiscardFrame) {
      const startLine = renderWorker.mStartLine;
      const lines = renderWorker.mLines;
      const outputStartLine = renderWorkerPoolState.mInFlightHeight - (startLine + lines);
      projectionPixels.set(event.data as Uint32Array, outputStartLine * renderWorkerPoolState.mInFlightWidth);
    }

    renderWorkerPoolState.mPendingCount--;
    if (renderWorkerPoolState.mPendingCount > 0) {
      return;
    }

    const canPresentFrame = !renderWorkerPoolState.mDiscardFrame;
    renderWorkerPoolState.mFrameInFlight = false;
    renderWorkerPoolState.mDiscardFrame = false;

    if (canPresentFrame) {
      if (kRenderCanUseSharedBuffers && projectionSharedPixels) {
        projectionPixels.set(projectionSharedPixels);
      }
      projectionCtx.putImageData(projectionImageData, 0, 0);
    }
  });

  worker.addEventListener("error", () => {
    renderWorkerPoolState.mFrameInFlight = false;
    renderWorkerPoolState.mDiscardFrame = false;
    renderWorkerPoolState.mPendingCount = 0;
  });
}

const renderBroadcastToWorkers = (message: RenderWorkersArgs) => {
  for (const worker of renderWorkerPoolState.mWorkers) {
    worker.mWorker.postMessage(message);
  }
}

const renderProjection = (camera: Camera) => {
  const workerCount = mathMin(renderWorkerPoolState.mWorkerCount, canvas.height);
  const renderWorkers = renderWorkerPoolState.mWorkers;

  if (workerCount > 0) {
    renderEnsureSharedProjectionPixels(canvas.width, canvas.height);

    if (!renderWorkerPoolState.mFrameInFlight) {
      renderWorkerPoolState.mFrameInFlight = true;
      renderWorkerPoolState.mDiscardFrame = false;
      renderWorkerPoolState.mPendingCount = workerCount;
      renderWorkerPoolState.mInFlightWidth = canvas.width;
      renderWorkerPoolState.mInFlightHeight = canvas.height;

      const linesPerWorker = (canvas.height / workerCount) | 0;
      const extraLines = canvas.height - (linesPerWorker * workerCount);
      let startLine = 0;

      for (let idx = 0; idx < workerCount; ++idx) {
        const curRenderWorker = renderWorkers[idx];
        const lines = linesPerWorker + (idx < extraLines ? 1 : 0);
        const expectedBufferSize = lines * canvas.width;
        const outputStartLine = canvas.height - (startLine + lines);
        let projectionFragment: Uint32Array;

        if (kRenderCanUseSharedBuffers) {
          const sharedProjectionPixels = projectionSharedPixels;
          if (!sharedProjectionPixels) {
            projectionFragment = new Uint32Array(expectedBufferSize);
          } else {
            projectionFragment = new Uint32Array(
              sharedProjectionPixels.buffer,
              outputStartLine * canvas.width * Uint32Array.BYTES_PER_ELEMENT,
              expectedBufferSize
            );
          }
        } else {
          projectionFragment = curRenderWorker.mInFlightBuffer as Uint32Array;
          if (!projectionFragment || projectionFragment.length !== expectedBufferSize) {
            projectionFragment = new Uint32Array(expectedBufferSize);
          }
        }

        curRenderWorker.mStartLine = startLine;
        curRenderWorker.mLines = lines;

        const renderData: RenderProjectionFragmentData = [
          kRenderWorkerOpRenderProjectionFragment,
          canvas.width,
          startLine,
          lines,
          camera.mPos.x,
          camera.mPos.y,
          camera.mHeight,
          renderFrameCache.mCamAngleSin,
          renderFrameCache.mCamAngleCos,
          renderFrameCache.mCamPitchSin,
          renderFrameCache.mCamPitchCos,
          projectionFragment,
        ];
        if (kRenderCanUseSharedBuffers) {
          curRenderWorker.mWorker.postMessage(renderData);
        } else {
          curRenderWorker.mInFlightBuffer = 0;
          curRenderWorker.mWorker.postMessage(renderData, [projectionFragment.buffer]);
        }

        startLine += lines;
      }
    }
  } else {
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
  const trackPixelsForRender = renderCreateSharedPixels(trackPixels);
  const cloudsPixelsForRender = renderCreateSharedPixels(cloudsPixels);
  const terrainPixelsForRender = renderCreateSharedPixels(terrainPixels);

  renderState.mTrackPixels = trackPixelsForRender;
  renderState.mCloudsPixels = cloudsPixelsForRender;
  renderState.mTerrainPixels = terrainPixelsForRender;

  renderState.mTrackWidth = trackWidth;
  renderState.mCloudsWidth = cloudsWidth;
  renderState.mTerrainWidth = terrainWidth;

  renderState.mSkyCloudsHeight = skyCloudsHeight;
  renderState.mCloudsHeight = cloudsHeight;
  renderState.mTerrainHeight = terrainHeight;

  renderBroadcastToWorkers([
    kRenderWorkerOpAssignPlanes,
    trackPixelsForRender,
    cloudsPixelsForRender,
    terrainPixelsForRender,
    trackWidth,
    cloudsWidth,
    terrainWidth,
    skyCloudsHeight,
    cloudsHeight,
    terrainHeight
  ]);
}

export const renderSetFogValues = (distance: number, intensity: number) => {
  renderState.mFogDistance = distance;
  renderState.mFogIntensity = intensity;

  renderBroadcastToWorkers([kRenderWorkerOpSetFogValues, distance, intensity]);
}

export const renderSetColors = (skyColor: number, groundColor: number) => {
  renderState.mSkyColor = skyColor;
  renderState.mGroundColor = groundColor;

  renderBroadcastToWorkers([kRenderWorkerOpSetColors, skyColor, groundColor]);
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
    renderBroadcastToWorkers([
      kRenderWorkerOpSetTanTables,
      renderState.mVerTanTable,
      renderState.mHorTanTable,
    ]);

    if (canvasSizeChanged) {
      if (renderWorkerPoolState.mFrameInFlight) {
        renderWorkerPoolState.mDiscardFrame = true;
      }

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

  renderProjection(camera);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(projectionCanvas, 0, 0);
  
  renderRenderables(camera, renderableCmd);
}
