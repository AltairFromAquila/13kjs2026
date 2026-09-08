import { Game } from "../game";
import { vec2Length } from "../math";
import { ctx, ctxBeginPath, ctxLineTo, ctxMoveTo } from "../sys/context";

let textHue = 44;
let lastLapTimer = 0;
let lastLap = 0;
let lapColor = '#ff7';
let showingGap = false;
let gapTimeText = '';
let gapTimeColor = '#7f7';
let gapTimer = -1;

export const renderGameUI = (delta: number) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const speed = vec2Length(Game.mRacers[0].mVel) * 0.42;

  const playerLap = Game.mRacers[0].mLap;
  const playerSegmentIdx = Game.mRacers[0].mTrackPoints[-1]?.mSegmentIdx ?? 0;
  const playerSegmentT = Game.mRacers[0].mTrackPoints[-1]?.t ?? 0;
  
  let playerPosition = 1;
  let leaderRacer = Game.mRacers[1];
  for (let i = 1; i < Game.mRacers.length; ++i) {
    const racer = Game.mRacers[i];
    const racerLap = racer.mLap;
    const racerSegmentIdx = racer.mTrackPoints[-1]?.mSegmentIdx ?? 0;
    const racerSegmentT = racer.mTrackPoints[-1]?.t ?? 0;

    if (racerLap > playerLap ||
        (racerLap === playerLap && racerSegmentIdx > playerSegmentIdx) ||
        (racerLap === playerLap && racerSegmentIdx === playerSegmentIdx && racerSegmentT > playerSegmentT)) {
      playerPosition += 1;
    }
    
    const leaderLap = leaderRacer.mLap;
    const leaderSegmentIdx = leaderRacer.mTrackPoints[-1]?.mSegmentIdx ?? 0;
    if (racerLap > leaderRacer.mLap ||
        (racerLap === leaderLap && racerSegmentIdx > leaderSegmentIdx) ||
        (racerLap === leaderLap && racerSegmentIdx === leaderSegmentIdx && racerSegmentT > (leaderRacer.mTrackPoints[-1]?.t ?? 0))) {
      leaderRacer = racer;
    }
  }

  const scale = (height > 720) ? 1.5 : 1;

  const fontFamily = 'Georgia, Verdana, sans-serif';

  textHue = (textHue + delta * 10) % 360;

  ctx.save();

  ctx.strokeStyle = '#8888';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 1;
  ctx.shadowColor = '#0008';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.font = `bold ${(8 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = '#fff';

  ctx.fillText('POSITION', (20 * scale), (20 * scale));
  ctx.fillText('LAP', (120 * scale), (20 * scale));

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

  ctx.font = `bold ${(64 * scale) | 0}px ${fontFamily}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = playerPosColor;
  ctx.fillText(`${playerPosition}`, (60 * scale), (70 * scale));

  ctx.font = `bold ${(32 * scale) | 0}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.fillText(playerPosSufix, (62 * scale), (48 * scale));

  ctx.font = `bold ${(18 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.fillText('/ 8', (64 * scale), (68 * scale));
  ctx.fillText(`${Game.mRacers[0].mLap || 1}`, (120 * scale), (42 * scale));
  ctx.fillText('/ 3', (136 * scale), (42 * scale));

  ctx.font = `bold ${(12 * scale) | 0}px ${fontFamily}`;
  ctx.textAlign = 'right';

  ctx.fillText('STAMINA', width - (142 * scale), (30 * scale));
  ctx.fillText('SPEED', width - (142 * scale), (64 * scale));
  ctx.fillText('km/h', width - (20 * scale), (64 * scale));

  ctxBeginPath(ctx);
  ctxMoveTo(ctx, width - (204 * scale), (35 * scale));
  ctxLineTo(ctx, width - (20 * scale), (35 * scale));
  ctxLineTo(ctx, width - (20 * scale), (18 * scale));
  ctxLineTo(ctx, width - (136 * scale), (18 * scale));
  ctxLineTo(ctx, width - (136 * scale), (35 * scale));
  ctxMoveTo(ctx, width - (204 * scale), (69 * scale));
  ctxLineTo(ctx, width - (20 * scale), (69 * scale));
  ctx.stroke();

  const tapPressed = Game.mRacers[0].mController.mGallopTapPressed;
  const rainbowGradient = ctx.createLinearGradient(width - (136 * scale), 0, width - (20 * scale), 0);
  rainbowGradient.addColorStop(0.00, tapPressed ? '#f88c' : '#f00c');
  rainbowGradient.addColorStop(0.17, tapPressed ? '#fb6c' : '#f80c');
  rainbowGradient.addColorStop(0.33, tapPressed ? '#ff8c' : '#ff0c');
  rainbowGradient.addColorStop(0.50, tapPressed ? '#8f8c' : '#0f0c');
  rainbowGradient.addColorStop(0.67, tapPressed ? '#88fc' : '#00fc');
  rainbowGradient.addColorStop(0.83, tapPressed ? '#d6cc' : '#408c');
  rainbowGradient.addColorStop(1.00, tapPressed ? '#b8fc' : '#80fc');
  ctx.fillStyle = rainbowGradient;
  ctx.fillRect(width - (134 * scale), (20 * scale), (112 * scale) * Game.mRacers[0].mStamina, (13 * scale));  

  ctx.font = `bold ${(32 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = `hsl(${textHue}, 100%, 85%)`;

  ctx.fillText(speed.toFixed(0), width - (64 * scale), (64 * scale));

  ctx.font = `bold ${(8 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = '#fff';

  ctx.fillText('TOTAL TIME', width - (142 * scale), (90 * scale));
  ctx.fillText('LAP TIME', width - (142 * scale), (110 * scale));
  ctx.fillText('BEST LAP', width - (142 * scale), (130 * scale));

  ctx.font = `bold ${(18 * scale) | 0}px ${fontFamily}`;

  const drawTimeElement = (time: number, y: number, scale: number) => {
    const seconds = Math.floor(time);
    const milliseconds = Math.floor((time - seconds) * 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    ctx.textAlign = 'left';
    ctx.fillText(`${milliseconds.toString().padStart(3, '0')}`, width - (56 * scale), (y * scale));
    ctx.textAlign = 'right';
    ctx.fillText(`${remainingSeconds.toString().padStart(2, '0')}.`, width - (57 * scale), (y * scale));
    ctx.fillText(`${minutes.toString().padStart(2, '0')}:`, width - (87 * scale), (y * scale));
  };
  const drawNoTimeElement = (y: number, scale: number) => {
    ctx.textAlign = 'left';
    ctx.fillText('---', width - (56 * scale), (y * scale));
    ctx.textAlign = 'right';
    ctx.fillText('--.', width - (57 * scale), (y * scale));
    ctx.fillText('--:', width - (87 * scale), (y * scale));
  };

  drawTimeElement(Game.mRacers[0].mTotalTime, 90, scale);

  if (Game.mRacers[0].mLap > 1) {
    drawTimeElement(Game.mRacers[0].mBestLapTime, 130, scale);
  } else {
    drawNoTimeElement(130, scale);
  }

  // drawTimeElement(Game.mRacers[0].mBestLapTime, 130, scale);

  if (lastLap !== Game.mRacers[0].mLap && Game.mRacers[0].mLap > 1) {
    showingGap = true;
    gapTimer = -1;

    lastLap = Game.mRacers[0].mLap;
    lastLapTimer = 5;

    if (Game.mRacers[0].mLastLapTime === Game.mRacers[0].mBestLapTime) {
      let betterTimeFound = false;

        for (let i = 1; i < Game.mRacers.length; ++i) {
          if (Game.mRacers[i].mBestLapTime > 0 && Game.mRacers[i].mBestLapTime < Game.mRacers[0].mBestLapTime) {
            betterTimeFound = true;
            break;
          }
        }

        lapColor = betterTimeFound ? '#7f7' : '#f7f';
    } else {
      lapColor = '#ff7';
    }

    ctx.fillStyle = lapColor;
    drawTimeElement(Game.mRacers[0].mLastLapTime, 110, scale);
  } else if (lastLapTimer > 0) {
    lastLapTimer -= delta;
    ctx.fillStyle = lapColor;
    drawTimeElement(Game.mRacers[0].mLastLapTime, 110, scale);
  } else {
    drawTimeElement(Game.mRacers[0].mLapTime, 110, scale);
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
        if (Game.mRacers[0].mLap > (leaderRacer.mLap + 1)) {
          const lapDelta = leaderRacer.mLap - Game.mRacers[0].mLap + 1;
          gapTimeText = `${lapDelta} LAP${lapDelta > 1 ? 'S' : ''}`;
          gapTimeColor = '#7f7';
          
          gapTimer = 5;
        } else if (Game.mRacers[0].mLap > leaderRacer.mLap) {
          gapTimeText = `-${Game.mRacers[0].mLapTime.toFixed(3)}`;
          gapTimeColor = '#7f7';
        } else {
          const timeDelta = Game.mRacers[0].mLapTime - leaderRacer.mLapTime;
          gapTimeText = `-${timeDelta.toFixed(3)}`;
          gapTimeColor = (timeDelta < 0.001) ? '#fff' : '#7f7';
          gapTimer = 5;
        }
      } else {
        if (Game.mRacers[0].mLap < leaderRacer.mLap) {
          const lapDelta = leaderRacer.mLap - Game.mRacers[0].mLap;
          gapTimeText = `+${lapDelta} LAP${lapDelta > 1 ? 'S' : ''}`;
          gapTimeColor = '#f77';

          gapTimer = 5;
        } else {
          const timeDelta = leaderRacer.mLapTime - Game.mRacers[0].mLapTime;
          gapTimeText = `+${timeDelta.toFixed(3)}`;
          gapTimeColor = (timeDelta < 0.001) ? '#fff' : '#f77';

          gapTimer = 5;
        }
      }
    }
    ctx.font = `bold ${(8 * scale) | 0}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('GAP', width / 2, 120 * scale);

    ctx.font = `bold ${(18 * scale) | 0}px ${fontFamily}`;
    ctx.fillStyle = gapTimeColor;
    ctx.fillText(gapTimeText, (width / 2) - (3 * scale), 140 * scale);
  }
  
  ctx.restore();
};
