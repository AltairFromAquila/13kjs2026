import { Game } from "../game";
import { vec2Length } from "../math";
import { ctx, ctxBeginPath, ctxLineTo, ctxMoveTo } from "../sys/context";

var textHue = 44;

export const renderGameUI = (delta: number) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const speed = vec2Length(Game.mRacers[0].mVel) * 0.42;

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

  ctx.font = `bold ${(64 * scale) | 0}px ${fontFamily}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fe8';
  ctx.fillText('1', (60 * scale), (70 * scale));

  ctx.font = `bold ${(32 * scale) | 0}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.fillText('st', (62 * scale), (48 * scale));

  ctx.font = `bold ${(18 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.fillText('/ 8', (64 * scale), (68 * scale));
  ctx.fillText('1', (120 * scale), (42 * scale));
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
  ctx.fillRect(width - (134 * scale), (20 * scale), (113 * scale) * Game.mRacers[0].mStamina, (13 * scale));  

  ctx.font = `bold ${(32 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = `hsl(${textHue}, 100%, 85%)`;

  ctx.fillText(speed.toFixed(0), width - (64 * scale), (64 * scale));

  ctx.font = `bold ${(8 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = '#fff';

  ctx.fillText('TOTAL TIME', width - (142 * scale), (90 * scale));
  ctx.fillText('LAP TIME', width - (142 * scale), (110 * scale));
  ctx.fillText('BEST LAP', width - (142 * scale), (130 * scale));

  ctx.font = `bold ${(18 * scale) | 0}px ${fontFamily}`;

  ctx.textAlign = 'left';
  ctx.fillText('000', width - (56 * scale), (90 * scale));
  ctx.textAlign = 'right';
  ctx.fillText('00.', width - (57 * scale), (90 * scale));
  ctx.fillText('00:', width - (87 * scale), (90 * scale));

  ctx.textAlign = 'left';
  ctx.fillText('000', width - (56 * scale), (110 * scale));
  ctx.textAlign = 'right';
  ctx.fillText('00.', width - (57 * scale), (110 * scale));
  ctx.fillText('00:', width - (87 * scale), (110 * scale));

  ctx.textAlign = 'left';
  ctx.fillText('000', width - (56 * scale), (130 * scale));
  ctx.textAlign = 'right';
  ctx.fillText('00.', width - (57 * scale), (130 * scale));
  ctx.fillText('00:', width - (87 * scale), (130 * scale));

  ctx.font = `bold ${(8 * scale) | 0}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillText('GAP', width / 2, 120 * scale);

  ctx.font = `bold ${(18 * scale) | 0}px ${fontFamily}`;
  ctx.fillStyle = '#7f7'; // #f77 #f7f #ff7
  ctx.fillText('-8.888', (width / 2) - (3 * scale), 140 * scale);
  
  ctx.restore();
};
