import {
  GapType,
  RequirementPriority,
  classifyRequirement,
  normalizeAlias,
} from './skill-taxonomy';

describe('skill taxonomy', () => {
  it('normalizes aliases without losing technical punctuation', () => {
    expect(normalizeAlias('  Node.js / TypeScript ')).toBe(
      'node.js typescript',
    );
  });

  it('keeps time-bound eligibility out of learnable skills', () => {
    expect(
      classifyRequirement('5+ years of backend experience', false),
    ).toEqual(
      expect.objectContaining({
        learnable: false,
        gapType: GapType.TIME_BOUND,
        priority: RequirementPriority.REQUIRED,
      }),
    );
  });

  it('recognizes preferred evidence gaps', () => {
    expect(classifyRequirement('Kubernetes is a nice to have', true)).toEqual(
      expect.objectContaining({
        learnable: true,
        gapType: GapType.EVIDENCE,
        priority: RequirementPriority.PREFERRED,
      }),
    );
  });
});
