import { render, renderAssignPlanes, renderGetCloudsOffsetRef, renderGetTerrainOffsetRef, renderSetColors, renderSetFogValues, type RenderableCommand } from "./core/render";
import { racerData } from "./data/racer.data";
import { tracks, type TrackMetadata } from "./data/track.data";
import { cloudsGenerate, kCloudsNoiseWidth } from "./game/clouds";
import { racerFixedTick, racerNew, racerRender, racerReset, racerSetAngleFromVector, racerSetupTrackPoints, racerTick, type Racer } from "./game/racer";
import { Track, trackDrawTexture, trackGetStartPositions, trackLoadData } from "./game/track";
import { mathCeil, mathLerp, mathMin, mathRandom, mathTan, vec2Add, vec2Copy, vec2MulScalar, vec2New } from "./math";
import { cameraGameCamNew, cameraGameCamTick, type GameCamera, cameraGameCamSetupIntro } from "./game/camera";
import { kVerticalFov, type Camera } from "./core/camera";
import { uiCalculateResults, uiFadeIn, uiRenderGame, uiRenderMenu, uiReset, uiSetupPlayerInput } from "./game/ui";
import { controllerProcessAIForRacer, controllerProcessPlayerInput, controllerSetupPlayerInput } from "./game/controllers";
import { collisionActivateEntity } from "./game/collision";
import { kTerrainWidth } from "./game/terrain";
import { ctxGetCanvasImageData } from "./sys/context";

const kTargetTickTime = 1/120;

const kGamePointTable = [13, 10, 8, 6, 4, 3, 2, 1];

export const kGameModeRaceIntro = 0;
export const kGameModeRaceRacing = 1;
export const kGameModeRaceResults = 2;
export const kGameModeRaceFinalResult = 3;
export const kGameModeRaceMenu = 4;

export let gGameCloudsPlane: Uint32Array = 0 as any;

export interface Game {
  mProcess: (self: Game, delta: number) => void;
  mAccTime: number;

  mDifficulty: number;
  mGameMode: number;
  mSequenceTimer: number;

  // TODO: Refactor later
  mTrack: Track;
  mTrackMetadata: TrackMetadata;
  mCurrentTrack: number;
  mRacers: Racer[];
  mRacersOrdered: Racer[];
  mRacersStandings: Racer[];

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

      self.mRacersOrdered.forEach((r, i) => {
        r.mPoints += kGamePointTable[i];
      });
      self.mRacersStandings.sort(
        (a, b) => (a.mPoints !== b.mPoints)
          ? b.mPoints- a.mPoints
          : self.mRacers.indexOf(a) - self.mRacers.indexOf(b)
      );
      uiCalculateResults();
    }
  }

  cameraGameCamTick(self.mCamera as GameCamera, delta);
  render(self.mCamera, self.mRenderRacerCmd);
  uiRenderGame(delta);
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

const processMenu = (self: Game, delta: number) => {
  racerTick(self.mRacers[0], delta);
  uiRenderMenu(delta);
}

export const Game: Game = {
  mProcess: processMenu,
  mAccTime: 0,
  mDifficulty: 1,
  mGameMode: kGameModeRaceIntro,
  mSequenceTimer: 0,
  mTrack: new Track(),
  mTrackMetadata: tracks[0].mMetadata,
  mCurrentTrack: 0,
  mRacers: [
    racerNew(racerData[0]),
    racerNew(racerData[1]),
    racerNew(racerData[2]),
    racerNew(racerData[3]),
    racerNew(racerData[4]),
    racerNew(racerData[5]),
    racerNew(racerData[6]),
    racerNew(racerData[7]),
  ],
  mRacersOrdered: [],
  mRacersStandings: [],
  mCamera: cameraGameCamNew(),
  mRenderRacerCmd: {
    mRenderables: [],
    mScale: 440 / ((900 * 0.5) / mathTan(kVerticalFov * 0.5)),
    mAlpha: 0,
    mCommand: racerRender,
  }
}

const gameRandomizeComputerRacersData = () => {
  const playerRacer = Game.mRacers[0];
  const computerRacers = Game.mRacers.slice(1);
  const availableData = racerData.filter(data => data !== playerRacer.mData);

  for (let idx = availableData.length - 1; idx > 0; --idx) {
    const randomIdx = (mathRandom() * (idx + 1)) | 0;
    const temp = availableData[idx];
    availableData[idx] = availableData[randomIdx];
    availableData[randomIdx] = temp;
  }

  for (let idx = 0; idx < computerRacers.length && idx < availableData.length; ++idx) {
    computerRacers[idx].mData = availableData[idx];
  }
}

export const gameStartGame = () => {
  gameRandomizeComputerRacersData();
  Game.mRacers.forEach(racer => {
    racer.mPoints = 0;
  });
  gameGoToTrack(0);
}

export const gameGoToMenu = () => {
  Game.mSequenceTimer = 0;
  Game.mGameMode = kGameModeRaceMenu;

  Game.mProcess = processMenu;
  uiSetupPlayerInput();
  uiReset();
  uiFadeIn();
}

export const gameGoToTrack = (trackIdx: number) => {
  const track = tracks[trackIdx];

  trackLoadData(Game.mTrack, track);
  trackDrawTexture(Game.mTrack);

  Game.mTrackMetadata = track.mMetadata;
  Game.mCurrentTrack = trackIdx;

  const trackImageData = ctxGetCanvasImageData(Game.mTrack.textureCanvas.width, Game.mTrack.textureCanvas.height, Game.mTrack.textureCtx);

  renderAssignPlanes(
    trackImageData.mPixels,
    gGameCloudsPlane,
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

      racerReset(racer);
      vec2Add(
        vec2MulScalar(
          vec2Copy(racer.mPos, normal),
          widthFactor
        ),
        pos.mPos
      );
      racerSetAngleFromVector(racer, pos.mTangent);
      racerSetupTrackPoints(racer, pos);

      widthFactor += racerDistance;
    }
  }

  Game.mRacers[0].mController.mProcessFunction = controllerProcessPlayerInput;
  Game.mGameMode = kGameModeRaceIntro;
  Game.mSequenceTimer = 0;
  Game.mRenderRacerCmd.mAlpha = 0;
  Game.mProcess = processDefault;
  cameraGameCamSetupIntro(Game.mCamera as GameCamera);
  uiReset();
  uiFadeIn();
};

export const gameGoToFinal = () => {
  Game.mSequenceTimer = 0;
  Game.mGameMode = kGameModeRaceFinalResult;
}

export const gameInit = () => {
  gGameCloudsPlane = cloudsGenerate();

  Game.mRacers.forEach(racer => {
    Game.mRenderRacerCmd.mRenderables.push(racer);
    Game.mRacersOrdered.push(racer);
    Game.mRacersStandings.push(racer);
    collisionActivateEntity(racer);
  });

  (Game.mCamera as GameCamera).mTarget = Game.mRacers[0];
  controllerSetupPlayerInput(Game.mRacers[0].mController);

  // gameGoToTrack(0);
  gameGoToMenu();
}
