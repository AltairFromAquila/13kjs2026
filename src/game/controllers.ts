import { difficultyData } from "../data/difficulty.data";
import { Game, kGameModeRaceMenu } from "../game";
import { kMathEpsilon, mathAbs, mathAtan2, mathClamp, mathCos, mathLerpAngle, mathMax, mathMin, mathRandom, mathSin, splineCalculateSegmentPoint, splineCalculateSegmentTangent, vec2Add, vec2Copy, vec2Distance, vec2DistanceSqr, vec2Dot, vec2LengthSqr, vec2Lerp, vec2MulScalar, vec2New, vec2NewCopy, vec2Normalize, vec2Sub, type Vec2 } from "../math";
import { kWindowEventKeyDown, kWindowEventKeyUp, kWindowEventPointerCancel, kWindowEventPointerDown, kWindowEventPointerMove, kWindowEventPointerUp, windowAddEventListener, windowIsMobile, windowRemoveEventListener } from "../sys/window";
import type { Racer } from "./racer";
import { trackGetTrackWidthAt, trackWrapSegmentIndex } from "./track";

type KeyBoardEventListener = (event: KeyboardEvent) => void;
type PointerEventListener = (event: PointerEvent) => void;
type DeviceOrientationEventListener = (event: DeviceOrientationEvent) => void;

interface PlayerInputState {
  mEventListeners: { [event: string]: KeyBoardEventListener | 0 };
  mPressed: { mUp: boolean; mDown: boolean; mLeft: boolean; mRight: boolean; mGallop: boolean; };
  mDirection: Vec2;
  mGallopingTimer: number;
  mMobileSteerValue: number;
  mMobileSteerHoldValue: number;
  mMobileTiltSteerValue: number;
  mMobileSteerPointerId: number;
  mPointerDownListener: PointerEventListener | 0;
  mPointerMoveListener: PointerEventListener | 0;
  mPointerUpListener: PointerEventListener | 0;
  mPointerCancelListener: PointerEventListener | 0;
  mDeviceOrientationListener: DeviceOrientationEventListener | 0;
}

export interface Controller {
  mDesiredDirection: Vec2;
  mGallopTapPressed: boolean;
  mIsGalloping: boolean;

  mPreviousSegmentIdx: number;
  mPreviousSegmentT: number;

  mBlockPlayerTimer: number;
  mGallopingReactionTimer: number;
  mReactionTimer: number;
  
  mIsWaitingForStamina: boolean;
  mIsBlockingPlayer: boolean;
  mWasStuck: boolean;

  mReturningToTrack?: { mIsReturning: boolean; mTimer: number;};

  mProcessFunction: (self: Controller, racer: Racer, delta: number) => void;
}

const kAIReactionTimeMin = 0.2;
const kAIReactionTimeMaxDelta = 0.1;
const kAIGallopingReactionTime = 0.06;
const kAISafeWidthFactor = 0.6;
const kAIBlockPlayerSafeWidthFactor = 0.8;
const kAIGallopLookaheadTOffsets = [0.1, 0.25, 0.5, 0.75, 1] as const;
const kAIGallopLookaheadWeights = [0.35, 0.25, 0.2, 0.12, 0.08] as const;
const kAIGallopEnterScore = 0.925;
const kAIGallopKeepScore = 0.85;
const kAIGallopStartStamina = 0.55;
const kAIGallopKeepStamina = 0.15;
const kAIGallopWaitThreshold = 0.6;

const kPlayerGallopTapTimeout = 0.3;
const kPlayerSteeringCompressionMaxSpeed = 120;
const kPlayerSteeringMinTurnScale = 0.5;
const kPlayerMobileSteeringDeadZone = 0.5;
const kPlayerMobileAutoSteerLookaheadT = 0.05;
const kPlayerMobileAutoSteerBlend = 0.66;
const kPlayerMobileTiltDeadZoneDeg = 6;
const kPlayerMobileTiltMaxDeg = 28;
const kPlayerMobileTiltStrength = 0.6;

const kReturnToTrackReCheck = 1.0;

const playerInputState: PlayerInputState = {
  mEventListeners: {},
  mPressed: { mUp: false, mDown: false, mLeft: false, mRight: false, mGallop: false },
  mDirection: vec2New(),
  mGallopingTimer: 0,
  mMobileSteerValue: 0,
  mMobileSteerHoldValue: 0,
  mMobileTiltSteerValue: 0,
  mMobileSteerPointerId: -1,
  mPointerDownListener: 0,
  mPointerMoveListener: 0,
  mPointerUpListener: 0,
  mPointerCancelListener: 0,
  mDeviceOrientationListener: 0,
};

const controllerMapPointerToSteering = (clientX: number) => {
  const width = window.innerWidth || 1;
  const ratio = mathClamp(clientX / width, 0, 1);
  const rawSteer = (ratio - 0.5) * 2;

  if (mathAbs(rawSteer) < kPlayerMobileSteeringDeadZone) return 0;

  return rawSteer > 0 ? 1 : -1;
};

const controllerMapTiltToSteering = (gamma: number | null) => {
  if (gamma == null) return 0;

  const absGamma = mathAbs(gamma);
  if (absGamma < kPlayerMobileTiltDeadZoneDeg) return 0;

  return mathClamp(gamma / kPlayerMobileTiltMaxDeg, -1, 1) * kPlayerMobileTiltStrength;
};

const controllerTriggerGallopTap = (self: Controller) => {
  if (!self || self.mIsWaitingForStamina) return;

  self.mIsGalloping = true;
  playerInputState.mPressed.mGallop = true;
  playerInputState.mGallopingTimer = kPlayerGallopTapTimeout;
};

export const controllerNew = (): Controller => ({
  mDesiredDirection: vec2New(),
  mGallopTapPressed: false,
  mIsGalloping: false,

  mPreviousSegmentIdx: -1,
  mPreviousSegmentT: 0,

  mBlockPlayerTimer: 0,
  mGallopingReactionTimer: 0,
  mReactionTimer: 0,

  mIsWaitingForStamina: false,
  mIsBlockingPlayer: false,
  mWasStuck: false,

  mProcessFunction: controllerProcessAIForRacer,
});

const controllerTranslatePlayerDirection = (x: number, y: number, racer: Racer, outVec: Vec2) => {
  const camAngle = Game.mCamera.mAngle;
  const camSin = mathSin(camAngle);
  const camCos = mathCos(camAngle);

  outVec.x = (x * camCos) - (y * camSin);
  outVec.y = (x * camSin) + (y * camCos);

  vec2Normalize(outVec);

  const outVecLengthSqr = vec2LengthSqr(outVec);
  const speedSqr = vec2LengthSqr(racer.mVel);
  if (outVecLengthSqr > 0 && speedSqr > kMathEpsilon) {
    const steeringCompressionSqr = kPlayerSteeringCompressionMaxSpeed * kPlayerSteeringCompressionMaxSpeed;
    const speedRatio = mathClamp(speedSqr / steeringCompressionSqr, 0, 1);
    const turnScale = 1 - ((1 - kPlayerSteeringMinTurnScale) * speedRatio);

    const velocityAngle = mathAtan2(racer.mVel.y, racer.mVel.x);
    const desiredAngle = mathAtan2(outVec.y, outVec.x);
    const blendedAngle = mathLerpAngle(velocityAngle, desiredAngle, turnScale);

    outVec.x = mathCos(blendedAngle);
    outVec.y = mathSin(blendedAngle); 
  }
};

export const controllerReset = (self: Controller) => {
  self.mPreviousSegmentIdx = -1;

  self.mPreviousSegmentT = self.mBlockPlayerTimer =
  self.mGallopingReactionTimer = self.mReactionTimer = 0;

  self.mIsWaitingForStamina = self.mIsBlockingPlayer = self.mWasStuck = false;

  playerInputState.mMobileSteerValue = 0;
  playerInputState.mMobileSteerHoldValue = 0;
  playerInputState.mMobileTiltSteerValue = 0;
  playerInputState.mMobileSteerPointerId = -1;
}

export const controllerIsPlayerControlled = (self: Controller) => {
  return self.mProcessFunction === controllerProcessPlayerInput;
};

export const controllerReturnToTrack = (self: Controller, racer: Racer) => {
  const trackPoint = racer.mTrackPoints[racer.mLastValidPathIdx];
  let nextPathIdx = racer.mLastValidPathIdx;
  let nextSegmentIdx = trackPoint.mSegmentIdx;
  let nextT = trackPoint.t + ((self.mReturningToTrack?.mIsReturning) ? 0.1 : 0.25);

  if (nextT > 1) {
    nextT -= 1;

    if (nextPathIdx > -1) {
      const branchInPath = Game.mTrack.mSecondaryPaths[nextPathIdx].branchInPath;

      nextPathIdx = branchInPath.path;
      nextSegmentIdx = branchInPath.point;
    } else {
      nextSegmentIdx = trackWrapSegmentIndex(nextSegmentIdx + 1, Game.mTrack.mSegments.length);
    }
  }

  // We use self.mDesiredDirection as a work vector
  splineCalculateSegmentPoint(
    (nextPathIdx > -1)
      ? Game.mTrack.mSecondaryPaths[nextPathIdx].segments[nextSegmentIdx]
      : Game.mTrack.mSegments[nextSegmentIdx],
    nextT, self.mDesiredDirection
  );
  
  vec2Normalize(
    vec2Sub(self.mDesiredDirection, racer.mPos)
  );

  if (self.mReturningToTrack) {
    self.mReturningToTrack.mIsReturning = true;
    self.mReturningToTrack.mTimer = kReturnToTrackReCheck;
  } else {
    self.mReturningToTrack = { mIsReturning: true, mTimer: kReturnToTrackReCheck };
  }

  self.mIsGalloping = false;
  self.mGallopTapPressed = false;
  self.mIsWaitingForStamina = false;
};

export const controllerSetupPlayerInput = (self: Controller) => {
  let orientationPermissionRequested = false;
  let orientationPermissionGranted = true;

  const requestOrientationPermissionIfNeeded = () => {
    if (orientationPermissionRequested || !windowIsMobile()) return;

    const orientationWithPermission = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const requestPermission = orientationWithPermission.requestPermission;

    if (typeof requestPermission !== 'function') {
      orientationPermissionRequested = true;
      orientationPermissionGranted = true;
      return;
    }

    orientationPermissionRequested = true;
    orientationPermissionGranted = false;

    requestPermission()
      .then((state) => {
        orientationPermissionGranted = state === 'granted';
      })
      .catch(() => {
        orientationPermissionGranted = false;
      });
  };

  const onKeyDown: KeyBoardEventListener = (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        if (!playerInputState.mPressed.mUp) {
          playerInputState.mPressed.mUp = true;
        }
        break;
      case "KeyS":
      case "ArrowDown":
        if (!playerInputState.mPressed.mDown) {
          playerInputState.mPressed.mDown = true;
        }
        break;
      case "KeyA":
      case "ArrowLeft":
        if (!playerInputState.mPressed.mLeft) {
          playerInputState.mPressed.mLeft = true;
        }
        break;
      case "KeyD":
      case "ArrowRight":
        if (!playerInputState.mPressed.mRight) {
          playerInputState.mPressed.mRight = true;
        }
        break;
      case "KeyK":
        if (!event.repeat) {
          controllerTriggerGallopTap(self);
        }
        break;
    }
  };

  const onKeyUp: KeyBoardEventListener = (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        if (playerInputState.mPressed.mUp) {
          playerInputState.mPressed.mUp = false;
        }
        break;
      case "KeyS":
      case "ArrowDown":
        if (playerInputState.mPressed.mDown) {
          playerInputState.mPressed.mDown = false;
        }
        break;
      case "KeyA":
      case "ArrowLeft":
        if (playerInputState.mPressed.mLeft) {
          playerInputState.mPressed.mLeft = false;
        }
        break;
      case "KeyD":
      case "ArrowRight":
        if (playerInputState.mPressed.mRight) {
          playerInputState.mPressed.mRight = false;
        }
        break;
    }
  };

  const onPointerDown: PointerEventListener = (event) => {
    if (!windowIsMobile() || Game.mGameMode === kGameModeRaceMenu) return;

    requestOrientationPermissionIfNeeded();

    const steer = controllerMapPointerToSteering(event.clientX);
    playerInputState.mMobileSteerValue = steer;
    playerInputState.mMobileSteerHoldValue = steer;
    playerInputState.mMobileSteerPointerId = event.pointerId;

    controllerTriggerGallopTap(self);
  };

  const onPointerMove: PointerEventListener = (event) => {
    if (!windowIsMobile() || Game.mGameMode === kGameModeRaceMenu) return;
    if (playerInputState.mMobileSteerPointerId !== event.pointerId) return;

    const steer = controllerMapPointerToSteering(event.clientX);
    playerInputState.mMobileSteerValue = steer;
    playerInputState.mMobileSteerHoldValue = steer;

  };

  const onPointerEnd: PointerEventListener = (event) => {
    if (playerInputState.mMobileSteerPointerId !== event.pointerId) return;

    playerInputState.mMobileSteerPointerId = -1;
    playerInputState.mMobileSteerValue = 0;
  };

  const onDeviceOrientation: DeviceOrientationEventListener = (event) => {
    if (!windowIsMobile() || Game.mGameMode === kGameModeRaceMenu) {
      playerInputState.mMobileTiltSteerValue = 0;
      return;
    }

    if (!orientationPermissionGranted) {
      playerInputState.mMobileTiltSteerValue = 0;
      return;
    }

    playerInputState.mMobileTiltSteerValue = controllerMapTiltToSteering(event.gamma);
  };

  playerInputState.mEventListeners[kWindowEventKeyDown] = onKeyDown;
  playerInputState.mEventListeners[kWindowEventKeyUp] = onKeyUp;
  playerInputState.mPointerDownListener = onPointerDown;
  playerInputState.mPointerMoveListener = onPointerMove;
  playerInputState.mPointerUpListener = onPointerEnd;
  playerInputState.mPointerCancelListener = onPointerEnd;
  playerInputState.mDeviceOrientationListener = onDeviceOrientation;

  windowAddEventListener(kWindowEventKeyDown, onKeyDown);
  windowAddEventListener(kWindowEventKeyUp, onKeyUp);
  windowAddEventListener(kWindowEventPointerDown, onPointerDown);
  windowAddEventListener(kWindowEventPointerMove, onPointerMove);
  windowAddEventListener(kWindowEventPointerUp, onPointerEnd);
  windowAddEventListener(kWindowEventPointerCancel, onPointerEnd);
  windowAddEventListener('deviceorientation', onDeviceOrientation);
};

export const controllerRemovePlayerInput = () => {
  if (playerInputState.mEventListeners[kWindowEventKeyDown]) {
    windowRemoveEventListener(kWindowEventKeyDown, playerInputState.mEventListeners[kWindowEventKeyDown]);
    playerInputState.mEventListeners[kWindowEventKeyDown] = 0;
  }
  if (playerInputState.mEventListeners[kWindowEventKeyUp]) {
    windowRemoveEventListener(kWindowEventKeyUp, playerInputState.mEventListeners[kWindowEventKeyUp]);
    playerInputState.mEventListeners[kWindowEventKeyUp] = 0;
  }
  if (playerInputState.mPointerDownListener) {
    windowRemoveEventListener(kWindowEventPointerDown, playerInputState.mPointerDownListener);
    playerInputState.mPointerDownListener = 0;
  }
  if (playerInputState.mPointerMoveListener) {
    windowRemoveEventListener(kWindowEventPointerMove, playerInputState.mPointerMoveListener);
    playerInputState.mPointerMoveListener = 0;
  }
  if (playerInputState.mPointerUpListener) {
    windowRemoveEventListener(kWindowEventPointerUp, playerInputState.mPointerUpListener);
    playerInputState.mPointerUpListener = 0;
  }
  if (playerInputState.mPointerCancelListener) {
    windowRemoveEventListener(kWindowEventPointerCancel, playerInputState.mPointerCancelListener);
    playerInputState.mPointerCancelListener = 0;
  }
  if (playerInputState.mDeviceOrientationListener) {
    windowRemoveEventListener('deviceorientation', playerInputState.mDeviceOrientationListener);
    playerInputState.mDeviceOrientationListener = 0;
  }
};

export const controllerProcessPlayerInput = (self: Controller, racer: Racer, delta: number) => {
  if (self.mReturningToTrack?.mIsReturning) {
    self.mReturningToTrack.mTimer -= delta;

    if (self.mReturningToTrack.mTimer <= 0) {
      controllerReturnToTrack(self, racer);
    } else {
      // Calculate current used track width relative to the track center
      // We might get a bug where the racer could "cheat" by skipping a section of the track, but this is a rare edge case and not worth fixing for now
      const trackPoint = racer.mTrackPoints[racer.mLastValidPathIdx];
      const curOffset = vec2Sub(vec2Copy(vec2New(), racer.mPos), trackPoint.mPos);
      const offsetThresholdSqr = 6 * 6;

      if (vec2LengthSqr(curOffset) < offsetThresholdSqr) {
        self.mReturningToTrack.mIsReturning = false;
      }
    }
  } else {
    if (self.mGallopTapPressed) {
      self.mGallopTapPressed = false;
    }

    if (playerInputState.mPressed.mGallop) {
      playerInputState.mPressed.mGallop = false;
      self.mGallopTapPressed = true;
    }

    if (racer.mStamina <= 0) {
      self.mIsGalloping = false;
      self.mIsWaitingForStamina = true;
      playerInputState.mGallopingTimer = 0;
    } else if (self.mIsWaitingForStamina && racer.mStamina > 0.33) {
      self.mIsWaitingForStamina = false;
    }

    if (playerInputState.mGallopingTimer > 0) {
      playerInputState.mGallopingTimer -= delta;
      if (playerInputState.mGallopingTimer <= 0) {
        playerInputState.mGallopingTimer = 0;
        self.mIsGalloping = false;
        playerInputState.mMobileSteerHoldValue = 0;
      }
    }

    const keyX = (playerInputState.mPressed.mRight ? 1 : 0) - (playerInputState.mPressed.mLeft ? 1 : 0);
    const keyY = (playerInputState.mPressed.mDown ? 1 : 0) - (playerInputState.mPressed.mUp ? 1 : 0);

    const isMobile = windowIsMobile();
    const holdMobileSteer =
      isMobile &&
      self.mIsGalloping &&
      playerInputState.mGallopingTimer > 0 &&
      !playerInputState.mMobileSteerValue &&
      playerInputState.mMobileSteerHoldValue;

    const x = isMobile
      ? mathClamp((playerInputState.mMobileSteerValue || holdMobileSteer || keyX) + playerInputState.mMobileTiltSteerValue, -1.25, 1.25)
      : keyX;
    const y = isMobile ? -1 : keyY;

    controllerTranslatePlayerDirection(x, y, racer, self.mDesiredDirection);

    if (isMobile) {
      const trackPoint = racer.mTrackPoints[-1];

      if (trackPoint) {
        let targetSegmentIdx = trackPoint.mSegmentIdx;
        let targetT = trackPoint.t + kPlayerMobileAutoSteerLookaheadT;

        while (targetT > 1) {
          targetT -= 1;
          targetSegmentIdx = trackWrapSegmentIndex(targetSegmentIdx + 1, Game.mTrack.mSegments.length);
        }

        const targetTangent = splineCalculateSegmentTangent(Game.mTrack.mSegments[targetSegmentIdx], targetT, vec2New());
        const desiredAngle = mathAtan2(self.mDesiredDirection.y, self.mDesiredDirection.x);
        const targetAngle = mathAtan2(targetTangent.y, targetTangent.x);
        const correctedAngle = mathLerpAngle(targetAngle, desiredAngle, kPlayerMobileAutoSteerBlend);

        self.mDesiredDirection.x = mathCos(correctedAngle);
        self.mDesiredDirection.y = mathSin(correctedAngle);
      }
    }
  }
};

export const controllerProcessAIForRacer = (self: Controller, racer: Racer, delta: number) => {
  self.mBlockPlayerTimer -= delta;
  self.mReactionTimer -= delta;
  self.mGallopTapPressed = false;

  if (self.mIsWaitingForStamina && racer.mStamina > kAIGallopWaitThreshold) {
    self.mIsWaitingForStamina = false;
  } else if (self.mIsGalloping && racer.mStamina <= 0) {
    self.mIsGalloping = false;
    self.mIsWaitingForStamina = true; 
  }

  if (self.mGallopingReactionTimer > 0) {
    self.mGallopingReactionTimer -= delta;
  } else {
    const trackPoint = racer.mTrackPoints[-1];
    const wasGalloping = self.mIsGalloping;

    if (!self.mIsWaitingForStamina) {
      const tangent0 = trackPoint.mTangent;
      let gallopSafetyScore = 0;

      for (let i = 0; i < kAIGallopLookaheadTOffsets.length; ++i) {
        let aheadSegmentIdx = trackPoint.mSegmentIdx;
        let aheadT = trackPoint.t + kAIGallopLookaheadTOffsets[i];
        while (aheadT > 1) {
          aheadT -= 1;
          aheadSegmentIdx = trackWrapSegmentIndex(aheadSegmentIdx + 1, Game.mTrack.mSegments.length);
        }

        const tangent = splineCalculateSegmentTangent(Game.mTrack.mSegments[aheadSegmentIdx], aheadT, vec2New());
        const alignment = vec2Dot(tangent0, tangent);
        const safety = mathClamp((alignment + 1) * 0.5, 0, 1);

        gallopSafetyScore += safety * kAIGallopLookaheadWeights[i];
      }

      const canStartGalloping = racer.mStamina >= kAIGallopStartStamina;
      const canKeepGalloping = racer.mStamina >= kAIGallopKeepStamina;

      if (self.mIsGalloping) {
        if (gallopSafetyScore < kAIGallopKeepScore || !canKeepGalloping) {
          self.mIsGalloping = false;
          self.mIsWaitingForStamina = racer.mStamina < kAIGallopStartStamina;
        }
      } else if (canStartGalloping && gallopSafetyScore >= kAIGallopEnterScore) {
        self.mIsGalloping = true;
      }

      if (self.mIsGalloping) {
        self.mGallopTapPressed = !wasGalloping || mathRandom() < difficultyData[Game.mDifficulty][3];
      }
    }

    self.mGallopingReactionTimer += kAIGallopingReactionTime;
  }

  if (self.mReactionTimer > 0) return;

  const trackPoint = racer.mTrackPoints[-1];
  const playerRacer = Game.mPlayerRacer;

  if (self.mBlockPlayerTimer <= 0 && racer != playerRacer) {
    const playerTrackPoint = playerRacer.mTrackPoints[-1];
    const isPlayerAhead =
      playerTrackPoint.mSegmentIdx > trackPoint.mSegmentIdx ||
      (playerTrackPoint.mSegmentIdx === trackPoint.mSegmentIdx && playerTrackPoint.t > trackPoint.t);
    const playerDistanceSqr = vec2DistanceSqr(racer.mPos, playerRacer.mPos);

    // We only block the player if
    //   They are ahead and within a certain distance
    //   They are behind but very close
    //   We are not too close to the player (to avoid being too unfair with the player)
    if (
      playerDistanceSqr < (isPlayerAhead ? 240 * 240 : 64 * 64) &&
      playerDistanceSqr > (32 * 32) &&
      mathRandom() < difficultyData[Game.mDifficulty][0]
    ) {
      self.mIsBlockingPlayer = mathRandom() < difficultyData[Game.mDifficulty][0];
    }

    self.mBlockPlayerTimer = 1 + (mathRandom() * 4);
  }

  if (self.mWasStuck) {
    const targetSegmentIdx = trackPoint.t > 0.5
      ? trackWrapSegmentIndex(trackPoint.mSegmentIdx + 1, Game.mTrack.mSegments.length)
      : trackPoint.mSegmentIdx;
    const nextPos = splineCalculateSegmentPoint(Game.mTrack.mSegments[targetSegmentIdx], 0.5, vec2New());

    vec2Normalize(
      vec2Sub(
        vec2Copy(self.mDesiredDirection, nextPos),
        racer.mPos
      )
    );
  } else if (trackPoint.mSegmentIdx !== self.mPreviousSegmentIdx) {
    const segment = Game.mTrack.mSegments[trackPoint.mSegmentIdx];

    if (segment) {
      const segmentStart = splineCalculateSegmentPoint(segment, 0, vec2New());
      const segmentEnd = splineCalculateSegmentPoint(segment, 1, vec2New());

      const segmentDirection = vec2Normalize(vec2Sub(segmentEnd, segmentStart));
      const tangentDirection = trackPoint.mTangent;

      const alignment = vec2Dot(segmentDirection, tangentDirection);
      const alignmentRatio = (alignment - 1) * -0.5; // remap to [0, 1] range, where 0 is same direction, 1 is opposite direction

      vec2Normalize(
        vec2Lerp(
          vec2Copy(self.mDesiredDirection, tangentDirection), segmentDirection, alignmentRatio * 0.8
        )
      );
    }
  } else {
    // Calculate desired direction based on a delta between future track point and current track point
    const deltaT = mathMax(trackPoint.t - self.mPreviousSegmentT, 0.06);
    let nextT = trackPoint.t + (deltaT * 2); // Look ahead twice the current deltaT
    let nextTSegmentIdx = trackPoint.mSegmentIdx;

    if (nextT > 1) {
      // We are exiting the current segment
      const nextSegment = trackWrapSegmentIndex(trackPoint.mSegmentIdx + 1, Game.mTrack.mSegments.length);
      const nextSegmentLength = vec2Distance(
        splineCalculateSegmentPoint(Game.mTrack.mSegments[nextSegment], 0, vec2New()),
        splineCalculateSegmentPoint(Game.mTrack.mSegments[nextSegment], 1, vec2New())
      ) || kMathEpsilon;

      nextT = mathMin(92 / nextSegmentLength, 1); // 92 is the distance we want to look ahead, we divide by the segment length to get the t value
      nextTSegmentIdx = nextSegment;
    }
    const nextPos = splineCalculateSegmentPoint(Game.mTrack.mSegments[nextTSegmentIdx], nextT, vec2New());

    // Calculate current used track width relative to the track center
    const curTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, trackPoint.mSegmentIdx, trackPoint.t) * 0.5;
    const curNormal = vec2New(-trackPoint.mTangent.y, trackPoint.mTangent.x);
    const curOffset = vec2Sub(vec2Copy(vec2New(), racer.mPos), trackPoint.mPos);
    const curUsedHalfWidth = vec2Dot(curOffset, curNormal);

    const trackSafeWidthFactor = self.mIsBlockingPlayer ? kAIBlockPlayerSafeWidthFactor : kAISafeWidthFactor;

    let playerWidthRatio = 0;
    if (self.mIsBlockingPlayer) {
      const playerTrackPoint = playerRacer.mTrackPoints[-1];

      if (playerTrackPoint.mInside) {
        const playerTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, playerTrackPoint.mSegmentIdx, playerTrackPoint.t) * 0.5;
        const playerNormal = vec2New(-playerTrackPoint.mTangent.y, playerTrackPoint.mTangent.x);
        const playerOffset = vec2Sub(vec2Copy(vec2New(), playerRacer.mPos), playerTrackPoint.mPos);
        const playerUsedHalfWidth = vec2Dot(playerOffset, playerNormal);

        playerWidthRatio = playerUsedHalfWidth / playerTrackHalfWidth;
      }
    }

    if (
      mathAbs(curUsedHalfWidth) > (curTrackHalfWidth * trackSafeWidthFactor) ||
      (self.mIsBlockingPlayer && mathAbs(playerWidthRatio) > trackSafeWidthFactor) ||
      curTrackHalfWidth <= kMathEpsilon
    ) {
      // If we are too close to the edge, we want to steer towards the center of the track
      // or if for some reason the track is far too narrow, we just steer towards the next point
      vec2Normalize(
        vec2Sub(
          vec2Copy(self.mDesiredDirection, nextPos),
          racer.mPos
        )
      );
    } else {
      const targetWidthRatio = mathClamp(
        self.mIsBlockingPlayer
          ? playerWidthRatio
          : (curUsedHalfWidth / curTrackHalfWidth) + (mathRandom() * 0.5) - 0.25,
        -trackSafeWidthFactor, trackSafeWidthFactor
      );

      const nextTangent = splineCalculateSegmentTangent(Game.mTrack.mSegments[nextTSegmentIdx], nextT, vec2New());
      const nextNormal = vec2New(-nextTangent.y, nextTangent.x);

      const nextTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, nextTSegmentIdx, nextT) * 0.5;

      vec2Normalize(
        vec2Sub(
          vec2Add(
            vec2Copy(self.mDesiredDirection, nextPos),
            vec2MulScalar(nextNormal, targetWidthRatio * nextTrackHalfWidth)
          ),
          racer.mPos
        )
      );
    }
  }

  if (self.mWasStuck) {
    self.mWasStuck = false;
  } else if (vec2LengthSqr(racer.mVel) > 0) {
    const velDir = vec2Normalize(vec2NewCopy(racer.mVel));
    const velAlignment = vec2Dot(self.mDesiredDirection, velDir);
    const velAlignmentRatio = (velAlignment - 1) * -0.5; // remap to [0, 1] range, where 0 is same direction, 1 is opposite direction
    
    if (velAlignmentRatio > 0.5) {
      vec2MulScalar(self.mDesiredDirection, 0);
      self.mWasStuck = true;
    } else {
      vec2Lerp(
        self.mDesiredDirection,
        vec2MulScalar(velDir, -1),
        mathMin(velAlignmentRatio * 1.5, 1)
      );
    }
  }

  self.mPreviousSegmentIdx = trackPoint.mSegmentIdx;
  self.mPreviousSegmentT = trackPoint.t;
  self.mReactionTimer += kAIReactionTimeMin + mathRandom() * kAIReactionTimeMaxDelta;
};