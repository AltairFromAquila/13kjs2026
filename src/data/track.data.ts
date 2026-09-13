import { kCloudsNoiseWidth } from "../game/clouds";
import { terrainGenerate } from "../game/terrain";
import { waterGenerate } from "../game/water";
import { colorUnpack, kMathTau, mathSin, type Vec2 } from "../math";

export interface TrackRawData {
  mMainPath: number[];
  mSecondaryPaths?: { mDepthChanges: { [key: number]: number }; mData: number[] }[];
  mMetadata: TrackMetadata;
}

// Name, SkyColor, TerrainData, TerrainHeight, CloudsHeight, SkyCloudsHeight, FogDistance, MovePlanesFunction
export type TrackMetadata = [string, number, () => Uint32Array, number, number, number, number, (cloudsOffset: Vec2, terrainOffset: Vec2, delta: number) => void];

const moveClouds = (cloudsOffset: Vec2, delta: number) => {
  cloudsOffset.x = (cloudsOffset.x + (delta * 4)) % kCloudsNoiseWidth;
  cloudsOffset.y = (cloudsOffset.y + (delta * 4)) % kCloudsNoiseWidth;
};

let waterOffsetValue = 0;
const moveWater = (waterOffset: Vec2, delta: number) => {
  waterOffsetValue = (waterOffsetValue + delta) % kMathTau;
  waterOffset.x = mathSin(waterOffsetValue) * 5;
}

export const tracks: TrackRawData[] = [
  {
    mMainPath: [
      101, 100, 8,
      102, 200, 8,
      149, 241, 8,
      203, 200, 8,
      201, 99, 8,
      151, 58, 8,
    ],
    mSecondaryPaths: [
      {
        mDepthChanges: {
          2: 1
        },
        mData: [
          -1, 0,
          -1, 5,
          113, 57, 8,
          104, 62, 6,
          102, 80, 8
        ]
      }
      // [
      //   -1, 0,
      //   -1, 12,
      //   700, 60, 60,
      //   150, 80, 40,
      //   100, 120, 60,
      // ]
    ],
    mMetadata: [
      'Mystic Forest',
      0xffbb55,
      () => terrainGenerate(
        [
          { mHeight: 0, mColor: colorUnpack(0xff913c14) },
          { mHeight: 1, mColor: colorUnpack(0xfff5c378) },
          { mHeight: 2, mColor: colorUnpack(0xff90af68) },
          { mHeight: 5, mColor: colorUnpack(0xff306022) },
          { mHeight: 8, mColor: colorUnpack(0xff4e803f) },
          { mHeight: 10, mColor: colorUnpack(0xff7ea771) }
        ], 16
      ),
      7, 2, 5, 2,
      (cloudsOffset: Vec2, _: Vec2, delta: number) => moveClouds(cloudsOffset, delta)
    ]
  },
  {
    mMainPath: [
      222, 44, 8,
      137, 56, 8,
      100, 112, 8,
      122, 206, 7,
      181, 210, 7,
      215, 129, 6,
      256, 169, 6,
      291, 159, 5,
      308, 103, 5,
      355, 87, 6,
      358, 62, 7,
      324, 51, 8
    ],
    mMetadata: [
      'Atlantis',
      0xffd56a,
      () => waterGenerate(
        colorUnpack(0xffddaa02),
        colorUnpack(0xffb36f02),
        colorUnpack(0xfff6f5cf)
      ),
      1, 0, 9, 2,
      (cloudsOffset: Vec2, waterOffset: Vec2, delta: number) => (moveClouds(cloudsOffset, delta), moveWater(waterOffset, delta))
    ],
  },
  {
    mMainPath: [
      169, 162, 8,
      191, 126, 8,
      185, 64, 7,
      202, 39, 7,
      220, 62, 7,
      214, 129, 6,
      229, 167, 6,
      265, 189, 6,
      321, 207, 6,
      336, 238, 6,
      300, 238, 6,
      252, 209, 6,
      207, 205, 5,
      218, 181, 5,
      199, 162, 5,
      179, 180, 5,
      194, 206, 6,
      143, 206, 7,
      104, 242, 7,
      73, 234, 7,
      80, 202, 8,
      112, 190, 8
    ],
    mMetadata: [
      'Dunes',
      0xd6fc66,
      () => terrainGenerate(
        [
          { mHeight: 0, mColor: colorUnpack(0xff05a0e7) },
          { mHeight: 3, mColor: colorUnpack(0xff17bdfa) },
          { mHeight: 7, mColor: colorUnpack(0xff17d8fa) },
          { mHeight: 10, mColor: colorUnpack(0xff39eafd) }
        ], 16
      ),
      3, 0, 0, 1,
      () => {}
    ]
  },
  {
    mMainPath: [
      200, 63, 8,
      257, 65, 8,
      276, 73, 8,
      263, 90, 9,
      234, 125, 10,
      242, 152, 10,
      274, 180, 9,
      288, 194, 8,
      277, 204, 8,
      225, 209, 7,
      171, 218, 7,
      178, 188, 6,
      200, 147, 5,
      175, 115, 5,
      150, 137, 5,
      142, 172, 6,
      130, 182, 6,
      121, 170, 6,
      132, 130, 7,
      152, 71, 8
    ],
    mMetadata: [
      'Haunted Hills',
      0xa3804b,
      () => terrainGenerate(
        [
          { mHeight: 0, mColor: colorUnpack(0xff008600) },
          { mHeight: 2, mColor: colorUnpack(0xff498d70) },
          { mHeight: 4, mColor: colorUnpack(0xff669493) },
          { mHeight: 8, mColor: colorUnpack(0xffaaaaaa) },
          { mHeight: 10, mColor: colorUnpack(0xffffffff) }
        ], 16
      ),
      9, 1, 0, 3,
      (cloudsOffset: Vec2, _: Vec2, delta: number) => moveClouds(cloudsOffset, delta)
    ]
  },
  {
    mMainPath: [
      226, 171, 7,
      275, 122, 7,
      319, 65, 7,
      332, 59, 6,
      342, 68, 6,
      323, 89, 6,
      266, 158, 5,
      270, 172, 5,
      301, 184, 5,
      293, 202, 4,
      251, 187, 3,
      256, 214, 3,
      242, 223, 4,
      144, 262, 5,
      131, 248, 4,
      129, 215, 4,
      125, 182, 4,
      89, 177, 5,
      87, 156, 5,
      68, 153, 5,
      69, 127, 5,
      105, 127, 6,
      109, 98, 6,
      132, 100, 6,
      133, 127, 7,
      156, 223, 7
    ],
    mMetadata: [
      'Icy Mist',
      0xc382df,
      () => terrainGenerate(
        [
          { mHeight: 0, mColor: colorUnpack(0xffffde96) },
          { mHeight: 5, mColor: colorUnpack(0xffffa696) },
          { mHeight: 10, mColor: colorUnpack(0xfffdb6db) }
        ], 16
      ),
      6, 1, 4, 6,
      (cloudsOffset: Vec2, _: Vec2, delta: number) => moveClouds(cloudsOffset, delta)
    ]
  },
  {
    mMainPath: [
      189, 162, 8,
      93, 158, 7,
      71, 142, 6,
      82, 123, 5,
      105, 125, 4,
      120, 147, 4,
      136, 142, 4,
      130, 112, 5,
      77, 82, 5,
      37, 44, 4,
      75, 33, 4,
      217, 36, 4,
      299, 57, 5,
      353, 81, 6,
      350, 130, 6,
      385, 164, 7,
      381, 249, 7,
      354, 277, 8,
      331, 249, 9,
      331, 196, 8,
      290, 184, 9,
      267, 225, 7,
      299, 287, 7,
      276, 317, 6,
      277, 375, 6,
      227, 389, 5,
      162, 354, 5,
      155, 300, 4,
      171, 256, 3,
      160, 227, 3,
      98, 274, 3,
      54, 237, 4,
      68, 203, 5,
      218, 201, 6,
      238, 171, 7
    ],
    mMetadata: [
      "Dragon's Lair",
      0x2337a5,
      () => waterGenerate(
        colorUnpack(0xff0202b2),
        colorUnpack(0xff000080),
        colorUnpack(0xff008ee8)
      ),
      2, 1, 3, 2,
      (cloudsOffset: Vec2, waterOffset: Vec2, delta: number) => (moveClouds(cloudsOffset, delta), moveWater(waterOffset, delta))
    ]
  }
]
