import type { TrackRawData } from "../data/track.data";
import { splineCalculateCatmullRom, splineCalculateSegmentPoint, splineCalculateSegmentTangent, mathLerp, vec2Add, vec2Dot, vec2MulScalar, vec2New, vec2NewCopy, vec2Normalize, vec2Sub, type SplinePoint, type SplineSegment, type Vec2, mathMod, vec2Copy, vec2LengthSqr, mathAbs, mathMax, mathSqrt } from "../math";
import { ctxBeginPath, ctxClosePathAndFill, ctxCreateOffscreenCanvas, ctxGetCanvasImageData, ctxGetRainbowGradient, ctxLineTo, ctxMoveTo, ctxSetFillStyle } from "../sys/context";

interface TrackData {
  mainPath: SplinePoint[];
  secondaryPaths: SecondaryPathData[];
  alpha: number; // 0.5
}

interface SecondaryPathData {
  path: SplinePoint[];
  branchOffPath: { path: number; point: number; };
  branchInPath: { path: number; point: number; };
  depthChanges: { [point: number]: number; };
}

interface SecondaryPath {
  segments: SplineSegment[];
  depthChanges: { [point: number]: number; };
  branchOffPath: { path: number; point: number; };
  branchInPath: { path: number; point: number; };
}

export interface TrackPointProjection {
  mPathIdx: number;
  mSegmentIdx: number;
  t: number;
  mPos: Vec2;
  mTangent: Vec2;
  mWidth: number;
  mDistSqr: number;
  mInside: boolean;
}

export interface Track {
  mSegments: SplineSegment[];
  mSecondaryPaths: SecondaryPath[];
}

export const kTrackTextureSize = 4096;

const {
  mCtx: gTrackCtx,
} = ctxCreateOffscreenCanvas(kTrackTextureSize, kTrackTextureSize, true, true);

const kStartPosDistanceFromStartLine = 12 as const;
const kStartPosDistance = 24 as const;

const workTrackPoints: { [k: number]: TrackPointProjection } = {};

const trackSampleTrackSegment = (
  segment: SplineSegment,
  t0: number, t1: number,
  tan0: Vec2, tan1: Vec2,
  depth: number,
  samples: ({ pos: Vec2, normal: Vec2, width: number } | null)[],
) => {
  if (depth > 8) return;

  const tMid = 0.5 * (t0 + t1);
  const tanMid = vec2Normalize(splineCalculateSegmentTangent(segment, tMid, vec2New()));

  trackSampleTrackSegment(segment, t0, tMid, tan0, tanMid, depth + 1, samples);
  samples.push({
    pos: vec2NewCopy(splineCalculateSegmentPoint(segment, tMid, vec2New())),
    normal: vec2New(-tanMid.y, tanMid.x),
    width: mathLerp(segment.w0, segment.w1, tMid),
  });
  trackSampleTrackSegment(segment, tMid, t1, tanMid, tan1, depth + 1, samples);
}

const trackGetDistanceSqrAt = (segment: SplineSegment, t: number, pos: Vec2) => {
  const point = splineCalculateSegmentPoint(segment, t, vec2New());
  const diff = vec2Sub(vec2NewCopy(pos), point);
  return vec2LengthSqr(diff);
}

const trackCalculateSpline = (self: Track, trackData: TrackData)  => {
  const segments = self.mSegments;
  segments.length = 0;
  
  const mainPath = trackData.mainPath;
  splineCalculateCatmullRom(
    [ mainPath[mainPath.length - 1], ...mainPath, mainPath[0], mainPath[1] ],
    trackData.alpha,
    segments
  );

  const secondaryPaths = self.mSecondaryPaths;
  const secondaryPathsData = trackData.secondaryPaths;

  secondaryPaths.length = 0;
  for (const path of secondaryPathsData) {
    const segments: SplineSegment[] = [];
    const branchOffPath = (path.branchOffPath.path === -1)
      ? mainPath
      : secondaryPathsData[path.branchOffPath.path].path;
    const branchInPath = (path.branchInPath.path === -1)
      ? mainPath
      : secondaryPathsData[path.branchInPath.path].path;

    splineCalculateCatmullRom(
      [
        branchOffPath[
          (path.branchOffPath.point > 0) ? path.branchOffPath.point - 1 : branchOffPath.length - 1
        ],
        branchOffPath[path.branchOffPath.point],
        ...path.path,
        branchInPath[path.branchInPath.point],
        branchInPath[(path.branchInPath.point + 1) % branchInPath.length]
      ],
      trackData.alpha,
      segments
    )

    secondaryPaths.push({
      segments,
      depthChanges: path.depthChanges,
      branchOffPath: path.branchOffPath,
      branchInPath: path.branchInPath
    });
  }
}

export const trackNew = (): Track => ({
  mSegments: [],
  mSecondaryPaths: [],
});

export const trackWrapSegmentIndex = (segmentIdx: number, segmentCount: number) => (segmentCount <= 0) ? 0 : mathMod(segmentIdx, segmentCount);

export const trackGetTrackWidthAt = (self: Track, pathIdx: number, segmentIdx: number, t: number) => {
  const segments = (pathIdx === -1)
    ? self.mSegments
    : self.mSecondaryPaths[pathIdx]?.segments;
  const segmentLen = segments?.length ?? 0;
  
  if (segmentLen === 0) return 0;
  const segment = segments[trackWrapSegmentIndex(segmentIdx, segments.length)];
  return mathLerp(segment.w0, segment.w1, t);
};

export const trackLoadData = (self: Track, data: TrackRawData) => {
  const mainPath: SplinePoint[] = [];
  for (let i = 0; i < data.mMainPath.length; i += 3) {
    mainPath.push({
      x: data.mMainPath[i] * 10,
      y: data.mMainPath[i + 1] * 10,
      tension: 0,
      width: data.mMainPath[i + 2] * 10,
    });
  }
  
  const secondaryPaths: SecondaryPathData[] = [];
  for (const pathData of data.mSecondaryPaths ?? []) {
    const path: SplinePoint[] = [];
    for (let i = 4; i < pathData.mData.length; i += 3) {
      path.push({
        x: pathData.mData[i] * 10,
        y: pathData.mData[i + 1] * 10,
        tension: 0,
        width: pathData.mData[i + 2] * 10,
      });
    }
    secondaryPaths.push({
      branchInPath: {
        path: pathData.mData[0],
        point: pathData.mData[1],
      },
      branchOffPath: {
        path: pathData.mData[2],
        point: pathData.mData[3],
      },
      path: path,
      depthChanges: pathData.mDepthChanges,
    });
  }

  trackCalculateSpline(self, {
    mainPath: mainPath,
    secondaryPaths: secondaryPaths,
    alpha: 0.8,
  });
}

export const trackDrawTexture = (self: Track) => {
  let segments: SplineSegment[];

  if (self.mSecondaryPaths.length > 0) {
    const segmentMap: { [depth: number]: SplineSegment[] } = {};

    for (const path of self.mSecondaryPaths) {
      let depth = 0;

      for (let segmentIdx = 0; segmentIdx < path.segments.length; ++segmentIdx) {
        depth = ~~(path.depthChanges[segmentIdx] ?? depth);
        (segmentMap[depth] ??= []).push(path.segments[segmentIdx]);
      }
    }
    (segmentMap[0] ??= []).push(...self.mSegments);

    const depths = Object.keys(segmentMap).sort((a, b) => +a - +b);
    segments = [];
    for (const d of depths){
      segments.push(...segmentMap[+d]);
    }
  } else {
    segments = self.mSegments;
  }

  const samples: ({ pos: Vec2, normal: Vec2, width: number } | null)[] = [];
  const segLen = segments.length;
  for (let i = 0; i < segLen; ++i) {
    const cur = segments[i];
    const tan0 = vec2Normalize(vec2NewCopy(cur.c));
    const tan1 = vec2Normalize(splineCalculateSegmentTangent(cur, 1, vec2New()));

    samples.push({
      pos: vec2NewCopy(cur.d),
      normal: vec2New(-tan0.y, tan0.x),
      width: cur.w0
    });
    trackSampleTrackSegment(cur, 0, 1, tan0, tan1, 0, samples);
    samples.push({
      pos: vec2NewCopy(splineCalculateSegmentPoint(cur, 1, vec2New())),
      normal: vec2New(-tan1.y, tan1.x),
      width: cur.w1
    });

    samples.push(null);
  }

  const ctx = gTrackCtx;
  ctx.clearRect(0, 0, kTrackTextureSize, kTrackTextureSize);

  const samplesLen = samples.length;
  for (let i = 0; i < samplesLen; ++i) {
    const cur = samples[i];
    const next = samples[i + 1];

    if (!cur) continue;
    if (!next) { ++i; continue; }

    const curHalfWidth = cur.width * 0.5;
    const nextHalfWidth = next.width * 0.5;

    const curLeft: Vec2 = vec2Add(
      vec2MulScalar(vec2NewCopy(cur.normal), curHalfWidth),
      cur.pos
    );
    const curRight: Vec2 = vec2Add(
      vec2MulScalar(vec2NewCopy(cur.normal), -curHalfWidth),
      cur.pos
    );

    const nextLeft: Vec2 = vec2Add(
      vec2MulScalar(vec2NewCopy(next.normal), nextHalfWidth),
      next.pos
    );
    const nextRight: Vec2 = vec2Add(
      vec2MulScalar(vec2NewCopy(next.normal), -nextHalfWidth),
      next.pos
    );

    const midPos = vec2MulScalar(vec2Add(vec2NewCopy(cur.pos), next.pos), 0.5);
    const midNormal = vec2Normalize(
      vec2New(cur.pos.y - next.pos.y, next.pos.x - cur.pos.x)
    );
    const midHalfWidth = 0.25 * (cur.width + next.width);
    const gradLeft = vec2Add(vec2MulScalar(vec2NewCopy(midNormal), midHalfWidth), midPos);
    const gradRight = vec2Add(vec2MulScalar(vec2NewCopy(midNormal), -midHalfWidth), midPos);

    const gradient = ctxGetRainbowGradient(gradLeft.x, gradLeft.y, gradRight.x, gradRight.y, '8', ctx);

    ctxSetFillStyle(gradient, ctx);
    ctx.strokeStyle = gradient;
    ctxBeginPath(ctx);
    ctxMoveTo(curLeft.x, curLeft.y, ctx);
    ctxLineTo(nextLeft.x, nextLeft.y, ctx);
    ctxLineTo(nextRight.x, nextRight.y, ctx);
    ctxLineTo(curRight.x, curRight.y, ctx);
    ctxClosePathAndFill(ctx);
    ctx.stroke();
  }

  const start = self.mSegments[0];
  if (!start) return ctxGetCanvasImageData(kTrackTextureSize, kTrackTextureSize, gTrackCtx).mPixels;

  const startPos = start.d;
  const startTan = vec2Normalize(vec2NewCopy(start.c));
  const startNormal = vec2New(-startTan.y, startTan.x);

  const halfSpan = start.w0 * 0.55;
  const halfThickness = start.w0 * 0.06;
  const tileCols = start.w0 * 0.3;
  const tileRows = 3;
  const tileSpan = (2 * halfSpan) / tileCols;
  const rowSpan = (2 * halfThickness) / tileRows;

  for (let y = 0; y < tileRows; ++y) {
    const t0 = -halfThickness + y * rowSpan;
    const t1 = t0 + rowSpan;
    for (let x = 0; x < tileCols; ++x) {
      const n0 = -halfSpan + x * tileSpan;
      const n1 = n0 + tileSpan;

      const p0 = vec2Add(
        vec2Add(vec2MulScalar(vec2NewCopy(startNormal), n0), startPos),
        vec2MulScalar(vec2NewCopy(startTan), t0)
      );
      const p1 = vec2Add(
        vec2Add(vec2MulScalar(vec2NewCopy(startNormal), n1), startPos),
        vec2MulScalar(vec2NewCopy(startTan), t0)
      );
      const p2 = vec2Add(
        vec2Add(vec2MulScalar(vec2NewCopy(startNormal), n1), startPos),
        vec2MulScalar(vec2NewCopy(startTan), t1)
      );
      const p3 = vec2Add(
        vec2Add(vec2MulScalar(vec2NewCopy(startNormal), n0), startPos),
        vec2MulScalar(vec2NewCopy(startTan), t1)
      );

      ctx.fillStyle = ((x + y) & 1) ? '#000' : '#fff';
      ctxBeginPath(ctx);
      ctxMoveTo(p0.x, p0.y, ctx);
      ctxLineTo(p1.x, p1.y, ctx);
      ctxLineTo(p2.x, p2.y, ctx);
      ctxLineTo(p3.x, p3.y, ctx);
      ctxClosePathAndFill(ctx);
    }
  }

  return ctxGetCanvasImageData(kTrackTextureSize, kTrackTextureSize, gTrackCtx).mPixels;
}

export const trackGetStartPositions = (self: Track, rows: number): TrackPointProjection[] => {
  const positions: TrackPointProjection[] = [];
  const start = self.mSegments[0];
  if (!start) return positions;

  const segments = self.mSegments;
  const segmentCount = segments.length;
  if (segmentCount === 0) return positions;

  const estimateArcLength = (
    segment: SplineSegment,
    t0: number,
    t1: number,
    samples = 12,
    targetDistance = Infinity,
  ) => {
    if (t1 === t0) return 0;

    let length = 0;
    let prev = splineCalculateSegmentPoint(segment, t0, vec2New());
    for (let i = 1; i <= samples; ++i) {
      const t = mathLerp(t0, t1, i / samples);
      const cur = splineCalculateSegmentPoint(segment, t, vec2New());
      
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      length += mathSqrt(dx * dx + dy * dy);

      if (length >= targetDistance) return targetDistance;

      prev = cur;
    }
    return length;
  };

  const moveBackward = (fromSegmentIdx: number, fromT: number, distance: number) => {
    const eps = 1e-4;
    let segmentIdx = trackWrapSegmentIndex(fromSegmentIdx, segmentCount);
    let t = fromT;
    let remaining = distance;
    let guard = 0;

    while (remaining > 0 && guard < segmentCount * 4) {
      ++guard;

      if (t <= eps) {
        segmentIdx = trackWrapSegmentIndex(segmentIdx - 1, segmentCount);
        t = 1;
      }

      const segment = segments[segmentIdx];
      const available = estimateArcLength(segment, t, 0, 12, remaining + eps);

      if (available + eps >= remaining) {
        const tCurrent = t;
        const targetFromEnd = mathMax(0, remaining);
        let left = 0;
        let right = tCurrent;

        for (let i = 0; i < 16; ++i) {
          const mid = 0.5 * (left + right);
          const length = estimateArcLength(segment, tCurrent, mid, 10);
          if (length > targetFromEnd) {
            left = mid;
          } else {
            right = mid;
          }
        }

        t = 0.5 * (left + right);
        remaining = 0;
        break;
      }

      remaining -= available;
      segmentIdx = trackWrapSegmentIndex(segmentIdx - 1, segmentCount);
      t = 1;
    }

    const segment = segments[segmentIdx];
    const pos = splineCalculateSegmentPoint(segment, t, vec2New());
    const tangent = vec2Normalize(splineCalculateSegmentTangent(segment, t, vec2New()));
    const width = trackGetTrackWidthAt(self, -1, segmentIdx, t);

    return { segmentIdx, t, pos, tangent, width };
  };

  let segmentIdx = 0;
  let t = 0;
  for (let i = 0; i < rows; ++i) {
    const sample = moveBackward(segmentIdx, t, kStartPosDistance + kStartPosDistanceFromStartLine);
    positions.push({
      mPathIdx: -1,
      mSegmentIdx: sample.segmentIdx,
      t: sample.t,
      mPos: sample.pos,
      mTangent: sample.tangent,
      mWidth: sample.width,
      mInside: true,
      mDistSqr: vec2LengthSqr(sample.pos),
    });

    segmentIdx = sample.segmentIdx;
    t = sample.t;
  }

  return positions;
}

export const trackCopyTrackPoint = (trackPointTo: TrackPointProjection, trackPointFrom: TrackPointProjection) => {
  trackPointTo.mPathIdx = trackPointFrom.mPathIdx;
  trackPointTo.mSegmentIdx = trackPointFrom.mSegmentIdx;
  trackPointTo.t = trackPointFrom.t;
  vec2Copy(trackPointTo.mPos, trackPointFrom.mPos);
  vec2Copy(trackPointTo.mTangent, trackPointFrom.mTangent);
  trackPointTo.mWidth = trackPointFrom.mWidth;
  trackPointTo.mInside = trackPointFrom.mInside;
  trackPointTo.mDistSqr = trackPointFrom.mDistSqr;
};

/**
 * **inMode**: -1 = main path only, 0 = all paths, 1 = secondary paths only
 */
export const trackFindPointInTrack = (
  self: Track, pos: Vec2, mainPathHintSegment: number,
  mode: -1 | 0 | 1, trackPoints: { [pathIdx: number]: TrackPointProjection }
) => {
  let workSegmentKey = 0;
  const projectPointToSegment = (segments: SplineSegment[], segmentIdx: number) => {
    const segment = segments[segmentIdx];
    const kSamples = 12;
    let bestT = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i <= kSamples; ++i) {
      const t = i / kSamples;
      const distSq = trackGetDistanceSqrAt(segment, t, pos);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestT = t;
      }
    }

    const coarseStep = 1 / kSamples;
    let left = (bestT > coarseStep) ? bestT - coarseStep : 0;
    let right = (bestT < 1 - coarseStep) ? bestT + coarseStep : 1;

    for (let i = 0; i < 32; ++i) {
      const t1 = (2 * left + right) / 3;
      const t2 = (left + 2 * right) / 3;

      const dist1 = trackGetDistanceSqrAt(segment, t1, pos);
      const dist2 = trackGetDistanceSqrAt(segment, t2, pos);

      if (dist1 <= dist2) {
        right = t2;
      } else {
        left = t1;
      }
    }

    const t = 0.5 * (left + right);
    const trackPoint = workTrackPoints[workSegmentKey] || (workTrackPoints[workSegmentKey] = { mPos: vec2New(), mTangent: vec2New() } as TrackPointProjection);

    trackPoint.mPathIdx = -1;
    trackPoint.mSegmentIdx = segmentIdx;
    trackPoint.t = t;
    splineCalculateSegmentPoint(segment, t, trackPoint.mPos);
    vec2Normalize(splineCalculateSegmentTangent(segment, t, trackPoint.mTangent));
    trackPoint.mWidth = mathLerp(segment.w0, segment.w1, t);

    const tangent = trackPoint.mTangent;
    const normal = vec2New(-tangent.y, tangent.x);
    const toPos = vec2Sub(vec2NewCopy(pos), trackPoint.mPos);
    const signedOffset = vec2Dot(toPos, normal);

    trackPoint.mInside = mathAbs(signedOffset) <= (0.5 * trackPoint.mWidth) + 3;
    trackPoint.mDistSqr = vec2Dot(toPos, toPos);
    
    return trackPoint;
  };
  const calcuateBestProjection = (segments: SplineSegment[], minSegmentIdx: number, maxSegmentIdx: number) => {
    let bestDistSq = Infinity;
    let bestProjection = null;

    for (let i = minSegmentIdx; i <= maxSegmentIdx; ++i) {
      const res = projectPointToSegment(segments, trackWrapSegmentIndex(i, segments.length));
      if (res.mDistSqr < bestDistSq) {
        bestDistSq = res.mDistSqr;
        bestProjection = res;
        workSegmentKey ^= 1;
      }
    }

    return bestProjection as TrackPointProjection;
  }
  const findClosestOnPath = (segments: SplineSegment[], hintSegment: number, trackPointIdx: number) => {
    const segmentLen = segments.length;
    let bestProjection = null as TrackPointProjection | null;

    if (segmentLen > 5 && hintSegment >= 0 && hintSegment < segmentLen) {
      // Try the hinted segment only -- fast mode
      const minSegmentIdx = hintSegment - 2;
      const maxSegmentIdx = hintSegment + 2;
      
      bestProjection = calcuateBestProjection(segments, minSegmentIdx, maxSegmentIdx);
    } else {
      // Check all segments
      bestProjection = calcuateBestProjection(segments, 0, segments.length - 1);
    }

    trackCopyTrackPoint(
      trackPoints[trackPointIdx] || (trackPoints[trackPointIdx] = { mPos: vec2New(), mTangent: vec2New() } as TrackPointProjection),
      bestProjection
    );
    trackPoints[trackPointIdx].mPathIdx = trackPointIdx;
  };

  if (mode !== 1) {
    findClosestOnPath(self.mSegments, mainPathHintSegment, -1);
  }

  if (mode !== -1) {
    const pathCount = self.mSecondaryPaths.length;
    for (let pathIdx = 0; pathIdx < pathCount; ++pathIdx) {
      findClosestOnPath(self.mSecondaryPaths[pathIdx].segments, -1, pathIdx);
    }
  }
};
