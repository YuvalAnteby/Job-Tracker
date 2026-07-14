import {
  AlertCircle,
  BookOpenCheck,
  ExternalLink,
  Plus,
  Save,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  type CreateRoadmapItem,
  type RoadmapItem,
  RoadmapStatus,
} from '../../types';
import { groupRoadmapItems, visibleRoadmapItems } from './roadmap-utils';
import {
  type ProofArtifactInput,
  useCreateRoadmapItem,
  useRoadmapData,
} from './useRoadmapData';

const controlClass =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900';

const optionalNumber = (value: string): number | undefined =>
  value === '' ? undefined : Number(value);

interface ItemControlsProps {
  item: RoadmapItem;
  save: (body: {
    status?: RoadmapStatus;
    priority_override?: number;
    notes?: string;
  }) => void;
  pending: boolean;
}

function ItemControls({
  item,
  save,
  pending,
}: ItemControlsProps): ReactElement {
  const { register, handleSubmit } = useForm<{
    status: RoadmapStatus;
    priority_override?: number;
    notes?: string;
  }>({
    defaultValues: {
      status: item.status,
      priority_override: item.priority_override ?? undefined,
      notes: item.notes ?? '',
    },
  });
  return (
    <form
      className="grid gap-2 sm:grid-cols-[11rem_8rem_minmax(12rem,1fr)_auto]"
      onSubmit={handleSubmit(save)}
    >
      <label className="grid gap-1 text-xs font-medium">
        Status
        <select className={controlClass} {...register('status')}>
          {Object.values(RoadmapStatus).map((status) => (
            <option key={status} value={status}>
              {status.replace('_', ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Priority override
        <input
          className={controlClass}
          min="0"
          step="0.1"
          type="number"
          {...register('priority_override', { setValueAs: optionalNumber })}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Quick note
        <input
          className={controlClass}
          placeholder="Next step or blocker"
          {...register('notes')}
        />
      </label>
      <button
        className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        disabled={pending}
        type="submit"
      >
        <Save className="h-4 w-4" /> Save
      </button>
    </form>
  );
}

interface ProofFormProps {
  item: RoadmapItem;
  add: (body: ProofArtifactInput) => void;
  promote: (artifactId: string) => void;
  pending: boolean;
}

function ProofForm({
  item,
  add,
  promote,
  pending,
}: ProofFormProps): ReactElement {
  const { register, handleSubmit } = useForm<ProofArtifactInput>();
  const submit = handleSubmit((body) => add(body));
  return (
    <details className="border-t border-gray-200 pt-3 dark:border-slate-800">
      <summary className="w-fit cursor-pointer text-sm font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300">
        Proof and CV evidence
      </summary>
      <div className="mt-3 space-y-3">
        {item.artifacts.length > 0 && (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
            {item.artifacts.map((artifact) => (
              <li
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                key={artifact.id}
              >
                <div>
                  <p className="text-sm font-medium">{artifact.title}</p>
                  {(artifact.url || artifact.repository_url) && (
                    <a
                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline dark:text-blue-300"
                      href={artifact.repository_url ?? artifact.url ?? '#'}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open proof <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {artifact.promoted_at ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    CV evidence
                  </span>
                ) : (
                  <button
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800"
                    disabled={pending}
                    onClick={() => promote(artifact.id)}
                    type="button"
                  >
                    Promote to CV evidence
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="grid gap-2 md:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1 text-xs font-medium">
            Proof title
            <input
              className={controlClass}
              required
              {...register('title', { required: true })}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Project URL
            <input className={controlClass} type="url" {...register('url')} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Repository URL
            <input
              className={controlClass}
              type="url"
              {...register('repository_url')}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Resources
            <input
              className={controlClass}
              placeholder="Course, docs, reading"
              {...register('resources')}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium md:col-span-2">
            Proof notes
            <textarea
              className={controlClass}
              rows={2}
              {...register('notes')}
            />
          </label>
          <button
            className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            Attach proof
          </button>
        </form>
      </div>
    </details>
  );
}

interface RoadmapRowProps {
  item: RoadmapItem;
  update: ItemControlsProps['save'];
  addArtifact: ProofFormProps['add'];
  promote: ProofFormProps['promote'];
  pending: boolean;
}

function RoadmapRow({
  item,
  update,
  addArtifact,
  promote,
  pending,
}: RoadmapRowProps): ReactElement {
  return (
    <li className="space-y-3 border-t border-gray-200 py-4 first:border-t-0 dark:border-slate-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-950 dark:text-slate-50">
              {item.title}
            </h3>
            {item.overdue && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                Overdue
              </span>
            )}
            {item.status === RoadmapStatus.BLOCKED && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Blocked
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Priority {item.effective_priority.toFixed(1)}:{' '}
            {item.priority_reason}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-slate-400">
            {item.target_date && <span>Due {item.target_date}</span>}
            <span>{item.requirements.length} requirements</span>
            <span>{item.jobs.length} linked jobs</span>
            {item.target_profile_revision !== null && (
              <span>Profile rev. {item.target_profile_revision}</span>
            )}
          </div>
        </div>
        {item.skill && (
          <Link
            className="text-sm text-blue-700 hover:underline dark:text-blue-300"
            to="/skills"
          >
            {item.skill.name}
          </Link>
        )}
      </div>
      <ItemControls item={item} pending={pending} save={update} />
      <ProofForm
        add={addArtifact}
        item={item}
        pending={pending}
        promote={promote}
      />
    </li>
  );
}

function Roadmap(): ReactElement {
  const [status, setStatus] = useState<RoadmapStatus | 'ALL'>('ALL');
  const [semester, setSemester] = useState('ALL');
  const {
    data = [],
    isLoading,
    isError,
    refetch,
    update,
    addArtifact,
    promote,
  } = useRoadmapData();
  const create = useCreateRoadmapItem();
  const { register, handleSubmit, reset } = useForm<CreateRoadmapItem>({
    defaultValues: { title: '', gap_type: 'SKILL', effort: 3, relevance: 5 },
  });
  const semesters = useMemo(
    () => Array.from(new Set(data.map((item) => item.semester))),
    [data],
  );
  const groups = groupRoadmapItems(visibleRoadmapItems(data, status, semester));
  const submit = handleSubmit((body) =>
    create.mutate(body, { onSuccess: () => reset() }),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-950 dark:text-slate-50">
          Learning roadmap
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-slate-400">
          Turn repeated gaps into dated work, then attach proof before promoting
          it to CV evidence.
        </p>
      </header>

      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">Add a roadmap item</h2>
        <form
          className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_10rem_7rem_7rem_auto]"
          onSubmit={submit}
        >
          <label className="grid gap-1 text-xs font-medium">
            Outcome
            <input
              className={controlClass}
              placeholder="Build a Kafka event pipeline"
              required
              {...register('title', { required: true })}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Target date
            <input
              className={controlClass}
              type="date"
              {...register('target_date')}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Effort
            <input
              className={controlClass}
              max="5"
              min="1"
              type="number"
              {...register('effort', { setValueAs: optionalNumber })}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Relevance
            <input
              className={controlClass}
              max="5"
              min="0"
              type="number"
              {...register('relevance', { setValueAs: optionalNumber })}
            />
          </label>
          <button
            className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            disabled={create.isPending}
            type="submit"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
          <label className="grid gap-1 text-xs font-medium">
            Gap type
            <select className={controlClass} {...register('gap_type')}>
              <option value="SKILL">Skill</option>
              <option value="EVIDENCE">Evidence</option>
              <option value="TIME_BOUND">Time-bound</option>
              <option value="ROLE_MISMATCH">Role mismatch</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium md:col-span-3">
            Notes
            <input
              className={controlClass}
              placeholder="Resources or expected proof"
              {...register('notes')}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" {...register('confirm_non_learnable')} /> I
            understand time-bound or role gaps may not be learnable
          </label>
        </form>
      </section>

      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs font-medium">
          Status
          <select
            className={controlClass}
            onChange={(event) =>
              setStatus(event.target.value as RoadmapStatus | 'ALL')
            }
            value={status}
          >
            <option value="ALL">All statuses</option>
            {Object.values(RoadmapStatus).map((value) => (
              <option key={value} value={value}>
                {value.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Semester
          <select
            className={controlClass}
            onChange={(event) => setSemester(event.target.value)}
            value={semester}
          >
            <option value="ALL">All semesters</option>
            {semesters.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <div aria-label="Loading roadmap" className="space-y-2">
          {[1, 2, 3].map((row) => (
            <div
              className="h-28 animate-pulse rounded-md bg-gray-200 dark:bg-slate-800"
              key={row}
            />
          ))}
        </div>
      )}
      {isError && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Could not load the roadmap.
          </span>
          <button
            className="font-semibold hover:underline"
            onClick={() => refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {!isLoading && !isError && groups.size === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-10 text-center dark:border-slate-700">
          <BookOpenCheck className="mx-auto mb-3 h-6 w-6 text-gray-400" />
          <h2 className="font-semibold">No roadmap items here</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Add one above or send a repeated gap from Skill evidence.
          </p>
        </div>
      )}
      {Array.from(groups.entries()).map(([month, items]) => (
        <section key={month}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">
              {month === 'Backlog'
                ? month
                : new Intl.DateTimeFormat(undefined, {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${month}-01T00:00:00Z`))}
            </h2>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {items[0]?.semester}
            </span>
          </div>
          <ul className="rounded-md border border-gray-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {items.map((item) => (
              <RoadmapRow
                addArtifact={(body) =>
                  addArtifact.mutate({ id: item.id, body })
                }
                item={item}
                key={item.id}
                pending={
                  update.isPending || addArtifact.isPending || promote.isPending
                }
                promote={(artifactId) =>
                  promote.mutate({ id: item.id, artifactId })
                }
                update={(body) => update.mutate({ id: item.id, body })}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default Roadmap;
