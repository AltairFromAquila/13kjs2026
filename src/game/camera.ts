import { kVerticalFov, type Camera } from "../core/camera";
import { mathJs, mathSin, mathCos, type Vec2, kMathTau, mathMod, vec2New, kMathHalfPi, mathLerp, mathLerpAngle } from "../math";

export interface GameCamera extends Camera {
  mAngleOffset: number;
  mTarget: { mPos: Vec2; mAngle: number; }
}

export interface FreeCamera extends Camera {
  mLogTime: number;

  mForward: boolean;
  mBackward: boolean;
  mLeft: boolean;
  mRight: boolean;
  mHeightDown: boolean;
  mHeightUp: boolean;
  mTurnLeft: boolean;
  mTurnRight: boolean;
  mPitchNegative: boolean;
  mPitchPositive: boolean;
  mMoveFast: boolean;
}

const kGameCamTargetOffset = 24;

const kFreeCamSpeed = 200;
const kFreeHeightSpeed = 300;
const kFreePitchSpeed = mathJs.PI * 0.25;
const kFreeTurnSpeed = mathJs.PI * 0.5;
const kFreeCamMinHeight = 1;
const kFreePitchMaxAbs = mathJs.PI * 0.5;

export const cameraGameCamNew = (): GameCamera => ({
  mPos: vec2New(),
  mAngle: 0,
  mPitch: 0.4,
  mHeight: 32,
  mVerticalFov: kVerticalFov,
  mAngleOffset: 0,
  mTarget: null as any, // Will be set later
});

export const cameraGameCamTick = (self: GameCamera, delta: number) => {
  self.mAngle = mathLerpAngle(self.mTarget.mAngle + self.mAngleOffset, self.mAngle - kMathHalfPi, 0.92);

  // Slightly offset the camera position to avoid animation issue (I might fix the animation issue later, but for now this is a quick fix)
  // The bug is related to the racer mirroring the animation when turning, which causes the camera to jitter when following the racer.
  self.mPos.x = self.mTarget.mPos.x - kGameCamTargetOffset * mathCos(self.mAngle);
  self.mPos.y = self.mTarget.mPos.y - kGameCamTargetOffset * mathSin(self.mAngle);

  self.mAngle += kMathHalfPi;
};

export const cameraFreeCamNew = (): FreeCamera => ({
  mPos: { x: 0, y: 0 },
  mAngle: 0,
  mPitch: 0,
  mHeight: 500,
  mVerticalFov: kVerticalFov,

  mLogTime: 0,

  mForward: false,
  mBackward: false,
  mLeft: false,
  mRight: false,
  mHeightDown: false,
  mHeightUp: false,
  mTurnLeft: false,
  mTurnRight: false,
  mPitchNegative: false,
  mPitchPositive: false,
  mMoveFast: false,
});

export const cameraSetupFreeCamEvents = (self: FreeCamera) => {
  window.addEventListener("keydown", (ev) => {
    switch (ev.code) {
      case "KeyW":
        self.mForward = true;
        break;
      case "KeyS":
        self.mBackward = true;
        break;
      case "KeyQ":
        self.mLeft = true;
        break;
      case "KeyE":
        self.mRight = true;
        break;
      case "KeyZ":
        self.mHeightDown = true;
        break;
      case "KeyX":
        self.mHeightUp = true;
        break;
      case "KeyA":
        self.mTurnLeft = true;
        break;
      case "KeyD":
        self.mTurnRight = true;
        break;
      case "ShiftLeft":
        self.mMoveFast = true;
        break;
      case "KeyR":
        self.mPitchNegative = true;
        break;
      case "KeyF":
        self.mPitchPositive = true;
        break;
    }
  });

  window.addEventListener("keyup", (ev) => {
    switch (ev.code) {
      case "KeyW":
        self.mForward = false;
        break;
      case "KeyS":
        self.mBackward = false;
        break;
      case "KeyQ":
        self.mLeft = false;
        break;
      case "KeyE":
        self.mRight = false;
        break;
      case "KeyZ":
        self.mHeightDown = false;
        break;
      case "KeyX":
        self.mHeightUp = false;
        break;
      case "KeyA":
        self.mTurnLeft = false;
        break;
      case "KeyD":
        self.mTurnRight = false;
        break;
      case "ShiftLeft":
        self.mMoveFast = false;
        break;
      case "KeyR":
        self.mPitchNegative = false;
        break;
      case "KeyF":
        self.mPitchPositive = false;
        break;
    }
  });

  window.addEventListener("blur", () => {
    self.mForward = false;
    self.mBackward = false;
    self.mLeft = false;
    self.mRight = false;
    self.mHeightDown = false;
    self.mHeightUp = false;
    self.mTurnLeft = false;
    self.mTurnRight = false;
    self.mPitchNegative = false;
    self.mPitchPositive = false;
    self.mMoveFast = false;
  });
};

export const cameraHandleFreeCamInput = (self: FreeCamera, delta: number) => {
  const distance = kFreeCamSpeed * delta * (self.mMoveFast ? 3 : 1);
  const heightDelta = kFreeHeightSpeed * delta;
  const pitchDelta = kFreePitchSpeed * delta;
  const turnDelta = kFreeTurnSpeed * delta;
  const yawSin = mathSin(self.mAngle);
  const yawCos = mathCos(self.mAngle);

  const forwardX = yawSin;
  const forwardY = -yawCos;
  const rightX = yawCos;
  const rightY = yawSin;

  if (self.mForward) {
    self.mPos.x += forwardX * distance;
    self.mPos.y += forwardY * distance;
  }
  if (self.mBackward) {
    self.mPos.x -= forwardX * distance;
    self.mPos.y -= forwardY * distance;
  }
  if (self.mLeft) {
    self.mPos.x -= rightX * distance;
    self.mPos.y -= rightY * distance;
  }
  if (self.mRight) {
    self.mPos.x += rightX * distance;
    self.mPos.y += rightY * distance;
  }
  if (self.mHeightDown) self.mHeight -= heightDelta;
  if (self.mHeightUp) self.mHeight += heightDelta;
  if (self.mTurnLeft) self.mAngle -= turnDelta;
  if (self.mTurnRight) self.mAngle += turnDelta;
  if (self.mPitchNegative) self.mPitch -= pitchDelta;
  if (self.mPitchPositive) self.mPitch += pitchDelta;

  self.mHeight = mathJs.max(kFreeCamMinHeight, self.mHeight);
  self.mAngle = mathMod(self.mAngle, kMathTau);
  self.mPitch = mathJs.max(-kFreePitchMaxAbs, mathJs.min(kFreePitchMaxAbs, self.mPitch));

  self.mLogTime += delta;
  if (self.mLogTime > 5) {
    console.log(
      'Free Camera:',
      'x:', self.mPos.x.toFixed(2), '-',
      'y:', self.mPos.y.toFixed(2), '-',
      'height:', self.mHeight.toFixed(2), '-',
      'angle:', self.mAngle.toFixed(2), '-',
      'pitch:', self.mPitch.toFixed(2)
    );
    self.mLogTime = 0;
  }
}
