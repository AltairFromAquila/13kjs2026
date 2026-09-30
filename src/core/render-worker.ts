import { vec2New } from "../math";
import { kRenderWorkerOpAssignPlanes, kRenderWorkerOpRenderProjectionFragment, kRenderWorkerOpSetColors, kRenderWorkerOpSetFogValues, kRenderWorkerOpSetTanTables, renderRenderProjection, type AssignPlanesData, type BaseRenderState, type RenderProjectionFragmentData, type SetColorsData, type SetFogValuesData, type SetTanTablesData } from "./base-render";

type AnyRenderOp =
  typeof kRenderWorkerOpRenderProjectionFragment |
  typeof kRenderWorkerOpAssignPlanes |
  typeof kRenderWorkerOpSetFogValues |
  typeof kRenderWorkerOpSetColors |
  typeof kRenderWorkerOpSetTanTables;

type RenderWorkerPayloadByOp = {
  [kRenderWorkerOpRenderProjectionFragment]: RenderProjectionFragmentData;
  [kRenderWorkerOpAssignPlanes]: AssignPlanesData;
  [kRenderWorkerOpSetFogValues]: SetFogValuesData;
  [kRenderWorkerOpSetColors]: SetColorsData;
  [kRenderWorkerOpSetTanTables]: SetTanTablesData;
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

const renderWorkerOperations: {
  [K in AnyRenderOp]: (args: RenderWorkerPayloadByOp[K]) => void;
} = {
  [kRenderWorkerOpRenderProjectionFragment]: (args: RenderProjectionFragmentData) => {
    renderRenderProjection(
      renderState,
      args[1], args[2], args[3],
      args[4], args[5], args[6],
      args[7], args[8],
      args[9], args[10],
      args[11]
    );

    self.postMessage(args[11], [args[11].buffer]);
  },
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
}

self.onmessage = (event) => {
  const data = event.data;
  if (
    Array.isArray(data) && (
      data[0] === kRenderWorkerOpRenderProjectionFragment ||
      data[0] === kRenderWorkerOpAssignPlanes ||
      data[0] === kRenderWorkerOpSetFogValues ||
      data[0] === kRenderWorkerOpSetColors ||
      data[0] === kRenderWorkerOpSetTanTables
    )
  ) {
    const op = data[0] as AnyRenderOp;
    (renderWorkerOperations[op] as (args: AnyRenderData) => void)(data as AnyRenderData);
  }
}
