// Based on https://github.com/jobtalle/CubicNoise

import { mathMod, mathSmoothstep } from "../math";
import { createOffscreenCanvas } from "../sys/context";

const kBaseNoiseWidth = 16 as const;
const kCloudsNoiseWidth = 512 as const;
const kCloudsNoiseMask = kCloudsNoiseWidth - 1;

// const cloudsCanvas: OffscreenCanvas = new OffscreenCanvas(kCloudsNoiseWidth, kCloudsNoiseWidth);
// const cloudsCtx: OffscreenCanvasRenderingContext2D = cloudsCanvas.getContext('2d', { alpha: true })!;
const {
  offscreenCanvas: cloudsCanvas,
  offscreenCtx: cloudsCtx
} = createOffscreenCanvas(kCloudsNoiseWidth, kCloudsNoiseWidth, true, true);
const cloudsImageData = cloudsCtx.getImageData(0, 0, kCloudsNoiseWidth, kCloudsNoiseWidth);
const cloudsPixels = new Uint32Array(cloudsImageData.data.buffer);

export function cloudsGenerate() {
  const baseNoise = bufferedCubicNoise(kBaseNoiseWidth, kBaseNoiseWidth);

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

function bufferedCubicNoise(width: number, height: number) {
  const values = new Float32Array(width * height);

  for (let i = 0; i < values.length; ++i) {
    values[i] = Math.random();
  }

  return values;
}

function interpolateCubicNoise(a: number, b: number, c: number, d: number, x: number) {
  const p = (d - c) - (a - b);
  return x * (x * (x * p + ((a - b) - p)) + (c - a)) + b;
}

function sampleCubicNoise(x: number, y: number, values: Float32Array, width: number, height: number) {
  const xi = x | 0;
  const yi = y | 0;
  const tx = x - xi;
  const ty = y - yi;

  const getValue = (sx: number, sy: number) => values[(mathMod(sy, height) * width) + mathMod(sx, width)];

  return interpolateCubicNoise(
    interpolateCubicNoise(
      getValue(xi, yi),
      getValue(xi + 1, yi),
      getValue(xi + 2, yi),
      getValue(xi + 3, yi),
      tx
    ),
    interpolateCubicNoise(
      getValue(xi, yi + 1),
      getValue(xi + 1, yi + 1),
      getValue(xi + 2, yi + 1),
      getValue(xi + 3, yi + 1),
      tx
    ),
    interpolateCubicNoise(
      getValue(xi, yi + 2),
      getValue(xi + 1, yi + 2),
      getValue(xi + 2, yi + 2),
      getValue(xi + 3, yi + 2),
      tx
    ),
    interpolateCubicNoise(
      getValue(xi, yi + 3),
      getValue(xi + 1, yi + 3),
      getValue(xi + 2, yi + 3),
      getValue(xi + 3, yi + 3),
      tx
    ),
    ty
  ) * 0.5 + 0.25;
}
