import "./sys/context";

import { Game } from "./game";

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  // Worker thread
} else {
  // Main thread

  const game = new Game();
  let currentTime = performance.now();

  function run(time: number) {
    requestAnimationFrame(run);

    const delta = time - currentTime;
    game.process(game, delta * 0.001);

    currentTime = time;
  }

  run(currentTime);
}