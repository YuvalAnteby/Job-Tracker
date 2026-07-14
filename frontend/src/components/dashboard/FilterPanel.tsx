import React from 'react';
import { AnalysisClassification, Domain, JobStatus } from '../../types';
import type { JobFilters } from '../../types';
import { Search } from 'lucide-react';

interface FilterPanelProps {
  filters: JobFilters;
  setFilters: React.Dispatch<React.SetStateAction<JobFilters>>;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  setFilters,
}) => {
  const toggleDomain = (domain: Domain) => {
    const current = filters.domains || [];
    const next = current.includes(domain)
      ? current.filter((d) => d !== domain)
      : [...current, domain];
    setFilters((prev) => ({
      ...prev,
      domains: next.length > 0 ? next : undefined,
    }));
  };

  const toggleStatus = (status: JobStatus) => {
    const current = filters.statuses || [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilters((prev) => ({
      ...prev,
      statuses: next.length > 0 ? next : undefined,
    }));
  };

  const toggleClassification = (classification: AnalysisClassification) => {
    const current = filters.classifications || [];
    const next = current.includes(classification)
      ? current.filter((item) => item !== classification)
      : [...current, classification];
    setFilters((previous) => ({
      ...previous,
      classifications: next.length ? next : undefined,
    }));
  };

  return (
    <div className="py-4 space-y-10">
      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
          Search
        </h3>
        <div className="relative">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Company or title..."
            className="w-full pl-8 pr-4 py-2 bg-transparent text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-800 focus:border-blue-500 outline-none transition-colors placeholder-gray-400 dark:placeholder-slate-500"
            value={filters.search || ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                search: e.target.value || undefined,
              }))
            }
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
          Domain
        </h3>
        <div className="flex flex-col gap-3">
          {Object.values(Domain).map((domain) => (
            <button
              key={domain}
              onClick={() => toggleDomain(domain)}
              className={`text-left text-sm font-medium transition-colors ${
                filters.domains?.includes(domain)
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-400'
              }`}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
          Status
        </h3>
        <div className="flex flex-col gap-3">
          {Object.values(JobStatus)
            .filter((s) => s !== JobStatus.DELETED)
            .map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`text-left text-sm font-medium transition-colors ${
                  filters.statuses?.includes(status)
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-400'
                }`}
              >
                {status}
              </button>
            ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
          Classification
        </h3>
        <div className="flex flex-col gap-3">
          {Object.values(AnalysisClassification).map((classification) => (
            <button
              key={classification}
              onClick={() => toggleClassification(classification)}
              className={`text-left text-sm font-medium transition-colors ${
                filters.classifications?.includes(classification)
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-400'
              }`}
            >
              {classification}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
          Fit
        </h3>
        <select
          className="w-full py-2 bg-transparent border-b border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
          value={filters.fit || 'all'}
          onChange={(e) => {
            const fit = e.target.value as NonNullable<JobFilters['fit']>;
            setFilters((prev) => ({
              ...prev,
              fit: fit === 'all' ? undefined : fit,
            }));
          }}
        >
          <option value="all">All</option>
          <option value="applicable">Applicable only</option>
          <option value="interesting">Interesting only</option>
        </select>
      </div>
    </div>
  );
};
