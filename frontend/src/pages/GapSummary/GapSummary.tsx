import React, { useState } from 'react';
import { useGapSummaryData } from './useGapSummaryData';
import { Domain } from '../../types';
import { RefreshCw, AlertCircle, CheckCircle2, CircleDot, Loader2, Calendar, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../utils/cn';

const GapSummary: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'ALL'>('ALL');
  const { 
    summary, 
    isLoading, 
    isGenerating, 
    generate, 
    refetch 
  } = useGapSummaryData(selectedDomain === 'ALL' ? undefined : selectedDomain);

  const handleGenerate = (): void => {
    generate(selectedDomain === 'ALL' ? undefined : selectedDomain);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500 dark:text-slate-400">Loading gap analysis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Skill Gap Summary</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Identify the skills you need to acquire based on your active job applications.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Domain:</span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value as Domain | 'ALL')}
              className="block w-full rounded-md border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 pl-3 pr-10"
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
            disabled={isGenerating}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Generate New
          </button>
        </div>
      </div>

      {!summary ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">No analysis found</h2>
          <p className="text-gray-500 dark:text-slate-400 mt-2 mb-6">
            Click the "Generate New" button to start your first skill gap analysis.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-slate-400">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Last generated: {format(new Date(summary.generated_at), 'MMM d, yyyy HH:mm')}
            </div>
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
                  <h3 className="font-bold text-gray-900 dark:text-white">{domain}</h3>
                </div>
                
                <div className="p-6 grid md:grid-cols-2 gap-8">
                  <div>
                    <div className="flex items-center space-x-2 mb-4">
                      <CircleDot className="h-5 w-5 text-red-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Missing Skills</h4>
                    </div>
                    {data.missing_skills.length > 0 ? (
                      <ul className="space-y-2">
                        {data.missing_skills.map((skill) => (
                          <li key={skill} className="flex items-start">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2 mr-2 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-slate-300">{skill}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No missing skills identified.</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-4">
                      <CircleDot className="h-5 w-5 text-yellow-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Partial Knowledge</h4>
                    </div>
                    {data.partially_known.length > 0 ? (
                      <ul className="space-y-2">
                        {data.partially_known.map((skill) => (
                          <li key={skill} className="flex items-start">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-2 mr-2 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-slate-300">{skill}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No partial skills identified.</p>
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

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30 p-6">
              <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Overall Top Gaps (All Domains)
              </h3>
              <div className="flex flex-wrap gap-2">
                {summary.summary.overall_top_gaps.map((gap, index) => (
                  <span 
                    key={gap}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 shadow-sm"
                  >
                    <span className="text-blue-400 dark:text-blue-500 mr-1.5 font-bold">{index + 1}.</span>
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GapSummary;
