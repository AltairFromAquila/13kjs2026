import { racerData } from "../data/racer.data";
import { Game, gameGoToFinal, gameGoToMenu, gameGoToTrack, gameStartGame, kGameModeRaceFinalResult, kGameModeRaceIntro, kGameModeRaceResults } from "../game";
import { kMathPi, kMathTau, mathClamp, mathFloor, mathLerp, mathMax, mathMin, mathMod, mathRandom, numberToString, vec2Length } from "../math";
import { ctx, ctxBeginPath, ctxClosePathAndFill, ctxFillText, ctxGetRainbowGradient, ctxLineTo, ctxMoveTo, ctxSetFillStyle, ctxSetGlobalAlpha, ctxSetTextAlign } from "../sys/context";
import { kWindowEventKeyDown, windowAddEventListener, windowRemoveEventListener } from "../sys/window";
import { racerRender } from "./racer";

type KeyBoardEventListener = (event: KeyboardEvent) => void;

const gResultsTimes = [0, 0, 0, 0, 0, 0, 0, 0];

let gTextHue = mathRandom() * 360;

let gFadeDirection = 0;
let gFadeValue = 0;

let gUIControlValue1 = 0;
let gUIControlValue2 = 0;

let gLastLapTimer = 0;
let gLastLap = 0;
let gLapColor = '#ff7';
let gShowingGap = false;
let gGapTimeText = '';
let gGapTimeColor = '#7f7';
let gGapTimer = -1;

let gSelection = 0;
let gRacerSelection = 0;

let gKeyDownCallback: KeyBoardEventListener | 0 = 0;

const uiSetFont = (fontSize: number) => {
  ctx.font = `bold ${fontSize}px Georgia, Verdana, sans-serif`;
};

export const uiReset = () => {
  gUIControlValue1 = 0;
  gUIControlValue2 = 0;
  gLastLapTimer = 0;
  gLastLap = 0;
  gLapColor = '#ff7';
  gShowingGap = false;
  gGapTimeText = '';
  gGapTimeColor = '#7f7';
  gGapTimer = -1;
}

export const uiCalculateResults = () => {
  let estimatedTime = 0;

  Game.mRacersOrdered.forEach((r, i) => {
    if (estimatedTime) {
      gResultsTimes[i] = estimatedTime;
      estimatedTime += (mathRandom() * 2) + 0.01;
    } else {
      gResultsTimes[i] = r.mTotalTime - r.mLapTime;

      const nextRacer = i + 1;
      if (r === Game.mPlayerRacer && nextRacer < Game.mRacersOrdered.length) {
        const r2 = Game.mRacersOrdered[nextRacer];
        const lapDelta = 4 - r2.mLap;
        const calculatedETA = r2.mBestLapTime
         ? (r2.mTotalTime - r2.mLapTime) + ((r2.mBestLapTime + 1 + (mathRandom() * 2)) * lapDelta)
         : r2.mTotalTime * 3;

        estimatedTime = (calculatedETA < gResultsTimes[i]) ? (gResultsTimes[i] + mathRandom()) : calculatedETA;
      }
    }
  });
};

export const uiFadeIn = () => {
  gFadeValue = 1;
  gFadeDirection = -1;
};

export const uiFadeOut = () => {
  gFadeValue = 0;
  gFadeDirection = 1;
};

export const uiSetupPlayerInput = () => {
  gKeyDownCallback = (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
      case "KeyS":
      case "ArrowDown":
        gSelection ^= 1;
        break;
      case "KeyA":
      case "ArrowLeft":
        if (gSelection) {
          Game.mDifficulty = mathMod(Game.mDifficulty - 1, 3);
        } else {
          gRacerSelection = mathMod(gRacerSelection - 1, 8);
          Game.mPlayerRacer.mData = racerData[gRacerSelection];
        }
        break;
      case "KeyD":
      case "ArrowRight":
        if (gSelection) {
          Game.mDifficulty = mathMod(Game.mDifficulty + 1, 3);
        } else {
          gRacerSelection = mathMod(gRacerSelection + 1, 8);
          Game.mPlayerRacer.mData = racerData[gRacerSelection];
        }
        break;
      case "KeyK":
        if (!event.repeat) {
          uiRemovePlayerInput();
          uiFadeOut();

          gUIControlValue2 = 1;
        }
        break;
    }
  };

  windowAddEventListener(kWindowEventKeyDown, gKeyDownCallback);
};

export const uiRemovePlayerInput = () => {
  if (gKeyDownCallback) {
    windowRemoveEventListener(kWindowEventKeyDown, gKeyDownCallback);
    gKeyDownCallback = 0;
  }
};

export const uiRenderGame = (delta: number) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = (height > 720) ? 1.5 : 1;
  const playerRacer = Game.mPlayerRacer;

  const drawTimeElement = (
    msText: string, sText: string, mText: string,
    xMs: number, xS: number, xM: number, y: number
  ) => {
    ctxSetTextAlign('left');
    ctxFillText(msText, xMs, y);
    ctxSetTextAlign('right');
    ctxFillText(sText, xS, y);
    ctxFillText(mText, xM, y);
  };
  const drawInGameTimer = (time: number, y: number) => {
    const seconds = time | 0;
    const milliseconds = mathFloor((time - seconds) * 1000);
    const minutes = mathFloor(seconds / 60);
    const remainingSeconds = seconds % 60;

    drawTimeElement(
      numberToString(milliseconds, 3),
      numberToString(remainingSeconds, 2) + '.',
      numberToString(minutes, 2) + ':',
      -56, -57, -87, y
    );
  };
  const drawNoTimeTimer = (y: number) => drawTimeElement('---', '--.', '--:', -56, -57, -87, y);
  const drawTimeResultEntry = (index: number, name: string, time: number, color: string) => {
    const y = 90 + (index * 35);
    const seconds = time | 0;
    const milliseconds = mathFloor((time - seconds) * 1000);
    const minutes = mathFloor(seconds / 60);
    const remainingSeconds = seconds % 60;

    ctxSetFillStyle(color);
    ctxSetTextAlign('right');
    ctxFillText(`${index + 1}`, -165, y);
    drawTimeElement(
      numberToString(milliseconds, 3),
      numberToString(remainingSeconds, 2) + '.',
      numberToString(minutes, 2) + ':',
      139, 138, 96, y
    )
    ctxSetTextAlign('left');
    ctxFillText(name, -150, y);
  }
  const drawStandingsEntry = (index: number, name: string, points: number, color: string) => {
    const y = 90 + (index * 35);

    ctxSetFillStyle(color);
    ctxSetTextAlign('right');
    ctxFillText(`${index + 1}`, -165, y);
    ctxFillText(`${points} pts.`, 180, y);
    ctxSetTextAlign('left');
    ctxFillText(name, -150, y);
  }
  const drawResultPanel = (alphaFactor: number, title: string) => {
    ctxSetGlobalAlpha(0.5 * alphaFactor);
    ctx.fillRect(-210, 0, 420, 360);
    ctxSetGlobalAlpha(alphaFactor);

    uiSetFont(32);
    ctxSetFillStyle('#fff');
    ctxFillText(title, 0, 42);
  }

  ctx.save();

  ctx.strokeStyle = '#8888';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 1;
  ctx.shadowColor = '#0008';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.scale(scale, scale);

  gTextHue = (gTextHue + delta * 10) % 360;

  ctx.translate((width / scale) / 2, 120);
  ctxSetTextAlign('center');

  if (Game.mGameMode === kGameModeRaceResults) {
    gUIControlValue1 += delta;

    if (gUIControlValue2 === 1) {
      ctxSetGlobalAlpha(mathLerp(1, 0, mathClamp(gUIControlValue1 - 2, 0, 1)));

      if (gUIControlValue1 > 3) {
        gUIControlValue1 -= 3;
        gUIControlValue2 = 2;
      }

      uiSetFont(64);
      ctxSetFillStyle(`hsl(${gTextHue}, 100%, 85%)`);
      ctxFillText('FINISH !', 0, 70);
    } else if (gUIControlValue2 < 4) {
      const alphaFactor = (gUIControlValue2 === 2)
        ? mathLerp(0, 1, mathClamp(gUIControlValue1, 0, 1))
        : mathLerp(1, 0, mathClamp(gUIControlValue1, 0, 1));
      
      if (gUIControlValue2 === 2 && gUIControlValue1 > 6) {
        gUIControlValue1 -= 6;
        gUIControlValue2 = 3;
      } else if (gUIControlValue2 === 3 && gUIControlValue1 > 1) {
        gUIControlValue1 = 0;
        gUIControlValue2 = 4;
      }
      
      drawResultPanel(alphaFactor, 'Race Results');
      uiSetFont(24);
      Game.mRacersOrdered.forEach(
        (r, i) => drawTimeResultEntry(
          i, r.mData[0], gResultsTimes[i], (r === playerRacer) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff'
        )
      );
    } else if (gUIControlValue2 < 6) {
      const alphaFactor = (gUIControlValue2 === 4)
        ? mathLerp(0, 1, mathClamp(gUIControlValue1, 0, 1))
        : mathLerp(1, 0, mathClamp(gUIControlValue1, 0, 1));
      
      if (gUIControlValue2 === 4 && gUIControlValue1 > 6) {
        gUIControlValue1 -= 6;
        gUIControlValue2 = 5;
      } else if (gUIControlValue2 === 5 && gUIControlValue1 > 1) {
        gUIControlValue1 = 0;
        gUIControlValue2 = 6;
      }

      drawResultPanel(alphaFactor, 'Standings');
      uiSetFont(24);
      Game.mRacersStandings.forEach(
        (r, i) => drawStandingsEntry(
          i, r.mData[0], r.mPoints, (r === playerRacer) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff'
        )
      );
    } else if (gUIControlValue2 < 7) {
      if (Game.mCurrentTrack < 5) {
        uiFadeOut();
      }
      gUIControlValue2 = 7;
    } else if (gUIControlValue2 < 8) {
      if (gUIControlValue1 > 1) {
        gUIControlValue2 = 8;
        
        if (Game.mCurrentTrack < 5) {
          gameGoToTrack(Game.mCurrentTrack + 1);
        } else {
          gameGoToFinal();
        }
      }
    }

    ctxSetGlobalAlpha(1);
  } else if (Game.mGameMode === kGameModeRaceFinalResult) {
    if (Game.mSequenceTimer > 1) {
      const playerPosition = Game.mRacersStandings.indexOf(playerRacer) + 1;

      gUIControlValue1 += delta;
      if (gUIControlValue1 > 11) {
        uiFadeOut();
        if (gUIControlValue1 > 12) {
          gameGoToMenu();
        }
      }

      ctxSetGlobalAlpha(mathLerp(0, 1, mathClamp(gUIControlValue1, 0, 1)));

      if (playerPosition < 4) {
        uiSetFont(64);
        ctxSetFillStyle(`hsl(${gTextHue}, 100%, 85%)`);
        ctxFillText('Congratulations!', 0, 70);

        uiSetFont(32);
        ctxSetFillStyle('#fff');
        if (playerPosition < 2) {
          ctxFillText("Oh yeah! You've got the first place!", 0, 120);
        } else {
          ctxFillText(
            `You've finished ${(playerPosition < 3) ? '2nd' : '3rd'}! Well done!`,
            0, 120
          );
        }
      } else {
        uiSetFont(32);
        ctxSetFillStyle('#fff');
        ctxFillText(`You finished ${playerPosition}th. Better luck next time!`, 0, 120);
      }

      ctxSetGlobalAlpha(1);
    }
  } else {
    const speed = vec2Length(playerRacer.mVel) * 0.42;
    const playerPosition = Game.mRacersOrdered.indexOf(playerRacer) + 1;
    const leaderRacer = (playerPosition > 1) ? Game.mRacersOrdered[0] : Game.mRacersOrdered[1];

    if (Game.mGameMode === kGameModeRaceIntro) {
      if (Game.mSequenceTimer < 5) {
        ctxSetGlobalAlpha(mathLerp(0, 1, mathMin(mathClamp(4 - Game.mSequenceTimer, 0, 1), 1)));

        uiSetFont(32);
        ctxSetFillStyle(`hsl(${gTextHue}, 100%, 85%)`);
        ctxFillText(Game.mTrackMetadata[0], 0, 60);

        ctxSetGlobalAlpha(0);
      } else {
        ctxSetGlobalAlpha(mathLerp(0, 1, mathMin(Game.mSequenceTimer - 5, 1)));

        uiSetFont(32);
        ctxSetFillStyle('#fff');
        ctxFillText('Ready...', 0, 60);
      }
    } else {
      if (gUIControlValue1 > 0 && playerRacer.mLap === 3) {
        gUIControlValue1 -= delta / 2;
        if (gUIControlValue1 < 0) gUIControlValue1 = 0;
        gUIControlValue2 = 1;

        ctxSetGlobalAlpha(((gUIControlValue1 % 0.2) > 0.1) ? 0 : 1);
        uiSetFont(32);
        ctxSetFillStyle('#fff');
        ctxFillText('Final Lap!', 0, 60);

        ctxSetGlobalAlpha(1);
      } else if (gUIControlValue1 < 1 && gUIControlValue2 === 0) {
        gUIControlValue1 += delta / 2;
        if (gUIControlValue1 > 1) gUIControlValue1 = 1;

        ctxSetGlobalAlpha(((gUIControlValue1 % 0.2) > 0.1) ? 1 : 0);
        uiSetFont(64);
        ctxSetFillStyle(`hsl(${gTextHue}, 100%, 85%)`);
        ctxFillText('GO !', 0, 70);

        ctxSetGlobalAlpha(1);
      }
    }

    if (gShowingGap) {
      if (gGapTimer > -1) {
        gGapTimer -= delta;

        if (gGapTimer <= 0) {
          gGapTimer = -1;
          gShowingGap = false;
        }
      } else {
        if (playerPosition === 1) {
          if (playerRacer.mLap > (leaderRacer.mLap + 1)) {
            const lapDelta = leaderRacer.mLap - playerRacer.mLap + 1;
            gGapTimeText = `${lapDelta} LAP${lapDelta > 1 ? 'S' : ''}`;
            gGapTimeColor = '#7f7';

            gGapTimer = 5;
          } else if (playerRacer.mLap > leaderRacer.mLap) {
            gGapTimeText = `-${playerRacer.mLapTime.toFixed(3)}`;
            gGapTimeColor = '#7f7';
          } else {
            const timeDelta = playerRacer.mLapTime - leaderRacer.mLapTime;
            gGapTimeText = `-${timeDelta.toFixed(3)}`;
            gGapTimeColor = (timeDelta < 0.001) ? '#fff' : '#7f7';
            gGapTimer = 5;
          }
        } else {
          if (playerRacer.mLap < leaderRacer.mLap) {
            const lapDelta = leaderRacer.mLap - playerRacer.mLap;
            gGapTimeText = `+${lapDelta} LAP${lapDelta > 1 ? 'S' : ''}`;
            gGapTimeColor = '#f77';

            gGapTimer = 5;
          } else {
            const timeDelta = leaderRacer.mLapTime - playerRacer.mLapTime;
            gGapTimeText = `+${timeDelta.toFixed(3)}`;
            gGapTimeColor = (timeDelta < 0.001) ? '#fff' : '#f77';

            gGapTimer = 5;
          }
        }
      }

      uiSetFont(8);
      ctxSetFillStyle('#fff');
      ctxFillText('GAP', 0, 0);

      uiSetFont(18);
      ctxSetFillStyle(gGapTimeColor);
      ctxFillText(gGapTimeText, -3, 20);
    }

    ctx.resetTransform();
    ctx.scale(scale, scale);

    uiSetFont(8);
    ctxSetTextAlign('left');
    ctxSetFillStyle('#fff');

    ctxFillText('POSITION', 20, 20);
    ctxFillText('LAP', 120, 20);

    let playerPosColor: string;
    let playerPosSufix: string;

    if (playerPosition === 1) {
      playerPosColor = '#fe8';
      playerPosSufix = 'st';
    } else if (playerPosition === 2) {
      playerPosColor = '#dee';
      playerPosSufix = 'nd';
    } else if (playerPosition === 3) {
      playerPosColor = '#fc8';
      playerPosSufix = 'rd';
    } else {
      playerPosColor = '#fff';
      playerPosSufix = 'th';
    }

    uiSetFont(64);
    ctxSetTextAlign('right');
    ctxSetFillStyle(playerPosColor);
    ctxFillText(`${playerPosition}`, 60, 70);

    uiSetFont(32);
    ctxSetTextAlign('left');
    ctxFillText(playerPosSufix, 62, 48);

    uiSetFont(18);
    ctxSetFillStyle('#fff');
    ctxFillText('/ 8', 64, 68);
    ctxFillText(`${mathMin(playerRacer.mLap, 3) || 1}`, 120, 42);
    ctxFillText('/ 3', 136, 42);

    uiSetFont(12);
    ctxSetTextAlign('right');

    ctx.translate(width / scale, 0);
    ctxFillText('STAMINA', -142, 30);
    ctxFillText('SPEED', -142, 64);
    ctxFillText('km/h', -20, 64);

    ctxBeginPath();
    ctxMoveTo(-204, 35);
    ctxLineTo(-20, 35);
    ctxLineTo(-20, 18);
    ctxLineTo(-136, 18);
    ctxLineTo(-136, 35);
    ctxMoveTo(-204, 69);
    ctxLineTo(-20, 69);
    ctx.stroke();

    const rainbowGradient = ctxGetRainbowGradient(-136, 0, 20, 0, 'c');
    ctxSetFillStyle(rainbowGradient);
    ctx.fillRect(-134, 20, 112 * playerRacer.mStamina, 13);

    uiSetFont(32);
    ctxSetFillStyle(`hsl(${gTextHue}, 100%, 85%)`);

    ctxFillText(speed.toFixed(0), -64, 64);

    uiSetFont(8);
    ctxSetFillStyle('#fff');

    ctxFillText('TOTAL TIME', -142, 90);
    ctxFillText('LAP TIME', -142, 110);
    ctxFillText('BEST LAP', -142, 130);

    uiSetFont(18);

    drawInGameTimer(playerRacer.mTotalTime, 90);

    if (playerRacer.mLap > 1) {
      drawInGameTimer(playerRacer.mBestLapTime, 130);
    } else {
      drawNoTimeTimer(130);
    }

    if (gLastLap !== playerRacer.mLap && playerRacer.mLap > 1) {
      gShowingGap = true;
      gGapTimer = -1;

      gLastLap = playerRacer.mLap;
      gLastLapTimer = 5;

      if (playerRacer.mLastLapTime === playerRacer.mBestLapTime) {
        let betterTimeFound = false;

        for (let i = 1; i < Game.mRacers.length; ++i) {
          if (Game.mRacers[i].mBestLapTime > 0 && Game.mRacers[i].mBestLapTime < playerRacer.mBestLapTime) {
            betterTimeFound = true;
            break;
          }
        }

        gLapColor = betterTimeFound ? '#7f7' : '#f7f';
      } else {
        gLapColor = '#ff7';
      }

      ctxSetFillStyle(gLapColor);
      drawInGameTimer(playerRacer.mLastLapTime, 110);
    } else if (gLastLapTimer > 0) {
      gLastLapTimer -= delta;
      ctxSetFillStyle(gLapColor);
      drawInGameTimer(playerRacer.mLastLapTime, 110);
    } else {
      drawInGameTimer(playerRacer.mLapTime, 110);
    }
  }

  if (gFadeDirection || gFadeValue) {
    gFadeValue += gFadeDirection * mathMax(delta, 0.001);
    if (gFadeValue > 1) {
      gFadeValue = 1;
      gFadeDirection = 0;
    } else if (gFadeValue < 0) {
      gFadeValue = 0;
      gFadeDirection = 0;
    }

    ctx.resetTransform();
    ctxSetGlobalAlpha(gFadeValue);
    ctxSetFillStyle('#fff');
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
};

export const uiRenderMenu = (delta: number) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = (height > 720) ? 1.5 : 1;

  gTextHue = (gTextHue + delta * 10) % 360;

  const racerAngle = ((gTextHue / 360) * kMathTau) - kMathPi;

  ctx.save();

  ctxSetFillStyle(`hsl(${gTextHue}, 100%, 85%)`);
  ctx.fillRect(0, 0, width, height);

  ctx.translate(width / 2, height / 2);
  ctxSetTextAlign('center');

  ctx.scale(scale, scale);

  ctxSetGlobalAlpha(0.5);
  ctxSetFillStyle('#000');
  ctx.fillRect(-250, -200, 500, 300);
  ctx.fillRect(-250, 150, 500, 75);

  racerRender(
    Game.mPlayerRacer,
    ctx,
    -5, 35, 0, racerAngle, 10, 1
  );

  ctx.strokeStyle = '#8888';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 1;
  ctx.shadowColor = '#0008';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.translate(0, -75);
  uiSetFont(18);
  ctxSetFillStyle('#fff');
  ctxSetGlobalAlpha(1);

  ctxFillText(Game.mPlayerRacer.mData[0], 0, 142);

  ctxSetFillStyle((Game.mDifficulty === 0) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff');
  ctxFillText('Easy', -120, 270);
  ctxSetFillStyle((Game.mDifficulty === 1) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff');
  ctxFillText('Normal', 0, 270);
  ctxSetFillStyle((Game.mDifficulty === 2) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff');
  ctxFillText('Hard', 120, 270);
  ctxSetFillStyle('#fff');

  const translateY = (gSelection === 0) ? 15 : 264;

  ctx.translate(200, translateY);
  ctxBeginPath();
  ctxMoveTo(0, -20);
  ctxLineTo(20, 0);
  ctxLineTo(0, 20);
  ctxClosePathAndFill();

  ctx.translate(-400, 0);
  ctxBeginPath();
  ctxMoveTo(0, -20);
  ctxLineTo(-20, 0);
  ctxLineTo(0, 20);
  ctxClosePathAndFill();

  ctx.translate(200, -translateY);

  uiSetFont(42);
  ctx.strokeStyle = '#888';
  ctxFillText('Rainbow GP', 0, -150);
  ctx.strokeText('Rainbow GP', 0, -150);

  if (gUIControlValue2) {
    gUIControlValue1 += delta;

    if (gUIControlValue1 > 1) {
      gameStartGame();
    }
  }

  if (gFadeDirection || gFadeValue) {
    gFadeValue += gFadeDirection * mathMax(delta, 0.001);
    if (gFadeValue > 1) {
      gFadeValue = 1;
      gFadeDirection = 0;
    } else if (gFadeValue < 0) {
      gFadeValue = 0;
      gFadeDirection = 0;
    }

    ctxSetGlobalAlpha(gFadeValue);
    ctx.resetTransform();
    ctxSetFillStyle('#fff');
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}
