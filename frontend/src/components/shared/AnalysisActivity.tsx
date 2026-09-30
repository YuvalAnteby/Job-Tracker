import { useEffect, useRef, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AnalysisStatus, type Job, type JobFilters } from '../../types';
import { invalidateJobQueries, useJobs } from '../../hooks/useJobs';

interface AnalysisActivityProps {
  className?: string;
}

const EMPTY_FILTERS: JobFilters = {};
const EMPTY_JOBS: Job[] = [];

export const AnalysisActivity = ({
  className = '',
}: AnalysisActivityProps): JSX.Element | null => {
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useJobs(EMPTY_FILTERS);
  const previousStatuses = useRef<Map<string, AnalysisStatus>>(new Map());
  const jobs = data ?? EMPTY_JOBS;
  const pendingJobs = jobs.filter(
    (job) => job.analysis_status === AnalysisStatus.PENDING,
  );
  const failedJobs = jobs.filter(
    (job) => job.analysis_status === AnalysisStatus.FAILED,
  );

  useEffect((): void => {
    const currentStatuses = new Map<string, AnalysisStatus>();
    jobs.forEach((job: Job) => {
      currentStatuses.set(job.id, job.analysis_status);
      const previousStatus = previousStatuses.current.get(job.id);
      if (
        previousStatus !== AnalysisStatus.PENDING ||
        job.analysis_status === AnalysisStatus.PENDING
      ) {
        return;
      }

      invalidateJobQueries(queryClient);
      if (job.analysis_status === AnalysisStatus.COMPLETED) {
        toast.success(`${job.company_name} analysis is ready.`);
      } else if (job.analysis_status === AnalysisStatus.FAILED) {
        toast.error(`${job.company_name} analysis failed.`);
      }
    });
    previousStatuses.current = currentStatuses;
  }, [jobs, queryClient]);

  if (!pendingJobs.length && !failedJobs.length && !isError) return null;

  return (
    <aside
      aria-label="Analysis activity"
      className={`fixed bottom-4 right-4 z-40 max-h-[min(50vh,20rem)] w-[min(22rem,calc(100vw-2rem))] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${className}`}
    >
      {isError && (
        <div
          role="alert"
          className="border-b border-red-200 pb-2 text-red-700 dark:border-red-900 dark:text-red-300"
        >
          <span>Analysis activity could not be refreshed.</span>{' '}
          <button
            type="button"
            onClick={() => void refetch()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      {pendingJobs.length > 0 && (
        <div role="status" aria-live="polite">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Analysis running ({pendingJobs.length})
          </p>
          <ul className="mt-1 space-y-1">
            {pendingJobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/jobs/${job.id}`}
                  className="block break-words text-blue-700 hover:underline dark:text-blue-300"
                >
                  {job.company_name} — {job.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {failedJobs.length > 0 && (
        <div role="alert">
          <p className="font-semibold text-red-700 dark:text-red-300">
            Analysis failed ({failedJobs.length})
          </p>
          <ul className="mt-1 space-y-1">
            {failedJobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/jobs/${job.id}`}
                  className="block break-words text-red-700 hover:underline dark:text-red-300"
                >
                  {job.company_name} — {job.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
