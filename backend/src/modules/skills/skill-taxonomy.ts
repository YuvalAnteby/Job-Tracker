export enum RequirementPriority {
  REQUIRED = 'REQUIRED',
  PREFERRED = 'PREFERRED',
}

export enum GapType {
  SKILL = 'SKILL',
  EVIDENCE = 'EVIDENCE',
  TIME_BOUND = 'TIME_BOUND',
  ROLE_MISMATCH = 'ROLE_MISMATCH',
  NON_SKILL = 'NON_SKILL',
}

export enum Actionability {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum Effort {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
}

export const normalizeAlias = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .trim();

export const classifyRequirement = (
  text: string,
  hasEvidence: boolean,
): {
  priority: RequirementPriority;
  gapType: GapType;
  actionability: Actionability;
  effort: Effort;
  learnable: boolean;
} => {
  const normalized = text.toLocaleLowerCase();
  const preferred = /\b(preferred|nice to have|bonus|advantage|plus)\b/.test(
    normalized,
  );
  const timeBound =
    /\b\d+\+?\s*(years?|yrs?)\b/.test(normalized) ||
    /\b(graduat(e|ed|ing|ion)|degree by|class of)\b/.test(normalized);
  const roleMismatch =
    /\b(senior|staff|principal|lead|manager|director)\b/.test(normalized);
  const nonSkill =
    /\b(b\.?\s?(sc|a|eng|tech|com)|bachelor'?s?|master'?s?|ph\.?\s?d|doctorate|degree|university|college)\b/.test(
      normalized,
    ) ||
    /\b(english|hebrew|arabic|spanish|french|german|russian|chinese|mandarin|japanese|korean|portuguese|italian)\b.*\b(proficien\w*|fluen\w*|native|language|written|verbal)\b/.test(
      normalized,
    ) ||
    /\b(team player|self[- ]starter|detail[- ]oriented|interpersonal|communication skills|work (well )?independently|collaborative|proactive)\b/.test(
      normalized,
    );
  const gapType = nonSkill
    ? GapType.NON_SKILL
    : timeBound
    ? GapType.TIME_BOUND
    : roleMismatch
      ? GapType.ROLE_MISMATCH
      : hasEvidence
        ? GapType.EVIDENCE
        : GapType.SKILL;

  return {
    priority: preferred
      ? RequirementPriority.PREFERRED
      : RequirementPriority.REQUIRED,
    gapType,
    actionability:
      gapType === GapType.SKILL
        ? Actionability.HIGH
        : gapType === GapType.EVIDENCE
          ? Actionability.MEDIUM
          : Actionability.LOW,
    effort:
      gapType === GapType.SKILL
        ? Effort.MEDIUM
        : gapType === GapType.EVIDENCE
          ? Effort.SMALL
          : Effort.LARGE,
    learnable: !nonSkill && !timeBound && !roleMismatch,
  };
};
