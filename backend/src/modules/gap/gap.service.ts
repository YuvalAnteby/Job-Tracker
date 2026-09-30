import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, JsonContains, Repository } from 'typeorm';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { LlmService } from '../llm/llm.service';
import { JobSummaryInput } from '../llm/interfaces/job-analysis.interface';
import { TelegramService } from '../telegram/telegram.service';
import { AnalysisStatus } from '../jobs/enums/analysis-status.enum';
import { AnalysisClassification } from '../jobs/enums/analysis-classification.enum';
import { SettingsService } from '../settings/settings.service';

export interface CohortOptions {
  domain_filter?: Domain;
  include_research?: boolean;
}

export interface CohortPreview {
  included_job_ids: string[];
  excluded: { id: string; reason: string }[];
  profile_revision: number;
  options: { domain_filter: Domain | null; include_research: boolean };
}

export interface GapGenerationResult {
  cohort: CohortPreview;
  run: GapSummary | null;
}

interface CohortSelection extends CohortPreview {
  jobs: Job[];
}

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
    private readonly settingsService: SettingsService,
  ) {}

  async generate(options: CohortOptions = {}): Promise<GapGenerationResult> {
    const cohort = await this.selectCohort(options);
    const preview = this.toPreview(cohort);
    if (!cohort.jobs.length) return { cohort: preview, run: null };

    const pendingRun = this.gapSummaryRepository.create({
      domain_filter: cohort.options.domain_filter,
      summary: null,
      job_count: cohort.jobs.length,
      job_ids: cohort.included_job_ids,
      profile_revision: cohort.profile_revision,
      cohort_options: cohort.options,
      analysis_status: AnalysisStatus.PENDING,
      analysis_error: null,
      analysis_model: null,
      prompt_version: null,
      analyzed_at: null,
      cv_revision_id: null,
      cv_revision: null,
      analysis_revision_ids: [],
    });

    const run = await this.gapSummaryRepository.save(pendingRun);
    setImmediate(() => {
      // ponytail: in-process work can be interrupted by restart; add a durable queue when recovery matters.
      this.processGapAnalysis(cohort, run).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Unhandled error in background gap analysis: ${message}`,
        );
      });
    });
    return { cohort: preview, run };
  }

  async preview(options: CohortOptions = {}): Promise<CohortPreview> {
    return this.toPreview(await this.selectCohort(options));
  }

  private async processGapAnalysis(
    cohort: CohortSelection,
    run: GapSummary,
  ): Promise<void> {
    const domainFilter = cohort.options.domain_filter;
    this.logger.log(
      `Starting gap analysis background job${domainFilter ? ` for domain: ${domainFilter}` : ''}`,
    );

    try {
      const jobs = cohort.jobs;

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
      const completedRun = {
        summary: summaryResult.data,
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
      };

      Object.assign(run, completedRun);
      await this.gapSummaryRepository.update(run.id, completedRun);
      this.logger.log(
        `Gap analysis completed successfully. Saved summary ID: ${run.id}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === 'InvalidLlmOutputError'
          ? error.message
          : 'AI provider request failed';
      this.logger.error(`Error during background gap analysis: ${message}`);
      const failedRun = {
        summary: null,
        analysis_status: AnalysisStatus.FAILED,
        analysis_error: message.replace(/[\r\n]+/g, ' ').slice(0, 500),
        analysis_model: null,
        prompt_version: null,
        analyzed_at: new Date(),
        cv_revision_id: null,
        cv_revision: null,
        analysis_revision_ids: [],
      };
      Object.assign(run, failedRun);
      await this.gapSummaryRepository.update(run.id, failedRun);
    }

    if (run.analysis_status !== AnalysisStatus.COMPLETED) return;
    try {
      await this.notifyViaTelegram(run);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Gap analysis notification failed: ${message}`);
    }
  }

  private async selectCohort(options: CohortOptions): Promise<CohortSelection> {
    const jobs = await this.jobRepository.find({ relations: ['requirements'] });
    const profile = await this.settingsService.getTargetProfile();
    const normalized = this.normalizeOptions(options);
    const included: Job[] = [];
    const excluded: { id: string; reason: string }[] = [];
    for (const job of jobs) {
      const classification = job.effective_classification;
      const reason = !job.include_in_gap
        ? 'Excluded from gap analysis'
        : job.analysis_status === AnalysisStatus.PENDING ||
            job.analysis_status === AnalysisStatus.FAILED
          ? 'Job analysis is not complete'
          : normalized.domain_filter &&
              job.effective_domain !== normalized.domain_filter
            ? 'Outside selected domain'
            : classification === AnalysisClassification.IRRELEVANT
              ? 'Classified as irrelevant'
              : classification === AnalysisClassification.RESEARCH &&
                  !normalized.include_research
                ? 'Research jobs require opt-in'
                : null;
      if (reason) excluded.push({ id: job.id, reason });
      else included.push(job);
    }
    return {
      jobs: included,
      included_job_ids: included.map((job) => job.id),
      excluded,
      profile_revision: profile.revision,
      options: normalized,
    };
  }

  private toPreview(selection: CohortSelection): CohortPreview {
    const { jobs: _jobs, ...preview } = selection;
    void _jobs;
    return preview;
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

  async getStatus(options: CohortOptions = {}): Promise<GapSummary | null> {
    const normalized = this.normalizeOptions(options);
    return this.gapSummaryRepository.findOne({
      where: {
        domain_filter: normalized.domain_filter ?? IsNull(),
        cohort_options: JsonContains(normalized),
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

  private normalizeOptions(options: CohortOptions): CohortPreview['options'] {
    return {
      domain_filter: options.domain_filter ?? null,
      include_research: options.include_research ?? false,
    };
  }
}
