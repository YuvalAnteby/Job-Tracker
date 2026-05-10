import React from 'react';
import { Domain, JobFilters, JobStatus } from '../../types';
import { Search } from 'lucide-react';

interface FilterPanelProps {
  filters: JobFilters;
  setFilters: React.Dispatch<React.SetStateAction<JobFilters>>;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, setFilters }) => {
  const toggleDomain = (domain: Domain) => {
    const current = filters.domains || [];
    const next = current.includes(domain)
      ? current.filter(d => d !== domain)
      : [...current, domain];
    setFilters(prev => ({ ...prev, domains: next.length > 0 ? next : undefined }));
  };

  const toggleStatus = (status: JobStatus) => {
    const current = filters.statuses || [];
    const next = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    setFilters(prev => ({ ...prev, statuses: next.length > 0 ? next : undefined }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Search</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Company or title..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-slate-500"
            value={filters.search || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Domain</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(Domain).map((domain) => (
            <button
              key={domain}
              onClick={() => toggleDomain(domain)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filters.domains?.includes(domain)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Status</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(JobStatus).filter(s => s !== JobStatus.DELETED).map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filters.statuses?.includes(status)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Fit</h3>
        <select
          className="w-full p-2 border border-gray-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          value={filters.fit || 'all'}
          onChange={(e) => setFilters(prev => ({ ...prev, fit: e.target.value as any }))}
        >
          <option value="all">All</option>
          <option value="applicable">Applicable only</option>
          <option value="interesting">Interesting only</option>
        </select>
      </div>
    </div>
  );
};
