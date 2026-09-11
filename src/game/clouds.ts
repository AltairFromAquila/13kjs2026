// Based on https://github.com/jobtalle/CubicNoise

import { mathSmoothstep, noiseBufferedCubicNoise, sampleCubicNoise } from "../math";
import { ctxCreateOffscreenCanvas, ctxGetCanvasImageData } from "../sys/context";

export const kCloudsNoiseWidth = 512 as const;
const kBaseNoiseWidth = 16 as const;
const kCloudsNoiseMask = kCloudsNoiseWidth - 1;

const {
  mCanvas: cloudsCanvas,
  mCtx: cloudsCtx,
} = ctxCreateOffscreenCanvas(kCloudsNoiseWidth, kCloudsNoiseWidth, true, true);
const {
  mImage: cloudsImageData,
  mPixels: cloudsPixels,
} = ctxGetCanvasImageData(cloudsCtx, kCloudsNoiseWidth, kCloudsNoiseWidth);

export function cloudsGenerate() {
  const baseNoise = noiseBufferedCubicNoise(kBaseNoiseWidth, kBaseNoiseWidth);

  for (let y = 0; y < kCloudsNoiseWidth; ++y) {
    for (let x = 0; x < kCloudsNoiseWidth; ++x) {
      const u = x / kCloudsNoiseWidth;
      const v = y / kCloudsNoiseWidth;

      let frequency = 1;
      let amplitude = 1;
      let total = 0;
      let amplitudeSum = 0;

      for (let octave = 0; octave < 5; ++octave) {
        const sampleX = u * kBaseNoiseWidth * frequency;
        const sampleY = v * kBaseNoiseWidth * frequency;
        total += sampleCubicNoise(sampleX, sampleY, baseNoise, kBaseNoiseWidth, kBaseNoiseWidth) * amplitude;
        amplitudeSum += amplitude;

        frequency *= 2;
        amplitude *= 0.55;
      }

      const fbm = total / amplitudeSum;
      const density = mathSmoothstep((fbm - 0.48) / 0.24);
      const alpha = (density * 255) | 0;
      const shade = (205 + ((1 - density) * 45)) | 0;

      // ABGR packing: A in high byte, then B, G, R.
      cloudsPixels[(y * kCloudsNoiseWidth) + x] = (alpha << 24) | (shade << 16) | (shade << 8) | shade;
    }
  }

  // Duplicate edge texels so linear filtering can cross borders without visible seams.
  for (let i = 0; i < kCloudsNoiseWidth; ++i) {
    cloudsPixels[(i * kCloudsNoiseWidth) + kCloudsNoiseMask] = cloudsPixels[i * kCloudsNoiseWidth];
    cloudsPixels[(kCloudsNoiseMask * kCloudsNoiseWidth) + i] = cloudsPixels[i];
  }

  cloudsCtx.putImageData(cloudsImageData, 0, 0);
}

export function cloudsGetCanvas() {
  return cloudsCanvas;
}

export function cloudsGetPixels() {
  return cloudsPixels;
}
