import { mathJs, type Vec2 } from "../math";

export interface Camera {
  pos: Vec2;
  angle: number;
  pitch: number;
  height: number;
}

const kCamHeightMin = 1;
const kVerticalFov = mathJs.PI * 0.4;
