import { render } from "./core/render";
import { racerDataGetSkeleton, racerDataGetSkeletonShapes } from "./data/racer.data";
import { tracks } from "./data/track.data";
import { cloudsGenerate } from "./game/clouds";
import { racerNew, racerSetAngleFromVector, type Racer } from "./game/racer";
import { Track, trackDrawTexture, trackGetStartPositions, trackLoadData } from "./game/track";

const kTargetTickTime = 1/120;

export class Game {
  process: (self: Game, delta: number) => void = processWithFixed;
  accTime = 0;

  // TODO: Refactor later
  track: Track;
  racer: Racer;

  constructor() {
    this.racer = racerNew(
      racerDataGetSkeleton('#faa', '#000', '#b44', '#ff7', '#ff0'),
      racerDataGetSkeletonShapes('#faa', '#b44')
    );
    this.track = new Track();
    trackLoadData(this.track, tracks[2]);
    trackDrawTexture(this.track);
    cloudsGenerate();

    const startPositions = trackGetStartPositions(this.track);

    this.racer.mPos = startPositions[0].pos;
    racerSetAngleFromVector(this.racer, startPositions[0].tangent);

    console.log(this.racer.mPos);
    console.log(this.racer.mAngle);
  }
}

function processDefault(self: Game, delta: number) {
  render(self.track, self.racer);
  // ctx.drawImage(self.track.textureCanvas, 0, -650, 2800, 2800);
  // ctx.drawImage(self.track.textureCanvas, 0, 0, 1400, 1400);
}

function processWithFixed(self: Game, delta: number) {
  if (self.accTime > kTargetTickTime) {
    for (; self.accTime > 0; self.accTime -= kTargetTickTime) {}
  }

  processDefault(self, delta);
}