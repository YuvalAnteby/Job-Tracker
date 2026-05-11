import React, { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { Job, JobFilters, JobStatus } from '../types';
import { useJobs, useUpdateJobStatus, useDeleteJob } from '../hooks/useJobs';
import { ScoreBadge, DomainTag, StatusBadge } from '../components/shared/Badges';
import { FilterPanel } from '../components/dashboard/FilterPanel';
import { JobDetailPanel } from '../components/dashboard/JobDetailPanel';
import { Eye, CheckCircle, XCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils/cn';

const columnHelper = createColumnHelper<Job>();

export const Dashboard: React.FC = () => {
  const [filters, setFilters] = useState<JobFilters>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [rowSelection, setRowSelection] = useState({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useJobs(filters);
  const updateStatus = useUpdateJobStatus();
  const deleteJob = useDeleteJob();

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    }),
    columnHelper.accessor('company_name', {
      header: 'Company',
      cell: info => <span className="font-semibold text-gray-900 dark:text-white">{info.getValue()}</span>,
    }),
    columnHelper.accessor('title', {
      header: 'Job Title',
      cell: info => <span className="text-gray-600 dark:text-slate-300">{info.getValue()}</span>,
    }),
    columnHelper.accessor('effective_score', {
      header: 'Score',
      cell: info => <ScoreBadge score={info.getValue()} hasOverride={!!info.row.original.score_override} />,
    }),
    columnHelper.accessor('effective_domain', {
      header: 'Domain',
      cell: info => <DomainTag domain={info.getValue()} />,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('added_at', {
      header: 'Date Added',
      cell: info => <span className="text-gray-500 dark:text-slate-400 text-sm">{info.getValue() ? format(new Date(info.getValue()), 'MMM d, yyyy') : '-'}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const job = row.original;
        const isExpanded = selectedJobId === job.id;
        return (
          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedJobId(isExpanded ? null : job.id)}
              className={cn(
                "p-1 rounded transition-colors",
                isExpanded 
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
              )}
              title={isExpanded ? "Close Detail" : "View Detail"}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button 
              onClick={() => updateStatus.mutate({ id: job.id, status: JobStatus.APPLIED })}
              className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors text-blue-600 dark:text-blue-400" 
              title="Mark Applied"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            <button 
              onClick={() => updateStatus.mutate({ id: job.id, status: JobStatus.INACTIVE })}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors text-gray-400 dark:text-slate-500" 
              title="Mark Inactive"
            >
              <XCircle className="h-4 w-4" />
            </button>
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to delete this job?')) {
                  deleteJob.mutate(job.id);
                }
              }}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors text-red-600 dark:text-red-400" 
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    }),
  ], [updateStatus, deleteJob]);

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
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <aside className="lg:w-1/4">
        <FilterPanel filters={filters} setFilters={setFilters} />
      </aside>

      <div className="lg:w-3/4 flex flex-col space-y-4">
        {/* Bulk Actions Bar */}
        {Object.keys(rowSelection).length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 px-4 py-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
              {Object.keys(rowSelection).length} jobs selected
            </span>
            <div className="flex space-x-3">
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">Mark Applied</button>
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">Mark Inactive</button>
              <button className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors">Delete</button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center space-x-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ðŸ”¼',
                            desc: ' ðŸ”½',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-r-blue-600 border-indigo-200"></div>
                        <span>Loading jobs...</span>
                      </div>
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                      No jobs found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <React.Fragment key={row.id}>
                      <tr 
                        onClick={() => setSelectedJobId(selectedJobId === row.original.id ? null : row.original.id)}
                        className={`hover:bg-gray-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${selectedJobId === row.original.id ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-6 py-4 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {selectedJobId === row.original.id && (
                        <tr>
                          <td colSpan={columns.length} className="px-0 py-0 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                             <JobDetailPanel jobId={row.original.id} onClose={() => setSelectedJobId(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
