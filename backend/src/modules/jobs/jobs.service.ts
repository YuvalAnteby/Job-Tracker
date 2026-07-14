import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { AnalysisStatus } from './enums/analysis-status.enum';
import { Domain } from './enums/domain.enum';
import { calculateScore, recommend } from './job-scoring';

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
      domain: Domain.OTHER,
      llm_score: null,
      llm_domain: null,
      llm_summary: null,
      llm_is_applicable: null,
      analysis_status: AnalysisStatus.PENDING,
      posted_at: createJobDto.posted_at
        ? new Date(createJobDto.posted_at)
        : null,
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

  async findAll() {
    return this.jobRepository.find({
      order: { added_at: 'DESC' },
      relations: ['requirements'],
    });
  }

  async findOne(id: string) {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['requirements'],
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    const job = await this.findOne(id);

    // Merge updates
    Object.assign(job, updateJobDto);

    return this.jobRepository.save(job);
  }

  async remove(id: string) {
    const job = await this.findOne(id);
    return this.jobRepository.softRemove(job);
  }
}
