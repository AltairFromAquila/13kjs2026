import { colorPack, mathSmoothstep, noiseGenerateCubicNoisePlane } from "../math";
import { ctxCreateOffscreenCanvas, ctxGetCanvasImageData } from "../sys/context";

export const kCloudsNoiseWidth = 512 as const;
const kBaseNoiseWidth = 16 as const;

const {
  mCanvas: cloudsCanvas,
  mCtx: cloudsCtx,
} = ctxCreateOffscreenCanvas(kCloudsNoiseWidth, kCloudsNoiseWidth, true, true);
const {
  mImage: cloudsImageData,
  mPixels: cloudsPixels,
} = ctxGetCanvasImageData(cloudsCtx, kCloudsNoiseWidth, kCloudsNoiseWidth);

export const cloudsGenerate = () => {
  noiseGenerateCubicNoisePlane(
    cloudsPixels, kCloudsNoiseWidth, kBaseNoiseWidth, 5,
    fbm => {
      const density = mathSmoothstep((fbm - 0.48) / 0.24);
      const alpha = (density * 255) | 0;
      const shade = (205 + ((1 - density) * 45)) | 0;

      return colorPack(shade, shade, shade, alpha);
    }
  );

  cloudsCtx.putImageData(cloudsImageData, 0, 0);
  return cloudsPixels;
}
