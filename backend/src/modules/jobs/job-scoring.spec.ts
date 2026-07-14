import { calculateScore, recommend } from './job-scoring';
import { Recommendation } from './enums/recommendation.enum';

describe('deterministic job scoring', () => {
  it('uses the documented weights and hard blockers', () => {
    const dimensions = {
      hard_requirements: 80,
      preferred_requirements: 70,
      technical_stack: 80,
      seniority_eligibility: 90,
      domain_alignment: 80,
      logistics_availability: 90,
    };
    const score = calculateScore(dimensions);
    expect(score).toBe(82);
    expect(recommend(dimensions, score)).toBe(Recommendation.APPLY);
    expect(recommend({ ...dimensions, seniority_eligibility: 20 }, score)).toBe(
      Recommendation.SKIP,
    );
  });
});
