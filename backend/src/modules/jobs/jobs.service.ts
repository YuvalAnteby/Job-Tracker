import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { ApplicationStageEvent } from './entities/application-stage-event.entity';
import { TransitionApplicationStageDto } from './dto/transition-application-stage.dto';
import { ApplicationStage } from './enums/application-stage.enum';

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

    // Remove old requirements
    if (job.requirements && job.requirements.length > 0) {
      await this.requirementRepository.remove(job.requirements);
      job.requirements = [];
    }

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
    // 1. LLM Analysis
    const analysis = await this.llmService.analyzeJob(description);

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
    const isApplicableByScore = analysis.score >= scoreThreshold;
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

    if (!job.id) {
      job.posting_snapshot = { ...job.posting_snapshot, company_name, title };
    }

    // Save job and requirements to DB
    Object.assign(job, {
      company_name,
      title,
      llm_score: analysis.score,
      llm_domain: analysis.domain,
      domain: analysis.domain, // Default domain is LLM domain
      llm_summary: analysis.summary,
      llm_is_applicable: isApplicableByScore && isApplicableByDomain,
      requirements: analysis.requirements.map((req, index) =>
        this.requirementRepository.create({
          name: req.name,
          met_status: req.met_status,
          reasoning: req.reasoning,
          order: index,
        }),
      ),
    });

    return this.jobRepository.save(job);
  }

  async findAll(): Promise<Job[]> {
    return this.jobRepository.find({
      relations: ['requirements', 'application_events'],
      order: {
        added_at: 'DESC',
        application_events: { occurred_at: 'ASC' },
      },
    });
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
    const job = await this.findOne(id);

    // Merge updates
    Object.assign(job, updateJobDto);

    return this.jobRepository.save(job);
  }

  async remove(id: string): Promise<Job> {
    const job = await this.findOne(id);
    return this.jobRepository.softRemove(job);
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
      const previousStage = job.application_stage;
      const event = manager.getRepository(ApplicationStageEvent).create({
        job_id: job.id,
        previous_stage: previousStage,
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
}
