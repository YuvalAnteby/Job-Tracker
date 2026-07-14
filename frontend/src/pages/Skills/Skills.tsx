import { AlertCircle, RefreshCw, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Domain, type SkillAggregate } from '../../types';
import { useSkillsData } from './useSkillsData';
import { useCreateRoadmapItem } from '../Roadmap/useRoadmapData';

interface AliasForm {
  alias: string;
  skill_name: string;
}

const badgeClass =
  'rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

interface SkillRowProps {
  skill: SkillAggregate;
  addToRoadmap: () => void;
  adding: boolean;
}

const SkillRow = ({ skill, addToRoadmap, adding }: SkillRowProps) => (
  <details className="group border-b border-gray-200 last:border-b-0 dark:border-slate-800">
    <summary className="grid cursor-pointer list-none grid-cols-[minmax(9rem,1fr)_repeat(3,5rem)] items-center gap-3 px-4 py-3 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800/60 sm:grid-cols-[minmax(12rem,1fr)_repeat(4,6rem)]">
      <span className="font-semibold text-gray-950 dark:text-slate-50">
        {skill.name}
      </span>
      <span className="text-center text-sm tabular-nums">
        {skill.required_count}
        <span className="sr-only"> required</span>
      </span>
      <span className="hidden text-center text-sm tabular-nums sm:block">
        {skill.preferred_count}
        <span className="sr-only"> preferred</span>
      </span>
      <span className="text-center text-sm tabular-nums text-red-700 dark:text-red-300">
        {skill.gap_count}
        <span className="sr-only"> gaps</span>
      </span>
      <span className="text-center text-xs font-medium text-gray-500 dark:text-slate-400">
        {skill.actionability}
      </span>
    </summary>
    <div className="bg-gray-50 px-4 py-4 dark:bg-slate-950/60">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {skill.gap_types.map((type) => (
          <span className={badgeClass} key={type}>
            {type.replace('_', ' ')}
          </span>
        ))}
        <span className={badgeClass}>{skill.effort.toLowerCase()} effort</span>
        <button
          className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          disabled={adding}
          onClick={addToRoadmap}
          type="button"
        >
          Add to roadmap
        </button>
      </div>
      <p className="mb-4 max-w-3xl text-xs text-gray-500 dark:text-slate-400">
        Ranked by {skill.sort_reason}.
      </p>
      <ul className="space-y-3">
        {skill.supporting_jobs.map((job) => (
          <li
            className="grid gap-1 border-t border-gray-200 pt-3 first:border-t-0 first:pt-0 dark:border-slate-800"
            key={`${job.job_id}:${job.requirement_text}`}
          >
            <Link
              className="w-fit text-sm font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300"
              to={`/jobs/${job.job_id}`}
            >
              {job.company_name}, {job.title}
            </Link>
            <span className="max-w-3xl text-sm text-gray-800 dark:text-slate-200">
              {job.requirement_text}
            </span>
            {job.excerpt && (
              <span className="max-w-3xl text-xs text-gray-500 dark:text-slate-400">
                Posting: {job.excerpt}
              </span>
            )}
            {job.cv_evidence && (
              <span className="max-w-3xl text-xs text-emerald-700 dark:text-emerald-300">
                CV evidence: {job.cv_evidence}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  </details>
);

const Skills = () => {
  const [domain, setDomain] = useState<Domain | 'ALL'>('ALL');
  const [includeResearch, setIncludeResearch] = useState(false);
  const { data, isLoading, isError, refetch, alias, rebuild } = useSkillsData(
    domain === 'ALL' ? undefined : domain,
    includeResearch,
  );
  const { register, handleSubmit, reset } = useForm<AliasForm>();
  const createRoadmapItem = useCreateRoadmapItem();
  const saveAlias = handleSubmit((values) => {
    alias.mutate(values, { onSuccess: () => reset() });
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950 dark:text-slate-50">
            Skill evidence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-slate-400">
            Required and preferred skills, tied back to posting excerpts and CV
            evidence.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
            Domain
            <select
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900"
              onChange={(event) =>
                setDomain(event.target.value as Domain | 'ALL')
              }
              value={domain}
            >
              <option value="ALL">All domains</option>
              {Object.values(Domain).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <input
              checked={includeResearch}
              className="h-4 w-4 accent-blue-600"
              onChange={(event) => setIncludeResearch(event.target.checked)}
              type="checkbox"
            />
            Include research jobs
          </label>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            disabled={rebuild.isPending}
            onClick={() => rebuild.mutate()}
            type="button"
          >
            <RefreshCw
              className={`h-4 w-4 ${rebuild.isPending ? 'animate-spin' : ''}`}
            />
            Rebuild
          </button>
        </div>
      </header>

      {isLoading && (
        <div aria-label="Loading skill evidence" className="space-y-2">
          {[1, 2, 3, 4].map((row) => (
            <div
              className="h-12 animate-pulse rounded-md bg-gray-200 dark:bg-slate-800"
              key={row}
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Could not load skill evidence.
          </span>
          <button
            className="font-semibold hover:underline"
            onClick={() => refetch()}
          >
            Try again
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-slate-300">
            <span>
              <strong className="text-gray-950 dark:text-slate-50">
                {data.sample_size}
              </strong>{' '}
              distinct role groups
            </span>
            <span>{data.raw_job_count} source jobs</span>
            <span>{data.skills.length} normalized skills</span>
          </div>

          {data.skills.length ? (
            <section className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-[minmax(9rem,1fr)_repeat(3,5rem)] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400 sm:grid-cols-[minmax(12rem,1fr)_repeat(4,6rem)]">
                <span className="text-left">Skill</span>
                <span>Required</span>
                <span className="hidden sm:block">Preferred</span>
                <span>Gaps</span>
                <span>Action</span>
              </div>
              {data.skills.map((skill) => (
                <SkillRow
                  adding={createRoadmapItem.isPending}
                  addToRoadmap={() =>
                    createRoadmapItem.mutate({
                      title: `Build proof for ${skill.name}`,
                      skill_id: skill.id,
                      job_ids: skill.supporting_jobs.map((job) => job.job_id),
                      requirement_ids: skill.supporting_jobs.map(
                        (job) => job.requirement_id,
                      ),
                    })
                  }
                  key={skill.id}
                  skill={skill}
                />
              ))}
            </section>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 p-10 text-center dark:border-slate-700">
              <h2 className="font-semibold">
                No normalized skills in this cohort
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Include a job in gap analysis, then rebuild the matrix.
              </p>
            </div>
          )}

          {data.non_learnable_gaps.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Eligibility constraints</h2>
              <p className="mb-3 text-sm text-gray-500 dark:text-slate-400">
                Experience duration, graduation timing, and role-level
                mismatches are tracked separately from learnable skills.
              </p>
              <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {data.non_learnable_gaps.map((gap) => (
                  <li
                    className="py-3 text-sm"
                    key={`${gap.job_id}:${gap.requirement_text}`}
                  >
                    <span className="font-medium">{gap.requirement_text}</span>
                    <span className="ml-2 text-gray-500 dark:text-slate-400">
                      {gap.company_name}, {gap.title}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="border-t border-gray-200 pt-5 dark:border-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold">Correct the taxonomy</h2>
        </div>
        <form
          className="flex max-w-2xl flex-col gap-3 sm:flex-row"
          onSubmit={saveAlias}
        >
          <label className="grid flex-1 gap-1 text-xs font-medium">
            Posting term
            <input
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="e.g. k8s"
              {...register('alias', { required: true })}
            />
          </label>
          <label className="grid flex-1 gap-1 text-xs font-medium">
            Canonical skill
            <input
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="e.g. Kubernetes"
              {...register('skill_name', { required: true })}
            />
          </label>
          <button
            className="mt-auto h-10 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            disabled={alias.isPending}
            type="submit"
          >
            Save correction
          </button>
        </form>
      </section>
    </div>
  );
};

export default Skills;
