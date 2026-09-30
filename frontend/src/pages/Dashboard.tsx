import React, { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { SortingState, RowSelectionState } from '@tanstack/react-table';
import {
  AnalysisClassification,
  AnalysisStatus,
  ApplicationStage,
  JobStatus,
  ListingState,
} from '../types';
import type { Job, JobFilters } from '../types';
import {
  useBulkJobs,
  useJobs,
  useDeleteJob,
  useTransitionApplicationStage,
  useUpdateJob,
} from '../hooks/useJobs';
import {
  ScoreBadge,
  DomainTag,
  StatusBadge,
} from '../components/shared/Badges';
import { FilterPanel } from '../components/dashboard/FilterPanel';
import { JobDetailPanel } from '../components/dashboard/JobDetailPanel';
import {
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAttention } from '../hooks/useApplications';

const columnHelper = createColumnHelper<Job>();
const EMPTY_JOBS: Job[] = [];

interface JobActionButtonsProps {
  isExpanded: boolean;
  canMarkApplied: boolean;
  pending: boolean;
  onToggleDetail: () => void;
  onMarkApplied: () => void;
  onCloseListing: () => void;
  onDelete: () => void;
}

const JobActionButtons = ({
  isExpanded,
  canMarkApplied,
  pending,
  onToggleDetail,
  onMarkApplied,
  onCloseListing,
  onDelete,
}: JobActionButtonsProps): React.JSX.Element => (
  <div
    className="flex flex-nowrap items-center gap-1 whitespace-nowrap"
    onClick={(event) => event.stopPropagation()}
  >
    <button
      type="button"
      aria-label={isExpanded ? 'Close detail' : 'View detail'}
      onClick={onToggleDetail}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded transition-colors',
        isExpanded
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800',
      )}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
    <button
      type="button"
      aria-label="Mark applied"
      onClick={onMarkApplied}
      disabled={!canMarkApplied || pending}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
    >
      <CheckCircle className="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Close listing"
      onClick={onCloseListing}
      disabled={pending}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800"
    >
      <XCircle className="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Delete job"
      onClick={onDelete}
      disabled={pending}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
);

interface AnalysisStateProps {
  status: AnalysisStatus;
}

const AnalysisState = ({ status }: AnalysisStateProps): React.JSX.Element => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold',
      status === AnalysisStatus.PENDING
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
        : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    )}
  >
    {status === AnalysisStatus.PENDING ? 'Analysis pending' : 'Analysis failed'}
  </span>
);

export const Dashboard: React.FC = () => {
  const [filters, setFilters] = useState<JobFilters>({});
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'added_at', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    data: jobs = EMPTY_JOBS,
    isError,
    isLoading,
    refetch,
  } = useJobs(filters);
  const transitionStage = useTransitionApplicationStage();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const bulkJobs = useBulkJobs();
  const attention = useAttention();

  React.useEffect(() => {
    const visibleIds = new Set(jobs.map((job) => job.id));
    setRowSelection((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(
          ([id, selected]) => selected && visibleIds.has(id),
        ),
      );
      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
    setSelectedJobId((current) =>
      current && !visibleIds.has(current) ? null : current,
    );
  }, [jobs]);

  const runBulk = (status?: JobStatus.APPLIED | JobStatus.INACTIVE): void => {
    const ids = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    bulkJobs.mutate(
      { ids, status },
      {
        onSuccess: (result) => {
          setRowSelection(
            Object.fromEntries(result.failed.map(({ id }) => [id, true])),
          );
          const action =
            status === JobStatus.APPLIED
              ? 'marked applied'
              : status === JobStatus.INACTIVE
                ? 'marked inactive'
                : 'deleted';
          if (result.succeeded.length)
            toast.success(`${result.succeeded.length} jobs ${action}`);
          if (result.failed.length)
            toast.error(`${result.failed.length} jobs could not be updated`);
        },
        onError: () => toast.error('Bulk action failed'),
      },
    );
  };

  const markApplied = React.useCallback((job: Job): void => {
    transitionStage.mutate(
      { id: job.id, new_stage: ApplicationStage.APPLIED },
      {
        onSuccess: () => toast.success('Job marked applied'),
        onError: () => toast.error('Could not update job'),
      },
    );
  }, [transitionStage]);

  const closeListing = React.useCallback((job: Job): void => {
    updateJob.mutate(
      { id: job.id, listing_state: ListingState.CLOSED },
      {
        onSuccess: () => toast.success('Listing closed'),
        onError: () => toast.error('Could not update job'),
      },
    );
  }, [updateJob]);

  const deleteListing = React.useCallback(
    (job: Job): void => {
      if (!confirm('Are you sure you want to delete this job?')) return;
      deleteJob.mutate(job.id, {
        onSuccess: () => toast.success('Job deleted'),
        onError: () => toast.error('Could not delete job'),
      });
    },
    [deleteJob],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all jobs"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            onClick={(event) => event.stopPropagation()}
            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.company_name} ${row.original.title}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(event) => event.stopPropagation()}
            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      }),
      columnHelper.accessor('company_name', {
        header: 'Company',
        cell: (info) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Job Title',
        cell: (info) => (
          <span className="block break-words text-gray-600 dark:text-slate-300">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('effective_score', {
        header: 'Score',
        cell: (info) =>
          info.row.original.analysis_status === AnalysisStatus.COMPLETED ? (
            <ScoreBadge
              score={info.getValue()}
              hasOverride={!!info.row.original.score_override}
            />
          ) : (
            <AnalysisState status={info.row.original.analysis_status} />
          ),
      }),
      columnHelper.accessor('effective_domain', {
        header: 'Domain',
        cell: (info) => <DomainTag domain={info.getValue()} />,
      }),
      columnHelper.accessor('effective_classification', {
        header: 'Classification',
        cell: ({ getValue, row }) => (
          <select
            aria-label={`Classification for ${row.original.company_name}`}
            value={getValue() ?? ''}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              updateJob.mutate({
                id: row.original.id,
                classification_override: event.target
                  .value as AnalysisClassification,
              })
            }
            disabled={updateJob.isPending}
            className="min-h-11 max-w-full rounded border border-slate-200 bg-transparent px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
          >
            <option value="" disabled>
              Unclassified
            </option>
            {Object.values(AnalysisClassification).map((classification) => (
              <option key={classification} value={classification}>
                {classification}
              </option>
            ))}
          </select>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('added_at', {
        header: 'Date Added',
        cell: (info) => (
          <span className="text-gray-500 dark:text-slate-400 text-sm">
            {info.getValue()
              ? format(new Date(info.getValue()), 'MMM d, yyyy')
              : '-'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const job = row.original;
          return (
            <JobActionButtons
              canMarkApplied={
                job.application_stage === ApplicationStage.NOT_APPLIED
              }
              isExpanded={selectedJobId === job.id}
              onCloseListing={() => closeListing(job)}
              onDelete={() => deleteListing(job)}
              onMarkApplied={() => markApplied(job)}
              onToggleDetail={() =>
                setSelectedJobId((current) =>
                  current === job.id ? null : job.id,
                )
              }
              pending={
                transitionStage.isPending ||
                updateJob.isPending ||
                deleteJob.isPending
              }
            />
          );
        },
      }),
    ],
    [
      closeListing,
      deleteJob,
      deleteListing,
      markApplied,
      selectedJobId,
      transitionStage,
      updateJob,
    ],
  );

  const table = useReactTable({
    data: jobs,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  const mobileSortValue = sorting[0]
    ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`
    : 'added_at:desc';
  const setMobileSort = (value: string): void => {
    const [id, direction] = value.split(':');
    setSorting([{ id, desc: direction === 'desc' }]);
  };

  return (
    <div className="flex flex-col space-y-4">
      <section
        aria-labelledby="dashboard-attention"
        className="border-y border-slate-200 py-4 dark:border-slate-800"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1
              id="dashboard-attention"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Needs attention
            </h1>
            <p className="text-xs text-slate-500">
              Your next application actions, grouped by urgency.
            </p>
          </div>
          <Link
            to="/analytics"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            View all
          </Link>
        </div>
        {attention.isLoading && (
          <div className="h-16 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        )}
        {attention.isError && (
          <p role="alert" className="text-sm text-red-600">
            Attention items could not be loaded.
          </p>
        )}
        {attention.data &&
          attention.data.overdue.length +
            attention.data.due_today.length +
            attention.data.upcoming.length ===
            0 && (
            <p className="text-sm text-slate-500">
              Nothing needs attention.{' '}
              <Link
                to="/pipeline"
                className="font-semibold text-blue-600 dark:text-blue-400"
              >
                Schedule a next action in Pipeline.
              </Link>
            </p>
          )}
        {attention.data && (
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['Overdue', attention.data.overdue],
                ['Due today', attention.data.due_today],
                ['Upcoming', attention.data.upcoming],
              ] as const
            ).map(([label, items]) => (
              <section key={label} aria-label={label}>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label} · {items.length}
                </h2>
                {items.slice(0, 2).map((item) => (
                  <p
                    key={item.action.id}
                    className="truncate text-sm text-slate-700 dark:text-slate-200"
                  >
                    <span className="font-medium">{item.action.label}</span>{' '}
                    <span className="text-xs text-slate-500">
                      {item.job.company_name}
                    </span>
                  </p>
                ))}
                {!items.length && (
                  <p className="text-xs text-slate-400">None</p>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
      {/* Filters Toggle Button */}
      <div className="flex justify-start px-2">
        <button
          aria-controls="dashboard-filters"
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex min-h-11 items-center py-2 text-sm font-semibold tracking-wide text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
        >
          <Filter className="h-4 w-4 mr-2" />
          {isSidebarOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      <div
        className={cn(
          'flex flex-col lg:flex-row items-start transition-all duration-300',
          isSidebarOpen ? 'gap-8' : 'gap-0',
        )}
      >
        <aside
          id="dashboard-filters"
          className={cn(
            'min-w-0 shrink-0 origin-top overflow-hidden transition-all duration-300 ease-in-out lg:origin-left',
            isSidebarOpen
              ? 'max-h-[2000px] w-full scale-100 opacity-100 lg:w-80'
              : 'max-h-0 scale-95 opacity-0 lg:w-0 lg:scale-100',
          )}
        >
          {isSidebarOpen && (
            <div className="w-full pb-4 lg:w-80 lg:pb-0">
              <FilterPanel filters={filters} setFilters={setFilters} />
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div
          className={cn(
            'flex min-w-0 w-full flex-1 flex-col space-y-4 transition-all duration-300 ease-in-out',
          )}
        >
          {/* Bulk Actions Bar */}
          {Object.keys(rowSelection).length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 animate-in fade-in slide-in-from-top-2 dark:border-blue-900/30 dark:bg-blue-900/20">
              <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                {Object.keys(rowSelection).length} jobs selected
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={bulkJobs.isPending}
                  onClick={() => runBulk(JobStatus.APPLIED)}
                  className="min-h-11 px-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mark Applied
                </button>
                <button
                  disabled={bulkJobs.isPending}
                  onClick={() => runBulk(JobStatus.INACTIVE)}
                  className="min-h-11 px-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mark Inactive
                </button>
                <button
                  disabled={bulkJobs.isPending}
                  onClick={() => confirm('Delete selected jobs?') && runBulk()}
                  className="min-h-11 px-2 text-sm font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500 dark:text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-r-blue-600" />
              <span>Loading jobs...</span>
            </div>
          )}
          {isError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              <span>Jobs could not be loaded.</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="min-h-11 rounded-md px-3 font-semibold hover:bg-red-100 dark:hover:bg-red-900/40"
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && jobs.length === 0 && (
            <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              No jobs found matching your criteria.
            </p>
          )}
          {!isLoading && !isError && jobs.length > 0 && (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="cursor-pointer px-3 py-3 text-xs font-semibold uppercase tracking-widest text-gray-400 transition-colors hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <div className="flex items-center gap-1">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {{
                                asc: ' ↑',
                                desc: ' ↓',
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <tr
                          onClick={() =>
                            setSelectedJobId((current) =>
                              current === row.original.id
                                ? null
                                : row.original.id,
                            )
                          }
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-gray-100/50 dark:hover:bg-slate-900/40',
                            selectedJobId === row.original.id &&
                              'bg-gray-100/30 dark:bg-slate-900/60',
                          )}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className={cn(
                                'break-words px-3 py-3 align-top text-sm text-gray-600 dark:text-slate-300',
                                cell.column.id === 'select' && 'w-12',
                                cell.column.id === 'company_name' && 'w-32',
                                cell.column.id === 'title' &&
                                  'w-[24rem] max-w-[24rem]',
                                cell.column.id === 'effective_score' && 'w-24',
                                cell.column.id === 'effective_domain' && 'w-28',
                                cell.column.id === 'effective_classification' &&
                                  'w-36',
                                cell.column.id === 'status' && 'w-28',
                                cell.column.id === 'added_at' && 'w-32',
                                cell.column.id === 'actions' &&
                                  'w-48 whitespace-nowrap',
                              )}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                        {selectedJobId === row.original.id && (
                          <tr>
                            <td
                              colSpan={columns.length}
                              className="border-t border-gray-100 bg-gray-50/50 px-0 py-0 dark:border-slate-800 dark:bg-slate-900/10"
                            >
                              <JobDetailPanel
                                jobId={row.original.id}
                                onClose={() => setSelectedJobId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      aria-label="Select all jobs"
                      checked={table.getIsAllRowsSelected()}
                      onChange={table.getToggleAllRowsSelectedHandler()}
                      onClick={(event) => event.stopPropagation()}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Select all
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span>Sort</span>
                    <select
                      aria-label="Sort jobs"
                      className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={mobileSortValue}
                      onChange={(event) => setMobileSort(event.target.value)}
                    >
                      <option value="added_at:desc">Newest</option>
                      <option value="added_at:asc">Oldest</option>
                      <option value="effective_score:desc">Highest score</option>
                      <option value="effective_score:asc">Lowest score</option>
                      <option value="company_name:asc">Company A-Z</option>
                      <option value="company_name:desc">Company Z-A</option>
                    </select>
                  </label>
                </div>
                {rows.map((row) => {
                  const job = row.original;
                  const isExpanded = selectedJobId === job.id;
                  return (
                    <article
                      key={row.id}
                      onClick={() =>
                        setSelectedJobId((current) =>
                          current === job.id ? null : job.id,
                        )
                      }
                      className={cn(
                        'rounded-md border border-slate-200 bg-white p-3 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900',
                        isExpanded && 'ring-1 ring-blue-200 dark:ring-blue-900',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${job.company_name} ${job.title}`}
                          checked={row.getIsSelected()}
                          onChange={row.getToggleSelectedHandler()}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {job.company_name}
                          </p>
                          <h2 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {job.title}
                          </h2>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <span className="block text-xs text-slate-500">Score</span>
                          {job.analysis_status === AnalysisStatus.COMPLETED ? (
                            <ScoreBadge
                              score={job.effective_score}
                              hasOverride={!!job.score_override}
                            />
                          ) : (
                            <AnalysisState status={job.analysis_status} />
                          )}
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Domain</span>
                          <DomainTag domain={job.effective_domain} />
                        </div>
                        <label className="min-w-0">
                          <span className="block text-xs text-slate-500">Classification</span>
                          <select
                            aria-label={`Classification for ${job.company_name}`}
                            value={job.effective_classification ?? ''}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateJob.mutate({
                                id: job.id,
                                classification_override: event.target
                                  .value as AnalysisClassification,
                              })
                            }
                            disabled={updateJob.isPending}
                            className="min-h-11 w-full max-w-full rounded border border-slate-200 bg-transparent px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
                          >
                            <option value="" disabled>
                              Unclassified
                            </option>
                            {Object.values(AnalysisClassification).map(
                              (classification) => (
                                <option key={classification} value={classification}>
                                  {classification}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <div>
                          <span className="block text-xs text-slate-500">Status</span>
                          <StatusBadge status={job.status} />
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500">Added</span>
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {job.added_at
                              ? format(new Date(job.added_at), 'MMM d, yyyy')
                              : '-'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
                        <JobActionButtons
                          canMarkApplied={
                            job.application_stage ===
                            ApplicationStage.NOT_APPLIED
                          }
                          isExpanded={isExpanded}
                          onCloseListing={() => closeListing(job)}
                          onDelete={() => deleteListing(job)}
                          onMarkApplied={() => markApplied(job)}
                          onToggleDetail={() =>
                            setSelectedJobId((current) =>
                              current === job.id ? null : job.id,
                            )
                          }
                          pending={
                            transitionStage.isPending ||
                            updateJob.isPending ||
                            deleteJob.isPending
                          }
                        />
                      </div>
                      {isExpanded && (
                        <div
                          className="mt-3 border-t border-slate-200 dark:border-slate-800"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <JobDetailPanel
                            jobId={job.id}
                            onClose={() => setSelectedJobId(null)}
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
