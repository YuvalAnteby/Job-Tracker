import type { ScoreBreakdown } from '../llm/interfaces/job-analysis.interface';
import { Recommendation } from './enums/recommendation.enum';

const weights: Record<keyof ScoreBreakdown, number> = {
  hard_requirements: 0.3,
  preferred_requirements: 0.1,
  technical_stack: 0.25,
  seniority_eligibility: 0.15,
  domain_alignment: 0.1,
  logistics_availability: 0.1,
};

export const calculateScore = (dimensions: ScoreBreakdown): number =>
  Math.round(
    Object.entries(weights).reduce(
      (total, [dimension, weight]) =>
        total + dimensions[dimension as keyof ScoreBreakdown] * weight,
      0,
    ),
  );

// Hard eligibility and availability blockers intentionally override the average.
export const recommend = (
  dimensions: ScoreBreakdown,
  score: number,
): Recommendation => {
  if (
    dimensions.hard_requirements < 40 ||
    dimensions.seniority_eligibility < 30 ||
    dimensions.logistics_availability < 30
  )
    return Recommendation.SKIP;
  if (score >= 75 && dimensions.hard_requirements >= 70)
    return Recommendation.APPLY;
  if (score >= 60) return Recommendation.STRETCH;
  if (score >= 40) return Recommendation.RESEARCH;
  return Recommendation.SKIP;
};
