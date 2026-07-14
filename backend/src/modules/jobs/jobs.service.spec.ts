import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { ApplicationStageEvent } from './entities/application-stage-event.entity';
import { ApplicationStage } from './enums/application-stage.enum';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';

describe('JobsService application pipeline', () => {
  const job = {
    id: 'job-1',
    application_stage: ApplicationStage.NOT_APPLIED,
    applied_at: null,
  } as Job;
  const returnedJob = { ...job, application_events: [] } as Job;
  const jobs = {
    findOne: jest.fn().mockResolvedValue(job),
    save: jest.fn().mockResolvedValue(job),
    findOneOrFail: jest.fn().mockResolvedValue(returnedJob),
  };
  const events = {
    create: jest.fn((value: ApplicationStageEvent) => value),
    save: jest
      .fn()
      .mockImplementation((value: ApplicationStageEvent) =>
        Promise.resolve(value),
      ),
  };
  const manager = {
    getRepository: jest.fn(
      (entity: typeof Job | typeof ApplicationStageEvent) =>
        entity === Job ? jobs : events,
    ),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      (callback: (entityManager: EntityManager) => Promise<Job>) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const service = new JobsService(
    {} as Repository<Job>,
    {} as Repository<JobRequirement>,
    {} as LlmService,
    {} as SettingsService,
    dataSource,
  );

  beforeEach(() => {
    job.application_stage = ApplicationStage.NOT_APPLIED;
    job.applied_at = null;
    jest.clearAllMocks();
  });

  it('appends an event and preserves the first applied date', async () => {
    const occurredAt = new Date('2026-07-14T08:00:00Z');
    await service.transitionApplicationStage('job-1', {
      new_stage: ApplicationStage.APPLIED,
      occurred_at: occurredAt,
      source: 'TELEGRAM',
    });

    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_stage: ApplicationStage.NOT_APPLIED,
        new_stage: ApplicationStage.APPLIED,
        source: 'TELEGRAM',
      }),
    );
    expect(job.applied_at).toEqual(occurredAt);
  });

  it('rejects invalid stage jumps without writing history', async () => {
    await expect(
      service.transitionApplicationStage('job-1', {
        new_stage: ApplicationStage.OFFER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(events.save).not.toHaveBeenCalled();
  });
});
