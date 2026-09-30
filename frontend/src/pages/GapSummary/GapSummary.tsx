import React, { useState } from 'react';
import { useGapSummaryData } from './useGapSummaryData';
import { Domain } from '../../types';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Loader2,
  Calendar,
  LayoutGrid,
} from 'lucide-react';
import { format } from 'date-fns';

const GapSummary: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'ALL'>('ALL');
  const [includeResearch, setIncludeResearch] = useState(false);
  const {
    summary,
    isLoading,
    isGenerating,
    generate,
    preview,
    isPreviewLoading,
    isError,
    refetch,
    canGenerate,
    generationError,
  } = useGapSummaryData(
    selectedDomain === 'ALL' ? undefined : selectedDomain,
    includeResearch,
  );

  const handleGenerate = (): void => {
    generate();
  };

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Skill Gap Summary
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Identify the skills you need to acquire based on your active job
            applications.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end xl:shrink-0">
          <div className="grid min-w-0 gap-1 sm:min-w-48">
            <label
              htmlFor="gap-domain"
              className="text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              Domain
            </label>
            <select
              id="gap-domain"
              value={selectedDomain}
              onChange={(e) =>
                setSelectedDomain(e.target.value as Domain | 'ALL')
              }
              className="block min-h-11 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-3 pr-10"
            >
              <option value="ALL">All Domains</option>
              {Object.values(Domain).map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isGenerating
              ? 'Generating...'
              : generationError
                ? 'Retry analysis'
                : 'Generate New'}
          </button>
        </div>
      </div>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          <span>
            Could not load the latest gap analysis or its progress. Any previous
            result is shown below.
          </span>
          <button
            type="button"
            onClick={refetch}
            className="min-h-11 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}
      {isGenerating && (
        <p
          role="status"
          className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
        >
          Gap analysis is running. You can leave this page and keep working.{' '}
          {summary
            ? 'Your previous summary remains below.'
            : 'Results will appear here when ready.'}
        </p>
      )}
      {generationError && !isGenerating && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          <span className="block">{generationError}</span>
          <span className="block mt-1">Use Retry analysis to try again.</span>
        </p>
      )}

      <section
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        aria-label="Gap cohort preview"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Analysis cohort
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {isPreviewLoading
                ? 'Calculating included jobs…'
                : preview
                  ? `${preview.included_job_ids.length} jobs included · profile revision ${preview.profile_revision}`
                  : 'Cohort preview unavailable'}
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeResearch}
              onChange={(event) => setIncludeResearch(event.target.checked)}
            />
            Include research jobs
          </label>
        </div>
        {!isPreviewLoading && preview?.included_job_ids.length === 0 && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            No jobs match this cohort. Change the domain, classification, or
            gap-inclusion setting before generating.
          </p>
        )}
        {preview && preview.excluded.length > 0 && (
          <details className="mt-3 text-sm text-gray-500 dark:text-slate-400">
            <summary className="cursor-pointer">
              Why {preview.excluded.length} jobs are excluded
            </summary>
            <ul className="mt-2 space-y-1">
              {preview.excluded.map((job) => (
                <li key={job.id}>
                  <span className="font-mono text-xs">{job.id}</span>:{' '}
                  {job.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {isLoading && (
        <div
          role="status"
          className="animate-pulse rounded-md bg-gray-100 p-8 text-sm text-gray-500 dark:bg-slate-900"
        >
          Loading gap analysis...
        </div>
      )}
      {!summary ? (
        !isLoading &&
        !isError &&
        !isGenerating &&
        !generationError && (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 sm:p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              No analysis found
            </h2>
            <p className="text-gray-500 dark:text-slate-400 mt-2 mb-6">
              Click the "Generate New" button to start your first skill gap
              analysis.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-slate-400">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Last generated:{' '}
              {format(new Date(summary.generated_at), 'MMM d, yyyy HH:mm')}
            </div>
            <span>
              {summary.cohort_options?.include_research
                ? 'Includes research jobs'
                : 'Excludes research jobs'}
            </span>
            <div className="flex items-center">
              <LayoutGrid className="h-4 w-4 mr-1" />
              Analyzed {summary.job_count} jobs
            </div>
          </div>

          <div className="grid gap-6">
            {Object.entries(summary.summary.domains).map(([domain, data]) => (
              <div
                key={domain}
                className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-3 border-b border-gray-200 dark:border-slate-800">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {domain}
                  </h3>
                </div>

                <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-2">
                  <div>
                    <div className="flex items-center space-x-2 mb-4">
                      <CircleDot className="h-5 w-5 text-red-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        Missing Skills
                      </h4>
                    </div>
                    {data.missing_skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {data.missing_skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No missing skills identified.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-4">
                      <CircleDot className="h-5 w-5 text-yellow-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        Partial Knowledge
                      </h4>
                    </div>
                    {data.partially_known.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {data.partially_known.map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-500/20"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No partial skills identified.
                      </p>
                    )}
                  </div>
                </div>

                {data.gaps_detail && (
                  <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-slate-800/50">
                    <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {data.gaps_detail}
                    </p>
                  </div>
                )}
              </div>
            ))}

            <div className="pt-8 mt-4 border-t border-gray-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-500" />
                Overall Top Gaps (All Domains)
              </h3>
              <div className="space-y-5">
                {summary.summary.overall_top_gaps.map((gap, index) => {
                  const colonIndex = gap.indexOf(':');
                  // Find exactly where the prefix ends so we can bold it
                  const hasPrefix = colonIndex > 0 && colonIndex < 80;

                  return (
                    <div key={index} className="flex items-start">
                      <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-xs font-bold mr-4 mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-gray-700 dark:text-slate-300 leading-relaxed text-sm">
                        {hasPrefix ? (
                          <>
                            <strong className="font-semibold text-gray-900 dark:text-white">
                              {gap.substring(0, colonIndex + 1)}
                            </strong>
                            {gap.substring(colonIndex + 1)}
                          </>
                        ) : (
                          gap
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GapSummary;
