/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository, UpdateResult } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { JobStatus } from './enums/job-status.enum';
import { JobsService } from './jobs.service';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';

describe('JobsService', () => {
  const job = {
    id: 'job-1',
    status: JobStatus.ACTIVE,
    applied_at: null,
  } as Job;

  const makeService = (affected = 1) => {
    const execute = jest.fn<Promise<UpdateResult>, []>().mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected,
    });
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute,
    };
    const jobs = {
      createQueryBuilder: jest.fn().mockReturnValue(updateBuilder),
      findOne: jest.fn().mockResolvedValue({ ...job }),
      save: jest
        .fn()
        .mockImplementation((value: Job) => Promise.resolve(value)),
      softRemove: jest
        .fn()
        .mockImplementation((value: Job) => Promise.resolve(value)),
    } as unknown as Repository<Job>;
    const requirements = {} as Repository<JobRequirement>;
    const service = new JobsService(
      jobs,
      requirements,
      {} as LlmService,
      {} as SettingsService,
    );
    return { service, jobs, updateBuilder };
  };

  it('sets the first application timestamp atomically', async () => {
    const { service, jobs, updateBuilder } = makeService();
    await service.update('job-1', { status: JobStatus.APPLIED });

    expect(updateBuilder.set).toHaveBeenCalledWith({
      status: JobStatus.APPLIED,
      applied_at: expect.any(Function),
    });
    expect(jobs.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.ACTIVE,
      }),
    );
  });

  it('rejects applying a missing or deleted job', async () => {
    const { service } = makeService(0);
    await expect(
      service.update('missing', { status: JobStatus.APPLIED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats repeated deletion as successful', async () => {
    const { service, jobs } = makeService();
    const deleted = { ...job, deleted_at: new Date() } as Job;
    jest.mocked(jobs.findOne).mockResolvedValue(deleted);

    await expect(service.remove(job.id)).resolves.toBe(deleted);
    expect(jobs.softRemove).not.toHaveBeenCalled();
  });

  it('reports per-job bulk failures', async () => {
    const { service } = makeService();
    jest
      .spyOn(service, 'remove')
      .mockResolvedValueOnce(job)
      .mockRejectedValueOnce(new NotFoundException('missing'));

    await expect(service.bulkRemove(['job-1', 'missing'])).resolves.toEqual({
      succeeded: ['job-1'],
      failed: [{ id: 'missing', error: 'missing' }],
    });
  });
});
