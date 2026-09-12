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

export const mathRandom = () => mathJs.random();

export const mathFloor = (x: number) => mathJs.floor(x);

export const mathCeil = (x: number) => mathJs.ceil(x);

export const mathMax = (a: number, b: number) => mathJs.max(a, b);

export const mathMin = (a: number, b: number) => mathJs.min(a, b);

export const mathAbs = (x: number) => mathJs.abs(x);

export const mathPow = (x: number, y: number) => mathJs.pow(x, y);

export const mathSqrt = (x: number) => mathJs.sqrt(x);

export const mathSin = (x: number) => mathJs.sin(x);

export const mathCos = (x: number) => mathJs.cos(x);

export const mathTan = (x: number) => mathJs.tan(x);

export const mathAtan2 = (y: number, x: number) => mathJs.atan2(y, x);

export const mathHypot = (x: number, y: number) => mathJs.hypot(x, y);

export const mathMod = (a: number, b: number) => ((a % b) + b) % b;

export const mathClamp = (a: number, min: number, max: number) => (a < min) ? min : (a > max) ? max : a;

export const mathLerp = (a: number, b: number, ratio: number) => a + (b - a) * ratio;

export const mathLerpAngle = (a: number, b: number, ratio: number) => {
  const delta = mathMod(b - a + kMathPi, kMathTau) - kMathPi;
  return a + delta * ratio;
};

export const mathSmoothstep = (x: number) => {
  const t = mathMax(0, mathMin(1, x));
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

export const numberToString = (n: number, padMaxLength: number) => `${n}`.padStart(padMaxLength, '0');

//#region Noise
// Based on https://github.com/jobtalle/CubicNoise

export const noiseBufferedCubicNoise = (width: number, height: number) => {
  const values = new Float32Array(width * height);

  for (let i = 0; i < values.length; ++i) {
    values[i] = Math.random();
  }

  return values;
}

export const noiseInterpolateCubicNoise = (a: number, b: number, c: number, d: number, x: number) => {
  const p = (d - c) - (a - b);
  return x * (x * (x * p + ((a - b) - p)) + (c - a)) + b;
}

export const noiseSampleCubicNoise = (x: number, y: number, values: Float32Array, width: number, height: number) => {
  const xi = x | 0;
  const yi = y | 0;
  const tx = x - xi;
  const ty = y - yi;

  const getValue = (sx: number, sy: number) => values[(mathMod(sy, height) * width) + mathMod(sx, width)];

  return noiseInterpolateCubicNoise(
    noiseInterpolateCubicNoise(
      getValue(xi, yi),
      getValue(xi + 1, yi),
      getValue(xi + 2, yi),
      getValue(xi + 3, yi),
      tx
    ),
    noiseInterpolateCubicNoise(
      getValue(xi, yi + 1),
      getValue(xi + 1, yi + 1),
      getValue(xi + 2, yi + 1),
      getValue(xi + 3, yi + 1),
      tx
    ),
    noiseInterpolateCubicNoise(
      getValue(xi, yi + 2),
      getValue(xi + 1, yi + 2),
      getValue(xi + 2, yi + 2),
      getValue(xi + 3, yi + 2),
      tx
    ),
    noiseInterpolateCubicNoise(
      getValue(xi, yi + 3),
      getValue(xi + 1, yi + 3),
      getValue(xi + 2, yi + 3),
      getValue(xi + 3, yi + 3),
      tx
    ),
    ty
  ) * 0.5 + 0.25;
}

export const noiseGenerateCubicNoisePlane = (
  pixels: Uint32Array, planeSize: number,
  baseNoiseSize: number, octaves: number, colorFunction: (fbm: number) => number
) => {
  const baseNoise = noiseBufferedCubicNoise(baseNoiseSize, baseNoiseSize);

  for (let y = 0; y < planeSize; ++y) {
    for (let x = 0; x < planeSize; ++x) {
      const u = x / planeSize;
      const v = y / planeSize;

      let frequency = 1;
      let amplitude = 1;
      let total = 0;
      let amplitudeSum = 0;

      for (let octave = 0; octave < octaves; ++octave) {
        const sampleX = u * baseNoiseSize * frequency;
        const sampleY = v * baseNoiseSize * frequency;
        total += noiseSampleCubicNoise(sampleX, sampleY, baseNoise, baseNoiseSize, baseNoiseSize) * amplitude;
        amplitudeSum += amplitude;

        frequency *= 2;
        amplitude *= 0.5;
      }

      const fbm = total / amplitudeSum;
      pixels[(y * planeSize) + x] = colorFunction(fbm);
    }
  }

  // Duplicate edge texels so linear filtering can cross borders without visible seams.
  const planeMask = planeSize - 1;
  for (let i = 0; i < planeSize; ++i) {
    pixels[(i * planeSize) + planeMask] = pixels[i * planeSize];
    pixels[(planeMask * planeSize) + i] = pixels[i];
  }
}

//#endregion

export const colorUnpack = (color: number) => ({
  r: color & 255,
  g: (color >> 8) & 255,
  b: (color >> 16) & 255,
  a: (color >> 24) & 255,
});

export const colorPack = (r: number, g: number, b: number, a: number) => ((a|0) << 24) | ((b|0) << 16) | ((g|0) << 8) | (r|0);

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

export const vec2Length = (v: Vec2) => mathSqrt(vec2Dot(v, v));

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

export const vec2Angle = (v: Vec2) => mathAtan2(v.y, v.x);

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

export const vec2Distance = (v1: Vec2, v2: Vec2) => mathSqrt(vec2DistanceSqr(v1, v2));

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
    const t01 = mathMax(mathPow(vec2Distance(p0, p1), alpha), kMathEpsilon);
    const t12 = mathMax(mathPow(vec2Distance(p1, p2), alpha), kMathEpsilon);
    const t23 = mathMax(mathPow(vec2Distance(p2, p3), alpha), kMathEpsilon);

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
  ? vec2Copy(outVec, segment.d)
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
    ? vec2Copy(outVec, segment.c)
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
