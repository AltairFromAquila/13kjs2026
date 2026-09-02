import type { Vec2 } from "../math";

export interface CircleCollider {
  pos: Vec2;
  radius: number;
}

const activeColliders: CircleCollider[] = [];

export function newCircleCollider(radius: number): CircleCollider {
  const col = { pos: { x: 0, y: 0 }, radius };
  return col;
}

export function activateCircleCollider(self: CircleCollider) {
  if (!activeColliders.includes(self)) {
    activeColliders.push(self);
  }
}
