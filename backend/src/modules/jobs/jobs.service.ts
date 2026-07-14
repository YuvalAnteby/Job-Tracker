import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { FindJobsQueryDto, JobFit } from './dto/find-jobs-query.dto';
import { JobStatus } from './enums/job-status.enum';

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

  async findAll(filters: FindJobsQueryDto = {}): Promise<Job[]> {
    const query = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.requirements', 'requirement')
      .orderBy('job.added_at', 'DESC');
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
      relations: ['requirements'],
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
      relations: ['requirements'],
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
}
