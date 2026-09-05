import { racerAnimations, type SkeletonNode, type SkeletonNodeShapes } from "../data/racer.data";
import { Game } from "../game";
import { kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathClamp, mathCos, mathJs, mathLerp, mathMod, mathPingPong, mathSin, vec2Add, vec2Copy, vec2CopyFromTuple, vec2MulScalar, vec2New, vec2NewCopy, type Vec2 } from "../math";
import { ctxBeginPath, ctxClosePathAndFill, ctxLineTo, ctxMoveTo, ctxSetFillStyle } from "../sys/context";
import { newCircleCollider, type CircleCollider } from "./collision";
import { controllerProcessAIForRacer, type AIController } from "./controllers";
import { trackCopyTrackPoint, trackFindPointInTrack, type TrackPointProjection } from "./track";

const kRacerColRadius = 3 as const;
const kRacerColDiameter = 6 as const;

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

export interface Racer {
  mSkeleton: SkeletonNode[];
  mSkeletonShapes: SkeletonNodeShapes;

  mFrontCol: CircleCollider;
  mMidCol: CircleCollider;
  mBackCol: CircleCollider;

  mController: AIController;

  mTrackPoints: { [pathIdx: number]: TrackPointProjection };
  mLastValidPathIdx: number;

  mPos: Vec2;
  mVel: Vec2;
  mAngle: number;

  mAnimIdx: number;
  mAnimTime: number;
  mAnimSpeed: number;

  mIsPlayer: boolean;
}

export const racerNew = (skeleton: SkeletonNode[], skeletonShapes: SkeletonNodeShapes): Racer => ({
  mSkeleton: skeleton,
  mSkeletonShapes: skeletonShapes,

  mFrontCol: newCircleCollider(kRacerColRadius),
  mMidCol: newCircleCollider(kRacerColRadius),
  mBackCol: newCircleCollider(kRacerColRadius),

  mTrackPoints: {},
  mLastValidPathIdx: -1,

  mPos: { x: 0, y: 0 },
  mVel: { x: 0, y: 0 },
  mAngle: 0,

  mAnimIdx: 3,
  mAnimTime: 0,
  mAnimSpeed: 1,

  mController: { mDesiredDirection: vec2New(), mPreviusSegmentT: 0, mReactionTimer: 0, mIsBlockingPlayer: false, mBlockPlayerTimer: 0 },

  mIsPlayer: false,
});

export const racerReset = (self: Racer) => {
  self.mPos.x = self.mPos.y = self.mVel.x = self.mVel.y = self.mFrontCol.pos.y =
  self.mMidCol.pos.x = self.mMidCol.pos.y = self.mBackCol.pos.y = 0;

  self.mFrontCol.pos.x = kRacerColDiameter;
  self.mBackCol.pos.x = -kRacerColDiameter;

  self.mLastValidPathIdx = -1;
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

  self.mFrontCol.pos.x = self.mPos.x + c * kRacerColDiameter;
  self.mFrontCol.pos.y = self.mPos.y + s * kRacerColDiameter;

  self.mMidCol.pos.x = self.mPos.x;
  self.mMidCol.pos.y = self.mPos.y;

  self.mBackCol.pos.x = self.mPos.x - c * kRacerColDiameter;
  self.mBackCol.pos.y = self.mPos.y - s * kRacerColDiameter;
};

export const racerSetAngleFromVector = (self: Racer, vec: Vec2) => racerSetAngle(self, mathJs.atan2(vec.y, vec.x));

export const racerFixedTick = (self: Racer, delta: number) => {
  if (!self.mIsPlayer) {
    controllerProcessAIForRacer(self.mController, self, delta);
  }

  vec2MulScalar(
    vec2Copy(self.mVel, self.mController.mDesiredDirection),
    mathLerp(60, 120, mathJs.random())
  );
  racerSetAngleFromVector(self, self.mVel);

  vec2Add(self.mPos, vec2MulScalar(vec2NewCopy(self.mVel), delta));
  trackFindPointInTrack(Game.mTrack, self.mPos, -1, 0, self.mTrackPoints);

  let isInsideAnyPath = false;
  let bestDistance = Infinity;
  let bestPathIdx = -1;
  for (let i = 0; i < Game.mTrack.secondaryPaths.length; ++i) {
    if (self.mTrackPoints[i].mInside) {
      isInsideAnyPath = true;
      
      const dist = self.mTrackPoints[i].mDistSqr;
      if (dist < bestDistance) {
        // This would be a bug if two track segments were too close with different widths, but for this game it's not a problem.
        bestDistance = dist;
        bestPathIdx = i;
      }
    }
  }

  if (isInsideAnyPath) {
    self.mLastValidPathIdx = bestPathIdx;
  } else {
    // Activate autopilot to return to the track
  }
};

export const racerTick = (self: Racer, delta: number) => {
  self.mAnimTime = (self.mAnimTime + (delta * self.mAnimSpeed)) % 1; // All animations have a total duration of 1.0, so we can wrap the time to stay within that range.
};

export const racerRender = (
  self: Racer,
  ctx: CanvasRenderingContext2D,
  x: number, y: number, invZ: number,
  angle: number, scale: number, alpha: number
) => {
  const getAnimatedAngle = (partId: number) =>{
    const anim = racerAnimations[self.mAnimIdx];
    if (!anim) return 0;
  
    const partAnim = anim[partId];
    const partAnimLen = partAnim?.length ?? 0;

    if (!partAnim || partAnimLen === 0) return 0;
    if (partAnimLen < 3) return partAnim[0] as number;
  
    let workIdx = 1;
    let totalDuration = 0;
    while(workIdx < partAnimLen) {
      totalDuration += mathJs.max(0, partAnim[workIdx] as number);
      workIdx += 3;
    }
  
    if (totalDuration <= 0) {
      return partAnim[0] as number;
    }
  
    const wrappedTime = mathMod(self.mAnimTime, totalDuration);
    let elapsed = 0;
  
    for (workIdx = 0; workIdx < partAnimLen; workIdx += 3) {
      const segmentDuration = mathJs.max(0, partAnim[workIdx + 1] as number);
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
    const localX = x - (self.mSkeleton[parentPart]?.[0] ?? 0);
    const localY = y - (self.mSkeleton[parentPart]?.[1] ?? 0);
    const parentAnimatedPos = workTransformedNodes[parentPart]?.mAnimPos ?? vec2New();

    return [
      (localX * animCos) - (localY * animSin) + parentAnimatedPos.x,
      (localX * animSin) + (localY * animCos) + parentAnimatedPos.y,
    ] as [number, number];
  };

  const dir = (mathJs.abs(angle) < kMathHalfPi) ? 1 : -1;
  const toScreen = (point: Vec2): [number, number] => {
    return [x + (point.x * scale * dir), y + (point.y * scale)];
  }

  angle = mathPingPong(angle, -kMathHalfPi, kMathHalfPi);
  const rotSin = mathSin(angle);
  const rotCos = mathCos(angle);
  const applyRotationTransform = (
    [x, y]: [number, number], z: number,
  ) => {
    const smoothSignX = x / mathJs.sqrt((x * x) + 0.25);
      
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
  for (let i = 0; i < self.mSkeleton.length; ++i) {
    const skelNode = self.mSkeleton[i];
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

    const shape = self.mSkeletonShapes[i];
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

      const morphValue = mathJs.abs(mathClamp(rotSin, -1, 1));
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
  ctx.globalAlpha = alpha;

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
      ctxSetFillStyle(ctx, self.mSkeletonShapes[node.mRef][3]);
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
      const skelNode = self.mSkeleton[node.mRef];
      const [sx, sy] = toScreen(node.mPos);
      const radius = skelNode[3] * scale;
      const color = skelNode[5];

      const parent = skelNode[7];
      if (parent >= 0 && !skelNode[6]) {
        const [psx, psy] = toScreen(workTransformedNodes[parent].mPos);
        const dx = sx - psx;
        const dy = sy - psy;
        const len = mathJs.hypot(dx, dy);

        const parentSkelNode = self.mSkeleton[parent];
        const parentRadius = parentSkelNode[3] * scale;
        if (len < kMathEpsilon) {
          drawCircle(psx, psy, mathJs.max(radius, parentRadius), color);
        }

        // Sweep circles along the segment with interpolated radius to create a smooth taper.
        const avgRadius = (parentRadius + radius) * 0.5;
        const spacing = mathJs.max(0.75, avgRadius * 0.35);
        const steps = mathJs.max(1, mathJs.ceil(len / spacing));

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
