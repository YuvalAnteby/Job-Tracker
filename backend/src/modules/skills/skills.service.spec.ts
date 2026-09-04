import { Repository } from 'typeorm';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { MetStatus } from '../jobs/enums/met-status.enum';
import { SkillAlias } from './entities/skill-alias.entity';
import { Skill } from './entities/skill.entity';
import { DataSource, EntityManager } from 'typeorm';
import { LlmService } from '../llm/llm.service';
import {
  Actionability,
  Effort,
  GapType,
  RequirementPriority,
} from './skill-taxonomy';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  it('deduplicates similar roles while retaining evidence', async () => {
    const skill = { id: 'skill-1', name: 'Kafka' } as Skill;
    const requirement = {
      name: 'Kafka',
      skill,
      priority: RequirementPriority.REQUIRED,
      gap_type: GapType.SKILL,
      actionability: Actionability.HIGH,
      effort: Effort.MEDIUM,
      met_status: MetStatus.NOT_MET,
      job_description_excerpt: 'Kafka required',
      cv_evidence: null,
    } as JobRequirement;
    const jobs = ['one', 'two'].map(
      (id) =>
        ({
          id,
          company_name: 'Acme',
          title: 'Backend Engineer',
          domain: Domain.BACKEND,
          llm_domain: Domain.BACKEND,
          include_in_gap: true,
          requirements: [requirement],
        }) as Job,
    );
    const service = new SkillsService(
      {} as Repository<Skill>,
      {} as Repository<SkillAlias>,
      {} as Repository<JobRequirement>,
      { find: jest.fn().mockResolvedValue(jobs) } as unknown as Repository<Job>,
      {} as DataSource,
      {} as LlmService,
    );

    const result = await service.getMatrix();

    expect(result).toEqual(
      expect.objectContaining({
        raw_job_count: 2,
        sample_size: 1,
        skills: [expect.objectContaining({ required_count: 1, gap_count: 1 })],
      }),
    );
  });

  it('keeps manual aliases ahead of automatic taxonomy', async () => {
    const manual = {
      id: 'alias-1',
      normalized_alias: 'k8s',
      skill_id: 'skill-kubernetes',
      is_manual: true,
    } as SkillAlias;
    const aliases = [manual];
    const aliasRepository = {
      find: jest.fn().mockResolvedValue([manual]),
      findOne: jest.fn(async ({ where }: { where: { normalized_alias: string } }) =>
        aliases.find((alias) => alias.normalized_alias === where.normalized_alias) ?? null,
      ),
      create: jest.fn((value: Partial<SkillAlias>) => value as SkillAlias),
      save: jest.fn(async (value: SkillAlias) => value),
    } as unknown as Repository<SkillAlias>;
    const skillRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: Partial<Skill>) => value as Skill),
      save: jest.fn(async (value: Skill) => ({ ...value, id: 'skill-1' })),
    } as unknown as Repository<Skill>;
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Skill ? skillRepository : aliasRepository,
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
    } as unknown as DataSource;
    const llm = {
      classifySkillTerms: jest.fn(),
    } as unknown as LlmService;
    const service = new SkillsService(
      skillRepository,
      aliasRepository,
      {} as Repository<JobRequirement>,
      {} as Repository<Job>,
      dataSource,
      llm,
    );

    await expect(
      service.normalizeRequirements([{ name: 'K8s', cv_evidence: null }]),
    ).resolves.toEqual([
      expect.objectContaining({ skill_id: 'skill-kubernetes' }),
    ]);
    expect(llm.classifySkillTerms).not.toHaveBeenCalled();
  });

  it('leaves low-confidence and failed taxonomy terms unlinked', async () => {
    const aliasRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<SkillAlias>;
    const dataSource = {
      transaction: jest.fn(
        (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work({
            getRepository: jest.fn(() => ({
              delete: jest.fn(),
              find: jest.fn().mockResolvedValue([]),
            })),
          } as unknown as EntityManager),
      ),
    } as unknown as DataSource;
    const llm = {
      classifySkillTerms: jest.fn().mockResolvedValue([
        {
          term: 'Kafka',
          decision: 'TRACK',
          canonical_name: 'Kafka',
          confidence: 'LOW',
        },
      ]),
    } as unknown as LlmService;
    const service = new SkillsService(
      {} as Repository<Skill>,
      aliasRepository,
      {} as Repository<JobRequirement>,
      {} as Repository<Job>,
      dataSource,
      llm,
    );

    await expect(
      service.normalizeRequirements([{ name: 'Kafka', cv_evidence: null }]),
    ).resolves.toEqual([expect.objectContaining({ skill_id: null })]);
  });

  it('consolidates wording variants onto one canonical skill', async () => {
    const storedAliases: SkillAlias[] = [];
    const skillRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: Partial<Skill>) => value as Skill),
      save: jest.fn(async (value: Skill) => ({ ...value, id: 'skill-kubernetes' })),
    } as unknown as Repository<Skill>;
    const aliasRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async ({ where }: { where: { normalized_alias: string } }) =>
        storedAliases.find(
          (alias) => alias.normalized_alias === where.normalized_alias,
        ) ?? null,
      ),
      create: jest.fn((value: Partial<SkillAlias>) => value as SkillAlias),
      save: jest.fn(async (value: SkillAlias) => {
        storedAliases.push(value);
        return value;
      }),
    } as unknown as Repository<SkillAlias>;
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Skill ? skillRepository : aliasRepository,
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        (work: (transactionManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
    } as unknown as DataSource;
    const service = new SkillsService(
      skillRepository,
      aliasRepository,
      {} as Repository<JobRequirement>,
      {} as Repository<Job>,
      dataSource,
      {
        classifySkillTerms: jest.fn().mockResolvedValue([
          {
            term: 'K8s',
            decision: 'TRACK',
            canonical_name: 'Kubernetes',
            confidence: 'HIGH',
          },
          {
            term: 'Kubernetes',
            decision: 'TRACK',
            canonical_name: 'Kubernetes',
            confidence: 'HIGH',
          },
        ]),
      } as unknown as LlmService,
    );

    await expect(
      service.normalizeRequirements([
        { name: 'K8s', cv_evidence: null },
        { name: 'Kubernetes', cv_evidence: null },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ skill_id: 'skill-kubernetes' }),
      expect.objectContaining({ skill_id: 'skill-kubernetes' }),
    ]);
    expect(skillRepository.save).toHaveBeenCalledTimes(1);
  });
});
