import type { Renderable } from "../core/render";
import { racerAnimations, racerMirrorNodes, type RacerData, type SkeletonNode, type SkeletonNodeShapes } from "../data/racer.data";
import { easeOutCubic } from "../easing";
import { Game } from "../game";
import { kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathAbs, mathAtan2, mathCeil, mathClamp, mathCos, mathHypot, mathJs, mathLerp, mathMax, mathMin, mathMod, mathPingPong, mathRandom, mathSin, mathSqrt, splineCalculateSegmentPoint, splineCalculateSegmentTangent, vec2Add, vec2ClampLength, vec2Copy, vec2CopyFromTuple, vec2Dot, vec2Length, vec2LengthSqr, vec2MulScalar, vec2New, vec2NewCopy, vec2Normalize, type Vec2 } from "../math";
import { ctxBeginPath, ctxClosePathAndFill, ctxLineTo, ctxMoveTo, ctxSetFillStyle } from "../sys/context";
import { collisionNewCircleCollider, collisionResolveCollisions, collisionSyncColliders, type CircleCollider, type PhysicEntity } from "./collision";
import { controllerIsPlayerControlled, controllerNew, controllerReset, controllerReturnToTrack, type Controller } from "./controllers";
import { trackCopyTrackPoint, trackFindPointInTrack, type TrackPointProjection } from "./track";

const kRacerColRadius = 3 as const;

const kRacerMaxJogSpeed = 64 as const;
const kRacerMaxSpeed = 120 as const;
const kRacerMaxSpeedWhileGalloping = 180 as const;

const kRacerMaxSpeedIncrease = 0.8 as const;
const kRacerReturnToTrackSpeedDecrease = -1 as const;
const kRacerGallopingMaxSpeedIncrement = 12 as const;
const kRacerGallopingMaxSpeedDecrease = -0.5 as const;

const workTransformedNodes: TransformedRacerNode[] = []
for (let i = 0; i < 50; ++i) {
  workTransformedNodes.push({
    mType: 0,
    mPos: vec2New(),
    mAnimPos: vec2New(),
    mZ: 0,
    mAngle: 0,
    mRef: 0,
    mParent: -1,
  });
}

const workTransformedShapes: TransformedRacerNodeShape[] = []
for (let i = 0; i < 5; ++i) {
  workTransformedShapes.push({
    mType: 1,
    mPoints: [],
    mZ: 0,
    mRef: 0,
  });
}
interface TransformedRacerNode {
  mType: 0;
  mPos: Vec2;
  mAnimPos: Vec2;
  mZ: number;
  mAngle: number;
  mRef: number;
  mParent: number;
}
interface TransformedRacerNodeShape {
  mType: 1;
  mPoints: Vec2[];
  mZ: number;
  mRef: number;
}

type TransformedRacerNodeEntry = TransformedRacerNode | TransformedRacerNodeShape;

export interface Racer extends Renderable, PhysicEntity {
  mData: RacerData;

  mController: Controller;

  mTrackPoints: { [pathIdx: number]: TrackPointProjection };
  mLastValidPathIdx: number;

  mMaxSpeed: number;
  mJogTime: number;

  mAnimIdx: number;
  mAnimTime: number;
  mAnimSpeed: number;

  mTotalTime: number;
  mLapTime: number;
  mLastLapTime: number;
  mBestLapTime: number;
  mLap: number;
  mLapTracker: number;

  mStamina: number;

  mPoints: number;
}

export const racerNew = (data: RacerData): Racer => ({
  mPos: vec2New(),
  mScreenPos: vec2New(),
  mAngle: 0,

  mFrontCol: collisionNewCircleCollider(kRacerColRadius),
  mMidCol: collisionNewCircleCollider(kRacerColRadius),
  mBackCol: collisionNewCircleCollider(kRacerColRadius),
  mVel: vec2New(),
  mColVel: vec2New(),

  mData: data,

  mTrackPoints: {},
  mLastValidPathIdx: -1,

  mMaxSpeed: kRacerMaxJogSpeed,
  mJogTime: 0,

  mAnimIdx: 3,
  mAnimTime: 0,
  mAnimSpeed: 1,

  mController: controllerNew(),

  mTotalTime: 0,
  mLapTime: 0,
  mLastLapTime: 0,
  mBestLapTime: 0,
  mLap: 0,
  mLapTracker: 0,

  mStamina: 1,

  mPoints: 0,
});

export const racerReset = (self: Racer) => {
  self.mPos.x = self.mPos.y = self.mVel.x = self.mVel.y = 0;

  self.mLastValidPathIdx = -1;

  self.mMaxSpeed = kRacerMaxJogSpeed;
  self.mJogTime = 0;
  self.mStamina = 1;

  self.mTotalTime = self.mLapTime = self.mLastLapTime =
  self.mBestLapTime = self.mLap = self.mLapTracker = 0;

  collisionSyncColliders(self);
  controllerReset(self.mController);
};

export const racerSetupTrackPoints = (self: Racer, startTrackPoint: TrackPointProjection) => {
  const mainPathTrackPoint = self.mTrackPoints[-1] || (self.mTrackPoints[-1] = { mPos: vec2New(), mTangent: vec2New() } as TrackPointProjection)

  trackCopyTrackPoint(mainPathTrackPoint, startTrackPoint);
  trackFindPointInTrack(Game.mTrack, self.mPos, -1, 1, self.mTrackPoints);

  self.mLastValidPathIdx = -1;
}

export const racerSetAngle = (self: Racer, angle: number) => {
  self.mAngle = angle;

  const c = mathCos(angle);
  const s = mathSin(angle);

  self.mFrontCol.mPos.x = self.mPos.x + c * kRacerColRadius;
  self.mFrontCol.mPos.y = self.mPos.y + s * kRacerColRadius;

  self.mMidCol.mPos.x = self.mPos.x;
  self.mMidCol.mPos.y = self.mPos.y;

  self.mBackCol.mPos.x = self.mPos.x - c * kRacerColRadius;
  self.mBackCol.mPos.y = self.mPos.y - s * kRacerColRadius;
};

export const racerSetAngleFromVector = (self: Racer, vec: Vec2) => racerSetAngle(self, mathAtan2(vec.y, vec.x));

export const racerFixedTick = (self: Racer, delta: number) => {
  self.mController.mProcessFunction(self.mController, self, delta);

  const prevPos = vec2NewCopy(self.mPos);

  self.mTotalTime += delta;
  self.mLapTime += delta;

  const speedSqr = vec2LengthSqr(self.mVel);
  const maxJogSpeedSqr = kRacerMaxJogSpeed * kRacerMaxJogSpeed;

  if (self.mController.mIsGalloping) {
    const staminaDrainRate = mathLerp(0, 0.1, mathMin(speedSqr / maxJogSpeedSqr, 1));
    self.mStamina -= delta * staminaDrainRate; // Decrease stamina continuously while galloping

    if (self.mStamina < 0) {
      self.mStamina = 0;
    }
  } else if (self.mStamina < 1) {
    self.mStamina += delta * 0.2; // Regenerate stamina while not galloping
    if (self.mStamina > 1) {
      self.mStamina = 1;
    }
  }

  let acceleration = 0.5;
  if (speedSqr > 0 && vec2LengthSqr(self.mController.mDesiredDirection) > 0) {
    const velDir = vec2Normalize(vec2NewCopy(self.mVel));
    const velAlignment = vec2Dot(self.mController.mDesiredDirection, velDir);
    const velAlignmentRatio = (velAlignment - 1) * -0.5; // remap to [0, 1] range, where 0 is same direction, 1 is opposite direction
    const accelerationRatio = easeOutCubic(mathMin(speedSqr / kRacerMaxSpeed, 1));
    const forardAcceleration = mathLerp(0.5, 4, accelerationRatio);
    const backwardAcceleration = mathLerp(1, 16, accelerationRatio);

    acceleration = mathLerp(forardAcceleration, backwardAcceleration, easeOutCubic(velAlignmentRatio));
  }

  if (self.mController.mReturningToTrack?.mIsReturning && self.mMaxSpeed > kRacerMaxJogSpeed) {
    self.mMaxSpeed += kRacerReturnToTrackSpeedDecrease;
    if (self.mMaxSpeed < kRacerMaxJogSpeed) {
      self.mMaxSpeed = kRacerMaxJogSpeed;
    }
  } else if (self.mController.mIsGalloping) {
    self.mMaxSpeed = mathClamp(
      self.mMaxSpeed + (self.mController.mGallopTapPressed
        ? kRacerGallopingMaxSpeedIncrement
        : kRacerGallopingMaxSpeedDecrease),
      kRacerMaxSpeed,
      kRacerMaxSpeedWhileGalloping
    );
  } else if (self.mJogTime < 1) {
    if (self.mMaxSpeed > kRacerMaxSpeed) {
      self.mMaxSpeed += kRacerGallopingMaxSpeedDecrease * ((self.mStamina < 0.3) ? 1.5 : 1);
    }

    if (speedSqr > maxJogSpeedSqr * 0.9) {
      self.mJogTime += delta * 0.5;
    } else {
      self.mJogTime -= delta * 0.5;
      if (self.mJogTime < 0) {
        self.mJogTime = 0;
      }
    }
  } else {
    if (speedSqr > maxJogSpeedSqr * 0.25) {
      if (self.mMaxSpeed > kRacerMaxSpeed) {
        self.mMaxSpeed += kRacerGallopingMaxSpeedDecrease * ((self.mStamina < 0.3) ? 1.5 : 1);
      }
      if (self.mMaxSpeed < kRacerMaxSpeed) {
        self.mMaxSpeed += kRacerMaxSpeedIncrease;
        if (self.mMaxSpeed > kRacerMaxSpeed) {
          self.mMaxSpeed = kRacerMaxSpeed;
        }
      }
    } else {
      self.mMaxSpeed = kRacerMaxJogSpeed;
      self.mJogTime -= delta * 0.5;
      if (self.mJogTime < 0) {
        self.mJogTime = 0;
      }
    }
  }

  const hasInput = vec2LengthSqr(self.mController.mDesiredDirection) > 0;
  const motion = vec2MulScalar(vec2NewCopy(self.mController.mDesiredDirection), acceleration);
  vec2Add(self.mVel, motion);

  vec2MulScalar(self.mVel, hasInput ? 0.98 : 0.95);
  if (vec2LengthSqr(self.mVel) < 0.01) {
    self.mVel.x = 0;
    self.mVel.y = 0;
  }

  vec2ClampLength(self.mVel, 0, self.mMaxSpeed);

  if (vec2LengthSqr(self.mVel) > 0) {
    racerSetAngleFromVector(self, self.mVel);
  }

  const prevMainSegmentIdx = self.mTrackPoints[-1]?.mSegmentIdx ?? 0;

  vec2Add(self.mPos, vec2MulScalar(vec2NewCopy(self.mVel), delta));

  if (controllerIsPlayerControlled(self.mController)) {
    collisionSyncColliders(self);
    collisionResolveCollisions(self);
    vec2Add(self.mPos, vec2MulScalar(vec2NewCopy(self.mColVel), delta));
    vec2MulScalar(self.mColVel, 0.9);

    if (vec2LengthSqr(self.mColVel) < 0.01) {
      self.mColVel.x = 0;
      self.mColVel.y = 0;
    }

    collisionSyncColliders(self);
    trackFindPointInTrack(Game.mTrack, self.mPos, -1, 0, self.mTrackPoints);
  } else {
    collisionSyncColliders(self);
    trackFindPointInTrack(Game.mTrack, self.mPos, self.mTrackPoints[-1]?.mSegmentIdx ?? -1, -1, self.mTrackPoints);
  }

  if (prevMainSegmentIdx === 0 && self.mTrackPoints[-1]?.mSegmentIdx === Game.mTrack.segments.length - 1) {
    self.mLapTracker -= 1;
  } else if (prevMainSegmentIdx === Game.mTrack.segments.length - 1 && self.mTrackPoints[-1]?.mSegmentIdx === 0) {
    if (self.mLapTracker === self.mLap) {
      if (self.mLap > 0) {
        const startPos = splineCalculateSegmentPoint(Game.mTrack.segments[0], 0, vec2New());
        const startTangent = splineCalculateSegmentTangent(Game.mTrack.segments[0], 0, vec2New());

        // Find u in: SP + t*n = PP + u*(CP - PP), where n is the start-line normal.
        const startNormal = vec2New(-startTangent.y, startTangent.x);
        const moveVecX = self.mPos.x - prevPos.x;
        const moveVecY = self.mPos.y - prevPos.y;
        const spToPrevX = startPos.x - prevPos.x;
        const spToPrevY = startPos.y - prevPos.y;

        const den = (moveVecX * startNormal.y) - (moveVecY * startNormal.x);
        let crossingRatio = 1;
        if (mathAbs(den) > kMathEpsilon) {
          const num = (spToPrevX * startNormal.y) - (spToPrevY * startNormal.x);
          crossingRatio = mathClamp(num / den, 0, 1);
        }

        const nextLapCarry = delta * (1 - crossingRatio);
        const finishedLapTime = self.mLapTime - nextLapCarry;
        if (finishedLapTime > 0 && (self.mBestLapTime <= 0 || finishedLapTime < self.mBestLapTime)) {
          self.mBestLapTime = finishedLapTime;
        }

        self.mLastLapTime = finishedLapTime;
        self.mLapTime = nextLapCarry;
      }
      self.mLap += 1;
    }
    self.mLapTracker += 1;
  }

  let isInsideAnyPath = false;
  let bestDistance = Infinity;
  let bestPathIdx = -1;
  for (let i = 0; i < Game.mTrack.secondaryPaths.length; ++i) {
    const secondaryTrackPoint = self.mTrackPoints[i];
    if (secondaryTrackPoint?.mInside) {
      isInsideAnyPath = true;
      
      const dist = secondaryTrackPoint.mDistSqr;
      if (dist < bestDistance) {
        // This would be a bug if two track segments were too close with different widths, but for this game it's not a problem.
        bestDistance = dist;
        bestPathIdx = i;
      }
    }
  }
  const mainTrackPoint = self.mTrackPoints[-1];
  if (mainTrackPoint?.mInside) {
    isInsideAnyPath = true;
      
    const dist = mainTrackPoint.mDistSqr;
    if (dist < bestDistance) {
      // This would be a bug if two track segments were too close with different widths, but for this game it's not a problem.
      bestDistance = dist;
      bestPathIdx = -1;
    }
  }

  if (isInsideAnyPath) {
    self.mLastValidPathIdx = bestPathIdx;
  } else {
    // On sharp corners, there is an issue where it might feel the player never left the track. I might fix it later
    // Activate autopilot to return to the track
    if (controllerIsPlayerControlled(self.mController) && !self.mController.mReturningToTrack?.mIsReturning) {
      controllerReturnToTrack(self.mController, self);
    }
  }
};

export const racerTick = (self: Racer, delta: number) => {
  const speedSqr = vec2LengthSqr(self.mVel);
  const sprintAnimThreshold = kRacerMaxJogSpeed * kRacerMaxJogSpeed * 1.1;
  const gallopMaxSpeedSqr = kRacerMaxSpeedWhileGalloping * kRacerMaxSpeedWhileGalloping;
  
  if (speedSqr > sprintAnimThreshold) {
    self.mAnimIdx = 3;
    self.mAnimSpeed = mathLerp(0.8, 2, mathMin(1, speedSqr / gallopMaxSpeedSqr));
  } else if (speedSqr > 0) {
    self.mAnimIdx = 2;
    self.mAnimSpeed = mathLerp(0.1, 1.5, speedSqr / sprintAnimThreshold);
  } else {
    self.mAnimIdx = 1;
    self.mAnimSpeed = mathLerp(0.4, 1, mathRandom());
  }

  self.mAnimTime = (self.mAnimTime + (delta * self.mAnimSpeed)) % 1; // All animations have a total duration of 1.0, so we can wrap the time to stay within that range.
};

export const racerRender = (
  self: Racer,
  ctx: CanvasRenderingContext2D,
  x: number, y: number, invZ: number,
  angle: number, scale: number, alpha: number
) => {
  const skeleton = self.mData[1];
  const skeletonShapes = self.mData[2];
  const dir = (mathAbs(angle) < kMathHalfPi) ? 1 : -1;

  const getAnimatedAngle = (partId: number) =>{
    const anim = racerAnimations[self.mAnimIdx];
    if (!anim) return 0;
  
    const partIdAnim = (dir < 0) ? racerMirrorNodes[partId] ?? partId : partId;
    const partAnim = anim[partIdAnim];
    const partAnimLen = partAnim?.length ?? 0;

    if (!partAnim || partAnimLen === 0) return 0;
    if (partAnimLen < 3) return partAnim[0] as number;
  
    let workIdx = 1;
    let totalDuration = 0;
    while(workIdx < partAnimLen) {
      totalDuration += mathMax(0, partAnim[workIdx] as number);
      workIdx += 3;
    }
  
    if (totalDuration <= 0) {
      return partAnim[0] as number;
    }
  
    const wrappedTime = mathMod(self.mAnimTime, totalDuration);
    let elapsed = 0;
  
    for (workIdx = 0; workIdx < partAnimLen; workIdx += 3) {
      const segmentDuration = mathMax(0, partAnim[workIdx + 1] as number);
      if (segmentDuration === 0) {
        continue;
      }
  
      const segmentEnd = elapsed + segmentDuration;
      if (wrappedTime < segmentEnd || workIdx === partAnimLen - 3) {
        const t = (wrappedTime - elapsed) / segmentDuration;
        const easingFn = partAnim[workIdx + 2] as ((t: number) => number);
        const easedT = easingFn(mathClamp(t, 0, 1));
        const curAngle = partAnim[workIdx] as number;
        const nextAngle = partAnim[(workIdx + 3) % partAnimLen] as number;

        return curAngle + ((nextAngle - curAngle) * easedT);
      }
  
      elapsed = segmentEnd;
    }
  
    return partAnim[partAnim.length - 3] as number;
  };
  const applyAnimationTransform = (
    x: number, y: number,
    animSin: number, animCos: number,
    parentPart: number
  ) => {
    const localX = x - (skeleton[parentPart]?.[0] ?? 0);
    const localY = y - (skeleton[parentPart]?.[1] ?? 0);
    const parentAnimatedPos = workTransformedNodes[parentPart]?.mAnimPos ?? vec2New();

    return [
      (localX * animCos) - (localY * animSin) + parentAnimatedPos.x,
      (localX * animSin) + (localY * animCos) + parentAnimatedPos.y,
    ] as [number, number];
  };

  const toScreen = (point: Vec2): [number, number] => {
    return [x + (point.x * scale * dir), y + (point.y * scale)];
  }

  angle = mathPingPong(angle, -kMathHalfPi, kMathHalfPi);
  const rotSin = mathSin(angle);
  const rotCos = mathCos(angle);
  const applyRotationTransform = (
    [x, y]: [number, number], z: number,
  ) => {
    const smoothSignX = x / mathSqrt((x * x) + 0.25);
      
    // Pseudo-3D yaw: collapse x by cos, offset x by depth, and shift y by signed x.
    const transformedX = (x * rotCos) - (z * rotSin);
    const transformedY = y + (rotSin * (invZ * 25) * smoothSignX); // inInvZ is kVerticalFactor
    const transformedZ = (z * rotCos) + (x * rotSin);

    return {
      x: transformedX,
      y: transformedY,
      z: transformedZ,
    };
  };

  // #region Sort nodes
  const nodeSet: TransformedRacerNodeEntry[] = [];
  const insertSorted = (nodeItem: TransformedRacerNodeEntry) => {
    let insertIdx = nodeSet.findIndex((n) => nodeItem.mZ < n.mZ);
    if (insertIdx === -1) insertIdx = nodeSet.length;

    nodeSet.splice(insertIdx, 0, nodeItem);
  };

  let shapeIdx = 0;
  for (let i = 0; i < skeleton.length; ++i) {
    const skelNode = skeleton[i];
    const parentPart = skelNode[7];
    const parentAnimAngle = workTransformedNodes[parentPart]?.mAngle ?? 0;
    const animAngle = getAnimatedAngle(i) + parentAnimAngle;

    const animSin = mathSin(animAngle * kMathPi);
    const animCos = mathCos(animAngle * kMathPi);
    const nodeZ = skelNode[2];
    const animTx = applyAnimationTransform(
      skelNode[0], skelNode[1], animSin, animCos, skelNode[7]
    );
    const targetTx = applyRotationTransform(animTx, nodeZ);

    const transNode = workTransformedNodes[i];
    vec2Copy(transNode.mPos, targetTx);
    vec2CopyFromTuple(transNode.mAnimPos, animTx);
    transNode.mZ = targetTx.z + skelNode[3] + skelNode[4];
    transNode.mAngle = animAngle;
    transNode.mRef = i;
    transNode.mParent = skelNode[7];

    insertSorted(transNode);

    const shape = skeletonShapes[i];
    if (shape) {
      let workIdx = 0;

      const shapePoints: Vec2[] = [];
      while (workIdx < shape[0].length) {
        shapePoints.push(
          applyRotationTransform(
            applyAnimationTransform(
              shape[0][workIdx++], shape[0][workIdx++], animSin, animCos, skelNode[7]
            ),
            nodeZ
          )
        );
      }

      const morphValue = mathAbs(mathClamp(rotSin, -1, 1));
      if (morphValue > 0 && shape[1]) {
        shapePoints.forEach((point, idx) => {
          const shapeIdx = idx * 2;
          const morphPointX = targetTx.x + ((shape[1] as number[])[shapeIdx] - skelNode[0]);
          const morphPointY = targetTx.y + ((shape[1] as number[])[shapeIdx + 1] - skelNode[1]);

          point.x = mathLerp(point.x, morphPointX, morphValue);
          point.y = mathLerp(point.y, morphPointY, morphValue);
        });
      }

      const transShape = workTransformedShapes[shapeIdx++];
      transShape.mRef = i;
      transShape.mPoints = shapePoints;
      transShape.mZ = shape[2] ? transNode.mZ : targetTx.z;

      insertSorted(transShape);
    }
  }
  // #endregion

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha * (self.mController.mReturningToTrack?.mIsReturning ? 0.25 : 1);

  const drawCircle = (x: number, y: number, radius: number, color: string) => {
    ctxSetFillStyle(ctx, color);
    ctxBeginPath(ctx);
    ctxMoveTo(ctx, x + radius, y);
    ctx.arc(x, y, radius, 0, kMathTau);
    ctxClosePathAndFill(ctx);
  };

  // #region Draw skeleton
  for (const node of nodeSet) {
    if (node.mType === 1) {
      ctxSetFillStyle(ctx, skeletonShapes[node.mRef][3]);
      ctxBeginPath(ctx);

      node.mPoints.forEach((point, idx) => {
        const [sx, sy] = toScreen(point);
        if (idx === 0) {
          ctxMoveTo(ctx, sx, sy);
        } else {
          ctxLineTo(ctx, sx, sy);
        }
      });

      ctxClosePathAndFill(ctx);
    } else {
      const skelNode = skeleton[node.mRef];
      const [sx, sy] = toScreen(node.mPos);
      const radius = skelNode[3] * scale;
      const color = skelNode[5];

      const parent = skelNode[7];
      if (parent >= 0 && !skelNode[6]) {
        const [psx, psy] = toScreen(workTransformedNodes[parent].mPos);
        const dx = sx - psx;
        const dy = sy - psy;
        const len = mathHypot(dx, dy);

        const parentSkelNode = skeleton[parent];
        const parentRadius = parentSkelNode[3] * scale;
        if (len < kMathEpsilon) {
          drawCircle(psx, psy, mathMax(radius, parentRadius), color);
        }

        // Sweep circles along the segment with interpolated radius to create a smooth taper.
        const avgRadius = (parentRadius + radius) * 0.5;
        const spacing = mathMax(0.75, avgRadius * 0.35);
        const steps = mathMax(1, mathCeil(len / spacing));

        for (let i = 0; i <= steps; ++i) {
          const t = i / steps;
          const cx = psx + (dx * t);
          const cy = psy + (dy * t);
          const cr = mathLerp(parentRadius, radius, t);
        
          drawCircle(cx, cy, cr, color);
        }
      }

      drawCircle(sx, sy, radius, color);
    }
  }
  // #endregion

  ctx.restore();
};
