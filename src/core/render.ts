import { easeInOutQuad, easeInOutSine, easeInQuad, easeInSine, easeOutQuad, easeOutSine } from "../easing";
import { cloudsGetPixels } from "../game/clouds";
import { racerRender } from "../game/racer";
import { kMathEpsilon, kMathHalfPi, kMathPi, kMathTau, mathClamp, mathCos, mathJs, mathMod, mathSin, mathTan, type Vec2, } from "../math";
import type { Camera } from "../core/camera";
import { kVerticalFov } from "../core/camera";
import { canvas, createOffscreenCanvas, ctx } from "../sys/context";

export interface Renderable {
  mPos: Vec2;
  mAngle: number;
}

export interface RenderableCommand<R extends Renderable> {
  mRenderables: R[];
  mScale: number;
  mCommand: (self: R, ctx: CanvasRenderingContext2D, x: number, y: number, invZ: number, angle: number, scale: number, alpha: number) => void;
}

interface SortedRenderable<R extends Renderable = Renderable> {
  mRenderable: R;
  mInvZ: number;
  mX: number;
  mY: number;
  mAngle: number;
  mScale: number;
  mAlpha: number;
}

const easingFunctions = [
  (x: number) => x,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad
];

const workSortedRenderables: SortedRenderable[] = [];

const kTau = mathJs.PI * 2;
let prevInputUpdateTime = performance.now();
let racerRotation = mathJs.PI * 0.25;
let animationTime = 0;

let cloudsWindOffsetX = 0;
let cloudsWindOffsetY = 0;

const kCloudsPlaneHeightOffset = 50;
const kCloudsWindSpeedX = 6;
const kCloudsWindSpeedY = -2;

const {
  offscreenCanvas: projectedPlaneCanvas,
  offscreenCtx: projectedPlaneCtx
} = createOffscreenCanvas(canvas.width, canvas.height, false, false);
// const projectedPlaneCanvas: OffscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
// const projectedPlaneCtx: OffscreenCanvasRenderingContext2D = projectedPlaneCanvas.getContext('2d')!;

export function render<R extends Renderable>(camera: Camera, a: any, renderableCmd: RenderableCommand<R>) {
  const now = performance.now();
  const deltaMs = now - prevInputUpdateTime;
  // racerRotation += (now - prevInputUpdateTime) * 0.001;
  animationTime = (animationTime + deltaMs * 0.0015) % 1.0;
  const deltaSec = deltaMs * 0.001;
  cloudsWindOffsetX += kCloudsWindSpeedX * deltaSec;
  cloudsWindOffsetY += kCloudsWindSpeedY * deltaSec;
  prevInputUpdateTime = now;

  renderProjectedPlane(camera, a);

  const rotationOff = (mathJs.PI * 0.5) - racerRotation;
  if (rotationOff < 0) {
    racerRotation = -((mathJs.PI * 0.5) + rotationOff);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(projectedPlaneCanvas, 0, 0);
  // renderRacer();

  renderRenderables(camera, renderableCmd);
  // renderRacer2(b);
}

const verTanTable = (() => {
  const halfHeight = canvas.height * 0.5;
  const tanHalfFov = mathTan(kVerticalFov * 0.5);
  const ret: number[] = [];

  for (let y = 0; y < canvas.height; ++y) {
    const ndcY = ((y + 0.5) - halfHeight) / halfHeight;
    ret.push(ndcY * tanHalfFov);
  }

  return ret;
})();
const horTanTable = (() => {
  const halfWidth = canvas.width * 0.5;
  const tanHalfVFov = mathTan(kVerticalFov * 0.5);
  const tanHalfHFov = tanHalfVFov * (canvas.width / canvas.height);
  const ret: number[] = [];

  for (let x = 0; x < canvas.width; ++x) {
    const ndcX = ((x + 0.5) - halfWidth) / halfWidth;
    ret.push(ndcX * tanHalfHFov);
  }

  return ret;
})();

let trackPixels: Uint32Array | null = null;
let cloudsPixels: Uint32Array | null = null;
const outputData = projectedPlaneCtx.createImageData(canvas.width, canvas.height);
const outputPixels = new Uint32Array(outputData.data.buffer);
const kMask = (2048 * 2) - 1; // Track texture is always power of two, and mod operator tanks the frame rate
const kCloudsMask = 512 - 1;
const kSkyColor = 0xffebce87;
const kFogFactor = 0.1;
const kGroundBaseColor = 0xff2b8f2b;
const kGroundSkyTint = 0.2;
const kGroundColor = blendAbgr(kGroundBaseColor, kSkyColor, kGroundSkyTint);
const kRacerScaleFromFocal = 440 / ((900 * 0.5) / mathTan(kVerticalFov * 0.5));

function blendAbgr(src: number, dst: number, t: number): number {
  const invT = 1 - t;

  const srcR = src & 0xff;
  const srcG = (src >>> 8) & 0xff;
  const srcB = (src >>> 16) & 0xff;
  const srcA = (src >>> 24) & 0xff;

  const dstR = dst & 0xff;
  const dstG = (dst >>> 8) & 0xff;
  const dstB = (dst >>> 16) & 0xff;
  const dstA = (dst >>> 24) & 0xff;

  const outR = ((srcR * invT) + (dstR * t)) | 0;
  const outG = ((srcG * invT) + (dstG * t)) | 0;
  const outB = ((srcB * invT) + (dstB * t)) | 0;
  const outA = ((srcA * invT) + (dstA * t)) | 0;

  return (outA << 24) | (outB << 16) | (outG << 8) | outR;
}

function overAbgr(top: number, bottom: number): number {
  const topA = (top >>> 24) & 0xff;
  if (topA === 0xff) return top;
  if (topA === 0) return bottom;

  const invTopA = 255 - topA;

  const topR = top & 0xff;
  const topG = (top >>> 8) & 0xff;
  const topB = (top >>> 16) & 0xff;

  const botR = bottom & 0xff;
  const botG = (bottom >>> 8) & 0xff;
  const botB = (bottom >>> 16) & 0xff;
  const botA = (bottom >>> 24) & 0xff;

  const outR = ((topR * topA) + (botR * invTopA)) / 255;
  const outG = ((topG * topA) + (botG * invTopA)) / 255;
  const outB = ((topB * topA) + (botB * invTopA)) / 255;
  const outA = topA + ((botA * invTopA) / 255);

  return (((outA | 0) & 0xff) << 24)
    | (((outB | 0) & 0xff) << 16)
    | (((outG | 0) & 0xff) << 8)
    | ((outR | 0) & 0xff);
}

function renderProjectedPlane(camera: Camera, a: any) {
  if (!trackPixels) {
    const trackCanvas = a.textureCanvas as OffscreenCanvas;
    const trackImage = a.textureCtx.getImageData(0, 0, trackCanvas.width, trackCanvas.height);

    trackPixels = new Uint32Array(trackImage.data.buffer);
  }
  if (!cloudsPixels) {
    cloudsPixels = cloudsGetPixels();
  }

  const width = canvas.width;
  const height = canvas.height;

  const camSin = mathSin(camera.mPitch);
  const camCos = mathCos(camera.mPitch);
  const yawSin = mathSin(camera.mAngle);
  const yawCos = mathCos(camera.mAngle);
  const rowStride = kMask + 1;
  const cloudsRowStride = kCloudsMask + 1;

  for (let j = 0; j < height; ++j) {
    const outputRow = (height - 1 - j);
    const sy = verTanTable[j];

    const rayY = -camCos - (sy * camSin);
    const rayZ = -camSin + (sy * camCos);

    if (rayZ >= -1e-6) {
      outputPixels.fill(kSkyColor, outputRow * width, (outputRow + 1) * width);
      continue;
    }

    const invZ = 1 / -rayZ;
    const t = camera.mHeight * invZ;
    const cloudsT = (camera.mHeight + kCloudsPlaneHeightOffset) * invZ;
    const localY = t * rayY;
    const cloudsLocalY = cloudsT * rayY;
    const linearFogValue = mathClamp((invZ * kFogFactor) - 1, 0, 1);
    const fogValue = easeOutQuad(linearFogValue);

    for (let i = 0; i < width; ++i) {
      const sx = horTanTable[i];
      const localX = t * sx;
      const cloudsLocalX = cloudsT * sx;

      const worldX = (yawCos * localX) - (yawSin * localY);
      const worldY = (yawSin * localX) + (yawCos * localY);
      const cloudsWorldX = (yawCos * cloudsLocalX) - (yawSin * cloudsLocalY) + cloudsWindOffsetX;
      const cloudsWorldY = (yawSin * cloudsLocalX) + (yawCos * cloudsLocalY) + cloudsWindOffsetY;

      const texX = (camera.mPos.x + worldX) | 0;
      const texY = (camera.mPos.y + worldY) | 0;
      const cloudsTexX = (camera.mPos.x + cloudsWorldX) | 0;
      const cloudsTexY = (camera.mPos.y + cloudsWorldY) | 0;
      const rowOffset = (texY & kMask) * rowStride;
      const textureIdx = rowOffset + (texX & kMask);
      const cloudsRowOffset = (cloudsTexY & kCloudsMask) * cloudsRowStride;
      const cloudsTextureIdx = cloudsRowOffset + (cloudsTexX & kCloudsMask);
      const outputIdx = (width * outputRow) + i;

      const trackColor = trackPixels[textureIdx];
      const cloudColor = cloudsPixels[cloudsTextureIdx];
      const groundFogged = (fogValue > 0)
        ? blendAbgr(kGroundColor, kSkyColor, fogValue)
        : kGroundColor;
      const cloudsFogged = (fogValue > 0)
        ? blendAbgr(cloudColor, kSkyColor, linearFogValue)
        : cloudColor;

      const trackFogged = (fogValue > 0)
        ? blendAbgr(trackColor, kSkyColor, linearFogValue)
        : trackColor;

      const groundAndClouds = overAbgr(cloudsFogged, groundFogged);
      outputPixels[outputIdx] = overAbgr(trackFogged, groundAndClouds);
    }
  }

  projectedPlaneCtx.putImageData(outputData, 0, 0);
}

const kVerticalFactor = 1;
function renderRacer() {
  type SkeletonNodeShape = {
    points: [number, number][];
    front?: {
      points: [number, number][];
      z?: number;
    };
    back?: {
      points: [number, number][];
      z?: number;
    };
    z?: number;
    useParentDepth?: boolean;
    color?: string;
  }
  type SkeletonNode = {
    pos: [number, number];
    z: number;
    radius: number;
    depthOffset?: number;
    color?: string;
    split?: boolean;
    children?: SkeletonNode[];
    shapes?: SkeletonNodeShape[];
  };
  type TransformedSkeletonNode = {
    type: 0,
    pos: [number, number];
    z: number;
    color: string;
    ref: SkeletonNode;
    parent: SkeletonNode | null;
  };
  type TransformedSkeletonPart = TransformedSkeletonNode | ({ type: 1; z: number; } & SkeletonNodeShape);
  type AnimationFrames = {
    [patId: number]: AnimationKeyFrame[];
  }
  type AnimationKeyFrame = {
    angle: number;
    duration: number;
    easing: number;
  };

  const skeleton: SkeletonNode = {
    pos: [6.2, -11.8], // Root - Pelvis
    z: 0,
    radius: 2.4,
    color: "#faa",
    children: [
      {
        pos: [2.1, -11], // Torso 2
        z: 0,
        radius: 2.9,
        children: [
          {
            pos: [-2.3, -11], // Torso 1
            z: 0,
            radius: 3,
            children: [
              {
                pos: [-3.4, -12.2], // Neck
                z: 0,
                radius: 2,
                split: true,
                children: [
                  {
                    pos: [-6.8, -16.6], // Head
                    z: 0,
                    radius: 1.2,
                    children: [
                      {
                        pos: [-10, -15], // Mouth
                        z: 0,
                        radius: 0.7,
                        split: true,
                      },
                      {
                        pos: [-8.1, -16.7], // Eye 1
                        z: 0.8,
                        radius: 0.3,
                        split: true,
                        depthOffset: 1.8,
                        color: "#000"
                      },
                      {
                        pos: [-8.1, -16.7], // Eye 2
                        z: -0.8,
                        radius: 0.3,
                        split: true,
                        color: "#000"
                      },
                      {
                        pos: [-8.55, -17.6], // Horn
                        z: 0,
                        radius: 0.35,
                        split: true,
                        color: "#b44",
                        depthOffset: -1,
                        children: [
                          {
                            pos: [-10.25, -21], // Horn Tip
                            z: 0,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-7.5, -17.4], // Ear
                        z: 0.5,
                        radius: 0.4,
                        split: true,
                        depthOffset: -1,
                        children: [
                          {
                            pos: [-7.8, -19.2], // Ear Tip
                            z: 0.8,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-7.5, -17.4], // Ear
                        z: -0.5,
                        radius: 0.4,
                        split: true,
                        depthOffset: -1,
                        children: [
                          {
                            pos: [-7.8, -19.2], // Ear Tip
                            z: -0.8,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-7.5, -17.5], // Hair 1
                        z: 0,
                        radius: 0.4,
                        split: true,
                        color: "#ff7",
                        children: [
                          {
                            pos: [-7, -18],
                            z: 0,
                            radius: 0.2,
                            children: [
                              {
                                pos: [-4, -17.5],
                                z: 0,
                                radius: 0,
                              }
                            ]
                          }
                        ]
                      },
                      {
                        pos: [-6.5, -17.5], // Hair 2
                        z: 0.5,
                        radius: 0.3,
                        split: true,
                        color: "#ff0",
                        depthOffset: 0.5,
                        children: [
                          {
                            pos: [-5, -16.5],
                            z: 1,
                            radius: 0,
                            depthOffset: 1.5,
                          }
                        ]
                      },
                      {
                        pos: [-6.5, -17.5], // Hair 3
                        z: -0.5,
                        radius: 0.3,
                        split: true,
                        color: "#ff0",
                        children: [
                          {
                            pos: [-5, -16.5],
                            z: -1,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-6, -17.5], // Hair 4
                        z: 0,
                        radius: 0.5,
                        split: true,
                        color: "#ff7",
                        depthOffset: 0.75,
                        children: [
                          {
                            pos: [-2, -15],
                            z: 0,
                            depthOffset: 0.25,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-5, -16.75], // Hair 5
                        z: 0.6,
                        radius: 0.4,
                        split: true,
                        color: "#ff0",
                        depthOffset: 0.3,
                        children: [
                          {
                            pos: [-3.5, -15],
                            z: 1.2,
                            radius: 0,
                            depthOffset: 1,
                          }
                        ]
                      },
                      {
                        pos: [-5, -16.75], // Hair 6
                        z: -0.6,
                        radius: 0.4,
                        split: true,
                        color: "#ff0",
                        children: [
                          {
                            pos: [-3.5, -15],
                            z: -1.2,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-5, -16.5], // Hair 7
                        z: 0,
                        radius: 0.4,
                        split: true,
                        color: "#ff7",
                        children: [
                          {
                            pos: [-1.5, -13.75],
                            z: 0,
                            depthOffset: 0.5,
                            radius: 0,
                          }
                        ]
                      },
                      {
                        pos: [-4.25, -16], // Hair 8
                        z: 0.6,
                        radius: 0.3,
                        split: true,
                        color: "#ff0",
                        depthOffset: 0.3,
                        children: [
                          {
                            pos: [-2.5, -14],
                            z: 0.8,
                            radius: 0,
                            depthOffset: 1,
                          }
                        ]
                      },
                      {
                        pos: [-4.25, -16], // Hair 9
                        z: -0.6,
                        radius: 0.3,
                        split: true,
                        color: "#ff0",
                        children: [
                          {
                            pos: [-2.5, -14],
                            z: -0.8,
                            radius: 0,
                          }
                        ]
                      },
                    ],
                    shapes: [
                      { // Head
                        points: [
                          [-6.8, -15.4],
                          [-10.7, -14.5],
                          [-10.7, -14.5],
                          [-11.5, -15.4],
                          [-8.3, -17.8],
                          [-6.8, -17.8],
                        ],
                        useParentDepth: true,
                      },
                    ]
                  }
                ]
              },
              {
                pos: [-3.5, -9], // Upper front leg
                z: 1.8,
                radius: 1,
                split: true,
                children: [
                  {
                    pos: [-3.6, -4.6], // Lower front leg
                    z: 2,
                    radius: 0.5,
                    children: [
                      {
                        pos: [-3.6, -1.8], // Front hoof
                        z: 2,
                        radius: 0.5,
                        shapes: [
                          {
                            points: [
                              [-3.1, -1.8],
                              [-3.1, 0],
                              [-4.5, 0],
                              [-4.1, -1.8],
                            ],
                            color: "#b44",
                            front: {
                              points: [
                                [-3.1, -1.8],
                                [-3.1, 0],
                                [-4.1, 0],
                                [-4.1, -1.8],
                              ]
                            },
                            back: {
                              points: [
                                [-3.1, -1.8],
                                [-3.1, 0],
                                [-4.1, 0],
                                [-4.1, -1.8],
                              ]
                            },
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                pos: [-3.5, -9], // Upper front leg
                z: -1.8,
                radius: 1,
                split: true,
                children: [
                  {
                    pos: [-3.6, -4.6], // Lower front leg
                    z: -2,
                    radius: 0.5,
                    children: [
                      {
                        pos: [-3.6, -1.8], // Front hoof
                        z: -2,
                        radius: 0.5,
                        shapes: [
                          {
                            points: [
                              [-3.1, -1.8],
                              [-3.1, 0],
                              [-4.5, 0],
                              [-4.1, -1.8],
                            ],
                            color: "#b44",
                            front: {
                              points: [
                                [-3.1, -1.8],
                                [-3.1, 0],
                                [-4.1, 0],
                                [-4.1, -1.8],
                              ]
                            },
                            back: {
                              points: [
                                [-3.1, -1.8],
                                [-3.1, 0],
                                [-4.1, 0],
                                [-4.1, -1.8],
                              ]
                            },
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        pos: [7, -10.2], // Upper back leg
        z: 1.2,
        radius: 1.8,
        split: true,
        children: [
          {
            pos: [9, -5.8], // Lower back leg
            z: 2.4,
            radius: 0.6,
            children: [
              {
                pos: [9, -1.8], // Back hoof
                z: 2.5,
                radius: 0.5,
                shapes: [
                  {
                    points: [
                      [9.5, -1.8],
                      [9.5, 0],
                      [8.1, 0],
                      [8.5, -1.8],
                    ],
                    color: "#b44",
                    front: {
                      points: [
                        [9.5, -1.8],
                        [9.5, 0],
                        [8.5, 0],
                        [8.5, -1.8],
                      ]
                    },
                    back: {
                      points: [
                        [9.5, -1.8],
                        [9.5, 0],
                        [8.5, 0],
                        [8.5, -1.8],
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        pos: [7, -10.2], // Upper back leg
        z: -1.2,
        radius: 1.8,
        split: true,
        children: [
          {
            pos: [9, -5.8], // Lower back leg
            z: -2.4,
            radius: 0.6,
            children: [
              {
                pos: [9, -1.8], // Back hoof
                z: -2.5,
                radius: 0.5,
                shapes: [
                  {
                    points: [
                      [9.5, -1.8],
                      [9.5, 0],
                      [8.1, 0],
                      [8.5, -1.8],
                    ],
                    color: "#b44",
                    front: {
                      points: [
                        [9.5, -1.8],
                        [9.5, 0],
                        [8.5, 0],
                        [8.5, -1.8],
                      ]
                    },
                    back: {
                      points: [
                        [9.5, -1.8],
                        [9.5, 0],
                        [8.5, 0],
                        [8.5, -1.8],
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      { // Tail
        pos: [8.5, -13.2],
        z: 0,
        radius: 0.5,
        color: '#ff0',
        split: true,
        children: [
          {
            pos: [8.9, -13.5],
            z: 0,
            radius: 0.6,
            children: [
              {
                pos: [9.3, -13.2],
                z: 0,
                radius: 0.7,
                children: [
                  {
                    pos: [10.5, -9.5],
                    z: 0,
                    radius: 0.7,
                    children: [
                      {
                        pos: [11.5, -8],
                        z: 0,
                        radius: 0.2,
                      }
                    ],
                  }
                ],
              }
            ],
          }
        ],
      }
    ]
  };
  const animations: AnimationFrames[] = [
    {}, // Base pose
    {   // Staing still
      4: [
        {
          angle: 0.025,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.025,
          duration: 0.5,
          easing: 6
        },
      ]
    },
    {   // Walking
      4: [
        {
          angle: 0.025,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.025,
          duration: 0.5,
          easing: 6
        },
      ],
      34: [
        {
          angle: 0.1,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.1,
          duration: 0.5,
          easing: 6
        },
      ],
      35: [
        {
          angle: 0,
          duration: 0.3,
          easing: 0
        },
        {
          angle: 0,
          duration: 0.4,
          easing: 6
        },
        {
          angle: -0.5,
          duration: 0.3,
          easing: 6
        },
      ],
      37: [
        {
          angle: -0.1,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.1,
          duration: 0.5,
          easing: 6
        },
      ],
      38: [
        {
          angle: -0.25,
          duration: 0.2,
          easing: 5
        },
        {
          angle: -0.5,
          duration: 0.3,
          easing: 6
        },
        {
          angle: 0,
          duration: 0.3,
          easing: 0
        },
        {
          angle: 0,
          duration: 0.2,
          easing: 4
        },
      ],
      40: [
        {
          angle: 0.075,
          duration: 0.2,
          easing: 5
        },
        {
          angle: 0.15,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.05,
          duration: 0.3,
          easing: 4
        },
      ],
      41: [
        {
          angle: 0,
          duration: 0.2,
          easing: 5
        },
        {
          angle: 0.1,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.15,
          duration: 0.3,
          easing: 4
        },
      ],
      43: [
        {
          angle: 0.025,
          duration: 0.2,
          easing: 5
        },
        {
          angle: -0.05,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.15,
          duration: 0.3,
          easing: 4
        },
      ],
      44: [
        {
          angle: 0,
          duration: 0.2,
          easing: 5
        },
        {
          angle: -0.15,
          duration: 0.3,
          easing: 6
        },
        {
          angle: 0.1,
          duration: 0.5,
          easing: 4
        },
      ],
      46: [
        {
          angle: 0.05,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.05,
          duration: 0.5,
          easing: 6
        },
      ],
    },
    {   // Running
      4: [
        {
          angle: 0.15,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.05,
          duration: 0.5,
          easing: 6
        },
      ],
      34: [
        {
          angle: 0.36,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.1,
          duration: 0.5,
          easing: 6
        },
      ],
      35: [
        {
          angle: -0.2,
          duration: 0.2,
          easing: 5
        },
        {
          angle: 0,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.5,
          duration: 0.3,
          easing: 4
        },
      ],
      37: [
        {
          angle: 0.1,
          duration: 0.25,
          easing: 5
        },
        {
          angle: -0.1,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.36,
          duration: 0.25,
          easing: 4
        },
      ],
      38: [
        {
          angle: -0.1,
          duration: 0.4,
          easing: 5
        },
        {
          angle: -0.5,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0,
          duration: 0.1,
          easing: 4
        },
      ],
      40: [
        {
          angle: 0.1,
          duration: 0.375,
          easing: 5
        },
        {
          angle: -0.2,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.2,
          duration: 0.125,
          easing: 4
        },
      ],
      41: [
        {
          angle: 0,
          duration: 0.3,
          easing: 5
        },
        {
          angle: -0.1,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.2,
          duration: 0.2,
          easing: 4
        },
      ],
      43: [
        {
          angle: -0.1,
          duration: 0.125,
          easing: 5
        },
        {
          angle: -0.2,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.2,
          duration: 0.375,
          easing: 4
        },
      ],
      44: [
        {
          angle: -0.084,
          duration: 0.05,
          easing: 5
        },
        {
          angle: -0.1,
          duration: 0.5,
          easing: 6
        },
        {
          angle: 0.2,
          duration: 0.45,
          easing: 4
        },
      ],
      47: [
        {
          angle: -0.2,
          duration: 0.5,
          easing: 6
        },
        {
          angle: -0.3,
          duration: 0.5,
          easing: 6
        },
      ],
    },
  ];

  const scale = 18;
  const offsetX = canvas.width * 0.5;
  const offsetY = canvas.height * 1;

  function toScreen(point: [number, number]): [number, number] {
    return [offsetX + (point[0] * scale), offsetY + (point[1] * scale)];
  }

  function drawCircle(x: number, y: number, radius: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, kTau);
    ctx.fill();
  }

  function drawBone(
    ax: number,
    ay: number,
    ar: number,
    bx: number,
    by: number,
    br: number,
    color: string,
  ) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = mathJs.hypot(dx, dy);

    if (len < 1e-6) {
      drawCircle(ax, ay, mathJs.max(ar, br), color);
      return;
    }

    // Sweep circles along the segment with interpolated radius to create a smooth taper.
    const avgRadius = (ar + br) * 0.5;
    const spacing = mathJs.max(0.75, avgRadius * 0.35);
    const steps = mathJs.max(1, mathJs.ceil(len / spacing));

    for (let i = 0; i <= steps; ++i) {
      const t = i / steps;
      const cx = ax + (dx * t);
      const cy = ay + (dy * t);
      const cr = ar + ((br - ar) * t);

      drawCircle(cx, cy, cr, color);
    }
  }

  function drawSortedShape(shapeNode: Extract<TransformedSkeletonPart, { type: 1 }>, defaultColor: string) {
    const shape = shapeNode.points;
    if (!shape || shape.length < 3) return;

    ctx.fillStyle = shapeNode.color ?? defaultColor;
    ctx.beginPath();

    for (let i = 0; i < shape.length; ++i) {
      const [px, py] = shape[i];
      const [sx, sy] = toScreen([px, py]);

      if (i === 0) {
        ctx.moveTo(sx, sy);
      } else {
        ctx.lineTo(sx, sy);
      }
    }

    ctx.closePath();
    ctx.fill();
  }

  function drawSkeleton(nodeSet: TransformedSkeletonPart[], defaultColor = "#454545") {
    const transformedPosByNode = new Map<SkeletonNode, [number, number]>();
    for (const transformedNode of nodeSet) {
      if (transformedNode.type === 0) {
        transformedPosByNode.set(transformedNode.ref, transformedNode.pos);
      }
    }

    for (const transformedNode of nodeSet) {
      if (transformedNode.type === 1) {
        drawSortedShape(transformedNode, defaultColor);
        continue;
      }

      const node = transformedNode.ref;
      const parent = transformedNode.parent;
      const nodeColor = transformedNode.color || defaultColor;

      const [x, y] = toScreen(transformedNode.pos);
      const radius = node.radius * scale;

      if (parent && !node.split) {
        const parentPos = transformedPosByNode.get(parent) ?? parent.pos;
        const [px, py] = toScreen(parentPos);
        drawBone(px, py, parent.radius * scale, x, y, radius, nodeColor);
      }

      // Always draw the joint circle so branches/splits merge as a solid silhouette.
      drawCircle(x, y, radius, nodeColor);

      // Shapes are drawn as type-1 entries from the sorted set.
    }
  }

  function sortNode(
    node: SkeletonNode,
    parent: SkeletonNode | null,
    partId: number,
    parentAnimAngle: number,
    nodeSet: TransformedSkeletonPart[],
    inheritedColor = "#454545",
    parentBindPos: [number, number] = [0, 0],
    parentAnimatedPos: [number, number] = [0, 0],
  ) {
    function getAnimationStep(partId: number, animIdx: number, time: number) {
      const anim = animations[animIdx];
      if (!anim) return 0;

      const partAnim = anim[partId];
      if (!partAnim || partAnim.length === 0) return 0;
      if (partAnim.length === 1) return partAnim[0].angle;

      let totalDuration = 0;
      for (const keyframe of partAnim) {
        totalDuration += mathJs.max(0, keyframe.duration);
      }

      if (totalDuration <= 0) {
        return partAnim[0].angle;
      }

      const wrappedTime = ((time % totalDuration) + totalDuration) % totalDuration;
      let elapsed = 0;

      for (let i = 0; i < partAnim.length; ++i) {
        const current = partAnim[i];
        const next = partAnim[(i + 1) % partAnim.length];
        const segmentDuration = mathJs.max(0, current.duration);

        if (segmentDuration === 0) {
          continue;
        }

        const segmentEnd = elapsed + segmentDuration;
        if (wrappedTime < segmentEnd || i === partAnim.length - 1) {
          const t = (wrappedTime - elapsed) / segmentDuration;
          const easingIdx = mathClamp(current.easing | 0, 0, easingFunctions.length - 1);
          const easingFn = easingFunctions[easingIdx] ?? easingFunctions[0];
          const easedT = easingFn(mathClamp(t, 0, 1));
          return current.angle + ((next.angle - current.angle) * easedT);
        }

        elapsed = segmentEnd;
      }

      return partAnim[partAnim.length - 1].angle;
    }

    const animAngle = getAnimationStep(partId, 0, animationTime) + parentAnimAngle;
    const animSin = mathSin(animAngle * mathJs.PI);
    const animCos = mathCos(animAngle * mathJs.PI);

    const rotSin = mathSin(racerRotation);
    const rotCos = mathCos(racerRotation);

    function applyAnimationTransform(x: number, y: number) {
      const localX = x - parentBindPos[0];
      const localY = y - parentBindPos[1];

      return {
        x: (localX * animCos) - (localY * animSin) + parentAnimatedPos[0],
        y: (localX * animSin) + (localY * animCos) + parentAnimatedPos[1],
      };
    }

    function applyYawTransform(x: number, y: number, z: number) {
      const animated = applyAnimationTransform(x, y);
      const animX = animated.x;
      const animY = animated.y;
      const smoothSignX = animX / mathJs.sqrt((animX * animX) + 0.25);
      
      // Pseudo-3D yaw: collapse x by cos, offset x by depth, and shift y by signed x.
      const transformedX = (animX * rotCos) - (z * rotSin);
      const transformedY = animY + (rotSin * kVerticalFactor * smoothSignX);
      const transformedZ = (z * rotCos) + (animX * rotSin);

      return {
        x: transformedX,
        y: transformedY,
        z: transformedZ,
      };
    }

    function insertSorted(nodeItem: TransformedSkeletonPart) {
      let insertIdx = nodeSet.length;
      for (let i = 0; i < nodeSet.length; ++i) {
        if (nodeItem.z < nodeSet[i].z) {
          insertIdx = i;
          break;
        }
      }

      nodeSet.splice(insertIdx, 0, nodeItem);
    }

    const nodeColor = node.color ?? inheritedColor;
    const animatedCenter = applyAnimationTransform(node.pos[0], node.pos[1]);
    const transformedCenter = applyYawTransform(node.pos[0], node.pos[1], node.z);
    const transformedNode: TransformedSkeletonPart = {
      type: 0,
      pos: [transformedCenter.x, transformedCenter.y],
      z: transformedCenter.z + node.radius + (node.depthOffset ?? 0),
      color: nodeColor,
      ref: node,
      parent: parent,
    };

    insertSorted(transformedNode);

    for (const shape of node.shapes ?? []) {
      const baseShapeZ = node.z + (shape.z ?? 0);
      const transformedShapeOrigin = applyYawTransform(node.pos[0], node.pos[1], baseShapeZ);
      const defaultPoints: [number, number][] = shape.points.map(([px, py]) => {
        const rotatedPoint = applyYawTransform(px, py, baseShapeZ);
        return [rotatedPoint.x, rotatedPoint.y];
      });

      let transformedPoints = defaultPoints;
      let transformedShapeZ = transformedShapeOrigin.z;

      const morphValue = mathJs.max(-1, mathJs.min(1, rotSin));
      const target = (morphValue >= 0) ? shape.back : shape.front;
      const morphAmount = mathJs.abs(morphValue);

      if (target && target.points.length === shape.points.length && morphAmount > 0) {
        const targetOrigin = applyYawTransform(node.pos[0], node.pos[1], node.z);
        targetOrigin.z += (target.z ?? 0);

        // Front/back targets are billboarded: preserve local XY offsets in screen space.
        const billboardTargetPoints: [number, number][] = target.points.map(([px, py]) => [
          targetOrigin.x + (px - node.pos[0]),
          targetOrigin.y + (py - node.pos[1]),
        ]);

        transformedPoints = defaultPoints.map((point, idx) => {
          const targetPoint = billboardTargetPoints[idx];
          return [
            point[0] + ((targetPoint[0] - point[0]) * morphAmount),
            point[1] + ((targetPoint[1] - point[1]) * morphAmount),
          ];
        });

        transformedShapeZ = transformedShapeOrigin.z + ((targetOrigin.z - transformedShapeOrigin.z) * morphAmount);
      }

      const transformedShape: TransformedSkeletonPart = {
        color: nodeColor,
        ...shape,
        points: transformedPoints,
        type: 1,
        z: shape.useParentDepth ? transformedNode.z : transformedShapeZ,
      };
      insertSorted(transformedShape);
    }

    for (const child of node.children ?? []) {
      partId = sortNode(
        child,
        node,
        partId + 1,
        animAngle,
        nodeSet,
        nodeColor,
        node.pos,
        [animatedCenter.x, animatedCenter.y],
      );
    }

    return partId;
  }

  function getSortedNodes(skeleton: SkeletonNode) {
    const nodeSet: TransformedSkeletonPart[] = [];

    sortNode(skeleton, null, 0, 0, nodeSet);

    return nodeSet;
  }

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  drawSkeleton(getSortedNodes(skeleton));
  // let xoff = 0;
  // let yoff = 0;

  // Torso
  // ctx.moveTo(85 + xoff, 104 + yoff);
  // ctx.bezierCurveTo(102 + xoff, 118 + yoff, 150 + xoff, 122 + yoff, 165 + xoff, 122 + yoff);
  // ctx.bezierCurveTo(195 + xoff, 122 + yoff, 263 + xoff, 110 + yoff, 281 + xoff, 105 + yoff);
  // ctx.bezierCurveTo(295 + xoff, 101 + yoff, 334 + xoff, 90 + yoff, 357 + xoff, 91 + yoff);
  // ctx.bezierCurveTo(379 + xoff, 92 + yoff, 408 + xoff, 110 + yoff, 413 + xoff, 125 + yoff);
  // ctx.bezierCurveTo(419 + xoff, 144 + yoff, 414 + xoff, 165 + yoff, 404 + xoff, 184 + yoff);
  // ctx.bezierCurveTo(397 + xoff, 197 + yoff, 351 + xoff, 219 + yoff, 327 + xoff, 224 + yoff);
  // ctx.bezierCurveTo(301 + xoff, 229 + yoff, 257 + xoff, 250 + yoff, 232 + xoff, 261 + yoff);
  // ctx.bezierCurveTo(213 + xoff, 269 + yoff, 173 + xoff, 277 + yoff, 142 + xoff, 271 + yoff);
  // ctx.bezierCurveTo(117 + xoff, 266 + yoff, 87 + xoff, 251 + yoff, 77 + xoff, 240 + yoff);
  // ctx.bezierCurveTo(67 + xoff, 229 + yoff, 51 + xoff, 209 + yoff, 46 + xoff, 196 + yoff);
  // ctx.bezierCurveTo(41 + xoff, 182 + yoff, 32 + xoff, 145 + yoff, 36 + xoff, 125 + yoff);
  // ctx.fill();

  // Upper back leg
  // Start a new path so the second fill does not affect the first shape.
  // xoff = 210;
  // yoff = 60;
  // ctx.beginPath();
  // ctx.fillStyle = '#f00';
  // ctx.moveTo(118 + xoff, 116 + yoff);
  // ctx.bezierCurveTo(115 + xoff, 132 + yoff, 125 + xoff, 158 + yoff, 135 + xoff, 184 + yoff);
  // ctx.bezierCurveTo(140 + xoff, 198 + yoff, 152 + xoff, 218 + yoff, 162 + xoff, 230 + yoff);
  // ctx.bezierCurveTo(172 + xoff, 242 + yoff, 185 + xoff, 254 + yoff, 197 + xoff, 263 + yoff);
  // ctx.bezierCurveTo(209 + xoff, 272 + yoff, 230 + xoff, 268 + yoff, 230 + xoff, 263 + yoff);
  // ctx.bezierCurveTo(231 + xoff, 250 + yoff, 224 + xoff, 230 + yoff, 218 + xoff, 219 + yoff);
  // ctx.bezierCurveTo(211 + xoff, 206 + yoff, 206 + xoff, 183 + yoff, 205 + xoff, 162 + yoff);
  // ctx.bezierCurveTo(204 + xoff, 147 + yoff, 205 + xoff, 123 + yoff, 205 + xoff, 111 + yoff);
  // ctx.bezierCurveTo(205 + xoff, 95 + yoff, 183 + xoff, 83 + yoff, 167 + xoff, 76 + yoff);
  // ctx.bezierCurveTo(153 + xoff, 70 + yoff, 135 + xoff, 80 + yoff, 125 + xoff, 93 + yoff);
  // ctx.fill();

  // Lower back leg
  // xoff = 415;
  // yoff = 310;
  // ctx.beginPath();
  // ctx.fillStyle = '#f88';
  // ctx.lineTo(0 + xoff, 0 + yoff);
  // ctx.lineTo(0 + xoff, 150 + yoff);
  // ctx.lineTo(20 + xoff, 150 + yoff);
  // ctx.lineTo(20 + xoff, 0 + yoff);
  // ctx.fill();

  ctx.restore();
}

function renderRenderables<R extends Renderable>(camera: Camera, renderableCmd: RenderableCommand<R>) {
  const sortedRenderables = workSortedRenderables as SortedRenderable<R>[];
  let renderableCount = 0;

  for (const renderable of renderableCmd.mRenderables) {
    const dx = renderable.mPos.x - camera.mPos.x;
    const dy = renderable.mPos.y - camera.mPos.y;
    const yawSin = mathSin(camera.mAngle);
    const yawCos = mathCos(camera.mAngle);
    const tanHalfVFov = mathTan(kVerticalFov * 0.5);
    const tanHalfHFov = tanHalfVFov * (canvas.width / canvas.height);
    const halfWidth = canvas.width * 0.5;
    const halfHeight = canvas.height * 0.5;

    const xCam = (yawCos * dx) + (yawSin * dy);
    const zBase = (-yawSin * dx) + (yawCos * dy);
    const pitchSin = mathSin(camera.mPitch);
    const pitchCos = mathCos(camera.mPitch);
    const yCam = (-camera.mHeight * pitchCos) - (zBase * pitchSin);
    const zCam = (-camera.mHeight * pitchSin) + (zBase * pitchCos);
    const zDepth = -zCam;
    const safeZ = (zDepth > 1e-6) ? zDepth : 1e-6;
    const ndcX = xCam / (safeZ * tanHalfHFov);
    const ndcY = yCam / (safeZ * tanHalfVFov);
    const x = (ndcX * halfWidth) + halfWidth - 0.5;
    const y = halfHeight - (ndcY * halfHeight) - 0.5;

    const invZ = 1 / safeZ;
    const camFromRacerAngle = mathJs.atan2(-dy, -dx);
    const relAngle = renderable.mAngle - camFromRacerAngle - kMathHalfPi;
    // const angle = mathJs.atan2(mathSin(relAngle), mathCos(relAngle));
    const angle = mathMod((relAngle + kMathPi), kMathTau) - kMathPi;
    const focalY = halfHeight / tanHalfVFov;
    const scale = renderableCmd.mScale * focalY * invZ;

    const offscreenOffset = 12 * scale;
    if (
      x < -offscreenOffset || x > canvas.width + offscreenOffset ||
      y < 0 || y > canvas.height + offscreenOffset
    ) {
      continue;
    }

    const groundDistance = mathJs.hypot(dx, dy);
    const groundInvZ = groundDistance / camera.mHeight;
    const linearFogValue = mathClamp((groundInvZ * kFogFactor) - 1, 0, 1);
    const fogAlpha = 1 - easeOutQuad(linearFogValue);

    if (zBase > -5 || fogAlpha < kMathEpsilon) {
      continue;
    }

    if (renderableCount < sortedRenderables.length) {
      sortedRenderables[renderableCount] = {
        mRenderable: renderable,
        mInvZ: invZ,
        mX: x,
        mY: y,
        mAngle: angle,
        mScale: scale,
        mAlpha: fogAlpha
      };
    } else {
      sortedRenderables.push({
        mRenderable: renderable,
        mInvZ: invZ,
        mX: x,
        mY: y,
        mAngle: angle,
        mScale: scale,
        mAlpha: fogAlpha
      });
    }

    renderableCount++;
  }

  // Insertion sort on active slice only, so we do not touch stale buffer entries.
  for (let i = 1; i < renderableCount; ++i) {
    const item = sortedRenderables[i];
    let j = i - 1;

    while (j >= 0 && sortedRenderables[j].mInvZ > item.mInvZ) {
      sortedRenderables[j + 1] = sortedRenderables[j];
      j--;
    }

    sortedRenderables[j + 1] = item;
  }

  for (let i = 0; i < renderableCount; ++i) {
    const item = sortedRenderables[i];
    renderableCmd.mCommand(
      item.mRenderable,
      ctx,
      item.mX,
      item.mY,
      item.mInvZ,
      item.mAngle,
      item.mScale,
      item.mAlpha,
    );
  }
}