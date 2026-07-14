import { parseGapSummary, parseJobAnalysis } from './analysis-validation';

describe('AI output validation', () => {
  it.each([
    ['malformed JSON', '{'],
    ['empty requirements', JSON.stringify({ requirements: [] })],
    [
      'invalid enum',
      JSON.stringify({
        company_name: 'Acme',
        title: 'Engineer',
        domain: 'INVALID',
        summary: 'Fit',
        score_breakdown: {},
        requirements: [{}],
      }),
    ],
  ])('rejects %s', (_caseName, raw) => {
    expect(() => parseJobAnalysis(raw)).toThrow();
  });

  it('rejects an empty gap summary', () => {
    expect(() =>
      parseGapSummary(
        JSON.stringify({ domains: {}, overall_top_gaps: ['Kafka'] }),
      ),
    ).toThrow('domains cannot be empty');
  });

  it('rejects unrecognized gap domains', () => {
    expect(() =>
      parseGapSummary(
        JSON.stringify({
          domains: {
            UNKNOWN: {
              missing_skills: [],
              partially_known: [],
              gaps_detail: 'Gap',
            },
          },
          overall_top_gaps: ['Kafka'],
        }),
      ),
    ).toThrow('unrecognized value');
  });
});
