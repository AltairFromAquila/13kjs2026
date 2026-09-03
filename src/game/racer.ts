import { racerAnimations, type SkeletonNode, type SkeletonNodeShapes } from "../data/racer.data";
import { kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathClamp, mathCos, mathJs, mathLerp, mathMod, mathPingPong, mathSin, vec2Copy, vec2CopyFromTuple, vec2New, type Vec2 } from "../math";
import { ctxBeginPath, ctxClosePathAndFill, ctxLineTo, ctxMoveTo, ctxSetFillStyle } from "../sys/context";
import { newCircleCollider, type CircleCollider } from "./collision";

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

  mPos: Vec2;
  mVel: Vec2;
  mAngle: number;

  mAnimIdx: number;
  mAnimTime: number;
  mAnimSpeed: number;
}

export const racerNew = (inSkeleton: SkeletonNode[], inSkeletonShapes: SkeletonNodeShapes): Racer => ({
  mSkeleton: inSkeleton,
  mSkeletonShapes: inSkeletonShapes,

  mFrontCol: newCircleCollider(kRacerColRadius),
  mMidCol: newCircleCollider(kRacerColRadius),
  mBackCol: newCircleCollider(kRacerColRadius),

  mPos: { x: 0, y: 0 },
  mVel: { x: 0, y: 0 },
  mAngle: 0,

  mAnimIdx: 3,
  mAnimTime: 0,
  mAnimSpeed: 1,
});

export const racerReset = (i0: Racer) => {
  i0.mPos.x = i0.mPos.y = i0.mVel.x = i0.mVel.y = i0.mFrontCol.pos.y =
  i0.mMidCol.pos.x = i0.mMidCol.pos.y = i0.mBackCol.pos.y = 0;

  i0.mFrontCol.pos.x = kRacerColDiameter;
  i0.mBackCol.pos.x = -kRacerColDiameter;
};

export const racerSetAngle = (i0: Racer, inAngle: number) => {
  i0.mAngle = inAngle;

  const c = mathCos(inAngle);
  const s = mathSin(inAngle);

  i0.mFrontCol.pos.x = i0.mPos.x + c * kRacerColDiameter;
  i0.mFrontCol.pos.y = i0.mPos.y + s * kRacerColDiameter;

  i0.mMidCol.pos.x = i0.mPos.x;
  i0.mMidCol.pos.y = i0.mPos.y;

  i0.mBackCol.pos.x = i0.mPos.x - c * kRacerColDiameter;
  i0.mBackCol.pos.y = i0.mPos.y - s * kRacerColDiameter;
};

export const racerSetAngleFromVector = (i0: Racer, inVec: Vec2) => racerSetAngle(i0, mathJs.atan2(inVec.y, inVec.x));

export const racerTick = (i0: Racer, inDelta: number) => {
  i0.mAnimTime = (i0.mAnimTime + (inDelta * i0.mAnimSpeed)) % 1; // All animations have a total duration of 1.0, so we can wrap the time to stay within that range.
};

export const racerRender = (
  i0: Racer,
  inCtx: CanvasRenderingContext2D,
  x: number, y: number, inInvZ: number,
  inAngle: number, inScale: number, inAlpha: number
) => {
  const getAnimatedAngle = (inPartId: number) =>{
    const anim = racerAnimations[i0.mAnimIdx];
    if (!anim) return 0;
  
    const partAnim = anim[inPartId];
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
  
    const wrappedTime = mathMod(i0.mAnimTime, totalDuration);
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
    inAnimSin: number, inAnimCos: number,
    inParentPart: number
  ) => {
    const localX = x - (i0.mSkeleton[inParentPart]?.[0] ?? 0);
    const localY = y - (i0.mSkeleton[inParentPart]?.[1] ?? 0);
    const parentAnimatedPos = workTransformedNodes[inParentPart]?.mAnimPos ?? vec2New();

    return [
      (localX * inAnimCos) - (localY * inAnimSin) + parentAnimatedPos.x,
      (localX * inAnimSin) + (localY * inAnimCos) + parentAnimatedPos.y,
    ] as [number, number];
  };

  const dir = (mathJs.abs(inAngle) < kMathHalfPi) ? 1 : -1;
  const toScreen = (inPoint: Vec2): [number, number] => {
    return [x + (inPoint.x * inScale * dir), y + (inPoint.y * inScale)];
  }

  inAngle = mathPingPong(inAngle, -kMathHalfPi, kMathHalfPi);
  const rotSin = mathSin(inAngle);
  const rotCos = mathCos(inAngle);
  const applyRotationTransform = (
    [x, y]: [number, number], z: number,
  ) => {
    const smoothSignX = x / mathJs.sqrt((x * x) + 0.25);
      
    // Pseudo-3D yaw: collapse x by cos, offset x by depth, and shift y by signed x.
    const transformedX = (x * rotCos) - (z * rotSin);
    const transformedY = y + (rotSin * (inInvZ * 25) * smoothSignX); // inInvZ is kVerticalFactor
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
  for (let i = 0; i < i0.mSkeleton.length; ++i) {
    const skelNode = i0.mSkeleton[i];
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

    const shape = i0.mSkeletonShapes[i];
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

  inCtx.save();
  inCtx.globalCompositeOperation = "source-over";
  inCtx.globalAlpha = inAlpha;

  const drawCircle = (x: number, y: number, radius: number, color: string) => {
    ctxSetFillStyle(inCtx, color);
    ctxBeginPath(inCtx);
    ctxMoveTo(inCtx, x + radius, y);
    inCtx.arc(x, y, radius, 0, kMathTau);
    ctxClosePathAndFill(inCtx);
  };

  // #region Draw skeleton
  for (const node of nodeSet) {
    if (node.mType === 1) {
      ctxSetFillStyle(inCtx, i0.mSkeletonShapes[node.mRef][3]);
      ctxBeginPath(inCtx);

      node.mPoints.forEach((point, idx) => {
        const [sx, sy] = toScreen(point);
        if (idx === 0) {
          ctxMoveTo(inCtx, sx, sy);
        } else {
          ctxLineTo(inCtx, sx, sy);
        }
      });

      ctxClosePathAndFill(inCtx);
    } else {
      const skelNode = i0.mSkeleton[node.mRef];
      const [sx, sy] = toScreen(node.mPos);
      const radius = skelNode[3] * inScale;
      const color = skelNode[5];

      const parent = skelNode[7];
      if (parent >= 0 && !skelNode[6]) {
        const [psx, psy] = toScreen(workTransformedNodes[parent].mPos);
        const dx = sx - psx;
        const dy = sy - psy;
        const len = mathJs.hypot(dx, dy);

        const parentSkelNode = i0.mSkeleton[parent];
        const parentRadius = parentSkelNode[3] * inScale;
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

  inCtx.restore();
};
