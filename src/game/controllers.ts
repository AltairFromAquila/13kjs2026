import { Game } from "../game";
import { kMathEpsilon, mathClamp, mathJs, splineCalculateSegmentPoint, splineCalculateSegmentTangent, vec2Add, vec2Angle, vec2Copy, vec2Distance, vec2DistanceSqr, vec2Dot, vec2Lerp, vec2MulScalar, vec2New, vec2NewCopy, vec2Normalize, vec2Sub, type Vec2 } from "../math";
import type { Racer } from "./racer";
import { trackGetTrackWidthAt, trackWrapSegmentIndex } from "./track";

export interface AIController {
  mDesiredDirection: Vec2;
  mIsGalloping: boolean;

  mPreviousSegmentIdx: number;
  mPreviousSegmentT: number;

  mBlockPlayerTimer: number;
  mGallopingReactionTimer: number;
  mReactionTimer: number;
  
  mIsWaitingForStamina: boolean;
  mIsBlockingPlayer: boolean;
}

const kAIReactionTimeMin = 0.2;
const kAIReactionTimeMaxDelta = 0.1;
const kAIGallopingReactionTime = 0.06;
const kAIBlockPlayerChance = 0.3;
const kAISafeWidthFactor = 0.8;
const kAIBlockPlayerSafeWidthFactor = 0.9;

export const controllerProcessAIForRacer = (self: AIController, racer: Racer, delta: number) => {
  self.mBlockPlayerTimer -= delta;
  self.mReactionTimer -= delta;

  if (self.mIsWaitingForStamina && racer.mStamina > 0.8) {
    self.mIsWaitingForStamina = false;
  } else if (self.mIsGalloping && racer.mStamina <= 0) {
    self.mIsGalloping = false;
    self.mIsWaitingForStamina = true; 
  }

  if (self.mGallopingReactionTimer > 0) {
    self.mGallopingReactionTimer -= delta;
  } else {
    const trackPoint = racer.mTrackPoints[-1];

    if (!self.mIsWaitingForStamina) {
      let aheadSegmentIdx = trackPoint.mSegmentIdx;
      let aheadT = trackPoint.t;
      let workVec1 = vec2NewCopy(trackPoint.mPos);
      let workVec2 = vec2New();
      let distanceSqr = 0;
      const targetDistanceSqr = 120 * 120;

      while (distanceSqr < targetDistanceSqr) {
        aheadT += 0.25;
        if (aheadT > 1) {
          --aheadT;
          aheadSegmentIdx = trackWrapSegmentIndex(aheadSegmentIdx + 1, Game.mTrack.segments.length);
        }

        distanceSqr += vec2DistanceSqr(
          splineCalculateSegmentPoint(Game.mTrack.segments[aheadSegmentIdx], aheadT, workVec2),
          workVec1
        );
        vec2Copy(workVec1, workVec2);
      }

      const tangent0 = trackPoint.mTangent;
      const tangent1 = splineCalculateSegmentTangent(Game.mTrack.segments[aheadSegmentIdx], aheadT, workVec1);
      const alignment = vec2Dot(tangent0, tangent1) ;

      if (alignment > 0.75) {
        self.mIsGalloping = self.mIsGalloping || mathJs.random() < 0.05; // Use values between 0.01 and 0.05 for a more balanced galloping behavior
      } else {
        self.mIsGalloping = false;
        self.mIsWaitingForStamina = racer.mStamina < 0.3;
      }
    }

    self.mGallopingReactionTimer += kAIGallopingReactionTime;
  }

  if (self.mReactionTimer > 0) return;

  const trackPoint = racer.mTrackPoints[-1];
  const playerRacer = Game.mRacers[0]; // Player should always be the first racer in the array

  if (self.mBlockPlayerTimer <= 0 && racer != playerRacer) {
    const playerTrackPoint = playerRacer.mTrackPoints[-1];
    const isPlayerAhead =
      playerTrackPoint.mSegmentIdx > trackPoint.mSegmentIdx ||
      (playerTrackPoint.mSegmentIdx === trackPoint.mSegmentIdx && playerTrackPoint.t > trackPoint.t);
    const playerDistanceSqr = vec2DistanceSqr(racer.mPos, playerRacer.mPos);

    // We only block the player if
    //   They are ahead and within a certain distance
    //   They are behind but very close
    //   We are not too close to the player (to avoid being too unfair with the player)
    if (
      playerDistanceSqr < (isPlayerAhead ? 240 * 240 : 64 * 64) &&
      playerDistanceSqr > (32 * 32) &&
      mathJs.random() < kAIBlockPlayerChance
    ) {
      self.mIsBlockingPlayer = mathJs.random() < kAIBlockPlayerChance;
    }

    self.mBlockPlayerTimer = 1 + (mathJs.random() * 4);
  }

  if (trackPoint.mSegmentIdx !== self.mPreviousSegmentIdx) {
    const segment = Game.mTrack.segments[trackPoint.mSegmentIdx];

    if (segment) {
      const segmentStart = splineCalculateSegmentPoint(segment, 0, vec2New());
      const segmentEnd = splineCalculateSegmentPoint(segment, 1, vec2New());

      const segmentDirection = vec2Normalize(vec2Sub(segmentEnd, segmentStart));
      const tangentDirection = trackPoint.mTangent;

      const alignment = vec2Dot(segmentDirection, tangentDirection);
      const alignmentRatio = (alignment - 1) * -0.5; // remap to [0, 1] range, where 0 is same direction, 1 is opposite direction

      vec2Normalize(
        vec2Lerp(
          vec2Copy(self.mDesiredDirection, tangentDirection), segmentDirection, alignmentRatio * 0.8
        )
      );
    }
  } else {
    // Calculate desired direction based on a delta between future track point and current track point
    const deltaT = (trackPoint.t - self.mPreviousSegmentT) || kMathEpsilon;
    let nextT = trackPoint.t + deltaT;
    let nextTSegmentIdx = trackPoint.mSegmentIdx;

    if (nextT > 1) {
      // We are exiting the current segment
      const nextSegment = trackWrapSegmentIndex(trackPoint.mSegmentIdx + 1, Game.mTrack.segments.length);
      const nextSegmentLength = vec2Distance(
        splineCalculateSegmentPoint(Game.mTrack.segments[nextSegment], 0, vec2New()),
        splineCalculateSegmentPoint(Game.mTrack.segments[nextSegment], 1, vec2New())
      ) || kMathEpsilon;

      nextT = mathJs.min(24 / nextSegmentLength, 1); // 24 is the distance we want to look ahead, we divide by the segment length to get the t value
      nextTSegmentIdx = nextSegment;
    }
    const nextPos = splineCalculateSegmentPoint(Game.mTrack.segments[nextTSegmentIdx], nextT, vec2New());

    // Calculate current used track width relative to the track center
    const curTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, trackPoint.mSegmentIdx, trackPoint.t) * 0.5;
    const curNormal = vec2New(-trackPoint.mTangent.y, trackPoint.mTangent.x);
    const curOffset = vec2Sub(vec2Copy(vec2New(), racer.mPos), trackPoint.mPos);
    const curUsedHalfWidth = vec2Dot(curOffset, curNormal);

    const trackSafeWidthFactor = self.mIsBlockingPlayer ? kAIBlockPlayerSafeWidthFactor : kAISafeWidthFactor;

    let playerWidthRatio = 0;
    if (self.mIsBlockingPlayer) {
      const playerTrackPoint = playerRacer.mTrackPoints[-1];

      if (playerTrackPoint.mInside) {
        const playerTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, playerTrackPoint.mSegmentIdx, playerTrackPoint.t) * 0.5;
        const playerNormal = vec2New(-playerTrackPoint.mTangent.y, playerTrackPoint.mTangent.x);
        const playerOffset = vec2Sub(vec2Copy(vec2New(), playerRacer.mPos), playerTrackPoint.mPos);
        const playerUsedHalfWidth = vec2Dot(playerOffset, playerNormal);

        playerWidthRatio = playerUsedHalfWidth / playerTrackHalfWidth;
      }
    }

    if (
      mathJs.abs(curUsedHalfWidth) > (curTrackHalfWidth * trackSafeWidthFactor) ||
      (self.mIsBlockingPlayer && mathJs.abs(playerWidthRatio) > trackSafeWidthFactor) ||
      curTrackHalfWidth <= kMathEpsilon
    ) {
      // If we are too close to the edge, we want to steer towards the center of the track
      // or if for some reason the track is far too narrow, we just steer towards the next point
      vec2Normalize(
        vec2Sub(
          vec2Copy(self.mDesiredDirection, nextPos),
          racer.mPos
        )
      );
    } else {
      const targetWidthRatio = mathClamp(
        self.mIsBlockingPlayer
          ? playerWidthRatio
          : (curUsedHalfWidth / curTrackHalfWidth) + (mathJs.random() * 0.2) - 0.1,
        -trackSafeWidthFactor, trackSafeWidthFactor
      );

      const nextTangent = splineCalculateSegmentTangent(Game.mTrack.segments[nextTSegmentIdx], nextT, vec2New());
      const nextNormal = vec2New(-nextTangent.y, nextTangent.x);

      const nextTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, nextTSegmentIdx, nextT) * 0.5;

      vec2Normalize(
        vec2Sub(
          vec2Add(
            vec2Copy(self.mDesiredDirection, nextPos),
            vec2MulScalar(nextNormal, targetWidthRatio * nextTrackHalfWidth)
          ),
          racer.mPos
        )
      );
    }
  }

  self.mPreviousSegmentIdx = trackPoint.mSegmentIdx;
  self.mPreviousSegmentT = trackPoint.t;
  self.mReactionTimer += kAIReactionTimeMin + mathJs.random() * kAIReactionTimeMaxDelta;
};