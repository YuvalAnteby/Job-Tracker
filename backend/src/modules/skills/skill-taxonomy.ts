export enum RequirementPriority {
  REQUIRED = 'REQUIRED',
  PREFERRED = 'PREFERRED',
}

export enum GapType {
  SKILL = 'SKILL',
  EVIDENCE = 'EVIDENCE',
  TIME_BOUND = 'TIME_BOUND',
  ROLE_MISMATCH = 'ROLE_MISMATCH',
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
  const gapType = timeBound
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
    learnable: !timeBound && !roleMismatch,
  };
};
