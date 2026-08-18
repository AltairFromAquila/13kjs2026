import { render } from "./core/render";
import { Track, trackCalculateSpline, trackDrawTexture } from "./game/track";
import { ctx } from "./sys/context";

const kTargetTickTime = 1/120;

export class Game {
  process: (self: Game, delta: number) => void = processWithFixed;
  accTime = 0;

  // TODO: Refactor later
  track: Track;

  constructor() {
    this.track = new Track();
    trackCalculateSpline(
      this.track,
      {
        mainPath: [
          {
            x: 20, y: 210, tension: 0, width: 40
          },
          {
            x: 510, y: 110, tension: 0, width: 40
          },
          {
            x: 110, y: 210, tension: 0, width: 40
          },
          {
            x: 110, y: 1110, tension: 0, width: 40
          },
          {
            x: 510, y: 1210, tension: 0, width: 40
          },
          {
            x: 1010, y: 1110, tension: 0, width: 40
          },
        ],
        secondaryPaths: [],
        alpha: 0.5
      }
    );
    trackDrawTexture(this.track);
  }
}

function processDefault(self: Game, delta: number) {
  render();
  ctx.drawImage(self.track.textureCanvas, 0, 0, 1000, 1000);
}

function processWithFixed(self: Game, delta: number) {
  if (self.accTime > kTargetTickTime) {
    for (; self.accTime > 0; self.accTime -= kTargetTickTime) {}
  }

  processDefault(self, delta);
}