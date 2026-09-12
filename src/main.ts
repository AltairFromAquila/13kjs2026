import "./sys/context";

import { Game, gameInit } from "./game";

let currentTime = performance.now();

gameInit();
function run(time: number) {
  requestAnimationFrame(run);

  const delta = time - currentTime;
  Game.mProcess(Game, delta * 0.001);

  currentTime = time;
}

run(currentTime);