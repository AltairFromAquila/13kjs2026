import { canvas, ctx } from "../sys/context";

export function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}