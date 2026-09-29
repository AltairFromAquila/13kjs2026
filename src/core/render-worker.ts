import { vec2New } from "../math";
import { kRenderWorkerOpAssignPlanes, kRenderWorkerOpRenderProjectedPlaneFragment, kRenderWorkerOpSetCachedValues, kRenderWorkerOpSetColors, kRenderWorkerOpSetFogValues, kRenderWorkerOpSetTanTables, type BaseRenderState, type RenderFrameCache } from "./base-render";

type AssignPlanesData = [
  opCode: typeof kRenderWorkerOpAssignPlanes,
  trackPixels: Uint32Array | 0,
  cloudsPixels: Uint32Array | 0,
  terrainPixels: Uint32Array | 0,
  trackWidth: number,
  cloudsWidth: number,
  terrainWidth: number,
  skyCloudsHeight: number,
  cloudsHeight: number,
  terrainHeight: number
];
type SetFogValuesData = [
  opCode: typeof kRenderWorkerOpSetFogValues,
  distance: number,
  intensity: number
];
type SetColorsData = [
  opCode: typeof kRenderWorkerOpSetColors,
  skyColor: number,
  groundColor: number
];
type SetTanTablesData = [
  opCode: typeof kRenderWorkerOpSetTanTables,
  verTanTable: number[],
  horTanTable: number[]
];
type SetCachedValuesData = [
  opCode: typeof kRenderWorkerOpSetCachedValues,
  camAngleSin: number,
  camAngleCos: number,
  camPitchSin: number,
  camPitchCos: number
];
type RenderProjectedPlaneFragmentData = [
  opCode: typeof kRenderWorkerOpRenderProjectedPlaneFragment,
  imageFragment: Uint32Array,
  width: number,
  startLine: number,
  lines: number
]
type AnyRenderOp =
  typeof kRenderWorkerOpRenderProjectedPlaneFragment |
  typeof kRenderWorkerOpAssignPlanes |
  typeof kRenderWorkerOpSetFogValues |
  typeof kRenderWorkerOpSetColors |
  typeof kRenderWorkerOpSetTanTables |
  typeof kRenderWorkerOpSetCachedValues;

type RenderWorkerPayloadByOp = {
  [kRenderWorkerOpRenderProjectedPlaneFragment]: RenderProjectedPlaneFragmentData;
  [kRenderWorkerOpAssignPlanes]: AssignPlanesData;
  [kRenderWorkerOpSetFogValues]: SetFogValuesData;
  [kRenderWorkerOpSetColors]: SetColorsData;
  [kRenderWorkerOpSetTanTables]: SetTanTablesData;
  [kRenderWorkerOpSetCachedValues]: SetCachedValuesData;
};
type AnyRenderData = RenderWorkerPayloadByOp[AnyRenderOp];

const renderState: BaseRenderState = {
  mVerTanTable: [],
  mHorTanTable: [],

  mTerrainPixels: 0,
  mCloudsPixels: 0,
  mTrackPixels: 0,

  mTerrainOffset: vec2New(),
  mCloudsOffset: vec2New(),

  mSkyColor: 0,
  mGroundColor: 0,

  mSkyCloudsHeight: 0,
  mCloudsHeight: 0,
  mTerrainHeight: 0,

  mTerrainWidth: 0,
  mCloudsWidth: 0,
  mTrackWidth: 0,

  mFogDistance: 0.2,
  mFogIntensity: 1.1,
};
const renderFrameCache: RenderFrameCache = {
  mCamAngleSin: 0,
  mCamAngleCos: 0,
  mCamPitchSin: 0,
  mCamPitchCos: 0,
};

const renderWorkerOperations: {
  [K in AnyRenderOp]: (args: RenderWorkerPayloadByOp[K]) => void;
} = {
  [kRenderWorkerOpRenderProjectedPlaneFragment]: (args: RenderProjectedPlaneFragmentData) => {},
  [kRenderWorkerOpAssignPlanes]: (args: AssignPlanesData) => {
    renderState.mTrackPixels = args[1];
    renderState.mCloudsPixels = args[2];
    renderState.mTerrainPixels = args[3];

    renderState.mTrackWidth = args[4];
    renderState.mCloudsWidth = args[5];
    renderState.mTerrainWidth = args[6];

    renderState.mSkyCloudsHeight = args[7];
    renderState.mCloudsHeight = args[8];
    renderState.mTerrainHeight = args[9];
  },
  [kRenderWorkerOpSetFogValues]: (args: SetFogValuesData) => {
    renderState.mFogDistance = args[1];
    renderState.mFogIntensity = args[2];
  },
  [kRenderWorkerOpSetColors]: (args: SetColorsData) => {
    renderState.mSkyColor = args[1];
    renderState.mGroundColor = args[2];
  },
  [kRenderWorkerOpSetTanTables]: (args: SetTanTablesData) => {
    renderState.mVerTanTable = args[1];
    renderState.mHorTanTable = args[2];
  },
  [kRenderWorkerOpSetCachedValues]: (args: SetCachedValuesData) => {
    renderFrameCache.mCamAngleSin = args[1];
    renderFrameCache.mCamAngleCos = args[2];
    renderFrameCache.mCamPitchSin = args[3];
    renderFrameCache.mCamPitchCos = args[4];
  },
}

self.onmessage = (event) => {
  const data = event.data;
  if (
    Array.isArray(data) && (
      data[0] === kRenderWorkerOpRenderProjectedPlaneFragment ||
      data[0] === kRenderWorkerOpAssignPlanes ||
      data[0] === kRenderWorkerOpSetFogValues ||
      data[0] === kRenderWorkerOpSetColors ||
      data[0] === kRenderWorkerOpSetTanTables ||
      data[0] === kRenderWorkerOpSetCachedValues
    )
  ) {
    const op = data[0] as AnyRenderOp;
    (renderWorkerOperations[op] as (args: AnyRenderData) => void)(data as AnyRenderData);
  }
}
