// Based on "Wind Waker Ocean" by @Polyflare, 
// used under CC BY 4.0 / Modified from original.
// Link to original: https://www.shadertoy.com/view/ltfGD7

import { colorPack } from "../math";
import { ctxCreateOffscreenCanvas, ctxGetCanvasImageData } from "../sys/context";

export type WaterColor = { r: number; g: number; b: number; };

export interface WaterPalette {
  water: WaterColor;
  water2: WaterColor;
  foam: WaterColor;
}

const kWaterWidth = 512 as const;
const kWaterMask = kWaterWidth - 1;

const {
  mCanvas: gWaterCanvas,
  mCtx: gWaterCtx,
} = ctxCreateOffscreenCanvas(kWaterWidth, kWaterWidth, false, true);
const {
  mImage: gWaterImageData,
  mPixels: gWaterPixels,
} = ctxGetCanvasImageData(kWaterWidth, kWaterWidth, gWaterCtx);

const kCircleData = (() => {
  const bytesRaw = atob("+zVvNN4mEChTOPYk4TYPO/MlITmQOQkifyMRLasnBTdQNmcnRzsGO0on9jR+OZQibjtGMskjnSnyOuAm8DQ9MiEgmTUyN8EgwSmhO+wliS8HOL8jgjjXM3wniTijOwYhRSpuMpMkjjgAOccixjSwOdwhBjssOpwa1TAFNm0YqS9WOGEiCTm7NBYlWjVDNMokWDu/O68kuTsKOIAeHjjsOmMerzlQKZwatjmeOIUl/jmdNqwh+yssOwwm2DuVN98dLjk8OdUkNjnaO0gf3TYeNqYnfjoBOXAZajbvOfwcTTWyNiAeKDs2LMkfMziUOEMj6DZKO3UlRDlJOxISHjjJM+4mYyYMNH0gBTiQNwEmjDnnNlAmpDYTO/UmxTCYNhcdRTguO6oePSmsOuYkHDkrOUclSDm7O3sdHDiNMNQc9S8nOcgU/TusOH8hKTt3M9Ue4jN2OTcc4Cw6MXkjmDtsOiohrzdKMqQhLTtuOicjsDQbOs0dXy6EL3QgCzbfGnceDThAOGAjijYoOz8mmDDQOkkcxy3RMZMhPzpQNt4cxTQBOaka/TK3OXAWRTkbMaAY5juwMGInIDMHNI8THTE5ODMe");
  const bytes = new Uint8Array(bytesRaw.length);

  for (let i = 0; i < bytes.length; ++i) {
    bytes[i] = bytesRaw.charCodeAt(i);
  }

  return new Float16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
})();

const wrap01 = (v: number) => {
  const w = v % 1;
  return w < 0 ? w + 1 : w;
};

const mixColor = (a: WaterColor, b: WaterColor, t: number): WaterColor => {
  const invT = 1 - t;
  return {
    r: ((a.r * invT) + (b.r * t)) | 0,
    g: ((a.g * invT) + (b.g * t)) | 0,
    b: ((a.b * invT) + (b.b * t)) | 0
  };
};

const circ = (x: number, y: number, cx: number, cy: number, size: number) => {
  let dx = Math.abs(x - cx);
  let dy = Math.abs(y - cy);
  dx = Math.min(dx, 1 - dx);
  dy = Math.min(dy, 1 - dy);
  return (dx * dx + dy * dy) < size ? -1 : 0;
};

const waterLayer = (x: number, y: number) => {
  const ux = wrap01(x);
  const uy = wrap01(y);
  let ret = 1;

  for (let i = 0; i < kCircleData.length; i += 3) {
    ret += circ(ux, uy, kCircleData[i], kCircleData[i + 1], kCircleData[i + 2]);
  }

  return ret < 0 ? 0 : ret;
};

const waterSample = (
  u: number, v: number, _phase: number,
  waterColor: WaterColor, botWaterColor: WaterColor, foamColor: WaterColor
) => {
  let ux = u * 12;
  let uy = v * 12;

  const t1 = waterLayer(ux, uy);
  const firstMix = mixColor(waterColor, botWaterColor, t1);

  const t2 = waterLayer(1 - ux, 1 - uy);
  return mixColor(firstMix, foamColor, t2);
};

export const waterGenerate = (waterColor: WaterColor, botWaterColor: WaterColor, foamColor: WaterColor) => {
  for (let y = 0; y < kWaterWidth; ++y) {
    for (let x = 0; x < kWaterWidth; ++x) {
      const u = x / kWaterWidth;
      const v = y / kWaterWidth;
      const color = waterSample(u, v, 0, waterColor, botWaterColor, foamColor);
      const packed = colorPack(color.r, color.g, color.b, 255);

      gWaterPixels[(y * kWaterWidth) + x] = packed;
    }
  }

  // Duplicate edge texels so linear filtering can cross borders without visible seams.
  for (let i = 0; i < kWaterWidth; ++i) {
    gWaterPixels[(i * kWaterWidth) + kWaterMask] = gWaterPixels[i * kWaterWidth];
    gWaterPixels[(kWaterMask * kWaterWidth) + i] = gWaterPixels[i];
  }

  gWaterCtx.putImageData(gWaterImageData, 0, 0);
  return gWaterPixels;
};
