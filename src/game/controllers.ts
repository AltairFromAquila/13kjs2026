import { Game } from "../game";
import { kMathEpsilon, mathClamp, mathJs, splineCalculateSegmentPoint, splineCalculateSegmentTangent, vec2Add, vec2Copy, vec2Distance, vec2Dot, vec2Lerp, vec2MulScalar, vec2New, vec2Normalize, vec2Sub, type Vec2 } from "../math";
import type { Racer } from "./racer";
import { trackGetTrackWidthAt, trackWrapSegmentIndex } from "./track";

export interface AIController {
  mDesiredDirection: Vec2;
  mPreviusSegmentT: number;
  mReactionTimer: number;
}

const kAIReactionTimeMin = 0.2;
const kAIReactionTimeMaxDelta = 0.1;
const kAIBlockPlayerChance = 0.3;

export const controllerProcessAIForRacer = (self: AIController, racer: Racer) => {
  const trackPoint = racer.mTrackPoints[-1];

  // I'm assuming the track points are separated enough so its impossible for the AI to skip a track point in a single tick
  if (trackPoint.t < self.mPreviusSegmentT) {
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
    const deltaT = (trackPoint.t - self.mPreviusSegmentT) || kMathEpsilon;
    const nextT = trackPoint.t + deltaT;

    if (nextT > 1) {
      // We are exiting the current segment
      const nextSegment = trackWrapSegmentIndex(trackPoint.mSegmentIdx + 1, Game.mTrack.segments.length);
      const nextSegmentLength = vec2Distance(
        splineCalculateSegmentPoint(Game.mTrack.segments[nextSegment], 0, vec2New()),
        splineCalculateSegmentPoint(Game.mTrack.segments[nextSegment], 1, vec2New())
      ) || kMathEpsilon;
      const newNextT = mathJs.min(24 / nextSegmentLength, 1); // 24 is the distance we want to look ahead, we divide by the segment length to get the t value
      const nextPos = splineCalculateSegmentPoint(Game.mTrack.segments[nextSegment], newNextT, vec2New());

      // Let's keep it simple and just steer towards the next position
      vec2Normalize(
        vec2Sub(
          vec2Copy(self.mDesiredDirection, nextPos),
          racer.mPos
        )
      );
    } else {
      const curTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, trackPoint.mSegmentIdx, trackPoint.t) * 0.5;
      const curNormal = vec2New(-trackPoint.mTangent.y, trackPoint.mTangent.x);
      const curOffset = vec2Sub(vec2Copy(vec2New(), racer.mPos), trackPoint.mPos);
      const curUsedHalfWidth = vec2Dot(curOffset, curNormal);

      const nextPos = splineCalculateSegmentPoint(Game.mTrack.segments[trackPoint.mSegmentIdx], nextT, vec2New());

      if (
        mathJs.abs(curUsedHalfWidth) > (curTrackHalfWidth * 0.8) ||
        curTrackHalfWidth <= kMathEpsilon
      ) {
        console.log('close to edge');
        // If we are too close to the edge, we want to steer towards the center of the track
        // or if for some reason the track is far too narrow, we just steer towards the next point
        vec2Normalize(
          vec2Sub(
            vec2Copy(self.mDesiredDirection, nextPos),
            racer.mPos
          )
        );
      } else {
        const curUsedRatio = curUsedHalfWidth / curTrackHalfWidth;
        const targetWidthRatio = mathClamp(curUsedRatio + (mathJs.random() * 0.2) - 0.1, -0.8, 0.8);
        
        const nextTangent = splineCalculateSegmentTangent(Game.mTrack.segments[trackPoint.mSegmentIdx], nextT, vec2New());
        const nextNormal = vec2New(-nextTangent.y, nextTangent.x);

        const nextTrackHalfWidth = trackGetTrackWidthAt(Game.mTrack, -1, trackPoint.mSegmentIdx, nextT) * 0.5;
        
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
  }

  self.mPreviusSegmentT = trackPoint.t;
  self.mReactionTimer += kAIReactionTimeMin + mathJs.random() * kAIReactionTimeMaxDelta;
};