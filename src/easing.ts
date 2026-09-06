// Taken from https://easings.net/

import { kMathPi, mathCos, mathJs, mathSin } from "./math";

export const easeLinear = (x: number): number => x;

export const easeInSine = (x: number): number => 1 - mathCos((x * kMathPi) / 2);

export const easeOutSine = (x: number): number => mathSin((x * kMathPi) / 2);

export const easeInOutSine = (x: number): number => -(mathCos(kMathPi * x) - 1) / 2;

export const easeInQuad = (x: number): number => x * x;

export const easeOutQuad = (x: number): number => 1 - (1 - x) * (1 - x);

export const easeInOutQuad = (x: number): number => x < 0.5 ? 2 * x * x : 1 - mathJs.pow(-2 * x + 2, 2) / 2;

export const easeInCubic = (x: number): number => x * x * x;

export const easeOutCubic = (x: number): number => 1 - mathJs.pow(1 - x, 3);

export const easeInOutCubic = (x: number): number => x < 0.5 ? 4 * x * x * x : 1 - mathJs.pow(-2 * x + 2, 3) / 2;
