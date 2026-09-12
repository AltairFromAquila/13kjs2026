import { Game, gameGoToTrack, kGameModeRaceFinalResult, kGameModeRaceIntro, kGameModeRaceRacing, kGameModeRaceResults } from "../game";
import { mathClamp, mathFloor, mathLerp, mathMax, mathMin, mathRandom, numberToString, vec2Length } from "../math";
import { ctx, ctxBeginPath, ctxFillText, ctxGetRainbowGradient, ctxLineTo, ctxMoveTo, ctxSetFillStyle, ctxSetTextAlign } from "../sys/context";


let lastLapTimer = 0;
let lastLap = 0;
let lapColor = '#ff7';
let showingGap = false;
let gapTimeText = '';
let gapTimeColor = '#7f7';
let gapTimer = -1;

const gResultsTimes = [0, 0, 0, 0, 0, 0, 0, 0];

let gTextHue = mathRandom() * 360;

let gFadeDirection = 0;
let gFadeValue = 0;

let gUIControlValue1 = 0;
let gUIControlValue2 = 0;

const uiSetFont = (fontSize: number) => {
  ctx.font = `bold ${fontSize}px Georgia, Verdana, sans-serif`;
};

export const uiResetGame = () => {
  gUIControlValue1 = 0;
  gUIControlValue2 = 0;
  lastLapTimer = 0;
  lastLap = 0;
  lapColor = '#ff7';
  showingGap = false;
  gapTimeText = '';
  gapTimeColor = '#7f7';
  gapTimer = -1;
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
      if (r === Game.mRacers[0] && nextRacer < Game.mRacersOrdered.length) {
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

export const uiRenderGame = (delta: number) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = (height > 720) ? 1.5 : 1;
  const playerRacer = Game.mRacers[0];

  const drawTimeElement = (
    msText: string, sText: string, mText: string,
    xMs: number, xS: number, xM: number, y: number
  ) => {
    ctxSetTextAlign(ctx, 'left');
    ctxFillText(ctx, msText, xMs, y);
    ctxSetTextAlign(ctx, 'right');
    ctxFillText(ctx, sText, xS, y);
    ctxFillText(ctx, mText, xM, y);
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

    ctxSetFillStyle(ctx, color);
    ctxSetTextAlign(ctx, 'right');
    ctxFillText(ctx, `${index + 1}`, -165, y);
    drawTimeElement(
      numberToString(milliseconds, 3),
      numberToString(remainingSeconds, 2) + '.',
      numberToString(minutes, 2) + ':',
      139, 138, 96, y
    )
    // ctxFillText(ctx, '03:12.123', 180, y);
    ctxSetTextAlign(ctx, 'left');
    ctxFillText(ctx, name, -150, y);
  }
  const drawStandingsEntry = (index: number, name: string, points: number, color: string) => {
    const y = 90 + (index * 35);

    ctxSetFillStyle(ctx, color);
    ctxSetTextAlign(ctx, 'right');
    ctxFillText(ctx, `${index + 1}`, -165, y);
    ctxFillText(ctx, `${points} pts.`, 180, y);
    ctxSetTextAlign(ctx, 'left');
    ctxFillText(ctx, name, -150, y);
  }
  const drawResultPanel = (alphaFactor: number, title: string) => {
    ctx.globalAlpha = 0.5 * alphaFactor;
    ctx.fillRect(-210, 0, 420, 360);
    ctx.globalAlpha = alphaFactor;

    uiSetFont(32);
    ctxSetFillStyle(ctx, '#fff');
    ctxFillText(ctx, title, 0, 42);
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
  ctxSetTextAlign(ctx, 'center');

  if (Game.mGameMode === kGameModeRaceResults) {
    gUIControlValue1 += delta;

    if (gUIControlValue2 === 1) {
      ctx.globalAlpha = mathLerp(1, 0, mathClamp(gUIControlValue1 - 2, 0, 1));

      if (gUIControlValue1 > 3) {
        gUIControlValue1 -= 3;
        gUIControlValue2 = 2;
      }

      uiSetFont(64);
      ctxSetFillStyle(ctx, `hsl(${gTextHue}, 100%, 85%)`);
      ctxFillText(ctx, 'FINISH !', 0, 70);
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
          i, 'Racer', gResultsTimes[i], (r === playerRacer) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff'
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
          i, 'Racer', r.mPoints, (r === playerRacer) ? `hsl(${gTextHue}, 100%, 85%)` : '#fff'
        )
      );
    } else if (gUIControlValue2 < 7) {
      uiFadeOut();
      gUIControlValue2 = 7;
    } else if (gUIControlValue2 < 8) {
      if (gUIControlValue1 > 1) {
        gUIControlValue2 = 8;
        
        if (Game.mCurrentTrack < 5) {
          gameGoToTrack(Game.mCurrentTrack + 1);
        }
      }
    }

    ctx.globalAlpha = 1;
  } else if (Game.mGameMode === kGameModeRaceFinalResult) {

  } else {
    const speed = vec2Length(playerRacer.mVel) * 0.42;
    const playerPosition = Game.mRacersOrdered.indexOf(playerRacer) + 1;
    const leaderRacer = (playerPosition > 1) ? Game.mRacersOrdered[0] : Game.mRacersOrdered[1];

    // ctx.globalAlpha = 0.5;
    // ctx.fillRect(-210, 0, 420, 360);
    // ctx.globalAlpha = 1;

    // uiSetFont(32);
    // ctxSetFillStyle(ctx, '#fff');
    // // ctxFillText(ctx, 'Race Results', 0, 42);
    // ctxFillText(ctx, 'Standings', 0, 42);
    // uiSetFont(24);

    // drawTimeResultEntry(0, 'Racer', 60.2);
    // drawTimeResultEntry(1, 'Racer', 60.2);
    // drawTimeResultEntry(2, 'Racer', 88.2);
    // drawTimeResultEntry(3, 'Racer', 1565165.2);
    // drawTimeResultEntry(4, 'Racer', 60.2);
    // drawTimeResultEntry(5, 'Racer', 60.2);
    // drawTimeResultEntry(6, 'Racer', 60.2);
    // drawTimeResultEntry(7, 'Racer', 60.2);

    // drawStandingsEntry(0, 'Racer', 13);
    // drawStandingsEntry(1, 'Racer', 13);
    // drawStandingsEntry(2, 'Racer', 13);
    // drawStandingsEntry(3, 'Racer', 13);
    // drawStandingsEntry(4, 'Racer', 13);
    // drawStandingsEntry(5, 'Racer', 13);
    // drawStandingsEntry(6, 'Racer', 13);
    // drawStandingsEntry(7, 'Racer', 13);

    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '1', -165, 90);
    // ctxFillText(ctx, '88:80.880', 180, 90);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 1', -150, 90);

    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, '123', 139, 90);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '12.', 138, 90);
    // ctxFillText(ctx, '03:', 104, 90);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '2', -165, 125);
    // ctxFillText(ctx, '03:12.123', 180, 125);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 2', -150, 125);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '3', -165, 160);
    // ctxFillText(ctx, '03:12.123', 180, 160);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 3', -150, 160);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '4', -165, 195);
    // ctxFillText(ctx, '03:12.123', 180, 195);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 4', -150, 195);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '5', -165, 230);
    // ctxFillText(ctx, '03:12.123', 180, 230);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 5', -150, 230);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '6', -165, 265);
    // ctxFillText(ctx, '03:12.123', 180, 265);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 6', -150, 265);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '7', -165, 300);
    // ctxFillText(ctx, '03:12.123', 180, 300);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 7', -150, 300);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '8', -165, 335);
    // ctxFillText(ctx, '03:12.123', 180, 335);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 8', -150, 335);
    
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '1', -165, 90);
    // ctxFillText(ctx, '130 pts.', 180, 90);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 1', -150, 90);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '2', -165, 125);
    // ctxFillText(ctx, '100 pts.', 180, 125);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 2', -150, 125);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '3', -165, 160);
    // ctxFillText(ctx, '80 pts.', 180, 160);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 3', -150, 160);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '4', -165, 195);
    // ctxFillText(ctx, '60 pts.', 180, 195);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 4', -150, 195);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '5', -165, 230);
    // ctxFillText(ctx, '40 pts.', 180, 230);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 5', -150, 230);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '6', -165, 265);
    // ctxFillText(ctx, '30 pts.', 180, 265);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 6', -150, 265);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '7', -165, 300);
    // ctxFillText(ctx, '20 pts.', 180, 300);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 7', -150, 300);
    // ctxSetTextAlign(ctx, 'right');
    // ctxFillText(ctx, '8', -165, 335);
    // ctxFillText(ctx, '10 pts.', 180, 335);
    // ctxSetTextAlign(ctx, 'left');
    // ctxFillText(ctx, 'RACER NAME 8', -150, 335);


    if (Game.mGameMode === kGameModeRaceIntro) {
      if (Game.mSequenceTimer < 5) {
        ctx.globalAlpha = mathLerp(0, 1, mathMin(mathClamp(4 - Game.mSequenceTimer, 0, 1), 1));

        uiSetFont(32);
        ctxSetFillStyle(ctx, `hsl(${gTextHue}, 100%, 85%)`);
        ctxFillText(ctx, Game.mTrackMetadata[0], 0, 60);

        ctx.globalAlpha = 0;
      } else {
        ctx.globalAlpha = mathLerp(0, 1, mathMin(Game.mSequenceTimer - 5, 1));

        uiSetFont(32);
        ctxSetFillStyle(ctx, '#fff');
        ctxFillText(ctx, 'Ready...', 0, 60);
      }
    } else {
      if (gUIControlValue1 > 0 && playerRacer.mLap === 3) {
        gUIControlValue1 -= delta / 2;
        if (gUIControlValue1 < 0) gUIControlValue1 = 0;
        gUIControlValue2 = 1;

        ctx.globalAlpha = ((gUIControlValue1 % 0.2) > 0.1) ? 0 : 1;
        uiSetFont(32);
        ctxSetFillStyle(ctx, '#fff');
        ctxFillText(ctx, 'Final Lap!', 0, 60);

        ctx.globalAlpha = 1;
      } else if (gUIControlValue1 < 1 && gUIControlValue2 === 0) {
        gUIControlValue1 += delta / 2;
        if (gUIControlValue1 > 1) gUIControlValue1 = 1;

        ctx.globalAlpha = ((gUIControlValue1 % 0.2) > 0.1) ? 1 : 0;
        uiSetFont(64);
        ctxSetFillStyle(ctx, `hsl(${gTextHue}, 100%, 85%)`);
        ctxFillText(ctx, 'GO !', 0, 70);

        ctx.globalAlpha = 1;
      }
    }

    if (showingGap) {
      if (gapTimer > -1) {
        gapTimer -= delta;

        if (gapTimer <= 0) {
          gapTimer = -1;
          showingGap = false;
        }
      } else {
        if (playerPosition === 1) {
          if (playerRacer.mLap > (leaderRacer.mLap + 1)) {
            const lapDelta = leaderRacer.mLap - playerRacer.mLap + 1;
            gapTimeText = `${lapDelta} LAP${lapDelta > 1 ? 'S' : ''}`;
            gapTimeColor = '#7f7';

            gapTimer = 5;
          } else if (playerRacer.mLap > leaderRacer.mLap) {
            gapTimeText = `-${playerRacer.mLapTime.toFixed(3)}`;
            gapTimeColor = '#7f7';
          } else {
            const timeDelta = playerRacer.mLapTime - leaderRacer.mLapTime;
            gapTimeText = `-${timeDelta.toFixed(3)}`;
            gapTimeColor = (timeDelta < 0.001) ? '#fff' : '#7f7';
            gapTimer = 5;
          }
        } else {
          if (playerRacer.mLap < leaderRacer.mLap) {
            const lapDelta = leaderRacer.mLap - playerRacer.mLap;
            gapTimeText = `+${lapDelta} LAP${lapDelta > 1 ? 'S' : ''}`;
            gapTimeColor = '#f77';

            gapTimer = 5;
          } else {
            const timeDelta = leaderRacer.mLapTime - playerRacer.mLapTime;
            gapTimeText = `+${timeDelta.toFixed(3)}`;
            gapTimeColor = (timeDelta < 0.001) ? '#fff' : '#f77';

            gapTimer = 5;
          }
        }
      }

      uiSetFont(8);
      ctxSetFillStyle(ctx, '#fff');
      ctxFillText(ctx, 'GAP', 0, 0);

      uiSetFont(18);
      ctxSetFillStyle(ctx, gapTimeColor);
      ctxFillText(ctx, gapTimeText, -3, 20);
    }

    ctx.resetTransform();
    ctx.scale(scale, scale);

    uiSetFont(8);
    ctxSetTextAlign(ctx, 'left');
    ctxSetFillStyle(ctx, '#fff');

    ctxFillText(ctx, 'POSITION', 20, 20);
    ctxFillText(ctx, 'LAP', 120, 20);

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
    ctxSetTextAlign(ctx, 'right');
    ctxSetFillStyle(ctx, playerPosColor);
    ctxFillText(ctx, `${playerPosition}`, 60, 70);

    uiSetFont(32);
    ctxSetTextAlign(ctx, 'left');
    ctxFillText(ctx, playerPosSufix, 62, 48);

    uiSetFont(18);
    ctxSetFillStyle(ctx, '#fff');
    ctxFillText(ctx, '/ 8', 64, 68);
    ctxFillText(ctx, `${mathMin(playerRacer.mLap, 3) || 1}`, 120, 42);
    ctxFillText(ctx, '/ 3', 136, 42);

    uiSetFont(12);
    ctxSetTextAlign(ctx, 'right');

    ctx.translate(width / scale, 0);
    ctxFillText(ctx, 'STAMINA', -142, 30);
    ctxFillText(ctx, 'SPEED', -142, 64);
    ctxFillText(ctx, 'km/h', -20, 64);

    ctxBeginPath(ctx);
    ctxMoveTo(ctx, -204, 35);
    ctxLineTo(ctx, -20, 35);
    ctxLineTo(ctx, -20, 18);
    ctxLineTo(ctx, -136, 18);
    ctxLineTo(ctx, -136, 35);
    ctxMoveTo(ctx, -204, 69);
    ctxLineTo(ctx, -20, 69);
    ctx.stroke();

    const rainbowGradient = ctxGetRainbowGradient(ctx, -136, 0, 20, 0, 'c');
    ctxSetFillStyle(ctx, rainbowGradient);
    ctx.fillRect(-134, 20, 112 * playerRacer.mStamina, 13);

    uiSetFont(32);
    ctxSetFillStyle(ctx, `hsl(${gTextHue}, 100%, 85%)`);

    ctxFillText(ctx, speed.toFixed(0), -64, 64);

    uiSetFont(8);
    ctxSetFillStyle(ctx, '#fff');

    ctxFillText(ctx, 'TOTAL TIME', -142, 90);
    ctxFillText(ctx, 'LAP TIME', -142, 110);
    ctxFillText(ctx, 'BEST LAP', -142, 130);

    uiSetFont(18);

    drawInGameTimer(playerRacer.mTotalTime, 90);

    if (playerRacer.mLap > 1) {
      drawInGameTimer(playerRacer.mBestLapTime, 130);
    } else {
      drawNoTimeTimer(130);
    }

    if (lastLap !== playerRacer.mLap && playerRacer.mLap > 1) {
      showingGap = true;
      gapTimer = -1;

      lastLap = playerRacer.mLap;
      lastLapTimer = 5;

      if (playerRacer.mLastLapTime === playerRacer.mBestLapTime) {
        let betterTimeFound = false;

        for (let i = 1; i < Game.mRacers.length; ++i) {
          if (Game.mRacers[i].mBestLapTime > 0 && Game.mRacers[i].mBestLapTime < playerRacer.mBestLapTime) {
            betterTimeFound = true;
            break;
          }
        }

        lapColor = betterTimeFound ? '#7f7' : '#f7f';
      } else {
        lapColor = '#ff7';
      }

      ctxSetFillStyle(ctx, lapColor);
      drawInGameTimer(playerRacer.mLastLapTime, 110);
    } else if (lastLapTimer > 0) {
      lastLapTimer -= delta;
      ctxSetFillStyle(ctx, lapColor);
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
    ctx.globalAlpha = gFadeValue;
    ctxSetFillStyle(ctx, '#fff');
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
};
