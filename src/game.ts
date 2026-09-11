import { render, renderAssignPlanes, renderGetCloudsOffsetRef, renderGetTerrainOffsetRef, renderSetColors, renderSetFogValues, type RenderableCommand } from "./core/render";
import { racerDataGetSkeleton, racerDataGetSkeletonShapes } from "./data/racer.data";
import { tracks, type TrackMetadata } from "./data/track.data";
import { cloudsGenerate, cloudsGetPixels, kCloudsNoiseWidth } from "./game/clouds";
import { racerFixedTick, racerNew, racerRender, racerSetAngleFromVector, racerSetupTrackPoints, racerTick, type Racer } from "./game/racer";
import { Track, trackDrawTexture, trackGetStartPositions, trackLoadData } from "./game/track";
import { mathCeil, mathLerp, mathMin, mathRandom, mathTan, vec2Add, vec2Copy, vec2MulScalar, vec2New } from "./math";
import { cameraFreeCamNew, cameraSetupFreeCamEvents, cameraHandleFreeCamInput, type FreeCamera, cameraGameCamNew, cameraGameCamTick, type GameCamera, cameraGameCamSetupIntro } from "./game/camera";
import { kVerticalFov, type Camera } from "./core/camera";
import { renderGameUI } from "./game/game-ui";
import { controllerProcessAIForRacer, controllerProcessPlayerInput, controllerSetupPlayerInput } from "./game/controllers";
import { collisionActivateEntity } from "./game/collision";
import { kTerrainWidth } from "./game/terrain";
import { ctxGetCanvasImageData } from "./sys/context";

const kTargetTickTime = 1/120;

export const kGameModeRaceIntro = 0;
export const kGameModeRaceRacing = 1;
export const kGameModeRaceResults = 2;
export const kGameModeRaceFinalResult = 3;
export const kGameModeRaceMenu = 4;

export interface Game {
  mProcess: (self: Game, delta: number) => void;
  mAccTime: number;

  mGameMode: number;
  mSequenceTimer: number;

  // TODO: Refactor later
  mTrack: Track;
  mTrackMetadata: TrackMetadata;
  mRacers: Racer[];
  mRacersOrdered: Racer[];

  mCamera: Camera;

  mRenderRacerCmd: RenderableCommand<Racer>;
}

const processDefault = (self: Game, delta: number) => {
  for (const racer of self.mRacers) {
    racerTick(racer, delta);
  }

  self.mTrackMetadata[7](
    renderGetCloudsOffsetRef(),
    renderGetTerrainOffsetRef(),
    delta
  );

  if (self.mGameMode === kGameModeRaceIntro) {
    self.mSequenceTimer += delta;

    if (self.mSequenceTimer > 9 && mathRandom() < 0.1) {
      self.mGameMode = kGameModeRaceRacing;
      self.mProcess = processWithFixed;
    } if (self.mSequenceTimer > 5) {
      self.mRenderRacerCmd.mAlpha = mathLerp(0, 1, mathMin(self.mSequenceTimer - 5, 1));
    }
  } else if (self.mGameMode === kGameModeRaceFinalResult) {
    self.mSequenceTimer += delta;

    if (self.mSequenceTimer > 1) {
      self.mProcess = processDefault;
    }
  } else if (self.mGameMode === kGameModeRaceRacing) {
    self.mRacersOrdered.sort((a, b) => {
      if (a.mLapTracker !== b.mLapTracker) {
        return b.mLapTracker - a.mLapTracker;
      }

      const aMainTrackPoint = a.mTrackPoints[-1];
      const bMainTrackPoint = b.mTrackPoints[-1];
      const aSegmentIdx = aMainTrackPoint.mSegmentIdx;
      const bSegmentIdx = bMainTrackPoint.mSegmentIdx;

      if (aSegmentIdx !== bSegmentIdx) {
        return bSegmentIdx - aSegmentIdx;
      }

      const aT = aMainTrackPoint.t;
      const bT = bMainTrackPoint.t;

      if (aT !== bT) {
        return bT - aT;
      }

      return self.mRacers.indexOf(a) - self.mRacers.indexOf(b);
    });

    if (self.mRacers[0].mLap > 3) {
      self.mGameMode = kGameModeRaceResults;
      Game.mRacers[0].mController.mProcessFunction = controllerProcessAIForRacer;
    }
  }

  cameraGameCamTick(self.mCamera as GameCamera, delta);
  // cameraHandleFreeCamInput(self.mCamera as FreeCamera, delta);
  render(self.mCamera, self.mRenderRacerCmd);
  renderGameUI(delta);
}

const processWithFixed = (self: Game, delta: number) => {
  self.mAccTime = mathMin(self.mAccTime + delta, 5);
  if (self.mAccTime > kTargetTickTime) {
    for (; self.mAccTime > 0; self.mAccTime -= kTargetTickTime) {
      for (const racer of self.mRacers) {
        racerFixedTick(racer, kTargetTickTime);
      }
    }
  }

  processDefault(self, delta);
}

export const Game: Game = {
  mProcess: processDefault,
  mAccTime: 0,
  mGameMode: kGameModeRaceIntro,
  mSequenceTimer: 0,
  mTrack: new Track(),
  mTrackMetadata: tracks[0].mMetadata,
  mRacers: [
    racerNew(
      racerDataGetSkeleton('#faa', '#000', '#b44', '#ff7', '#ff0'),
      racerDataGetSkeletonShapes('#faa', '#b44')
    ),
    racerNew(
      racerDataGetSkeleton('#ffa', '#000', '#bb4', '#ccc', '#fff'),
      racerDataGetSkeletonShapes('#ffa', '#bb4')
    ),
    racerNew(
      racerDataGetSkeleton('#afa', '#000', '#4b4', '#fc5', '#fa0'),
      racerDataGetSkeletonShapes('#afa', '#4b4')
    ),
    racerNew(
      racerDataGetSkeleton('#aff', '#000', '#4bb', '#56f', '#56a'),
      racerDataGetSkeletonShapes('#aff', '#4bb')
    ),
    racerNew(
      racerDataGetSkeleton('#aaf', '#000', '#44b', '#b5f', '#b5a'),
      racerDataGetSkeletonShapes('#aaf', '#44b')
    ),
    racerNew(
      racerDataGetSkeleton('#faf', '#000', '#b4b', '#f77', '#f00'),
      racerDataGetSkeletonShapes('#faf', '#b4b')
    ),
    racerNew(
      racerDataGetSkeleton('#fff', '#0af', '#aaa', '#ffc', '#ff7'),
      racerDataGetSkeletonShapes('#fff', '#aaa')
    ),
    racerNew(
      racerDataGetSkeleton('#444', '#fff', '#000', '#f55', '#f00'),
      racerDataGetSkeletonShapes('#444', '#000')
    ),
  ],
  mRacersOrdered: [],
  mCamera: cameraGameCamNew(),
  // mCamera: cameraFreeCamNew(),
  mRenderRacerCmd: {
    mRenderables: [],
    mScale: 440 / ((900 * 0.5) / mathTan(kVerticalFov * 0.5)),
    mAlpha: 0,
    mCommand: racerRender,
  }
}

export const gameInit = () => {
  const track = tracks[3];

  trackLoadData(Game.mTrack, track);
  trackDrawTexture(Game.mTrack);
  cloudsGenerate();

  Game.mTrackMetadata = track.mMetadata;

  const trackImageData = ctxGetCanvasImageData(Game.mTrack.textureCtx, Game.mTrack.textureCanvas.width, Game.mTrack.textureCanvas.height);

  renderAssignPlanes(
    trackImageData.mPixels,
    cloudsGetPixels(),
    track.mMetadata[2](),
    Game.mTrack.textureCanvas.width, kCloudsNoiseWidth, kTerrainWidth,
    track.mMetadata[5] * 30, track.mMetadata[4] * 30, track.mMetadata[3] * 30
  );
  renderSetColors(track.mMetadata[1], 0xff00cc30);
  renderSetFogValues(track.mMetadata[6] / 10, 1.1);
  
  const racersCount = Game.mRacers.length;
  const startRows = 2;
  const racersPerRow = mathCeil(racersCount / startRows);
  const startPositions = trackGetStartPositions(Game.mTrack, startRows);

  for (let idx = 0; idx < startRows; ++idx) {
    const pos = startPositions[idx];
    const racerDistance = pos.mWidth / (racersPerRow + 1);
    const normal = vec2New(-pos.mTangent.y, pos.mTangent.x);
    const firstRacerInRow = racersPerRow * idx;
    const firstRacerInNextRow = racersPerRow * (idx + 1);
    let widthFactor = (pos.mWidth * -0.5) + racerDistance;

    for (let racerIdx = firstRacerInRow; racerIdx < firstRacerInNextRow && racerIdx < racersCount; ++racerIdx) {
      const racer = Game.mRacers[racerIdx];

      vec2Add(
        vec2MulScalar(
          vec2Copy(racer.mPos, normal),
          widthFactor
        ),
        pos.mPos
      );
      racerSetAngleFromVector(racer, pos.mTangent);
      racerSetupTrackPoints(racer, pos);

      Game.mRenderRacerCmd.mRenderables.push(racer);
      Game.mRacersOrdered.push(racer);
      collisionActivateEntity(racer);

      widthFactor += racerDistance;
    }
  }

  (Game.mCamera as GameCamera).mTarget = Game.mRacers[0];

  Game.mRacers[0].mController.mProcessFunction = controllerProcessPlayerInput;
  controllerSetupPlayerInput(Game.mRacers[0].mController);

  // cameraSetupFreeCamEvents(Game.mCamera as FreeCamera);

  cameraGameCamSetupIntro(Game.mCamera as GameCamera);

  console.log(Game.mRacers[0].mPos);
  console.log(Game.mRacers[0].mAngle);
}
