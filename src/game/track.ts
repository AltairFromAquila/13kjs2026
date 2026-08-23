import { calculateCatmullRomSpline, calculateSplineSegmentPoint, calculateSplineSegmentTangent, lerp, vec2Add, vec2Dot, vec2MulScalar, vec2New, vec2NewCopy, vec2Normalize, vec2Sub, type SplinePoint, type SplineSegment, type Vec2 } from "../math";

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

  textureCanvas: OffscreenCanvas = new OffscreenCanvas(2048 * 2, 2048 * 2);
  textureCtx: OffscreenRenderingContext = this.textureCanvas.getContext('2d', { willReadFrequently: true })!;
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

  const samples: ({ pos: Vec2, normal: Vec2, width: number } | null)[] = [];
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

function sampleTrackSegment(
  segment: SplineSegment,
  t0: number, t1: number,
  tan0: Vec2, tan1: Vec2,
  depth: number,
  samples: ({ pos: Vec2, normal: Vec2, width: number } | null)[],
) {
  if (depth > 8) return;

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
