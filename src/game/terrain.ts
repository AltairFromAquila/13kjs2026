import { mathClamp, noiseBufferedCubicNoise, sampleCubicNoise } from "../math";
import { createOffscreenCanvas } from "../sys/context";

const kBaseNoiseWidth = 16 as const;
const kTerrainWidth = 512 as const;
const kTerrainMask = kTerrainWidth - 1;

const {
  offscreenCanvas: terrainCanvas,
  offscreenCtx: terrainCtx
} = createOffscreenCanvas(kTerrainWidth, kTerrainWidth, false, true);
const terrainImageData = terrainCtx.getImageData(0, 0, kTerrainWidth, kTerrainWidth);
const terrainPixels = new Uint32Array(terrainImageData.data.buffer);

// Fertile lands
const kTerrainColorStops: { height: number; color: [number, number, number]; }[] = [
  { height: 0.0, color: [20, 60, 145] },
  { height: 0.12, color: [120, 195, 245] },
  { height: 0.20, color: [104, 175, 96] },
  { height: 0.48, color: [34, 96, 48] },
  { height: 0.85, color: [142, 142, 142] },
  { height: 1.0, color: [255, 255, 255] }
];
// Dunes
// const kTerrainColorStops: { height: number; color: [number, number, number]; }[] = [
//   { height: 0.0, color: [231, 160, 5] },
//   { height: 0.25, color: [250, 189, 23] },
//   { height: 0.85, color: [250, 216, 23] },
//   { height: 1.0, color: [253, 231, 32] }
// ];

const terrainSampleGradient = (height: number) => {
  const h = mathClamp(height, 0, 1);

  for (let i = 1; i < kTerrainColorStops.length; ++i) {
    const low = kTerrainColorStops[i - 1];
    const high = kTerrainColorStops[i];

    if (h <= high.height) {
      const denom = high.height - low.height;
      const t = denom <= 0 ? 0 : (h - low.height) / denom;
      const r = (low.color[0] + ((high.color[0] - low.color[0]) * t)) | 0;
      const g = (low.color[1] + ((high.color[1] - low.color[1]) * t)) | 0;
      const b = (low.color[2] + ((high.color[2] - low.color[2]) * t)) | 0;
      return [r, g, b] as const;
    }
  }

  return kTerrainColorStops[kTerrainColorStops.length - 1].color;
};

export const terrainGenerateHills = () => {
  const baseNoise = noiseBufferedCubicNoise(kBaseNoiseWidth, kBaseNoiseWidth);

  for (let y = 0; y < kTerrainWidth; ++y) {
    for (let x = 0; x < kTerrainWidth; ++x) {
      const u = x / kTerrainWidth;
      const v = y / kTerrainWidth;

      let frequency = 1;
      let amplitude = 1;
      let total = 0;
      let amplitudeSum = 0;

      for (let octave = 0; octave < 8; ++octave) {
        const sampleX = u * kBaseNoiseWidth * frequency;
        const sampleY = v * kBaseNoiseWidth * frequency;
        total += sampleCubicNoise(sampleX, sampleY, baseNoise, kBaseNoiseWidth, kBaseNoiseWidth) * amplitude;
        amplitudeSum += amplitude;

        frequency *= 2;
        amplitude *= 0.5;
      }

      const fbm = total / amplitudeSum;
      const height = mathClamp((fbm - 0.24) / 0.64, 0, 1);
      const color = terrainSampleGradient(height);

      // ABGR packing: A in high byte, then B, G, R.
      terrainPixels[(y * kTerrainWidth) + x] = (255 << 24) | (color[2] << 16) | (color[1] << 8) | color[0];
    }
  }

  // Duplicate edge texels so linear filtering can cross borders without visible seams.
  for (let i = 0; i < kTerrainWidth; ++i) {
    terrainPixels[(i * kTerrainWidth) + kTerrainMask] = terrainPixels[i * kTerrainWidth];
    terrainPixels[(kTerrainMask * kTerrainWidth) + i] = terrainPixels[i];
  }

  terrainCtx.putImageData(terrainImageData, 0, 0);
}

export const terrainGetCanvas = () => {
  return terrainCanvas;
}

export const terrainGetPixels = () => {
  return terrainPixels;
}