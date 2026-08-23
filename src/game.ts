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
            x: 48, y: 990, tension: 0, width: 80
          },
          {
            x: 65, y: 1204, tension: 0, width: 80
          },
          {
            x: 315, y: 1590, tension: 0, width: 80
          },
          {
            x: 615, y: 1690, tension: 0, width: 80
          },
          {
            x: 715, y: 1698, tension: 0, width: 80
          },
          {
            x: 815, y: 1690, tension: 0, width: 80
          },
          {
            x: 1115, y: 1590, tension: 0, width: 80
          },
          {
            x: 1375, y: 1204, tension: 0, width: 80
          },
          {
            x: 1390, y: 990, tension: 0, width: 80
          },
          {
            x: 1390, y: 590, tension: 0, width: 80
          },
          {
            x: 1375, y: 490, tension: 0, width: 80
          },
          {
            x: 1115, y: 190, tension: 0, width: 80
          },
          {
            x: 815, y: 90, tension: 0, width: 80
          },
          {
            x: 715, y: 80, tension: 0, width: 80
          },
          {
            x: 615, y: 90, tension: 0, width: 80
          },
          {
            x: 315, y: 190, tension: 0, width: 80
          },
          {
            x: 65, y: 490, tension: 0, width: 80
          },
          {
            x: 50, y: 590, tension: 0, width: 80
          },
        ],
        secondaryPaths: [
          {
            branchInPath: { path: -1, point: 0 },
            branchOffPath: { path: -1, point: 12 },
            depthChanges: { 2: 1 },
            path: [
              {
                x: 700, y: 60, tension: 0, width: 40
              },
              {
                x: 150, y: 80, tension: 0, width: 60
              },
              {
                x: 100, y: 120, tension: 0, width: 80
              },
            ]
          }
        ],
        alpha: 0.5
      }
    );
    trackDrawTexture(this.track);
  }
}

function processDefault(self: Game, delta: number) {
  render(self.track);
  // ctx.drawImage(self.track.textureCanvas, 0, -650, 2800, 2800);
  // ctx.drawImage(self.track.textureCanvas, 0, 0, 1400, 1400);
}

function processWithFixed(self: Game, delta: number) {
  if (self.accTime > kTargetTickTime) {
    for (; self.accTime > 0; self.accTime -= kTargetTickTime) {}
  }

  processDefault(self, delta);
}