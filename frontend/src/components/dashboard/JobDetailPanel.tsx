import React, { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Domain, type Job, type ReanalysisComparison } from '../../types';
import {
  useAnalysisHistory,
  useDeleteJob,
  useJob,
  useReanalyzeJob,
  useUpdateJob,
} from '../../hooks/useJobs';
import { ScoreBadge, DomainTag, StatusBadge } from '../shared/Badges';
import { Modal } from '../shared/Modal';
import { ExternalLink, FileText, Loader2, Save, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { AnalysisDetails } from './AnalysisDetails';

interface JobDetailPanelProps {
  jobId: string | null;
  onClose: () => void;
}

interface JobDetailFormData {
  notes: string;
  score_override: string;
  domain_override: Domain | '';
  is_applicable_override: 'auto' | 'yes' | 'no';
}

interface JobDetailContentProps {
  job: Job;
  jobId: string;
  onClose: () => void;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string'
      ? error.message
      : 'Could not load job details.';
  }
  return 'Could not load job details.';
};

const JobDetailContent = ({
  job,
  jobId,
  onClose,
}: JobDetailContentProps): React.JSX.Element => {
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const reanalyzeJob = useReanalyzeJob();
  const analysisHistory = useAnalysisHistory(jobId);
  const [comparison, setComparison] = useState<ReanalysisComparison | null>(
    null,
  );
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const { register, handleSubmit, setValue, watch } =
    useForm<JobDetailFormData>({
      defaultValues: {
        notes: job.notes ?? '',
        score_override: job.score_override?.toString() ?? '',
        domain_override: job.domain_override ?? '',
        is_applicable_override:
          job.is_applicable_override === true
            ? 'yes'
            : job.is_applicable_override === false
              ? 'no'
              : 'auto',
      },
    });
  const isApplicableOverride = watch('is_applicable_override');

  const handleSaveOverrides: SubmitHandler<JobDetailFormData> = (
    values,
  ): void => {
    updateJob.mutate(
      {
        id: jobId,
        notes: values.notes || undefined,
        score_override:
          values.score_override === '' ? undefined : Number(values.score_override),
        domain_override:
          values.domain_override === '' ? undefined : values.domain_override,
        is_applicable_override:
          values.is_applicable_override === 'yes'
            ? true
            : values.is_applicable_override === 'no'
              ? false
              : undefined,
      },
      {
        onSuccess: (): void => {
          toast.success('Changes saved successfully');
        },
        onError: (): void => {
          toast.error('Failed to save changes');
        },
      },
    );
  };

  const handleDelete = (): void => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    deleteJob.mutate(jobId, {
      onSuccess: (): void => {
        toast.success('Job deleted');
        onClose();
      },
      onError: (): void => {
        toast.error('Failed to delete job');
      },
    });
  };

  const handleReanalyze = (): void => {
    reanalyzeJob.mutate(jobId, {
      onSuccess: (result): void => {
        setComparison(result.succeeded[0] ?? null);
        if (result.failed.length) toast.error(result.failed[0].error);
        else toast.success('Job re-analyzed successfully');
      },
      onError: (): void => {
        toast.error('Failed to re-analyze job');
      },
    });
  };

  return (
    <div className="animate-in slide-in-from-top-2 bg-gray-50/50 p-4 duration-200 dark:bg-slate-900/50 sm:p-6">
      <div className="mb-4 flex items-start justify-between sm:mb-6 sm:items-center">
        <h3 className="pr-4 text-lg font-bold text-gray-900 dark:text-white">
          {job.company_name} — {job.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"
          aria-label="Close job details"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(handleSaveOverrides)} className="space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <ScoreBadge
              score={job.effective_score}
              hasOverride={!!job.score_override}
              size="lg"
            />
            <DomainTag domain={job.effective_domain} />
            <StatusBadge status={job.status} />
          </div>
          <div className="flex flex-col gap-4 text-sm text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center">
            <div className="flex flex-col">
              <span>Added: {format(new Date(job.added_at), 'MMM d, yyyy')}</span>
              {job.posted_at && (
                <span>
                  Posted: {format(new Date(job.posted_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 border-t border-gray-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsListingModalOpen(true)}
                className="flex items-center space-x-1 font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <FileText className="h-4 w-4" />
                <span>Show Listing</span>
              </button>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 border-l border-gray-200 pl-4 font-medium text-blue-600 hover:text-blue-800 dark:border-slate-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>Open Posting</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <AnalysisDetails
          job={job}
          onRetry={handleReanalyze}
          retrying={reanalyzeJob.isPending}
        />

        {comparison && (
          <section className="border-y border-slate-200 py-4 text-sm dark:border-slate-800">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              Reanalysis comparison
            </h4>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(['before', 'after'] as const).map((side) => (
                <div key={side}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {side}
                  </p>
                  <p className="mt-1">
                    Score: <strong>{comparison[side].score ?? 'Unknown'}</strong>{' '}
                    · Recommendation:{' '}
                    <strong>
                      {comparison[side].recommendation ?? 'Unknown'}
                    </strong>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Requirements:{' '}
                    {comparison[side].requirements.join(', ') || 'None recorded'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <details className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">
            Analysis history ({analysisHistory.data?.length ?? 0})
          </summary>
          {analysisHistory.data?.length ? (
            <ol className="mt-3 space-y-2">
              {analysisHistory.data.map((revision) => (
                <li
                  key={revision.id}
                  className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {revision.status} · score {revision.score ?? 'unknown'} · CV
                    revision {revision.cv_revision ?? 'unknown'}
                  </span>
                  <span>
                    {new Date(revision.analyzed_at).toLocaleString()} ·{' '}
                    {revision.model ?? 'unknown model'} ·{' '}
                    {revision.prompt_version ?? 'unknown prompt'}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              No analysis revisions recorded yet.
            </p>
          )}
        </details>

        <div className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
            Notes
          </h4>
          <textarea
            {...register('notes')}
            aria-label="Notes"
            placeholder="Add your personal notes here..."
            className="h-32 w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700 outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
          />
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
            Manual Overrides
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
            <div>
              <label
                htmlFor={`score-override-${jobId}`}
                className="mb-2 block text-xs font-semibold uppercase text-gray-500 dark:text-slate-400"
              >
                Score Override
              </label>
              <input
                id={`score-override-${jobId}`}
                type="number"
                min="0"
                max="100"
                {...register('score_override')}
                placeholder="LLM Score"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor={`domain-override-${jobId}`}
                className="mb-2 block text-xs font-semibold uppercase text-gray-500 dark:text-slate-400"
              >
                Domain Override
              </label>
              <select
                id={`domain-override-${jobId}`}
                {...register('domain_override')}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Use AI Domain</option>
                {Object.values(Domain).map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-2 block text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                Is Applicable
              </span>
              <div className="flex h-[42px] items-center space-x-2">
                {(['auto', 'yes', 'no'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setValue('is_applicable_override', option)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 text-xs font-bold capitalize transition-all',
                      isApplicableOverride === option
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateJob.isPending}
              className="flex items-center space-x-2 rounded-lg bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-all hover:bg-slate-950 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              {updateJob.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-100 pt-6 dark:border-slate-800 sm:flex-row sm:items-center">
          <div className="text-sm italic text-gray-500 dark:text-slate-400">
            * Overrides take precedence over AI-generated values.
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteJob.isPending}
            className="flex items-center space-x-2 rounded-lg border border-transparent px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:border-red-100 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:border-red-900/30 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Job</span>
          </button>
        </div>
      </form>

      <Modal
        isOpen={isListingModalOpen}
        onClose={() => setIsListingModalOpen(false)}
        title="Job Listing"
      >
        <div className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap border-t border-gray-200 bg-gray-50 p-6 font-mono text-sm text-gray-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {job.description || 'No description available.'}
        </div>
      </Modal>
    </div>
  );
};

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
  jobId,
  onClose,
}): React.JSX.Element | null => {
  const jobQuery = useJob(jobId ?? '');

  if (!jobId) return null;

  if (jobQuery.isLoading && !jobQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="font-medium text-gray-500 dark:text-slate-400">
          Fetching job details...
        </span>
      </div>
    );
  }

  if (jobQuery.isError && !jobQuery.data) {
    return (
      <div role="alert" className="space-y-3 p-6 text-sm text-red-700 dark:text-red-300">
        <p>{getErrorMessage(jobQuery.error)}</p>
        <button
          type="button"
          onClick={() => void jobQuery.refetch()}
          className="rounded-md bg-red-700 px-3 py-2 font-semibold text-white hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!jobQuery.data) {
    return (
      <div role="alert" className="p-6 text-sm text-slate-600 dark:text-slate-300">
        Job details are unavailable.
      </div>
    );
  }

  return (
    <>
      {jobQuery.isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <span>{getErrorMessage(jobQuery.error)}</span>
          <button
            type="button"
            onClick={() => void jobQuery.refetch()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      <JobDetailContent
        key={jobQuery.data.id}
        job={jobQuery.data}
        jobId={jobId}
        onClose={onClose}
      />
    </>
  );
};
