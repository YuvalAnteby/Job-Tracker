import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { LlmService } from '../llm/llm.service';
import { JobSummaryInput } from '../llm/interfaces/job-analysis.interface';

@Injectable()
export class GapService {
  private readonly logger = new Logger(GapService.name);

  constructor(
    @InjectRepository(GapSummary)
    private readonly gapSummaryRepository: Repository<GapSummary>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly llmService: LlmService,
  ) {}

  generate(domainFilter?: Domain): void {
    // Run in background
    setImmediate(() => {
      this.processGapAnalysis(domainFilter).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Unhandled error in background gap analysis: ${message}`,
        );
      });
    });
  }

  private async processGapAnalysis(domainFilter?: Domain): Promise<void> {
    this.logger.log(
      `Starting gap analysis background job${domainFilter ? ` for domain: ${domainFilter}` : ''}`,
    );

    try {
      // 1. Fetch relevant jobs
      const queryBuilder = this.jobRepository
        .createQueryBuilder('job')
        .leftJoinAndSelect('job.requirements', 'requirement')
        .where('job.status = :status', { status: JobStatus.ACTIVE });

      if (domainFilter) {
        queryBuilder.andWhere(
          'COALESCE(job.domain_override, job.llm_domain) = :domain',
          { domain: domainFilter },
        );
      }

      const jobs = await queryBuilder.getMany();

      if (jobs.length === 0) {
        this.logger.warn('No active jobs found for gap analysis.');
        return;
      }

      // 2. Map to JobSummaryInput
      const jobSummaries: JobSummaryInput[] = jobs.map((job) => ({
        title: job.title,
        company_name: job.company_name,
        domain: job.effective_domain,
        requirements: job.requirements.map((req) => ({
          name: req.name,
          met_status: req.met_status,
          reasoning: req.reasoning,
        })),
      }));

      // 3. Generate summary via LLM
      const summaryResult =
        await this.llmService.generateGapSummary(jobSummaries);

      // 4. Save to DB
      const gapSummary = this.gapSummaryRepository.create({
        domain_filter: domainFilter || null,
        summary: summaryResult,
        job_count: jobs.length,
      });

      await this.gapSummaryRepository.save(gapSummary);
      this.logger.log(
        `Gap analysis completed successfully. Saved summary ID: ${gapSummary.id}`,
      );

      // TODO: Notify via Telegram
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error during background gap analysis: ${message}`,
        stack,
      );
    }
  }

  async getLatest(domainFilter?: Domain): Promise<GapSummary | null> {
    return this.gapSummaryRepository.findOne({
      where: { domain_filter: domainFilter ?? IsNull() },
      order: { generated_at: 'DESC' },
    });
  }

  async getHistory(limit: number = 10): Promise<GapSummary[]> {
    return this.gapSummaryRepository.find({
      order: { generated_at: 'DESC' },
      take: limit,
    });
  }
}
