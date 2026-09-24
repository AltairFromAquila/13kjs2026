import { kMathPi } from "../math";
import type { Entity } from "./entity";

export interface Camera extends Entity {
  mPitch: number;
  mHeight: number;
  mVerticalFov: number;
}

export const kVerticalFov = kMathPi * 0.4;

export const cameraNew = (): Camera => ({
  mPos: { x: 0, y: 0 },
  mAngle: 0,
  mPitch: 0,
  mHeight: 1,
  mVerticalFov: kVerticalFov,
});
