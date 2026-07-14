import { describe, expect, it } from 'vitest';
import { AnalysisClassification, Domain, JobStatus } from '../types';
import { serializeJobFilters } from './useJobs';

describe('serializeJobFilters', () => {
  it('serializes arrays explicitly and omits empty values', () => {
    expect(
      serializeJobFilters({
        domains: [Domain.BACKEND, Domain.ML],
        statuses: [JobStatus.ACTIVE, JobStatus.APPLIED],
        classifications: [
          AnalysisClassification.TARGET,
          AnalysisClassification.STRETCH,
        ],
        fit: 'all',
        search: '  engineer  ',
      }),
    ).toEqual({
      domains: 'BACKEND,ML',
      statuses: 'ACTIVE,APPLIED',
      classifications: 'TARGET,STRETCH',
      search: 'engineer',
    });
  });
});
