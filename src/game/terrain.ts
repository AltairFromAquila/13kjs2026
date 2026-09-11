import { colorPack, colorUnpack, mathClamp, noiseBufferedCubicNoise, sampleCubicNoise } from "../math";
import { ctxCreateOffscreenCanvas, ctxGetCanvasImageData } from "../sys/context";

export type TerrainColorStops = {
  mHeight: number,
  mColor: { r: number; g: number; b: number; };
}[];

export const kTerrainWidth = 512 as const;
const kTerrainMask = kTerrainWidth - 1;

const {
  mCanvas: terrainCanvas,
  mCtx: terrainCtx,
} = ctxCreateOffscreenCanvas(kTerrainWidth, kTerrainWidth, false, true);
const {
  mImage: terrainImageData,
  mPixels: terrainPixels,
} = ctxGetCanvasImageData(terrainCtx, kTerrainWidth, kTerrainWidth);

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
  const baseNoise = noiseBufferedCubicNoise(baseNoiseValue, baseNoiseValue);

  for (let y = 0; y < kTerrainWidth; ++y) {
    for (let x = 0; x < kTerrainWidth; ++x) {
      const u = x / kTerrainWidth;
      const v = y / kTerrainWidth;

      let frequency = 1;
      let amplitude = 1;
      let total = 0;
      let amplitudeSum = 0;

      for (let octave = 0; octave < 8; ++octave) {
        const sampleX = u * baseNoiseValue * frequency;
        const sampleY = v * baseNoiseValue * frequency;
        total += sampleCubicNoise(sampleX, sampleY, baseNoise, baseNoiseValue, baseNoiseValue) * amplitude;
        amplitudeSum += amplitude;

        frequency *= 2;
        amplitude *= 0.5;
      }

      const fbm = total / amplitudeSum;
      const height = mathClamp((fbm - 0.24) / 0.64, 0, 1);
      const color = terrainSampleGradient(colorData, height);

      // ABGR packing: A in high byte, then B, G, R.
      terrainPixels[(y * kTerrainWidth) + x] = colorPack(color.r, color.g, color.b, 255);
    }
  }

  // Duplicate edge texels so linear filtering can cross borders without visible seams.
  for (let i = 0; i < kTerrainWidth; ++i) {
    terrainPixels[(i * kTerrainWidth) + kTerrainMask] = terrainPixels[i * kTerrainWidth];
    terrainPixels[(kTerrainMask * kTerrainWidth) + i] = terrainPixels[i];
  }

  terrainCtx.putImageData(terrainImageData, 0, 0);
  return terrainPixels;
}

export const terrainGetCanvas = () => {
  return terrainCanvas;
}

export const terrainGetPixels = () => {
  return terrainPixels;
}