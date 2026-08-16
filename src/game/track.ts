import { calculateCatmullRomSpline, calculateSplineSegmentPoint, calculateSplineSegmentTangent, lerp, vec2Dot, vec2New, vec2NewCopy, vec2Normalize, type SplinePoint, type SplineSegment, type Vec2 } from "../math";

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

export class Track {
  segments: SplineSegment[] = [];
  secondaryPaths: SecondaryPath[] = [];

  textureCanvas: OffscreenCanvas = new OffscreenCanvas(2048, 2048);
  textureCtx: OffscreenRenderingContext = this.textureCanvas.getContext('2d')!;
}

export function trackCalculateSpline(self: Track, trackData: TrackData) {
  const segments = self.segments;
  segments.length = 0;
  
  const mainPath = trackData.mainPath;
  calculateCatmullRomSpline(
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

    calculateCatmullRomSpline(
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

  const samples: { pos: Vec2, normal: Vec2, width: number}[] = [];
  const segLen = segments.length;
  for (let i = 0; i < segLen; ++i) {
    const cur = segments[i];
    const tan0 = vec2Normalize(vec2NewCopy(cur.c));
    const tan1 = vec2Normalize(calculateSplineSegmentTangent(cur, 1, vec2New()));

    samples.push({
      pos: vec2NewCopy(cur.d),
      normal: vec2New(-tan0.y, tan0.x),
      width: cur.w0
    });
    sampleTrackSegment(cur, 0, 1, tan0, tan1, 0, samples);
    samples.push({
      pos: vec2NewCopy(calculateSplineSegmentPoint(cur, 1, vec2New())),
      normal: vec2New(-tan1.y, tan1.x),
      width: cur.w1
    });
  }

  // TODO: Draw texture from samples
}

const kCosThreshold = 0.985;
function sampleTrackSegment(
  segment: SplineSegment,
  t0: number, t1: number,
  tan0: Vec2, tan1: Vec2,
  depth: number,
  samples: { pos: Vec2, normal: Vec2, width: number}[],
) {
  if (depth > 5) return;

  if (vec2Dot(tan0, tan1) >= kCosThreshold) return;

  const tMid = 0.5 * (t0 + t1);
  const tanMid = vec2Normalize(calculateSplineSegmentTangent(segment, tMid, vec2New()));

  sampleTrackSegment(segment, t0, tMid, tan0, tanMid, depth + 1, samples);
  samples.push({
    pos: vec2NewCopy(calculateSplineSegmentPoint(segment, tMid, vec2New())),
    normal: vec2New(-tanMid.y, tanMid.x),
    width: lerp(segment.w0, segment.w1, tMid),
  });
  sampleTrackSegment(segment, tMid, t1, tanMid, tan1, depth + 1, samples);
}
