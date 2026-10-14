import { colorPack, colorUnpack, kMathEpsilon, mathAbs, mathClamp, mathMax, type Vec2 } from "../math";

export interface BaseRenderState {
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
}

export type AssignPlanesData = [
  opCode: typeof kRenderWorkerOpAssignPlanes,
  trackPixels: Uint32Array | 0,
  cloudsPixels: Uint32Array | 0,
  terrainPixels: Uint32Array | 0,
  trackWidth: number,
  cloudsWidth: number,
  terrainWidth: number,
  skyCloudsHeight: number,
  cloudsHeight: number,
  terrainHeight: number
];
export type SetFogValuesData = [
  opCode: typeof kRenderWorkerOpSetFogValues,
  distance: number,
  intensity: number
];
export type SetColorsData = [
  opCode: typeof kRenderWorkerOpSetColors,
  skyColor: number,
  groundColor: number
];
export type SetTanTablesData = [
  opCode: typeof kRenderWorkerOpSetTanTables,
  verTanTable: number[],
  horTanTable: number[]
];
export type RenderProjectionFragmentData = [
  opCode: typeof kRenderWorkerOpRenderProjectionFragment,
  width: number, startLine: number, lines: number,
  camX: number, camY: number, camHeight: number,
  camYawSin: number, camYawCos: number,
  camPitchSin: number, camPitchCos: number,
  projectionPixels: Uint32Array
]

export const kRenderWorkerOpRenderProjectionFragment = 0;
export const kRenderWorkerOpAssignPlanes = 1;
export const kRenderWorkerOpSetFogValues = 2;
export const kRenderWorkerOpSetColors = 3;
export const kRenderWorkerOpSetTanTables = 4;

export const renderRenderProjection = (
  renderState: BaseRenderState,
  width: number, startLine: number, lines: number,
  camX: number, camY: number, camHeight: number,
  camYawSin: number, camYawCos: number,
  camPitchSin: number, camPitchCos: number,
  projectionPixels: Uint32Array
) => {
  const blendAbgr = (src: number, dst: number, t: number): number => {
    if (t <= 0) return src;
    if (t >= 1) return dst;

    const alpha = (t * 256) | 0;
    const invAlpha = 256 - alpha;

    const srcRB = src & 0x00ff00ff;
    const dstRB = dst & 0x00ff00ff;
    const srcGA = (src >>> 8) & 0x00ff00ff;
    const dstGA = (dst >>> 8) & 0x00ff00ff;

    const resRB = (srcRB * invAlpha + dstRB * alpha) >>> 8;
    const resGA = (srcGA * invAlpha + dstGA * alpha);

    return ((resRB & 0x00ff00ff) | (resGA & 0xff00ff00));
  }

  const overAbgr = (top: number, bottom: number): number => {
    const topA = (top >> 24) & 255;
    
    if (topA === 255) return top;
    if (topA === 0) return bottom;

    const invTopA = 255 - topA;

    const botRB = bottom & 0x00ff00ff;
    const topRB = top & 0x00ff00ff;
    const botGA = (bottom >>> 8) & 0x00ff00ff;
    const topGA = (top >>> 8) & 0x00ff00ff;

    const resRB = (botRB * invTopA + topRB * topA) >>> 8;
    const resGA = (botGA * invTopA + topGA * topA);

    const botA = (bottom >> 24) & 255;
    const outA = topA + ((botA * invTopA) / 255);

    return (outA << 24) | ((resRB & 0x00ff00ff) | (resGA & 0x0000ff00));
  }

  const trackRowStride = renderState.mTrackWidth
  const cloudsRowStride = renderState.mCloudsWidth;
  const terrainRowStride = renderState.mTerrainWidth;
  const cloudsMask = cloudsRowStride - 1;
  const terrainkMask = terrainRowStride - 1;

  const cloudsPixels = renderState.mCloudsPixels;
  const terrainPixels = renderState.mTerrainPixels;
  const trackPixels = renderState.mTrackPixels;

  for (let j = 0; j < lines; ++j) {
    const outputRow = (lines - 1 - j);
    const sy = renderState.mVerTanTable[j + startLine];

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
          const cloudsTexX = (camX + cloudsWorldX) | 0;
          const cloudsTexY = (camY + cloudsWorldY) | 0;
          const cloudsRowOffset = (cloudsTexY & cloudsMask) * cloudsRowStride;
          const cloudsTextureIdx = cloudsRowOffset + (cloudsTexX & cloudsMask);

          const cloudColor = cloudsPixels[cloudsTextureIdx];
          const cloudsFogged = (fogValue > 0)
            ? blendAbgr(cloudColor, renderState.mSkyColor, fogValue)
            : cloudColor;

          projectionPixels[outputRowOffset + i] = overAbgr(cloudsFogged, renderState.mSkyColor);
        }
      } else {
        projectionPixels.fill(renderState.mSkyColor, outputRow * width, (outputRow + 1) * width);
      }

      continue;
    }

    const invZ = 1 / -rayZ;
    const t = camHeight * invZ;
    const cloudsT = (camHeight + renderState.mCloudsHeight) * invZ;
    const terrainT = (camHeight + renderState.mTerrainHeight) * invZ;
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
        const terrainTexX = (camX + worldX + renderState.mTerrainOffset.x + terrainWorldX) | 0;
        const terrainTexY = (camY + worldY + renderState.mTerrainOffset.y + terrainWorldY) | 0;
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
        const cloudsTexX = (camX + cloudsWorldX) | 0;
        const cloudsTexY = (camY + cloudsWorldY) | 0;
        const cloudsRowOffset = (cloudsTexY & cloudsMask) * cloudsRowStride;
        const cloudsTextureIdx = cloudsRowOffset + (cloudsTexX & cloudsMask);
        const cloudsFogged = (fogValue > 0)
          ? blendAbgr(cloudsPixels[cloudsTextureIdx], renderState.mSkyColor, fogValue)
          : cloudsPixels[cloudsTextureIdx];
        
        outputColor = overAbgr(cloudsFogged, outputColor);
      }
      
      if (trackPixels) {
        const texX = mathClamp((camX + worldX) | 0, 0, trackRowStride);
        const texY = mathClamp((camY + worldY) | 0, 0, trackRowStride);
        
        const rowOffset = texY * trackRowStride;
        const textureIdx = rowOffset + texX;
        const trackColor = textureIdx < trackPixels.length ? trackPixels[textureIdx] : 0;
        const trackFogged = (fogValue > 0)
          ? blendAbgr(trackColor, renderState.mSkyColor, fogValue)
          : trackColor;
        
        outputColor = overAbgr(trackFogged, outputColor);
      }

      const outputIdx = (width * outputRow) + i;
      projectionPixels[outputIdx] = outputColor;
    }
  }
}
