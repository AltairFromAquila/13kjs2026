import { render, type RenderableCommand } from "./core/render";
import { racerDataGetSkeleton, racerDataGetSkeletonShapes } from "./data/racer.data";
import { tracks } from "./data/track.data";
import { cloudsGenerate } from "./game/clouds";
import { racerFixedTick, racerNew, racerRender, racerSetAngleFromVector, racerSetupTrackPoints, racerTick, type Racer } from "./game/racer";
import { Track, trackDrawTexture, trackGetStartPositions, trackLoadData } from "./game/track";
import { mathJs, mathTan, vec2Copy } from "./math";
import { cameraFreeCamNew, cameraSetupFreeCamEvents, cameraHandleFreeCamInput, type FreeCamera, cameraGameCamNew, cameraGameCamTick, type GameCamera } from "./game/camera";
import { kVerticalFov, type Camera } from "./core/camera";
import { renderGameUI } from "./game/game-ui";
import { controllerProcessPlayerInput, controllerSetupPlayerInput } from "./game/controllers";

const kTargetTickTime = 1/120;

export interface Game {
  mProcess: (self: Game, delta: number) => void;
  mAccTime: number;

  // TODO: Refactor later
  mTrack: Track;
  mRacers: Racer[];

  mCamera: Camera;

  mRenderRacerCmd: RenderableCommand<Racer>;
}

export const Game: Game = {
  mProcess: processWithFixed,
  mAccTime: 0,
  mTrack: new Track(),
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
  mCamera: cameraGameCamNew(),
  // mCamera: cameraFreeCamNew(),
  mRenderRacerCmd: {
    mRenderables: [],
    mScale: 440 / ((900 * 0.5) / mathTan(kVerticalFov * 0.5)),
    mCommand: racerRender,
  }
}

export const gameInit = () => {
  trackLoadData(Game.mTrack, tracks[1]);
  trackDrawTexture(Game.mTrack);
  cloudsGenerate();
  
  const startPositions = trackGetStartPositions(Game.mTrack);
  
  for (let i = 0; i < Game.mRacers.length * 0.5; ++i) {
    vec2Copy(Game.mRacers[i].mPos, startPositions[0].mPos);
    racerSetAngleFromVector(Game.mRacers[i], startPositions[0].mTangent);
    racerSetupTrackPoints(Game.mRacers[i], startPositions[0]);

    Game.mRenderRacerCmd.mRenderables.push(Game.mRacers[i]);
  }
  for (let i = Game.mRacers.length * 0.5; i < Game.mRacers.length; ++i) {
    vec2Copy(Game.mRacers[i].mPos, startPositions[1].mPos);
    racerSetAngleFromVector(Game.mRacers[i], startPositions[1].mTangent);
    racerSetupTrackPoints(Game.mRacers[i], startPositions[1]);

    Game.mRenderRacerCmd.mRenderables.push(Game.mRacers[i]);
  }

  (Game.mCamera as GameCamera).mTarget = Game.mRacers[0];
  Game.mRacers[0].mIsPlayer = true;
  Game.mRacers[0].mController.mProcessFunction = controllerProcessPlayerInput;

  controllerSetupPlayerInput(Game.mRacers[0].mController);

  // cameraSetupFreeCamEvents(Game.mCamera as FreeCamera);

  console.log(Game.mRacers[0].mPos);
  console.log(Game.mRacers[0].mAngle);
}

function processDefault(self: Game, delta: number) {
  for (const racer of self.mRacers) {
    racerTick(racer, delta);
  }
  cameraGameCamTick(self.mCamera as GameCamera, delta);
  // cameraHandleFreeCamInput(self.mCamera as FreeCamera, delta);
  render(self.mCamera, self.mTrack, self.mRenderRacerCmd);
  renderGameUI(delta);
  // ctx.drawImage(self.track.textureCanvas, 0, -650, 2800, 2800);
  // ctx.drawImage(self.track.textureCanvas, 0, 0, 1400, 1400);
}

function processWithFixed(self: Game, delta: number) {
  self.mAccTime = mathJs.min(self.mAccTime + delta, 5);
  if (self.mAccTime > kTargetTickTime) {
    for (; self.mAccTime > 0; self.mAccTime -= kTargetTickTime) {
      for (const racer of self.mRacers) {
        racerFixedTick(racer, kTargetTickTime);
      }
    }
  }

  processDefault(self, delta);
}