import { useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import { Columns3, List, RotateCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  useJobs,
  useTransitionApplicationStage,
  useUpdateJob,
} from '../../hooks/useJobs';
import {
  ApplicationStage,
  type Job,
  ListingState,
  UserDecision,
} from '../../types';
import { cn } from '../../utils/cn';
import { nextStages, stageLabel, stageOrder } from './pipeline-utils';
import {
  useApplicationActions,
  useReminderDefaults,
} from '../../hooks/useApplications';

type View = 'board' | 'list';

interface TransitionForm {
  new_stage: ApplicationStage;
  source: string;
  rejection_reason: string;
  notes: string;
  occurred_at: string;
  applied_at: string;
}

interface PipelineJobProps {
  job: Job;
  compact?: boolean;
}

interface ActionForm {
  label: string;
  due_at: string;
}

const controlClass =
  'rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

const NextActionForm = ({ job }: { job: Job }): ReactElement => {
  const { schedule } = useApplicationActions();
  const { data: reminderDefaults } = useReminderDefaults();
  const { register, handleSubmit, reset } = useForm<ActionForm>();
  return (
    <form
      className="mt-2 grid grid-cols-[1fr_auto] gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"
      onSubmit={handleSubmit((values) =>
        schedule.mutate(
          {
            jobId: job.id,
            label: values.label,
            due_at: values.due_at
              ? new Date(values.due_at).toISOString()
              : undefined,
          },
          {
            onSuccess: () => {
              toast.success('Next action scheduled');
              reset();
            },
            onError: () => toast.error('Next action could not be scheduled'),
          },
        ),
      )}
    >
      <label className="sr-only" htmlFor={`action-${job.id}`}>
        Next action for {job.title}
      </label>
      <input
        id={`action-${job.id}`}
        placeholder="Next action"
        maxLength={200}
        className={controlClass}
        {...register('label', { required: true })}
      />
      <button
        type="submit"
        disabled={schedule.isPending}
        className="row-span-2 rounded-md border border-slate-300 px-2.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Schedule
      </button>
      <label className="sr-only" htmlFor={`action-due-${job.id}`}>
        Due date for {job.title}
      </label>
      <input
        id={`action-due-${job.id}`}
        type="datetime-local"
        title={`Leave blank to use the ${reminderDefaults?.reminder_default_days ?? 3}-day default`}
        className={controlClass}
        {...register('due_at')}
      />
    </form>
  );
};

const PipelineJob = ({
  job,
  compact = false,
}: PipelineJobProps): ReactElement => {
  const transition = useTransitionApplicationStage();
  const update = useUpdateJob();
  const { register, handleSubmit, watch, reset } = useForm<TransitionForm>({
    defaultValues: {
      source: 'WEB',
      new_stage: nextStages(job.application_stage)[0],
      rejection_reason: '',
      notes: '',
      occurred_at: '',
      applied_at: '',
    },
  });
  const selectedStage = watch('new_stage');

  const submit = handleSubmit((values): void => {
    transition.mutate(
      {
        id: job.id,
        new_stage: values.new_stage,
        source: values.source,
        rejection_reason: values.rejection_reason || undefined,
        notes: values.notes || undefined,
        occurred_at: values.occurred_at || undefined,
        applied_at: values.applied_at || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Moved to ${stageLabel(values.new_stage)}`);
          reset({
            source: 'WEB',
            new_stage: nextStages(values.new_stage)[0],
            rejection_reason: '',
            notes: '',
            occurred_at: '',
            applied_at: '',
          });
        },
        onError: () =>
          toast.error('Stage change failed. The previous stage was restored.'),
      },
    );
  });

  const patch = (payload: Partial<Job>): void => {
    update.mutate(
      { id: job.id, ...payload },
      { onError: () => toast.error('Could not save workflow setting') },
    );
  };

  return (
    <article
      className={cn(
        'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950',
        compact
          ? 'grid gap-3 border-b px-3 py-3 md:grid-cols-[minmax(12rem,1fr)_repeat(4,minmax(8rem,auto))] md:items-center'
          : 'rounded-md border p-3 shadow-sm',
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {job.title}
        </h3>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {job.company_name}
        </p>
      </div>
      <label className="grid gap-1 text-[11px] font-medium text-slate-500">
        Listing
        <select
          className={controlClass}
          value={job.listing_state}
          onChange={(event) =>
            patch({ listing_state: event.target.value as ListingState })
          }
        >
          {Object.values(ListingState).map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[11px] font-medium text-slate-500">
        Decision
        <select
          className={controlClass}
          value={job.user_decision}
          onChange={(event) =>
            patch({ user_decision: event.target.value as UserDecision })
          }
        >
          {Object.values(UserDecision).map((decision) => (
            <option key={decision} value={decision}>
              {decision}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={job.include_in_gap}
          onChange={(event) => patch({ include_in_gap: event.target.checked })}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        Gap analysis
      </label>

      <form
        className={cn(
          'grid gap-2',
          compact
            ? 'md:min-w-56'
            : 'mt-3 border-t border-slate-200 pt-3 dark:border-slate-800',
        )}
        onSubmit={submit}
      >
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`stage-${job.id}`}>
            Next stage for {job.title}
          </label>
          <select
            id={`stage-${job.id}`}
            className={cn(controlClass, 'min-w-0 flex-1')}
            {...register('new_stage', { required: true })}
          >
            <option value="">Choose stage</option>
            {job.applied_at && (
              <option value={job.application_stage}>
                Correct applied date
              </option>
            )}
            {nextStages(job.application_stage).map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={transition.isPending || !selectedStage}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-slate-50 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          >
            Move
          </button>
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40">
            Transition details
          </summary>
          <div className="mt-2 grid gap-2">
            <label>
              Source
              <input
                className={cn(controlClass, 'mt-1 w-full')}
                maxLength={100}
                {...register('source', { required: true })}
              />
            </label>
            {selectedStage === ApplicationStage.REJECTED && (
              <label>
                Rejection reason
                <input
                  className={cn(controlClass, 'mt-1 w-full')}
                  maxLength={500}
                  {...register('rejection_reason')}
                />
              </label>
            )}
            <label>
              Event time
              <input
                type="datetime-local"
                className={cn(controlClass, 'mt-1 w-full')}
                {...register('occurred_at')}
              />
            </label>
            {selectedStage === job.application_stage && (
              <label>
                Applied date
                <input
                  type="datetime-local"
                  required
                  className={cn(controlClass, 'mt-1 w-full')}
                  {...register('applied_at')}
                />
              </label>
            )}
            <label>
              Notes
              <input
                className={cn(controlClass, 'mt-1 w-full')}
                maxLength={2000}
                {...register('notes')}
              />
            </label>
          </div>
        </details>
      </form>

      <NextActionForm job={job} />

      {job.application_events?.length > 0 && (
        <details
          className={cn(
            'text-xs text-slate-500',
            compact ? 'md:col-span-5' : 'mt-2',
          )}
        >
          <summary className="cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40">
            History ({job.application_events.length})
          </summary>
          <ol className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-800">
            {job.application_events.map((event) => (
              <li key={event.id} className="flex flex-wrap gap-x-2">
                <time dateTime={event.occurred_at}>
                  {format(new Date(event.occurred_at), 'MMM d, yyyy HH:mm')}
                </time>
                <span>
                  {stageLabel(event.previous_stage)} →{' '}
                  {stageLabel(event.new_stage)}
                </span>
                <span>via {event.source}</span>
                {event.rejection_reason && (
                  <span>Reason: {event.rejection_reason}</span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
};

const Pipeline = (): ReactElement => {
  const [view, setView] = useState<View>('board');
  const { data: jobs = [], isLoading, isError, refetch } = useJobs({});
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Application pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Move applications forward without changing listing availability or
            gap analysis.
          </p>
        </div>
        <div
          className="flex rounded-md border border-slate-300 p-1 dark:border-slate-700"
          aria-label="Pipeline view"
        >
          <button
            type="button"
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
            className={cn(
              'rounded px-2.5 py-1.5 text-xs font-medium',
              view === 'board'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500',
            )}
          >
            <Columns3 className="mr-1 inline h-3.5 w-3.5" />
            Board
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={cn(
              'rounded px-2.5 py-1.5 text-xs font-medium',
              view === 'list'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500',
            )}
          >
            <List className="mr-1 inline h-3.5 w-3.5" />
            List
          </button>
        </div>
      </header>
      {isLoading && (
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
      )}
      {isError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <span>Pipeline could not be loaded.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="font-semibold"
          >
            <RotateCcw className="mr-1 inline h-4 w-4" />
            Retry
          </button>
        </div>
      )}
      {!isLoading && !isError && jobs.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Add a job to start tracking its application.
        </p>
      )}
      {!isLoading && !isError && jobs.length > 0 && view === 'board' && (
        <div
          className="flex snap-x gap-4 overflow-x-auto pb-3"
          aria-label="Application stages"
        >
          {stageOrder.map((stage) => {
            const stageJobs = jobs.filter(
              (job) => job.application_stage === stage,
            );
            return (
              <section
                key={stage}
                className="w-[19rem] shrink-0 snap-start"
                aria-labelledby={`heading-${stage}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2
                    id={`heading-${stage}`}
                    className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    {stageLabel(stage)}
                  </h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {stageJobs.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageJobs.map((job) => (
                    <PipelineJob key={job.id} job={job} />
                  ))}
                  {stageJobs.length === 0 && (
                    <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700">
                      No applications
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {!isLoading && !isError && jobs.length > 0 && view === 'list' && (
        <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
          {jobs.map((job) => (
            <PipelineJob key={job.id} job={job} compact />
          ))}
        </div>
      )}
    </div>
  );
};

export default Pipeline;
