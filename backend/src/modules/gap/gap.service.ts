import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { LlmService } from '../llm/llm.service';
import { JobSummaryInput } from '../llm/interfaces/job-analysis.interface';
import { TelegramService } from '../telegram/telegram.service';
import { AnalysisStatus } from '../jobs/enums/analysis-status.enum';

@Injectable()
export class GapService {
  private readonly logger = new Logger(GapService.name);

  constructor(
    @InjectRepository(GapSummary)
    private readonly gapSummaryRepository: Repository<GapSummary>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly llmService: LlmService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
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

    let jobCount = 0;
    try {
      // 1. Fetch relevant jobs
      const queryBuilder = this.jobRepository
        .createQueryBuilder('job')
        .leftJoinAndSelect('job.requirements', 'requirement')
        .where('job.include_in_gap = true');

      if (domainFilter) {
        queryBuilder.andWhere(
          'COALESCE(job.domain_override, job.llm_domain) = :domain',
          { domain: domainFilter },
        );
      }

      const jobs = await queryBuilder.getMany();
      jobCount = jobs.length;

      if (jobs.length === 0) {
        this.logger.warn('No jobs included in gap analysis.');
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
        summary: summaryResult.data,
        job_count: jobs.length,
        analysis_status: AnalysisStatus.COMPLETED,
        analysis_error: null,
        analysis_model: summaryResult.model,
        prompt_version: summaryResult.prompt_version,
        analyzed_at: summaryResult.analyzed_at,
        cv_revision_id: summaryResult.cv_revision_id,
        cv_revision: summaryResult.cv_revision,
        analysis_revision_ids: jobs
          .map((job) => job.analysis_revision_id)
          .filter((id): id is string => Boolean(id)),
      });

      await this.gapSummaryRepository.save(gapSummary);
      this.logger.log(
        `Gap analysis completed successfully. Saved summary ID: ${gapSummary.id}`,
      );

      // 5. Notify via Telegram
      await this.notifyViaTelegram(gapSummary);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === 'InvalidLlmOutputError'
          ? error.message
          : 'AI provider request failed';
      this.logger.error(`Error during background gap analysis: ${message}`);
      await this.gapSummaryRepository.save(
        this.gapSummaryRepository.create({
          domain_filter: domainFilter || null,
          summary: null,
          job_count: jobCount,
          analysis_status: AnalysisStatus.FAILED,
          analysis_error: message.replace(/[\r\n]+/g, ' ').slice(0, 500),
          analysis_model: null,
          prompt_version: null,
          analyzed_at: new Date(),
          cv_revision_id: null,
          cv_revision: null,
          analysis_revision_ids: [],
        }),
      );
    }
  }

  private async notifyViaTelegram(gapSummary: GapSummary): Promise<void> {
    const { summary, domain_filter, job_count } = gapSummary;
    if (!summary) return;
    const domainLabel = domain_filter || 'All Domains';

    let message = `✅ <b>Gap Analysis Ready</b> (${domainLabel} · ${job_count} jobs)\n\n`;

    // Extract details for the relevant domain(s)
    const domainsToReport = domain_filter
      ? [domain_filter]
      : Object.keys(summary.domains);

    domainsToReport.forEach((domain) => {
      const data = summary.domains[domain];
      if (!data) return;

      if (!domain_filter) {
        message += `🌐 <b>${domain}:</b>\n`;
      }

      if (data.missing_skills?.length > 0) {
        message += `🔴 <b>Missing:</b> ${data.missing_skills.join(', ')}\n`;
      }

      if (data.partially_known?.length > 0) {
        message += `🟡 <b>Partial:</b> ${data.partially_known.join(', ')}\n`;
      }

      message += `\n`;
    });

    if (summary.overall_top_gaps?.length > 0) {
      message += `<b>Top skills to invest in:</b>\n`;
      summary.overall_top_gaps.slice(0, 5).forEach((gap, index) => {
        message += `${index + 1}. ${gap}\n`;
      });
    }

    await this.telegramService.broadcastMessage(message);
  }

  async getLatest(domainFilter?: Domain): Promise<GapSummary | null> {
    return this.gapSummaryRepository.findOne({
      where: {
        domain_filter: domainFilter ?? IsNull(),
        analysis_status: AnalysisStatus.COMPLETED,
      },
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
