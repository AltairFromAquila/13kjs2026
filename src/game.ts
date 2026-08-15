import { render } from "./core/render";

const kTargetTickTime = 1/120;

export class Game {
  process: (self: Game, delta: number) => void = processWithFixed;
  accTime = 0;
}

function processDefault(self: Game, delta: number) {
  render();
}

function processWithFixed(self: Game, delta: number) {
  if (self.accTime > kTargetTickTime) {
    for (; self.accTime > 0; self.accTime -= kTargetTickTime) {}
  }

  processDefault(self, delta);
}