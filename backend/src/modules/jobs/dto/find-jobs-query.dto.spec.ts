import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Domain } from '../enums/domain.enum';
import { JobStatus } from '../enums/job-status.enum';
import { AnalysisClassification } from '../enums/analysis-classification.enum';
import { FindJobsQueryDto } from './find-jobs-query.dto';

describe('FindJobsQueryDto', () => {
  it('parses multiple filters and rejects invalid values', async () => {
    const valid = plainToInstance(FindJobsQueryDto, {
      domains: 'BACKEND, ML',
      statuses: 'ACTIVE,APPLIED',
      classifications: 'TARGET,STRETCH',
      fit: 'applicable',
      search: 'engineer',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.domains).toEqual([Domain.BACKEND, Domain.ML]);
    expect(valid.statuses).toEqual([JobStatus.ACTIVE, JobStatus.APPLIED]);
    expect(valid.classifications).toEqual([
      AnalysisClassification.TARGET,
      AnalysisClassification.STRETCH,
    ]);

    const invalid = plainToInstance(FindJobsQueryDto, { domains: 'NOPE' });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
