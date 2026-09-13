import { colorPack, mathClamp, noiseGenerateCubicNoisePlane, type Color } from "../math";
import { ctxCreateOffscreenCanvas, ctxGetCanvasImageData } from "../sys/context";

export type TerrainColorStops = {
  mHeight: number,
  mColor: Color;
}[];

export const kTerrainWidth = 512 as const;

const {
  mCanvas: gTerrainCanvas,
  mCtx: gTerrainCtx,
} = ctxCreateOffscreenCanvas(kTerrainWidth, kTerrainWidth, false, true);
const {
  mImage: gTerrainImageData,
  mPixels: gTerrainPixels,
} = ctxGetCanvasImageData(kTerrainWidth, kTerrainWidth, gTerrainCtx);

const terrainSampleGradient = (colorData: TerrainColorStops, height: number) => {
  const h = mathClamp(height, 0, 1);

  for (let i = 1; i < colorData.length; ++i) {
    const low = colorData[i - 1];
    const high = colorData[i];
    const lowColor = low.mColor;
    const highColor = high.mColor;
    const lowHeight = low.mHeight / 10;
    const highHeight = high.mHeight / 10;

    if (h <= highHeight) {
      const denom = highHeight - lowHeight;
      const t = denom <= 0 ? 0 : (h - lowHeight) / denom;
      const r = (lowColor.r + ((highColor.r - lowColor.r) * t)) | 0;
      const g = (lowColor.g + ((highColor.g - lowColor.g) * t)) | 0;
      const b = (lowColor.b + ((highColor.b - lowColor.b) * t)) | 0;
      return { r, g, b } as const;
    }
  }

  return colorData[colorData.length - 1].mColor;
};

export const terrainGenerate = (colorData: TerrainColorStops, baseNoiseValue: number) => {
  noiseGenerateCubicNoisePlane(
    gTerrainPixels, kTerrainWidth, baseNoiseValue, 8,
    fbm => {
      const height = mathClamp((fbm - 0.24) / 0.64, 0, 1);
      const color = terrainSampleGradient(colorData, height);

      return colorPack(color.r, color.g, color.b, 255);
    }
  );

  gTerrainCtx.putImageData(gTerrainImageData, 0, 0);
  return gTerrainPixels;
}
