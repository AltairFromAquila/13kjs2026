import type { TrackRawData } from "../data/track.data";
import { splineCalculateCatmullRom, splineCalculateSegmentPoint, splineCalculateSegmentTangent, mathLerp, mathJs, vec2Add, vec2Dot, vec2MulScalar, vec2New, vec2NewCopy, vec2Normalize, vec2Sub, type SplinePoint, type SplineSegment, type Vec2, mathMod, vec2Copy } from "../math";

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

export interface TrackFindPointResult {
  projection: TrackPointProjection;
  mainPathProjection: TrackPointProjection | null;
}

export class Track {
  segments: SplineSegment[] = [];
  secondaryPaths: SecondaryPath[] = [];

  textureCanvas: OffscreenCanvas = new OffscreenCanvas(2048 * 2, 2048 * 2);
  textureCtx: OffscreenRenderingContext = this.textureCanvas.getContext('2d', { willReadFrequently: true })!;
}

const kStartPosDistanceFromStartLine = 12 as const;
const kStartPosDistance = 24 as const;

const workTrackPoints: { [k: number]: TrackPointProjection } = {};

export function trackLoadData(self: Track, data: TrackRawData) {
  const mainPath: SplinePoint[] = [];
  for (let i = 0; i < data.mainPath.length; i += 3) {
    mainPath.push({
      x: data.mainPath[i],
      y: data.mainPath[i + 1],
      tension: 0,
      width: data.mainPath[i + 2],
    });
  }
  
  const secondaryPaths: SecondaryPathData[] = [];
  for (const pathData of data.secondaryPaths ?? []) {
    const path: SplinePoint[] = [];
    for (let i = 4; i < pathData.data.length; i += 3) {
      path.push({
        x: pathData.data[i],
        y: pathData.data[i + 1],
        tension: 0,
        width: pathData.data[i + 2],
      });
    }
    secondaryPaths.push({
      branchInPath: {
        path: pathData.data[0],
        point: pathData.data[1],
      },
      branchOffPath: {
        path: pathData.data[2],
        point: pathData.data[3],
      },
      path: path,
      depthChanges: pathData.depthChanges,
    });
  }

  trackCalculateSpline(self, {
    mainPath: mainPath,
    secondaryPaths: secondaryPaths,
    alpha: 0.8,
  });
}

export function trackCalculateSpline(self: Track, trackData: TrackData) {
  const segments = self.segments;
  segments.length = 0;
  
  const mainPath = trackData.mainPath;
  splineCalculateCatmullRom(
    [ mainPath[mainPath.length - 1], ...mainPath, mainPath[0], mainPath[1] ],
    trackData.alpha,
    segments
  );

  const secondaryPaths = self.secondaryPaths;
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
      depthChanges: path.depthChanges
    });
  }
}

export function trackDrawTexture(self: Track) {
  let segments: SplineSegment[];

  if (self.secondaryPaths.length > 0) {
    const segmentMap: { [depth: number]: SplineSegment[] } = {};

    for (const path of self.secondaryPaths) {
      let depth = 0;

      for (let segmentIdx = 0; segmentIdx < path.segments.length; ++segmentIdx) {
        depth = ~~(path.depthChanges[segmentIdx] ?? depth);
        (segmentMap[depth] ??= []).push(path.segments[segmentIdx]);
      }
    }
    (segmentMap[0] ??= []).push(...self.segments);

    const depths = Object.keys(segmentMap).sort((a, b) => +a - +b);
    segments = [];
    for (const d of depths){
      segments.push(...segmentMap[+d]);
    }
  } else {
    segments = self.segments;
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
    sampleTrackSegment(cur, 0, 1, tan0, tan1, 0, samples);
    samples.push({
      pos: vec2NewCopy(splineCalculateSegmentPoint(cur, 1, vec2New())),
      normal: vec2New(-tan1.y, tan1.x),
      width: cur.w1
    });

    samples.push(null);
  }

  const ctx = self.textureCtx as OffscreenCanvasRenderingContext2D;
  const { width: canvasWidth, height: canvasHeight } = self.textureCanvas;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  // ctx.imageSmoothingEnabled = false;

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

    const gradient = ctx.createLinearGradient(gradLeft.x, gradLeft.y, gradRight.x, gradRight.y);
    gradient.addColorStop(0.00, "#f008");
    gradient.addColorStop(0.17, "#f808");
    gradient.addColorStop(0.33, "#ff08");
    gradient.addColorStop(0.50, "#0f08");
    gradient.addColorStop(0.67, "#00f8");
    gradient.addColorStop(0.83, "#4088");
    gradient.addColorStop(1.00, "#80f8");

    ctx.fillStyle = gradient;
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(curLeft.x, curLeft.y);
    ctx.lineTo(nextLeft.x, nextLeft.y);
    ctx.lineTo(nextRight.x, nextRight.y);
    ctx.lineTo(curRight.x, curRight.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const start = self.segments[0];
  if (!start) return;

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

      ctx.fillStyle = ((x + y) & 1) ? "#000" : "#fff";
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export const trackGetStartPositions = (self: Track): TrackPointProjection[] => {
  const positions: TrackPointProjection[] = [];
  const start = self.segments[0];
  if (!start) return positions;

  const segments = self.segments;
  const segmentCount = segments.length;
  if (segmentCount === 0) return positions;

  const estimateArcLength = (
    inSegment: SplineSegment,
    inT0: number,
    inT1: number,
    inSamples = 12,
    inTargetDistance = Infinity,
  ) => {
    if (inT1 === inT0) return 0;

    let length = 0;
    let prev = splineCalculateSegmentPoint(inSegment, inT0, vec2New());
    for (let i = 1; i <= inSamples; ++i) {
      const t = mathLerp(inT0, inT1, i / inSamples);
      const cur = splineCalculateSegmentPoint(inSegment, t, vec2New());
      
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      length += mathJs.sqrt(dx * dx + dy * dy);

      if (length >= inTargetDistance) return inTargetDistance;

      prev = cur;
    }
    return length;
  };

  const moveBackward = (inFromSegmentIdx: number, inFromT: number, inDistance: number) => {
    const eps = 1e-4;
    let segmentIdx = wrapSegmentIndex(inFromSegmentIdx, segmentCount);
    let t = inFromT;
    let remaining = inDistance;
    let guard = 0;

    while (remaining > 0 && guard < segmentCount * 4) {
      ++guard;

      if (t <= eps) {
        segmentIdx = wrapSegmentIndex(segmentIdx - 1, segmentCount);
        t = 1;
      }

      const segment = segments[segmentIdx];
      const available = estimateArcLength(segment, t, 0, 12, remaining + eps);

      if (available + eps >= remaining) {
        const tCurrent = t;
        const targetFromEnd = mathJs.max(0, remaining);
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
      segmentIdx = wrapSegmentIndex(segmentIdx - 1, segmentCount);
      t = 1;
    }

    const segment = segments[segmentIdx];
    const pos = splineCalculateSegmentPoint(segment, t, vec2New());
    const tangent = vec2Normalize(splineCalculateSegmentTangent(segment, t, vec2New()));

    return { segmentIdx, t, pos, tangent };
  };

  let segmentIdx = 0;
  let t = 0;
  for (let i = 0; i < 2; ++i) {
    const sample = moveBackward(segmentIdx, t, kStartPosDistance + kStartPosDistanceFromStartLine);
    positions.push({
      mPathIdx: -1,
      mSegmentIdx: sample.segmentIdx,
      t: sample.t,
      mPos: sample.pos,
      mTangent: sample.tangent,
      mWidth: segments[sample.segmentIdx].w0,
      mInside: true,
      mDistSqr: vec2Dot(sample.pos, sample.pos),
    });

    segmentIdx = sample.segmentIdx;
    t = sample.t;
  }

  return positions;
}

export const trackCopyTrackPoint = (inTrackPointTo: TrackPointProjection, inTrackPointFrom: TrackPointProjection) => {
  inTrackPointTo.mPathIdx = inTrackPointFrom.mPathIdx;
  inTrackPointTo.mSegmentIdx = inTrackPointFrom.mSegmentIdx;
  inTrackPointTo.t = inTrackPointFrom.t;
  vec2Copy(inTrackPointTo.mPos, inTrackPointFrom.mPos);
  vec2Copy(inTrackPointTo.mTangent, inTrackPointFrom.mTangent);
  inTrackPointTo.mWidth = inTrackPointFrom.mWidth;
  inTrackPointTo.mInside = inTrackPointFrom.mInside;
  inTrackPointTo.mDistSqr = inTrackPointFrom.mDistSqr;
};

/**
 * **inMode**: -1 = main path only, 0 = all paths, 1 = secondary paths only
 */
export const trackFindPointInTrack = (
  self: Track, inPos: Vec2, inMainPathHintSegment: number,
  inMode: -1 | 0 | 1, inTrackPoints: { [pathIdx: number]: TrackPointProjection }
) => {
  let workSegmentKey = 0;
  const projectPointToSegment = (inSegments: SplineSegment[], inSegmentIdx: number) => {
    const segment = inSegments[inSegmentIdx];
    const kSamples = 8;
    let bestT = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i <= kSamples; ++i) {
      const t = i / kSamples;
      const distSq = getDistanceSqrAt(segment, t, inPos);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestT = t;
      }
    }

    const coarseStep = 1 / kSamples;
    let left = (bestT > coarseStep) ? bestT - coarseStep : 0;
    let right = (bestT < 1 - coarseStep) ? bestT + coarseStep : 1;

    for (let i = 0; i < 14; ++i) {
      const t1 = (2 * left + right) / 3;
      const t2 = (left + 2 * right) / 3;

      const dist1 = getDistanceSqrAt(segment, t1, inPos);
      const dist2 = getDistanceSqrAt(segment, t2, inPos);

      if (dist1 <= dist2) {
        right = t2;
      } else {
        left = t1;
      }
    }

    const t = 0.5 * (left + right);
    const trackPoint = workTrackPoints[workSegmentKey] || (workTrackPoints[workSegmentKey] = { mPos: vec2New(), mTangent: vec2New() } as TrackPointProjection);

    trackPoint.mPathIdx = -1;
    trackPoint.mSegmentIdx = inSegmentIdx;
    trackPoint.t = t;
    splineCalculateSegmentPoint(segment, t, trackPoint.mPos);
    vec2Normalize(splineCalculateSegmentTangent(segment, t, trackPoint.mTangent));
    trackPoint.mWidth = mathLerp(segment.w0, segment.w1, t);

    const tangent = trackPoint.mTangent;
    const normal = vec2New(-tangent.y, tangent.x);
    const toPos = vec2Sub(vec2NewCopy(inPos), trackPoint.mPos);
    const signedOffset = vec2Dot(toPos, normal);

    trackPoint.mInside = mathJs.abs(signedOffset) <= 0.5 * trackPoint.mWidth;
    trackPoint.mDistSqr = vec2Dot(toPos, toPos);
    
    return trackPoint;
  };
  const calcuateBestProjection = (inSegments: SplineSegment[], minSegmentIdx: number, maxSegmentIdx: number) => {
    let bestDistSq = Infinity;
    let bestProjection = null;

    for (let i = minSegmentIdx; i <= maxSegmentIdx; ++i) {
      const res = projectPointToSegment(inSegments, wrapSegmentIndex(i, inSegments.length));
      if (res.mDistSqr < bestDistSq) {
        bestDistSq = res.mDistSqr;
        bestProjection = res;
        workSegmentKey ^= 1;
      }
    }

    return bestProjection as TrackPointProjection;
  }
  const findClosestOnPath = (inSegments: SplineSegment[], inHintSegment: number, inTrackPointIdx: number) => {
    const segmentLen = inSegments.length;
    let bestProjection = null as TrackPointProjection | null;

    if (segmentLen > 5 && inHintSegment >= 0 && inHintSegment < segmentLen) {
      // Try the hinted segment only -- fast mode
      const minSegmentIdx = inHintSegment - 2;
      const maxSegmentIdx = inHintSegment + 2;
      
      bestProjection = calcuateBestProjection(inSegments, minSegmentIdx, maxSegmentIdx);
    } else {
      // Check all segments
      bestProjection = calcuateBestProjection(inSegments, 0, inSegments.length - 1);
    }

    trackCopyTrackPoint(
      inTrackPoints[inTrackPointIdx] || (inTrackPoints[inTrackPointIdx] = { mPos: vec2New(), mTangent: vec2New() } as TrackPointProjection),
      bestProjection
    );
    inTrackPoints[inTrackPointIdx].mPathIdx = inTrackPointIdx;
  };

  if (inMode !== 1) {
    if (!inTrackPoints[-1]) {
      inTrackPoints[-1] = {} as TrackPointProjection;
    }
    findClosestOnPath(self.segments, inMainPathHintSegment, -1);
  }

  if (inMode !== -1) {
    const pathCount = self.secondaryPaths.length;
    for (let pathIdx = 0; pathIdx < pathCount; ++pathIdx) {
      if (!inTrackPoints[pathIdx]) {
        inTrackPoints[pathIdx] = {} as TrackPointProjection;
      }
      findClosestOnPath(self.secondaryPaths[pathIdx].segments, -1, pathIdx);
    }
  }
};

export function trackFindPoint(self: Track, pos: Vec2, pathIdx: number, segmentIdx: number, forceMainPath = false, fast = false): TrackFindPointResult | null {
  const pathCount = self.secondaryPaths.length;
  const validPathIdx = (pathIdx >= 0 && pathIdx < pathCount) ? pathIdx : -1;

  const mainProjection = findClosestOnPath(self, -1, pos, (validPathIdx === -1) ? segmentIdx : 0, fast);
  if (!mainProjection) return null;

  if (forceMainPath) {
    return {
      projection: mainProjection,
      mainPathProjection: mainProjection,
    };
  }

  let bestProjection = mainProjection;

  const preferredPath = validPathIdx === -1
    ? mainProjection
    : findClosestOnPath(self, validPathIdx, pos, segmentIdx, fast);

  if (preferredPath && preferredPath.mDistSqr < bestProjection.mDistSqr) {
    bestProjection = preferredPath;
  }

  for (let secondaryIdx = 0; secondaryIdx < pathCount; ++secondaryIdx) {
    if (secondaryIdx === validPathIdx) continue;

    const projection = findClosestOnPath(self, secondaryIdx, pos, segmentIdx, fast);
    if (projection && projection.mDistSqr < bestProjection.mDistSqr) {
      bestProjection = projection;
    }
  }

  return {
    projection: bestProjection,
    mainPathProjection: (bestProjection.mPathIdx === -1) ? null : mainProjection,
  };
}

function sampleTrackSegment(
  segment: SplineSegment,
  t0: number, t1: number,
  tan0: Vec2, tan1: Vec2,
  depth: number,
  samples: ({ pos: Vec2, normal: Vec2, width: number } | null)[],
) {
  if (depth > 8) return;

  const tMid = 0.5 * (t0 + t1);
  const tanMid = vec2Normalize(splineCalculateSegmentTangent(segment, tMid, vec2New()));

  sampleTrackSegment(segment, t0, tMid, tan0, tanMid, depth + 1, samples);
  samples.push({
    pos: vec2NewCopy(splineCalculateSegmentPoint(segment, tMid, vec2New())),
    normal: vec2New(-tanMid.y, tanMid.x),
    width: mathLerp(segment.w0, segment.w1, tMid),
  });
  sampleTrackSegment(segment, tMid, t1, tanMid, tan1, depth + 1, samples);
}

function wrapSegmentIndex(segmentIdx: number, segmentCount: number) {
  if (segmentCount <= 0) return 0;
  return mathMod(segmentIdx, segmentCount);
}

function getDistanceSqrAt(segment: SplineSegment, t: number, pos: Vec2) {
  const point = splineCalculateSegmentPoint(segment, t, vec2New());
  const diff = vec2Sub(vec2NewCopy(pos), point);
  return vec2Dot(diff, diff);
}

function projectPointToSegment(pathIdx: number, segmentIdx: number, segment: SplineSegment, pos: Vec2): (TrackPointProjection) {
  const samples = 8;
  let bestT = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i <= samples; ++i) {
    const t = i / samples;
    const distSq = getDistanceSqrAt(segment, t, pos);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }

  const coarseStep = 1 / samples;
  let left = (bestT > coarseStep) ? bestT - coarseStep : 0;
  let right = (bestT < 1 - coarseStep) ? bestT + coarseStep : 1;

  for (let i = 0; i < 14; ++i) {
    const t1 = (2 * left + right) / 3;
    const t2 = (left + 2 * right) / 3;

    const dist1 = getDistanceSqrAt(segment, t1, pos);
    const dist2 = getDistanceSqrAt(segment, t2, pos);

    if (dist1 <= dist2) {
      right = t2;
    } else {
      left = t1;
    }
  }

  const t = 0.5 * (left + right);
  const point = splineCalculateSegmentPoint(segment, t, vec2New());
  const tangent = vec2Normalize(splineCalculateSegmentTangent(segment, t, vec2New()));
  const normal = vec2New(-tangent.y, tangent.x);
  const toPos = vec2Sub(vec2NewCopy(pos), point);
  const signedOffset = vec2Dot(toPos, normal);
  const width = mathLerp(segment.w0, segment.w1, t);
  const distSq = vec2Dot(toPos, toPos);

  return {
    mPathIdx: pathIdx,
    mSegmentIdx: segmentIdx,
    t,
    mPos: point,
    mTangent: tangent,
    mWidth: width,
    mInside: Math.abs(signedOffset) <= 0.5 * width,
    mDistSqr: distSq,
  };
}

function findClosestOnPath(self: Track, pathIdx: number, pos: Vec2, hintSegmentIdx: number, fast = false): (TrackPointProjection) | null {
  const segments = (pathIdx === -1)
    ? self.segments
    : self.secondaryPaths[pathIdx]?.segments;

  if (!segments || segments.length === 0) return null;

  const segmentCount = segments.length;
  const uniqueCandidates = new Set<number>();
  const candidateIndices: number[] = [];

  const hinted = [hintSegmentIdx - 2, hintSegmentIdx - 1, hintSegmentIdx, hintSegmentIdx + 1, hintSegmentIdx + 2];
  for (const idx of hinted) {
    const wrapped = wrapSegmentIndex(idx, segmentCount);
    if (!uniqueCandidates.has(wrapped)) {
      uniqueCandidates.add(wrapped);
      candidateIndices.push(wrapped);
    }
  }

  if (!fast) {
    for (let i = 0; i < segmentCount; ++i) {
      if (!uniqueCandidates.has(i)) {
        uniqueCandidates.add(i);
        candidateIndices.push(i);
      }
    }
  }

  let best: (TrackPointProjection) | null = null;
  for (const idx of candidateIndices) {
    const candidate = projectPointToSegment(pathIdx, idx, segments[idx], pos);
    if (!best || candidate.mDistSqr < best.mDistSqr) {
      best = candidate;
    }
  }

  return best;
}
