export const mathJs = Math;

export interface Vec2 {
  x: number;
  y: number;
}

export interface SplinePoint extends Vec2 {
  tension: number;
  width: number;
}

export interface SplineSegment {
  a: Vec2;
  b: Vec2;
  c: Vec2;
  d: Vec2;
  w0: number;
  w1: number;
}

export function lerp(a: number, b: number, ratio: number) {
  return a + (b - a) * ratio;
}

export function vec2New(x = 0, y = 0) {
  return { x, y };
}

export function vec2NewCopy(v: Vec2) {
  return { x: v.x, y: v.y };
}

export function vec2Copy(self: Vec2, v: Vec2) {
  self.x = v.x;
  self.y = v.y;
  return self;
}

export function vec2MulScalar(v: Vec2, s: number) {
  v.x *= s;
  v.y *= s;
  return v;
}

export function vec2DivScalar(v: Vec2, s: number) {
  v.x /= s;
  v.y /= s;
  return v;
}

export function vec2Add(self: Vec2, v: Vec2) {
  self.x += v.x;
  self.y += v.y;
  return self;
}

export function vec2Sub(self: Vec2, v: Vec2) {
  self.x -= v.x;
  self.y -= v.y;
  return self;
}

export function vec2Dot(v1: Vec2, v2: Vec2) {
  return v1.x * v2.x + v1.y * v2.y;
}

export function vec2Normalize(self: Vec2) {
  const len = mathJs.sqrt(vec2Dot(self, self));

  if (len > 1e-16) {
    self.x = self.x / len;
    self.y = self.y / len;
  } else {
    self.x = 0;
    self.y = 0;
  }

  return self;
}

export function vec2Distance(v1: Vec2, v2: Vec2) {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  return mathJs.sqrt(dx * dx + dy * dy);
}

export function calculateCatmullRomSpline(points: SplinePoint[], alpha: number, out: SplineSegment[]) {
  const epsilon = 1e-16;
  const len = points.length - 3;

  for (let idx = 0; idx < len; ++idx) {
    const p0 = points[idx];
    const p1 = points[idx + 1];
    const p2 = points[idx + 2];
    const p3 = points[idx + 3];
    const tension = p1.tension;
    const t01 = mathJs.max(mathJs.pow(vec2Distance(p0, p1), alpha), epsilon);
    const t12 = mathJs.max(mathJs.pow(vec2Distance(p1, p2), alpha), epsilon);
    const t23 = mathJs.max(mathJs.pow(vec2Distance(p2, p3), alpha), epsilon);

    const dp10 = vec2Sub(vec2NewCopy(p1), p0);
    const dp20 = vec2Sub(vec2NewCopy(p2), p0);
    const dp21 = vec2Sub(vec2NewCopy(p2), p1);
    const dp32 = vec2Sub(vec2NewCopy(p3), p2);
    const dp31 = vec2Sub(vec2NewCopy(p3), p1);
    const p1MinusP2 = vec2Sub(vec2NewCopy(p1), p2);

    const oneMinusTension = 1 - tension;
    const m1 = vec2MulScalar(
      vec2Add(
        vec2MulScalar(
          vec2Sub(
            vec2DivScalar(vec2NewCopy(dp10), t01),
            vec2DivScalar(vec2NewCopy(dp20), t01 + t12)
          ),
          t12
        ),
        dp21
      ),
      oneMinusTension
    );
    const m2 = vec2MulScalar(
      vec2Add(
        vec2MulScalar(
          vec2Sub(
            vec2DivScalar(vec2NewCopy(dp32), t23),
            vec2DivScalar(vec2NewCopy(dp31), t12 + t23)
          ),
          t12
        ),
        dp21
      ),
      oneMinusTension
    );
    

    const a = vec2Add(
      vec2Add(
        vec2MulScalar(vec2NewCopy(p1MinusP2), 2),
        m1
      ),
      m2
    );
    const b = vec2Sub(
      vec2Sub(
        vec2Sub(
          vec2MulScalar(vec2NewCopy(p1MinusP2), -3),
          m1
        ),
        m1
      ),
      m2
    );

    out.push({
      a,
      b,
      c: m1,
      d: vec2NewCopy(p1),
      w0: p1.width,
      w1: p2.width,
    });
  }

  return out;
}

export function calculateSplineSegmentPoint(segment: SplineSegment, t: number, out: Vec2) {
  if (t === 0) return segment.d;

  return vec2Add(
    vec2MulScalar(
      vec2Add(
        vec2MulScalar(
          vec2Add(
            vec2MulScalar(vec2Copy(out, segment.a), t),
            segment.b
          ),
          t
        ),
        segment.c
      ),
      t
    ),
    segment.d
  )
}

export function calculateSplineSegmentTangent(segment: SplineSegment, t: number, out: Vec2) {
  if (t === 0) return segment.c;

  return vec2Add(
    vec2MulScalar(
      vec2Add(
        vec2MulScalar(vec2Copy(out, segment.a), 3 * t),
        vec2MulScalar(vec2NewCopy(segment.b), 2)
      ),
      t
    ),
    segment.c
  );
}
