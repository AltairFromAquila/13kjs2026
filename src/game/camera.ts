import { kVerticalFov, type Camera } from "../core/camera";
import { easeOutQuad } from "../easing";
import { Game, kGameModeRaceFinalResult, kGameModeRaceIntro, kGameModeRaceResults } from "../game";
import { mathJs, mathSin, mathCos, type Vec2, kMathTau, mathMod, vec2New, kMathHalfPi, mathLerp, mathLerpAngle, mathMax, mathMin, mathClamp } from "../math";
import { kTrackTextureSize } from "./track";

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
  mTarget: 0 as any, // Will be set later
});

export const cameraGameCamSetupIntro = (self: GameCamera) => {
  self.mAngle = 0;
  self.mAngleOffset = 0;
  self.mPitch = kMathHalfPi;
  self.mHeight = 3000;

  self.mPos.x = self.mPos.y = kTrackTextureSize / 2;
}

export const cameraGameCamTick = (self: GameCamera, delta: number) => {
  if (Game.mGameMode === kGameModeRaceIntro) {
    if (Game.mSequenceTimer > 4) {
      const ratio = easeOutQuad(mathMin(Game.mSequenceTimer - 4, 1));

      self.mPitch = mathLerp(kMathHalfPi, 0.4, ratio);
      self.mHeight = mathLerp(3000, 32, ratio);
    } else if (Game.mSequenceTimer > 3) {
      const ratio = mathMin(Game.mSequenceTimer - 3, 1);

      self.mAngle = mathLerpAngle(self.mAngle - kMathHalfPi, self.mTarget.mAngle, ratio);
      self.mPos.x = mathLerp(self.mPos.x, self.mTarget.mPos.x - kGameCamTargetOffset * mathCos(self.mAngle), ratio);
      self.mPos.y = mathLerp(self.mPos.y, self.mTarget.mPos.y - kGameCamTargetOffset * mathSin(self.mAngle), ratio);

      self.mAngle += kMathHalfPi;
    }
  } else {
    if (Game.mGameMode === kGameModeRaceResults) {
      self.mAngleOffset = (self.mAngleOffset + (delta / 4)) % kMathTau;
    } else if (Game.mGameMode === kGameModeRaceFinalResult) {
      const ratio = easeOutQuad(mathMin(Game.mSequenceTimer, 1));

      self.mPitch = mathLerp(0.4, -0.6, ratio);
    }

    self.mAngle = mathLerpAngle(self.mTarget.mAngle + self.mAngleOffset, self.mAngle - kMathHalfPi, 0.92);

    self.mPos.x = self.mTarget.mPos.x - kGameCamTargetOffset * mathCos(self.mAngle);
    self.mPos.y = self.mTarget.mPos.y - kGameCamTargetOffset * mathSin(self.mAngle);

    self.mAngle += kMathHalfPi;
  }
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

  self.mHeight = mathMax(kFreeCamMinHeight, self.mHeight);
  self.mAngle = mathMod(self.mAngle, kMathTau);
  self.mPitch = mathClamp(self.mPitch, -kFreePitchMaxAbs, kFreePitchMaxAbs);

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
