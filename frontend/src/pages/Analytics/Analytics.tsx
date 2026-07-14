import { useReducer, useState, type ReactElement } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  downloadAnalyticsCsv,
  useApplicationActions,
  useApplicationAnalytics,
  useAttention,
} from '../../hooks/useApplications';
import { AnalysisClassification, Domain } from '../../types';
import type { AnalyticsFilters, AttentionItem } from '../../types/applications';
import { cn } from '../../utils/cn';

const control =
  'rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

const emptyFilters: AnalyticsFilters = {};

function ActionRow({ item }: { item: AttentionItem }): ReactElement {
  const { finish, reschedule } = useApplicationActions();
  const [dueAt, setDueAt] = useState('');
  const pending = finish.isPending || reschedule.isPending;
  return (
    <li className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {item.action.label}
        </p>
        <p className="truncate text-xs text-slate-500">
          {item.job.company_name}, {item.job.title} · due{' '}
          {new Date(item.action.due_at).toLocaleString()}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`New due date for ${item.job.title}`}
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className={cn(control, 'w-44 py-1.5 text-xs')}
        />
        <button
          type="button"
          disabled={!dueAt || pending}
          onClick={() =>
            reschedule.mutate(
              { jobId: item.job.id, due_at: new Date(dueAt).toISOString() },
              { onSuccess: () => setDueAt('') },
            )
          }
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Reschedule
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            finish.mutate({ jobId: item.job.id, outcome: 'complete' })
          }
          className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-slate-50 hover:bg-blue-700 disabled:opacity-50"
        >
          Complete
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            finish.mutate({ jobId: item.job.id, outcome: 'dismiss' })
          }
          className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-50 dark:hover:text-slate-100"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}

const ResponseTable = ({
  title,
  values,
}: {
  title: string;
  values: Record<
    string,
    { total: number; responses: number; response_rate: number | null }
  >;
}): ReactElement => (
  <section>
    <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
      {title}
    </h2>
    <div className="overflow-x-auto border-y border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-96 text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2 font-medium">Group</th>
            <th className="py-2 font-medium">Responses</th>
            <th className="py-2 text-right font-medium">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {Object.entries(values).map(([name, value]) => (
            <tr key={name}>
              <td className="max-w-64 truncate py-2 font-medium">{name}</td>
              <td className="py-2 text-slate-500">
                {value.responses} of {value.total}
              </td>
              <td className="py-2 text-right tabular-nums">
                {value.response_rate === null
                  ? 'N/A'
                  : `${value.response_rate}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!Object.keys(values).length && (
        <p className="py-5 text-center text-xs text-slate-500">
          No matching applications.
        </p>
      )}
    </div>
  </section>
);

const OutcomeTable = ({
  title,
  values,
}: {
  title: string;
  values: Record<string, Record<string, number>>;
}): ReactElement => (
  <section>
    <h2 className="mb-2 text-sm font-semibold">{title}</h2>
    <ul className="divide-y divide-slate-200 border-y border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
      {Object.entries(values).map(([group, stages]) => (
        <li key={group} className="py-2">
          <p className="mb-1 font-medium">{group}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-500">
            {Object.entries(stages).map(([stage, count]) => (
              <span key={stage} className="tabular-nums">
                {stage.replaceAll('_', ' ')}: {count}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  </section>
);

export default function Analytics(): ReactElement {
  const [filters, setFilter] = useReducer(
    (state: AnalyticsFilters, update: Partial<AnalyticsFilters>) => ({
      ...state,
      ...update,
    }),
    emptyFilters,
  );
  const attention = useAttention();
  const analytics = useApplicationAnalytics(filters);
  const data = analytics.data;
  const groups = [
    [
      'Overdue',
      attention.data?.overdue ?? [],
      'text-red-700 dark:text-red-300',
    ],
    [
      'Due today',
      attention.data?.due_today ?? [],
      'text-amber-700 dark:text-amber-300',
    ],
    [
      'Upcoming',
      attention.data?.upcoming ?? [],
      'text-slate-700 dark:text-slate-200',
    ],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
          Follow-through
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
          Attention and analytics
        </h1>
      </header>

      <section aria-labelledby="attention-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="attention-heading" className="text-lg font-semibold">
            Needs attention
          </h2>
          <span className="text-xs text-slate-500">
            {attention.data?.timezone ?? 'Asia/Jerusalem'}
          </span>
        </div>
        {attention.isLoading && (
          <div className="h-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        )}
        {attention.isError && (
          <p role="alert" className="text-sm text-red-600">
            Actions could not be loaded.
          </p>
        )}
        {attention.data && groups.every(([, items]) => !items.length) && (
          <p className="border-y border-slate-200 py-6 text-sm text-slate-500 dark:border-slate-800">
            Nothing needs attention. Schedule a next action from the pipeline.
          </p>
        )}
        <div className="grid gap-x-8 lg:grid-cols-3">
          {groups.map(([label, items, color]) =>
            items.length ? (
              <section key={label} aria-label={label}>
                <h3
                  className={cn(
                    'border-b border-slate-200 py-2 text-xs font-semibold uppercase tracking-wide dark:border-slate-800',
                    color,
                  )}
                >
                  {label} · {items.length}
                </h3>
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item) => (
                    <ActionRow key={item.action.id} item={item} />
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      </section>

      <section aria-labelledby="analytics-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 id="analytics-heading" className="text-lg font-semibold">
              Application analytics
            </h2>
            <p className="text-xs text-slate-500">
              Calculated from recorded application-stage events.
            </p>
          </div>
          <button
            type="button"
            disabled={!data?.sample_size}
            onClick={() =>
              void downloadAnalyticsCsv(filters).catch(() =>
                toast.error('Export failed'),
              )
            }
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input
            aria-label="From date"
            type="date"
            value={filters.from ?? ''}
            onChange={(event) =>
              setFilter({ from: event.target.value || undefined })
            }
            className={control}
          />
          <input
            aria-label="To date"
            type="date"
            value={filters.to ?? ''}
            onChange={(event) =>
              setFilter({
                to: event.target.value
                  ? `${event.target.value}T23:59:59.999Z`
                  : undefined,
              })
            }
            className={control}
          />
          <select
            aria-label="Domain"
            value={filters.domain ?? ''}
            onChange={(event) =>
              setFilter({
                domain: (event.target.value || undefined) as Domain | undefined,
              })
            }
            className={control}
          >
            <option value="">All domains</option>
            {Object.values(Domain).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Classification"
            value={filters.classification ?? ''}
            onChange={(event) =>
              setFilter({
                classification: (event.target.value || undefined) as
                  AnalysisClassification | undefined,
              })
            }
            className={control}
          >
            <option value="">All classifications</option>
            {Object.values(AnalysisClassification).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <input
            aria-label="Source"
            placeholder="Source"
            value={filters.source ?? ''}
            onChange={(event) =>
              setFilter({ source: event.target.value || undefined })
            }
            className={control}
          />
          <button
            type="button"
            onClick={() =>
              setFilter({
                from: undefined,
                to: undefined,
                domain: undefined,
                classification: undefined,
                source: undefined,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-medium dark:border-slate-700"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>

        {analytics.isLoading && (
          <div className="h-40 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        )}
        {analytics.isError && (
          <p role="alert" className="text-sm text-red-600">
            Analytics could not be loaded.
          </p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-4 dark:border-slate-800">
              <div>
                <span className="block text-xs text-slate-500">
                  Applications
                </span>
                <strong className="text-xl tabular-nums">
                  {data.sample_size}
                </strong>
              </div>
              <div>
                <span className="block text-xs text-slate-500">
                  Median first response
                </span>
                <strong className="text-xl tabular-nums">
                  {data.median_time_to_first_response_hours === null
                    ? 'N/A'
                    : `${data.median_time_to_first_response_hours}h`}
                </strong>
              </div>
              <p className="max-w-xl self-center text-xs text-slate-500">
                {data.disclaimer}
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <ResponseTable
                title="Response by role"
                values={data.response_by_role}
              />
              <ResponseTable
                title="Response by source"
                values={data.response_by_source}
              />
            </div>
            <section>
              <h2 className="mb-2 text-sm font-semibold">
                Applications by week
              </h2>
              <ul className="divide-y divide-slate-200 border-y border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
                {data.weekly_applications.map(({ week, count }) => (
                  <li key={week} className="flex justify-between py-2">
                    <span>{week}</span>
                    <span className="tabular-nums text-slate-500">{count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold">Stage conversion</h2>
              <div className="space-y-2">
                {Object.entries(data.stage_conversion).map(([stage, value]) => (
                  <div
                    key={stage}
                    className="grid grid-cols-[9rem_1fr_4rem] items-center gap-3 text-xs"
                  >
                    <span className="truncate">
                      {stage.replaceAll('_', ' ')}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${value.rate ?? 0}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums text-slate-500">
                      {value.count} · {value.rate ?? 0}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid gap-8 lg:grid-cols-3">
              <section>
                <h2 className="mb-2 text-sm font-semibold">
                  Rejection reasons
                </h2>
                <ul className="divide-y divide-slate-200 border-y border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
                  {Object.entries(data.rejection_reasons).map(
                    ([label, count]) => (
                      <li key={label} className="flex justify-between py-2">
                        <span>{label}</span>
                        <span className="tabular-nums text-slate-500">
                          {count}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </section>
              <OutcomeTable
                title="Outcomes by recommendation"
                values={data.outcomes_by_recommendation}
              />
              <OutcomeTable
                title="Outcomes by fit band"
                values={data.outcomes_by_fit_band}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
