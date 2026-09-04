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

  it.each([
    "BSc in Computer Science",
    'B.Sc. in Computer Science',
    "Bachelor’s in Computer Science",
    'English proficiency',
    'Hebrew fluency',
    'Team player',
  ])('excludes non-technical requirement %s', (requirement) => {
    expect(classifyRequirement(requirement, false)).toEqual(
      expect.objectContaining({ learnable: false, gapType: GapType.NON_SKILL }),
    );
  });

  it.each(['system design', 'API design'])('keeps %s learnable', (requirement) => {
    expect(classifyRequirement(requirement, false)).toEqual(
      expect.objectContaining({ learnable: true, gapType: GapType.SKILL }),
    );
  });
});
