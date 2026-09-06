import { easeInOutQuad, easeInQuad, easeLinear, easeOutQuad } from "../easing";

type SkeletonNodeShapeOld = {
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
type SkeletonNodeOld = {
  pos: [number, number];
  z: number;
  radius: number;
  depthOffset?: number;
  color?: string;
  split?: boolean;
  children?: SkeletonNodeOld[];
  shapes?: SkeletonNodeShapeOld[];
};
type AnimationFramesOld = {
  [patId: number]: AnimationKeyFrameOld[];
};
type AnimationKeyFrameOld = {
  angle: number;
  duration: number;
  easing: number;
};

// [points.x points.y][], [frontback.points.x frontback.points.y][], useParentDepth, color
export type SkeletonNodeShapes = {
  [parent: number]: [number[], number[] | null, boolean, string];
};
// pos.x, pos.y, z, radius, depthOffset, color, split, parent
export type SkeletonNode = [number, number, number, number, number, string, boolean, number];
// angle, duration, easing
export type AnimationFrames = {
  [patId: number]: (number | ((v: number) => number))[];
};

export const skeletonOld: SkeletonNodeOld = {
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
export const animationsOld: AnimationFramesOld[] = [
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
        angle: 0.05,
        duration: 0.5,
        easing: 6
      },
      {
        angle: 0.15,
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

export const racerAnimations: AnimationFrames[] = [
  {}, // Base pose
  {   // Staing still
    4: [
      0.025, 0.5, easeInOutQuad,
      -0.025, 0.5, easeInOutQuad,
    ],
  },
  {   // Walking
    4: [
      0.025, 0.5, easeInOutQuad,
      -0.025, 0.5, easeInOutQuad,
    ],
    34: [
      0.1, 0.5, easeInOutQuad,
      -0.1, 0.5, easeInOutQuad,
    ],
    35: [
      0, 0.3, easeLinear,
      0, 0.4, easeInOutQuad,
      -0.5, 0.3, easeInOutQuad,
    ],
    37: [
      -0.1, 0.5, easeInOutQuad,
      0.1, 0.5, easeInOutQuad,
    ],
    38: [
      -0.25, 0.2, easeOutQuad,
      -0.5, 0.3, easeInOutQuad,
      0, 0.3, easeLinear,
      0, 0.2, easeInQuad,
    ],
    40: [
      0.075, 0.2, easeOutQuad,
      0.15, 0.5, easeInOutQuad,
      -0.05, 0.3, easeInQuad,
    ],
    41: [
      0, 0.2, easeOutQuad,
      0.1, 0.5, easeInOutQuad,
      -0.15, 0.3, easeInQuad,
    ],
    43: [
      0.025, 0.2, easeOutQuad,
      -0.05, 0.5, easeInOutQuad,
      0.15, 0.3, easeInQuad,
    ],
    44: [
      0, 0.2, easeOutQuad,
      -0.15, 0.3, easeInOutQuad,
      0.1, 0.5, easeInQuad,
    ],
    46: [
      0.05, 0.5, easeInOutQuad,
      -0.05, 0.5, easeInOutQuad,
    ],
  },
  {   // Running
    4: [
      0.15, 0.5, easeInOutQuad,
      0.05, 0.5, easeInOutQuad,
    ],
    34: [
      0.36, 0.5, easeInOutQuad,
      -0.1, 0.5, easeInOutQuad,
    ],
    35: [
      -0.2, 0.2, easeOutQuad,
      0, 0.5, easeInOutQuad,
      -0.5, 0.3, easeInQuad,
    ],
    37: [
      0.1, 0.25, easeOutQuad,
      -0.1, 0.5, easeInOutQuad,
      0.36, 0.25, easeInQuad,
    ],
    38: [
      -0.1, 0.4, easeOutQuad,
      -0.5, 0.5, easeInOutQuad,
      0, 0.1, easeInQuad,
    ],
    40: [
      0.1, 0.375, easeOutQuad,
      -0.2, 0.5, easeInOutQuad,
      0.2, 0.125, easeInQuad,
    ],
    41: [
      0, 0.3, easeOutQuad,
      -0.1, 0.5, easeInOutQuad,
      0.2, 0.2, easeInQuad,
    ],
    43: [
      -0.1, 0.125, easeOutQuad,
      -0.2, 0.5, easeInOutQuad,
      0.2, 0.375, easeInQuad,
    ],
    44: [
      -0.084, 0.05, easeOutQuad,
      -0.1, 0.5, easeInOutQuad,
      0.2, 0.45, easeInQuad,
    ],
    47: [
      -0.2, 0.5, easeInOutQuad,
      -0.3, 0.5, easeInOutQuad,
    ],
  },
];
export const racerMirrorNodes: { [nodeId: number]: number } = {
  33: 36, // Upper front leg
  34: 37, // Lower front leg
  35: 38, // Front hoof
  36: 33, // Upper front leg
  37: 34, // Lower front leg
  38: 35, // Front hoof
  39: 42, // Upper back leg
  40: 43, // Lower back leg
  41: 44, // Back hoof
  42: 39, // Upper back leg
  43: 40, // Lower back leg
  44: 41, // Back hoof
};

export const racerDataGetSkeleton = (
  colorBody: string, colorEyes: string, colorHorn: string, colorHair1: string, colorHair2: string
): SkeletonNode[] => [
  [ // Root - Pelvis - 0
    6.2, -11.8, 0, 2.4, 0, colorBody, false, -1,
  ],
  [ // Torso 2 - 1
    2.1, -11, 0, 2.9, 0, colorBody, false, 0,
  ],
  [ // Torso 1 - 2
    -2.3, -11, 0, 3, 0, colorBody, false, 1,
  ],
  [ // Neck - 3
    -3.4, -12.2, 0, 2, 0, colorBody, true, 2,
  ],
  [ // Head - 4
    -6.8, -16.6, 0, 1.2, 0, colorBody, false, 3,
  ],
  [ // Mouth - 5
    -10, -15, 0, 0.7, 0, colorBody, true, 4,
  ],
  [ // Eye 1 - 6
    -8.1, -16.7, 0.8, 0.3, 1.8, colorEyes, true, 4,
  ],
  [ // Eye 2 - 7
    -8.1, -16.7, -0.8, 0.3, 0, colorEyes, true, 4,
  ],
  [ // Horn - 8
    -8.55, -17.6, 0, 0.35, -1, colorHorn, true, 4,
  ],
  [ // Horn Tip - 9
    -10.25, -21, 0, 0, 0, colorHorn, false, 8,
  ],
  [ // Ear 1 - 10
    -7.5, -17.4, 0.5, 0.4, -1, colorBody, true, 4,
  ],
  [ // Ear Tip 1 - 11
    -7.8, -19.2, 0.8, 0, 0, colorBody, false, 10,
  ],
  [ // Ear 2 - 12
    -7.5, -17.4, -0.5, 0.4, -1, colorBody, true, 4,
  ],
  [ // Ear Tip 2 - 13
    -7.8, -19.2, -0.8, 0, 0, colorBody, false, 12,
  ],
  [ // Hair 1 - 14
    -7.5, -17.5, 0, 0.4, 0, colorHair1, true, 4,
  ],
  [ // Hair 1 - 15
    -7, -18, 0, 0.2, 0, colorHair1, false, 14,
  ],
  [ // Hair 1 - 16
    -4, -17.5, 0, 0, 0, colorHair1, false, 15,
  ],
  [ // Hair 2 - 17
    -6.5, -17.5, 0.5, 0.3, 0.5, colorHair2, true, 4,
  ],
  [ // Hair 2 - 18
    -5, -16.5, 1, 0, 1.5, colorHair2, false, 17,
  ],
  [ // Hair 3 - 19
    -6.5, -17.5, -0.5, 0.3, 0, colorHair2, true, 4,
  ],
  [ // Hair 3 - 20
    -5, -16.5, -1, 0, 0, colorHair2, false, 19,
  ],
  [ // Hair 4 - 21
    -6, -17.5, 0, 0.5, 0.75, colorHair1, true, 4,
  ],
  [ // Hair 4 - 22
    -2, -15, 0, 0, 0.25, colorHair1, false, 21,
  ],
  [ // Hair 5 - 23
    -5, -16.75, 0.6, 0.4, 0.3, colorHair2, true, 4,
  ],
  [ // Hair 5 - 24
    -3.5, -15, 1.2, 0, 1, colorHair2, false, 23,
  ],
  [ // Hair 6 - 25
    -5, -16.75, -0.6, 0.4, 0, colorHair2, true, 4,
  ],
  [ // Hair 6 - 26
    -3.5, -15, -1.2, 0, 0, colorHair2, false, 25,
  ],
  [ // Hair 7 - 27
    -5, -16.5, 0, 0.4, 0, colorHair1, true, 4,
  ],
  [ // Hair 7 - 28
    -1.5, -13.75, 0, 0, 0.5, colorHair1, false, 27,
  ],
  [ // Hair 8 - 29
    -4.25, -16, 0.6, 0.3, 0.3, colorHair2, true, 4,
  ],
  [ // Hair 8 - 30
    -2.5, -14, 0.8, 0, 1, colorHair2, false, 29,
  ],
  [ // Hair 9 - 31
    -4.25, -16, -0.6, 0.3, 0, colorHair2, true, 4,
  ],
  [ // Hair 9 - 32
    -2.5, -14, -0.8, 0, 0, colorHair2, false, 31,
  ],
  [ // Upper front leg - 33
    -3.5, -9, 1.8, 1, 0, colorBody, true, 2,
  ],
  [ // Lower front leg - 34
    -3.6, -4.6, 2, 0.5, 0, colorBody, false, 33,
  ],
  [ // Front Hoof - 35
    -3.6, -1.8, 2, 0.5, 0, colorBody, false, 34,
  ],
  [ // Upper front leg - 36
    -3.5, -9, -1.8, 1, 0, colorBody, true, 2,
  ],
  [ // Lower front leg - 37
    -3.6, -4.6, -2, 0.5, 0, colorBody, false, 36,
  ],
  [ // Front Hoof - 38
    -3.6, -1.8, -2, 0.5, 0, colorBody, false, 37,
  ],
  [ // Upper back leg - 39
    7, -10.2, 1.2, 1.8, 0, colorBody, true, 0,
  ],
  [ // Lower back leg - 40
    9, -5.8, 2.4, 0.6, 0, colorBody, false, 39,
  ],
  [ // Back Hoof - 41
    9, -1.8, 2.5, 0.5, 0, colorBody, false, 40,
  ],
  [ // Upper back leg - 42
    7, -10.2, -1.2, 1.8, 0, colorBody, true, 0,
  ],
  [ // Lower back leg - 43
    9, -5.8, -2.4, 0.6, 0, colorBody, false, 42,
  ],
  [ // Back Hoof - 44
    9, -1.8, -2.5, 0.5, 0, colorBody, false, 43,
  ],
  [ // Tail 1 - 45
    8.5, -13.2, 0, 0.5, 0, colorHair2, true, 0,
  ],
  [ // Tail 2 - 46
    8.9, -13.5, 0, 0.6, 0, colorHair2, false, 45,
  ],
  [ // Tail 3 - 47
    9.3, -13.2, 0, 0.7, 0, colorHair2, false, 46,
  ],
  [ // Tail 4 - 48
    10.5, -9.5, 0, 0.7, 0, colorHair2, false, 47,
  ],
  [ // Tail 5 - 49
    11.5, -8, 0, 0.2, 0, colorHair2, false, 48,
  ],
]

export const racerDataGetSkeletonShapes = (
  colorBody: string, colorHoof: string
): SkeletonNodeShapes => ({
  4: [
    [
      -6.8, -15.4,
      -10.7, -14.5,
      -10.7, -14.5,
      -11.5, -15.4,
      -8.3, -17.8,
      -6.8, -17.8,
    ],
    null,
    true,
    colorBody,
  ],
  35: [
    [
      -3.1, -1.8,
      -3.1, 0,
      -4.5, 0,
      -4.1, -1.8,
    ],
    [
      -3.1, -1.8,
      -3.1, 0,
      -4.1, 0,
      -4.1, -1.8,
    ],
    false,
    colorHoof,
  ],
  38: [
    [
      -3.1, -1.8,
      -3.1, 0,
      -4.5, 0,
      -4.1, -1.8,
    ],
    [
      -3.1, -1.8,
      -3.1, 0,
      -4.1, 0,
      -4.1, -1.8,
    ],
    false,
    colorHoof,
  ],
  41: [
    [
      9.5, -1.8,
      9.5, 0,
      8.1, 0,
      8.5, -1.8,
    ],
    [
      9.5, -1.8,
      9.5, 0,
      8.5, 0,
      8.5, -1.8,
    ],
    false,
    colorHoof,
  ],
  44: [
    [
      9.5, -1.8,
      9.5, 0,
      8.1, 0,
      8.5, -1.8,
    ],
    [
      9.5, -1.8,
      9.5, 0,
      8.5, 0,
      8.5, -1.8,
    ],
    false,
    colorHoof,
  ],
});
