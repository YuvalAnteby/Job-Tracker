import { InvalidLlmOutputError } from '../analysis-validation';

export enum TaxonomyDecisionType {
  TRACK = 'TRACK',
  EXCLUDE = 'EXCLUDE',
  UNSURE = 'UNSURE',
}

export enum TaxonomyConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export interface TaxonomyDecision {
  term: string;
  decision: TaxonomyDecisionType;
  canonical_name: string | null;
  confidence: TaxonomyConfidence;
}

export const parseTaxonomyDecisions = (
  raw: string,
  terms: string[],
): TaxonomyDecision[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new InvalidLlmOutputError('Taxonomy response was not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidLlmOutputError('Taxonomy response was not an object');
  }
  const decisions = (parsed as Record<string, unknown>).decisions;
  if (!Array.isArray(decisions)) {
    throw new InvalidLlmOutputError('Taxonomy response had no decisions');
  }
  const allowedTerms = new Set(terms);
  const seen = new Set<string>();
  return decisions.flatMap((value): TaxonomyDecision[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const decision = value as Record<string, unknown>;
    const term = decision.term;
    const type = decision.decision;
    const confidence = decision.confidence;
    const canonical = decision.canonical_name;
    if (
      typeof term !== 'string' ||
      !allowedTerms.has(term) ||
      seen.has(term) ||
      !Object.values(TaxonomyDecisionType).includes(type as TaxonomyDecisionType) ||
      !Object.values(TaxonomyConfidence).includes(
        confidence as TaxonomyConfidence,
      )
    ) {
      return [];
    }
    seen.add(term);
    if (type === TaxonomyDecisionType.TRACK) {
      if (
        typeof canonical !== 'string' ||
        !canonical.trim() ||
        canonical.trim().length > 120
      ) {
        return [];
      }
      return [
        {
          term,
          decision: type,
          canonical_name: canonical.trim(),
          confidence: confidence as TaxonomyConfidence,
        },
      ];
    }
    return [
      {
        term,
        decision: type as TaxonomyDecisionType,
        canonical_name: null,
        confidence: confidence as TaxonomyConfidence,
      },
    ];
  });
};
