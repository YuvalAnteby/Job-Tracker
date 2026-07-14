import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { AnalysisStatus, Job, JobRequirement, MetStatus } from '../../types';
import { cn } from '../../utils/cn';

interface AnalysisDetailsProps {
  job: Job;
  onRetry: () => void;
  retrying: boolean;
}

const dimensionLabels: Record<
  keyof NonNullable<Job['score_breakdown']>,
  string
> = {
  hard_requirements: 'Hard requirements',
  preferred_requirements: 'Preferred requirements',
  technical_stack: 'Technical stack',
  seniority_eligibility: 'Seniority eligibility',
  domain_alignment: 'Domain alignment',
  logistics_availability: 'Logistics and availability',
};

interface RequirementRowProps {
  requirement: JobRequirement;
}

const RequirementRow = ({
  requirement,
}: RequirementRowProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const Icon =
    requirement.met_status === MetStatus.MET
      ? CheckCircle
      : requirement.met_status === MetStatus.NOT_MET
        ? XCircle
        : AlertTriangle;
  const iconClass =
    requirement.met_status === MetStatus.MET
      ? 'text-emerald-600'
      : requirement.met_status === MetStatus.NOT_MET
        ? 'text-red-600'
        : 'text-amber-600';

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-start gap-3">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClass)} />
          <span>
            <span className="block font-medium text-slate-800 dark:text-slate-200">
              {requirement.name}
            </span>
            <span className="text-xs text-slate-500">
              {requirement.met_status === MetStatus.UNCERTAIN
                ? 'Evidence missing'
                : requirement.met_status === MetStatus.NOT_MET
                  ? 'Confirmed gap'
                  : requirement.evidence_inferred
                    ? 'Evidence inferred'
                    : 'CV evidence found'}
            </span>
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="space-y-3 px-11 pb-4 text-sm text-slate-600 dark:text-slate-400">
          <p>{requirement.reasoning}</p>
          {requirement.job_description_excerpt && (
            <p>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Listing evidence:
              </span>{' '}
              “{requirement.job_description_excerpt}”
            </p>
          )}
          {requirement.cv_evidence && (
            <p>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                CV evidence:
              </span>{' '}
              “{requirement.cv_evidence}”
            </p>
          )}
          {requirement.evidence_inferred && !requirement.cv_evidence && (
            <p>
              Evidence is inferred from related CV experience, not a direct
              match.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const AnalysisDetails = ({
  job,
  onRetry,
  retrying,
}: AnalysisDetailsProps): React.JSX.Element => {
  if (job.analysis_status === AnalysisStatus.PENDING)
    return (
      <div
        role="status"
        className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
      >
        Analysis in progress. The job is saved and details will appear when
        scoring completes.
      </div>
    );

  if (job.analysis_status === AnalysisStatus.FAILED)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      >
        <span>
          <strong>Analysis failed.</strong>{' '}
          {job.analysis_error || 'The model did not return usable results.'}
        </span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-2 font-semibold text-slate-50 hover:bg-red-800 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin')} />
          Retry
        </button>
      </div>
    );

  if (!job.score_breakdown)
    return (
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <strong>Analysis incomplete.</strong> Re-run this legacy analysis to get
        the explainable score breakdown.
      </div>
    );

  return (
    <div className="space-y-6">
      <section aria-labelledby="analysis-summary-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4
            id="analysis-summary-heading"
            className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100"
          >
            AI analysis
          </h4>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              {job.recommendation}
            </span>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50 dark:text-blue-400"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', retrying && 'animate-spin')}
              />
              {retrying ? 'Regenerating' : 'Regenerate'}
            </button>
          </div>
        </div>
        {job.llm_summary && (
          <p className="max-w-[75ch] leading-relaxed text-slate-700 dark:text-slate-300">
            {job.llm_summary}
          </p>
        )}
        <p className="text-xs text-slate-500">
          {job.analysis_model} · {job.prompt_version}
          {job.analyzed_at
            ? ` · ${new Date(job.analyzed_at).toLocaleString()}`
            : ''}
        </p>
      </section>
      <section aria-labelledby="score-breakdown-heading">
        <h4
          id="score-breakdown-heading"
          className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100"
        >
          Score breakdown
        </h4>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {Object.entries(job.score_breakdown).map(([dimension, value]) => (
            <div
              key={dimension}
              className="grid grid-cols-[1fr_auto] items-center gap-3"
            >
              <dt className="text-sm text-slate-600 dark:text-slate-400">
                {dimensionLabels[dimension as keyof typeof dimensionLabels]}
              </dt>
              <dd className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                {value}
              </dd>
              <meter
                className="col-span-2 h-1.5 w-full"
                min="0"
                max="100"
                value={value}
                aria-label={
                  dimensionLabels[dimension as keyof typeof dimensionLabels]
                }
              />
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="requirements-heading">
        <h4
          id="requirements-heading"
          className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100"
        >
          Raw requirements
        </h4>
        <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {job.requirements.map((requirement) => (
            <RequirementRow key={requirement.id} requirement={requirement} />
          ))}
        </div>
      </section>
    </div>
  );
};
