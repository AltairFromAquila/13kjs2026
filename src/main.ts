import "./sys/context";

import { Game } from "./game";

const game = new Game();

let currentTime = performance.now();
let accTime = 0;

function run(time: number) {
  requestAnimationFrame(run);

  const delta = time - currentTime;  
  accTime += delta;

  game.process(game, delta);

  currentTime = time;
}

run(currentTime);