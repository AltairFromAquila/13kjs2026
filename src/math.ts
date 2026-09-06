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

export const kMathEpsilon = 1e-16;
export const kMathPi = mathJs.PI;
export const kMathHalfPi = mathJs.PI * 0.5;
export const kMathTau = mathJs.PI * 2;

export const mathSin = (x: number) => mathJs.sin(x);

export const mathCos = (x: number) => mathJs.cos(x);

export const mathTan = (x: number) => mathJs.tan(x);

export const mathMod = (a: number, b: number) => ((a % b) + b) % b;

export const mathClamp = (a: number, min: number, max: number) => (a < min) ? min : (a > max) ? max : a;

export const mathLerp = (a: number, b: number, ratio: number) => a + (b - a) * ratio;

export const mathSmoothstep = (x: number) => {
  const t = mathJs.max(0, mathJs.min(1, x));
  return t * t * (3 - (2 * t));
};

export const mathPingPong = (v: number, min: number, max: number) => {
  const low = min < max ? min : max;
  const high = min < max ? max : min;
  const length = high - low;

  if (length === 0) {
    return low;
  }

  const cycle = length * 2;
  const t = mathMod(v - low, cycle);

  return low + (t < length ? t : cycle - t);
};

export const vec2New = (x = 0, y = 0): Vec2 => ({ x, y });

export const vec2NewCopy = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });

export const vec2Copy = (self: Vec2, v: Vec2) => (
  self.x = v.x,
  self.y = v.y,
  self
);

export const vec2CopyFromTuple = (self: Vec2, v: [number, number]) => (
  self.x = v[0],
  self.y = v[1],
  self
);

export const vec2MulScalar = (v: Vec2, s: number) => (
  v.x *= s,
  v.y *= s,
  v
);

export const vec2DivScalar = (v: Vec2, s: number) => (
  v.x /= s,
  v.y /= s,
  v
);

export const vec2Add = (self: Vec2, v: Vec2) => (
  self.x += v.x,
  self.y += v.y,
  self
);

export const vec2Sub = (self: Vec2, v: Vec2) => (
  self.x -= v.x,
  self.y -= v.y,
  self
);

export const vec2Dot = (v1: Vec2, v2: Vec2) => v1.x * v2.x + v1.y * v2.y;

export const vec2LengthSqr = (v: Vec2) => vec2Dot(v, v);

export const vec2Length = (v: Vec2) => mathJs.sqrt(vec2Dot(v, v));

export const vec2Normalize = (self: Vec2) => {
  const len = vec2Length(self);

  if (len > kMathEpsilon) {
    self.x = self.x / len;
    self.y = self.y / len;
  } else {
    self.x = 0;
    self.y = 0;
  }

  return self;
};

export const vec2Angle = (v: Vec2) => mathJs.atan2(v.y, v.x);

export const vec2Rotate = (self: Vec2, angle: number) => {
  const cos = mathCos(angle);
  const sin = mathSin(angle);
  const x = self.x * cos - self.y * sin;
  const y = self.x * sin + self.y * cos;
  
  self.x = x;
  self.y = y;

  return self;
};

export const vec2DistanceSqr = (v1: Vec2, v2: Vec2) => {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  return dx * dx + dy * dy;
};

export const vec2Distance = (v1: Vec2, v2: Vec2) => mathJs.sqrt(vec2DistanceSqr(v1, v2));

export const vec2Lerp = (self: Vec2, v: Vec2, ratio: number) => (
  self.x = mathLerp(self.x, v.x, ratio),
  self.y = mathLerp(self.y, v.y, ratio),
  self
);

export const vec2ClampLength = (self: Vec2, minLength: number, maxLength: number) => {
  const len = vec2Length(self);

  if (len === 0) {
    return self;
  }

  if (len > maxLength) {
    vec2MulScalar(self, maxLength / len);
  } else if (len < minLength) {
    vec2MulScalar(self, minLength / len);
  }

  return self;
};

export const splineCalculateCatmullRom = (points: SplinePoint[], alpha: number, outSegments: SplineSegment[]) => {
  const len = points.length - 3;

  for (let idx = 0; idx < len; ++idx) {
    const p0 = points[idx];
    const p1 = points[idx + 1];
    const p2 = points[idx + 2];
    const p3 = points[idx + 3];
    const tension = p1.tension;
    const t01 = mathJs.max(mathJs.pow(vec2Distance(p0, p1), alpha), kMathEpsilon);
    const t12 = mathJs.max(mathJs.pow(vec2Distance(p1, p2), alpha), kMathEpsilon);
    const t23 = mathJs.max(mathJs.pow(vec2Distance(p2, p3), alpha), kMathEpsilon);

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

    outSegments.push({
      a,
      b,
      c: m1,
      d: vec2NewCopy(p1),
      w0: p1.width,
      w1: p2.width,
    });
  }

  return outSegments;
};

export const splineCalculateSegmentPoint = (
  segment: SplineSegment, t: number, outVec: Vec2
) => (t === 0)
  ? segment.d
  : vec2Add(
      vec2MulScalar(
        vec2Add(
          vec2MulScalar(
            vec2Add(
              vec2MulScalar(vec2Copy(outVec, segment.a), t),
              segment.b
            ),
            t
          ),
          segment.c
        ),
        t
      ),
      segment.d
    );

export const splineCalculateSegmentTangent = (
  segment: SplineSegment, t: number, outVec: Vec2
) => vec2Normalize(
  (t === 0)
    ? segment.c
    : vec2Add(
        vec2MulScalar(
          vec2Add(
            vec2MulScalar(vec2Copy(outVec, segment.a), 3 * t),
            vec2MulScalar(vec2NewCopy(segment.b), 2)
          ),
          t
        ),
        segment.c
      )
  );
