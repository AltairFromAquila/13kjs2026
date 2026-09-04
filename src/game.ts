import { render } from "./core/render";
import { racerDataGetSkeleton, racerDataGetSkeletonShapes } from "./data/racer.data";
import { tracks } from "./data/track.data";
import { cloudsGenerate } from "./game/clouds";
import { racerFixedTick, racerNew, racerSetAngleFromVector, racerSetupTrackPoints, racerTick, type Racer } from "./game/racer";
import { Track, trackDrawTexture, trackGetStartPositions, trackLoadData } from "./game/track";

const kTargetTickTime = 1/120;

export interface Game {
  mProcess: (self: Game, delta: number) => void;
  mAccTime: number;

  // TODO: Refactor later
  mTrack: Track;
  mRacer: Racer;
}

export const Game: Game = {
  mProcess: processWithFixed,
  mAccTime: 0,
  mTrack: new Track(),
  mRacer: racerNew(
    racerDataGetSkeleton('#faa', '#000', '#b44', '#ff7', '#ff0'),
    racerDataGetSkeletonShapes('#faa', '#b44')
  ),
}

export const gameInit = () => {
  trackLoadData(Game.mTrack, tracks[2]);
  trackDrawTexture(Game.mTrack);
  cloudsGenerate();
  
  const startPositions = trackGetStartPositions(Game.mTrack);
  
  Game.mRacer.mPos = startPositions[0].mPos;
  racerSetAngleFromVector(Game.mRacer, startPositions[0].mTangent);

  racerSetupTrackPoints(Game.mRacer, startPositions[0]);

  console.log(Game.mRacer.mPos);
  console.log(Game.mRacer.mAngle);
}

function processDefault(self: Game, delta: number) {
  racerTick(self.mRacer, delta);
  render(self.mTrack, self.mRacer);
  // ctx.drawImage(self.track.textureCanvas, 0, -650, 2800, 2800);
  // ctx.drawImage(self.track.textureCanvas, 0, 0, 1400, 1400);
}

function processWithFixed(self: Game, delta: number) {
  self.mAccTime += delta;
  if (self.mAccTime > kTargetTickTime) {
    for (; self.mAccTime > 0; self.mAccTime -= kTargetTickTime) {
      racerFixedTick(self.mRacer, kTargetTickTime);
    }
  }

  processDefault(self, delta);
}