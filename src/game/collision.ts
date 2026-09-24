import type { Entity } from "../core/entity";
import { kMathEpsilon, mathCos, mathHypot, mathSin, vec2Add, vec2Copy, vec2Distance, vec2New, vec2Sub, type Vec2 } from "../math";

export interface PhysicEntity extends Entity {
  mFrontCol: CircleCollider;
  mMidCol: CircleCollider;
  mBackCol: CircleCollider;

  mVel: Vec2;
  mColVel: Vec2;
}

export interface CircleCollider {
  mPos: Vec2;
  mRadius: number;
}

const workVector1 = vec2New();
const workVector2 = vec2New();
const activeSolidEntities: PhysicEntity[] = [];
const workEntityCollidersA: CircleCollider[] = [];
const workEntityCollidersB: CircleCollider[] = [];

export const collisionNewCircleCollider = (radius: number): CircleCollider => ({ mPos: vec2New(), mRadius: radius });

export const collisionActivateEntity = (self: PhysicEntity) => {
  if (!activeSolidEntities.includes(self)) {
    activeSolidEntities.push(self);
  }
}

export const collisionDeactivateEntity = (self: PhysicEntity) => {
  const idx = activeSolidEntities.indexOf(self);

  if (idx !== -1) {
    activeSolidEntities.splice(idx, 1);
  }
}

export const collisionSyncColliders = (self: PhysicEntity) => {
  vec2Sub(
    vec2Copy(workVector1, self.mFrontCol.mPos),
    self.mMidCol.mPos
  );
  vec2Sub(
    vec2Copy(workVector2, self.mBackCol.mPos),
    self.mMidCol.mPos
  );
  
  vec2Copy(self.mMidCol.mPos, self.mPos);
  vec2Add(
    vec2Copy(self.mFrontCol.mPos, self.mPos),
    workVector1
  );
  vec2Add(
    vec2Copy(self.mBackCol.mPos, self.mPos),
    workVector2
  );
};

export const collisionCheckCollision = (colA: CircleCollider, colB: CircleCollider) => {
  const touchDistance = colA.mRadius + colB.mRadius;
  const distance = vec2Distance(colA.mPos, colB.mPos);
  return distance - touchDistance;
};

export const collisionResolveCollisions = (self: PhysicEntity) => {
  const entityRadius = self.mMidCol.mRadius * 2;

  workEntityCollidersA[0] = self.mFrontCol;
  workEntityCollidersA[1] = self.mMidCol;
  workEntityCollidersA[2] = self.mBackCol;

  for (const other of activeSolidEntities) {
    if (self === other) {
      continue;
    }

    const otherRadius = other.mMidCol.mRadius * 2;
    const touchDistance = entityRadius + otherRadius;
    const distance = vec2Distance(self.mPos, other.mPos);

    if (distance < touchDistance) {
      workEntityCollidersB[0] = other.mFrontCol;
      workEntityCollidersB[1] = other.mMidCol;
      workEntityCollidersB[2] = other.mBackCol;

      let bestCollisionDistance = 0;
      let bestSelfCol: CircleCollider | undefined;
      let bestOtherCol: CircleCollider | undefined;

      for (const selfCol of workEntityCollidersA) {
        for (const otherCol of workEntityCollidersB) {
          const collisionDistance = collisionCheckCollision(selfCol, otherCol);

          if (collisionDistance < bestCollisionDistance) {
            bestCollisionDistance = collisionDistance;
            bestSelfCol = selfCol;
            bestOtherCol = otherCol;
          }
        }
      }

      if (!bestSelfCol || !bestOtherCol) {
        continue;
      }

      const penetration = -bestCollisionDistance;
      let normalX = bestSelfCol.mPos.x - bestOtherCol.mPos.x;
      let normalY = bestSelfCol.mPos.y - bestOtherCol.mPos.y;
      let normalLen = mathHypot(normalX, normalY);

      if (normalLen <= kMathEpsilon) {
        normalX = self.mPos.x - other.mPos.x;
        normalY = self.mPos.y - other.mPos.y;
        normalLen = mathHypot(normalX, normalY);

        if (normalLen <= kMathEpsilon) {
          normalX = 1;
          normalY = 0;
          normalLen = 1;
        }
      }

      normalX /= normalLen;
      normalY /= normalLen;

      self.mPos.x += normalX * penetration;
      self.mPos.y += normalY * penetration;
      collisionSyncColliders(self);

      const otherDirX = mathCos(other.mAngle);
      const otherDirY = mathSin(other.mAngle);
      const leftSideX = -otherDirY;
      const leftSideY = otherDirX;
      const toSelfX = self.mPos.x - other.mPos.x;
      const toSelfY = self.mPos.y - other.mPos.y;
      const sideSign = ((toSelfX * leftSideX) + (toSelfY * leftSideY) >= 0) ? 1 : -1;

      const force = (penetration < 0.1)
        ? 50
        : (penetration < 0.5)
          ? 100
          : 200;

      self.mColVel.x += leftSideX * sideSign * force;
      self.mColVel.y += leftSideY * sideSign * force;
    }
  }
};
