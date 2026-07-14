import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { FindJobsQueryDto, JobFit } from './dto/find-jobs-query.dto';
import { JobStatus } from './enums/job-status.enum';
import { AnalysisStatus } from './enums/analysis-status.enum';
import { Domain } from './enums/domain.enum';
import { calculateScore, recommend } from './job-scoring';
import { ApplicationStageEvent } from './entities/application-stage-event.entity';
import { TransitionApplicationStageDto } from './dto/transition-application-stage.dto';
import { ApplicationStage } from './enums/application-stage.enum';
import { AnalysisClassification } from './enums/analysis-classification.enum';
import { Recommendation } from './enums/recommendation.enum';

export interface BulkJobsResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(JobRequirement)
    private readonly requirementRepository: Repository<JobRequirement>,
    private readonly llmService: LlmService,
    private readonly settingsService: SettingsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    // 1. Deduplication check
    const existingJob = await this.jobRepository.findOne({
      where: { url: createJobDto.url },
      withDeleted: false,
    });

    if (existingJob) {
      throw new ConflictException(
        `Job with URL ${createJobDto.url} already exists.`,
      );
    }

    const job = this.jobRepository.create({
      ...createJobDto,
      domain: Domain.OTHER,
      llm_score: null,
      llm_domain: null,
      llm_summary: null,
      llm_is_applicable: null,
      analysis_status: AnalysisStatus.PENDING,
      suggested_classification: null,
      classification_override: null,
      posted_at: createJobDto.posted_at
        ? new Date(createJobDto.posted_at)
        : null,
      posting_snapshot: {
        company_name: createJobDto.company_name,
        title: createJobDto.title,
        url: createJobDto.url,
        description: createJobDto.description,
        posted_at: createJobDto.posted_at ?? null,
      },
    });

    await this.jobRepository.save(job);
    return this.processJobAnalysis(
      job,
      createJobDto.description,
      createJobDto.company_name,
      createJobDto.title,
    );
  }

  async reanalyze(id: string): Promise<Job> {
    const job = await this.findOne(id);
    this.logger.log(`Re-analyzing job from ID: ${id}`);

    job.analysis_status = AnalysisStatus.PENDING;
    job.analysis_error = null;
    await this.jobRepository.save(job);
    return this.processJobAnalysis(
      job,
      job.description,
      job.company_name,
      job.title,
    );
  }

  private async processJobAnalysis(
    job: Job,
    description: string,
    providedCompany: string,
    providedTitle: string,
  ): Promise<Job> {
    try {
      const result = await this.llmService.analyzeJob(description);
      const analysis = result.data;
      const score = calculateScore(analysis.score_breakdown);
      const recommendation = recommend(analysis.score_breakdown, score);

      // 2. Application logic
      const scoreThreshold = await this.settingsService.get<number>(
        'score_threshold',
        70,
      );
      const applicableDomains = await this.settingsService.get<string[]>(
        'applicable_domains',
        ['BACKEND', 'FULLSTACK'],
      );

      // Determine applicability based on score and domain
      const isApplicableByScore = score >= scoreThreshold;
      const isApplicableByDomain = applicableDomains.includes(analysis.domain);

      // Use provided company/title if given, otherwise fall back to LLM results or defaults
      const company_name =
        providedCompany === 'skip'
          ? analysis.company_name || 'Unknown Company'
          : providedCompany;

      const title =
        providedTitle === 'skip'
          ? analysis.title || 'Unknown Title'
          : providedTitle;

      // Save job and requirements to DB
      Object.assign(job, {
        company_name,
        title,
        llm_score: score,
        llm_domain: analysis.domain,
        domain: analysis.domain, // Default domain is LLM domain
        llm_summary: analysis.summary,
        llm_is_applicable: isApplicableByScore && isApplicableByDomain,
        score_breakdown: analysis.score_breakdown,
        recommendation,
        suggested_classification: this.classificationFor(recommendation),
        analysis_status: AnalysisStatus.COMPLETED,
        analysis_error: null,
        analysis_model: result.model,
        prompt_version: result.prompt_version,
        analyzed_at: result.analyzed_at,
        requirements: analysis.requirements.map((req, index) =>
          this.requirementRepository.create({
            name: req.name,
            met_status: req.met_status,
            reasoning: req.reasoning,
            job_description_excerpt: req.job_description_excerpt,
            cv_evidence: req.cv_evidence,
            evidence_inferred: req.evidence_inferred,
            order: index,
          }),
        ),
      });

      if (job.requirements?.length) {
        await this.requirementRepository.delete({ job_id: job.id });
      }
      return this.jobRepository.save(job);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === 'InvalidLlmOutputError'
          ? error.message
          : 'AI provider request failed';
      job.analysis_status = AnalysisStatus.FAILED;
      job.analysis_error = message.replace(/[\r\n]+/g, ' ').slice(0, 500);
      job.analyzed_at = new Date();
      this.logger.warn(
        `Job analysis failed for ${job.id}: ${job.analysis_error}`,
      );
      return this.jobRepository.save(job);
    }
  }

  async findAll(filters: FindJobsQueryDto = {}): Promise<Job[]> {
    const query = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.requirements', 'requirement')
      .leftJoinAndSelect('job.application_events', 'application_event')
      .orderBy('job.added_at', 'DESC')
      .addOrderBy('application_event.occurred_at', 'ASC');
    const statuses = filters.statuses ?? [];
    const storedStatuses = statuses.filter(
      (status) => status !== JobStatus.DELETED,
    );
    const includeDeleted = statuses.includes(JobStatus.DELETED);

    if (includeDeleted) {
      query.withDeleted();
      query.andWhere(
        new Brackets((where) => {
          where.where('job.deleted_at IS NOT NULL');
          if (storedStatuses.length > 0) {
            where.orWhere(
              '(job.deleted_at IS NULL AND job.status IN (:...statuses))',
              { statuses: storedStatuses },
            );
          }
        }),
      );
    } else if (storedStatuses.length > 0) {
      query.andWhere('job.status IN (:...statuses)', {
        statuses: storedStatuses,
      });
    }

    if (filters.domains?.length) {
      query.andWhere(
        'COALESCE(job.domain_override, job.llm_domain) IN (:...domains)',
        { domains: filters.domains },
      );
    }
    if (filters.classifications?.length) {
      query.andWhere(
        'COALESCE(job.classification_override, job.suggested_classification) IN (:...classifications)',
        { classifications: filters.classifications },
      );
    }
    if (filters.fit === JobFit.APPLICABLE) {
      query.andWhere(
        'COALESCE(job.is_applicable_override, job.llm_is_applicable) = true',
      );
    } else if (filters.fit === JobFit.INTERESTING) {
      query.andWhere(
        'COALESCE(job.is_interesting_override, job.is_interesting) = true',
      );
    }
    if (filters.search?.trim()) {
      query.andWhere(
        '(job.company_name ILIKE :search OR job.title ILIKE :search)',
        { search: `%${filters.search.trim()}%` },
      );
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['requirements', 'application_events'],
      order: { application_events: { occurred_at: 'ASC' } },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
    if (updateJobDto.status === JobStatus.APPLIED) {
      const result = await this.jobRepository
        .createQueryBuilder()
        .update(Job)
        .set({
          status: JobStatus.APPLIED,
          applied_at: () => 'COALESCE("applied_at", CURRENT_TIMESTAMP)',
        })
        .where('id = :id AND deleted_at IS NULL', { id })
        .execute();

      if (!result.affected) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }
    }

    const job = await this.findOne(id);
    const changes = { ...updateJobDto };
    if (changes.status === JobStatus.APPLIED) delete changes.status;
    Object.assign(job, changes);

    return this.jobRepository.save(job);
  }

  async remove(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['requirements', 'application_events'],
      withDeleted: true,
    });
    if (!job) throw new NotFoundException(`Job with ID ${id} not found`);
    if (job.deleted_at) return job;
    return this.jobRepository.softRemove(job);
  }

  async bulkUpdateStatus(
    ids: string[],
    status: JobStatus.APPLIED | JobStatus.INACTIVE,
  ): Promise<BulkJobsResult> {
    return this.runBulk(ids, (id) => this.update(id, { status }));
  }

  async bulkRemove(ids: string[]): Promise<BulkJobsResult> {
    return this.runBulk(ids, (id) => this.remove(id));
  }

  private async runBulk(
    ids: string[],
    operation: (id: string) => Promise<Job>,
  ): Promise<BulkJobsResult> {
    const results = await Promise.allSettled(ids.map(operation));
    return results.reduce<BulkJobsResult>(
      (result, outcome, index) => {
        const id = ids[index];
        if (outcome.status === 'fulfilled') {
          result.succeeded.push(id);
        } else {
          result.failed.push({
            id,
            error:
              outcome.reason instanceof Error
                ? outcome.reason.message
                : 'Operation failed',
          });
        }
        return result;
      },
      { succeeded: [], failed: [] },
    );
  }

  async transitionApplicationStage(
    id: string,
    dto: TransitionApplicationStageDto,
  ): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const jobs = manager.getRepository(Job);
      const job = await jobs.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!job) throw new NotFoundException(`Job with ID ${id} not found`);

      const isDateCorrection =
        job.application_stage === dto.new_stage && dto.applied_at !== undefined;
      if (job.application_stage === dto.new_stage && !isDateCorrection) {
        throw new BadRequestException(
          'Job is already at that application stage',
        );
      }
      if (!this.canTransition(job.application_stage, dto.new_stage)) {
        throw new BadRequestException(
          `Cannot move from ${job.application_stage} to ${dto.new_stage}`,
        );
      }

      const occurredAt = dto.occurred_at ?? new Date();
      const event = manager.getRepository(ApplicationStageEvent).create({
        job_id: job.id,
        previous_stage: job.application_stage,
        new_stage: dto.new_stage,
        occurred_at: occurredAt,
        source: dto.source || 'WEB',
        notes: dto.notes || null,
        rejection_reason: dto.rejection_reason || null,
      });
      await manager.getRepository(ApplicationStageEvent).save(event);

      job.application_stage = dto.new_stage;
      if (dto.applied_at !== undefined) {
        job.applied_at = dto.applied_at;
      } else if (
        dto.new_stage === ApplicationStage.APPLIED &&
        job.applied_at === null
      ) {
        job.applied_at = occurredAt;
      }
      await jobs.save(job);

      return jobs.findOneOrFail({
        where: { id },
        relations: ['requirements', 'application_events'],
        order: { application_events: { occurred_at: 'ASC' } },
      });
    });
  }

  private canTransition(from: ApplicationStage, to: ApplicationStage): boolean {
    if (from === to) return true;
    if (from === ApplicationStage.NOT_APPLIED) {
      return to === ApplicationStage.APPLIED;
    }
    if (
      from === ApplicationStage.REJECTED ||
      from === ApplicationStage.WITHDRAWN
    ) {
      return (
        to === ApplicationStage.NOT_APPLIED || to === ApplicationStage.APPLIED
      );
    }
    if (to === ApplicationStage.REJECTED || to === ApplicationStage.WITHDRAWN) {
      return true;
    }
    return (
      Object.values(ApplicationStage).indexOf(to) >
      Object.values(ApplicationStage).indexOf(from)
    );
  }

  private classificationFor(
    recommendation: Recommendation,
  ): AnalysisClassification {
    return {
      [Recommendation.APPLY]: AnalysisClassification.TARGET,
      [Recommendation.STRETCH]: AnalysisClassification.STRETCH,
      [Recommendation.RESEARCH]: AnalysisClassification.RESEARCH,
      [Recommendation.SKIP]: AnalysisClassification.IRRELEVANT,
    }[recommendation];
  }
}
