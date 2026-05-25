import React, { useState } from 'react';
import { Job, JobStatus, Domain, MetStatus } from '../../types';
import { useJob, useUpdateJob, useDeleteJob, useReanalyzeJob } from '../../hooks/useJobs';
import { ScoreBadge, DomainTag, StatusBadge } from '../shared/Badges';
import { Modal } from '../shared/Modal';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Trash2,
  Loader2,
  Save,
  RefreshCw,
  FileText,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';

interface JobDetailPanelProps {
  jobId: string | null;
  onClose: () => void;
}

const RequirementRow: React.FC<{ requirement: any }> = ({ requirement }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = (status: MetStatus) => {
    switch (status) {
      case MetStatus.MET:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case MetStatus.NOT_MET:
        return <XCircle className="h-5 w-5 text-red-500" />;
      case MetStatus.UNCERTAIN:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div className="border-b border-gray-100 dark:border-slate-800 last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start sm:items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors px-3 sm:px-4 rounded-lg gap-2"
      >
        <div className="flex items-start sm:items-center gap-3 text-left pr-2">
          <div className="shrink-0 mt-0.5 sm:mt-0">
            {getIcon(requirement.met_status)}
          </div>
          <span className="font-medium text-gray-700 dark:text-slate-300">{requirement.name}</span>
        </div>
        <div className="shrink-0 mt-1 sm:mt-0">
          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 dark:text-slate-500" /> : <ChevronDown className="h-4 w-4 text-gray-400 dark:text-slate-500" />}
        </div>
      </button>
      {isExpanded && (
        <div className="pb-4 pl-10 sm:pl-12 pr-4 text-sm text-gray-600 dark:text-slate-400 animate-in fade-in slide-in-from-top-1">
          {requirement.reasoning}
        </div>
      )}
    </div>
  );
};

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({ jobId, onClose }) => {
  const { data: job, isLoading } = useJob(jobId || '');
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const reanalyzeJob = useReanalyzeJob();

  const [notes, setNotes] = useState(job?.notes || '');
  const [scoreOverride, setScoreOverride] = useState<number | string>(job?.score_override || '');
  const [domainOverride, setDomainOverride] = useState<Domain | ''>(job?.domain_override || '');
  const [isApplicableOverride, setIsApplicableOverride] = useState<'auto' | 'yes' | 'no'>(
    job?.is_applicable_override === true ? 'yes' : job?.is_applicable_override === false ? 'no' : 'auto'
  );
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);

  // Sync state when job loads
  React.useEffect(() => {
    if (job) {
      setNotes(job.notes || '');
      setScoreOverride(job.score_override ?? '');
      setDomainOverride(job.domain_override || '');
      setIsApplicableOverride(
        job.is_applicable_override === true ? 'yes' : job.is_applicable_override === false ? 'no' : 'auto'
      );
    }
  }, [job]);

  if (!jobId) return null;

  const handleSaveOverrides = () => {
    updateJob.mutate({
      id: jobId,
      notes: notes || undefined,
      score_override: scoreOverride === '' ? undefined : Number(scoreOverride),
      domain_override: domainOverride === '' ? undefined : domainOverride as Domain,
      is_applicable_override: isApplicableOverride === 'yes' ? true : isApplicableOverride === 'no' ? false : undefined,
    }, {
      onSuccess: () => toast.success('Changes saved successfully'),
      onError: () => toast.error('Failed to save changes'),
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this job?')) {
      deleteJob.mutate(jobId, {
        onSuccess: () => {
          toast.success('Job deleted');
          onClose();
        },
      });
    }
  };

  // Re-analyze job listing handler
  const handleReanalyze = () => {
    if (jobId) {
      reanalyzeJob.mutate(jobId, {
        onSuccess: () => toast.success('Job re-analyzed successfully'),
        onError: () => toast.error('Failed to re-analyze job'),
      });
    }
  };

  return (
    <div className="bg-gray-50/50 dark:bg-slate-900/50 p-4 sm:p-6 animate-in slide-in-from-top-2 duration-200">
      <div className="flex justify-between items-start sm:items-center mb-4 sm:mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white pr-4">
          {isLoading ? 'Loading...' : `${job?.company_name} — ${job?.title}`}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {isLoading || !job ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="text-gray-500 dark:text-slate-400 font-medium">Fetching job details...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <ScoreBadge score={job.effective_score} hasOverride={!!job.score_override} size="lg" />
              <DomainTag domain={job.effective_domain} />
              <StatusBadge status={job.status} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
              <div className="flex flex-col">
                <span>Added: {format(new Date(job.added_at), 'MMM d, yyyy')}</span>
                {job.posted_at && <span>Posted: {format(new Date(job.posted_at), 'MMM d, yyyy')}</span>}
              </div>
              <div className="flex items-center gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-slate-700 sm:pl-4">
                <button
                  onClick={() => setIsListingModalOpen(true)}
                  className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                >
                  <FileText className="h-4 w-4" />
                  <span>Show Listing</span>
                </button>
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium border-l border-gray-200 dark:border-slate-700 pl-4"
                >
                  <span>Open Posting</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* LLM Summary */}
          {job.llm_summary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">AI Summary</h4>
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzeJob.isPending}
                  className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3 w-3", reanalyzeJob.isPending && "animate-spin")} />
                  <span>{reanalyzeJob.isPending ? 'Regenerating...' : 'Regenerate'}</span>
                </button>
              </div>
              <p className="text-blue-900 dark:text-blue-100 leading-relaxed italic bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                "{job.llm_summary}"
              </p>
            </div>
          )}

          {/* Requirements */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Requirements Breakdown</h4>
            <div className="border border-gray-100 dark:border-slate-800 rounded-lg divide-y divide-gray-100 dark:divide-slate-800">
              {job.requirements.map((req) => (
                <RequirementRow key={req.id} requirement={req} />
              ))}
              {job.requirements.length === 0 && (
                <div className="p-4 text-center text-gray-500 dark:text-slate-400 italic">No requirements analyzed.</div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Notes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your personal notes here..."
              className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all h-32 resize-none text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Overrides */}
          <div className="space-y-4 p-4 sm:p-6 bg-white dark:bg-slate-950 rounded-xl border border-gray-200 dark:border-slate-800">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Manual Overrides</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Score Override</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreOverride}
                  onChange={(e) => setScoreOverride(e.target.value)}
                  placeholder="LLM Score"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Domain Override</label>
                <select
                  value={domainOverride}
                  onChange={(e) => setDomainOverride(e.target.value as Domain | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Use AI Domain</option>
                  {Object.values(Domain).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Is Applicable</label>
                <div className="flex items-center space-x-2 h-[42px]">
                  {(['auto', 'yes', 'no'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setIsApplicableOverride(opt)}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-xs font-bold rounded-md border transition-all capitalize",
                        isApplicableOverride === opt
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveOverrides}
                disabled={updateJob.isPending}
                className="flex items-center space-x-2 px-6 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-950 dark:hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-all shadow-[0_1px_3px_rgba(0,0,0,0.1)] disabled:opacity-50"
              >
                {updateJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-sm text-gray-500 dark:text-slate-400 italic">
              * Overrides take precedence over AI-generated values.
            </div>
            <button
              onClick={handleDelete}
              disabled={deleteJob.isPending}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-bold border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Job</span>
            </button>
          </div>
        </div>
      )}

      {/* Raw Listing Modal */}
      <Modal
        isOpen={isListingModalOpen}
        onClose={() => setIsListingModalOpen(false)}
        title="Job Listing"
      >
        <div className="p-6 overflow-y-auto max-h-[70vh] bg-gray-50 dark:bg-slate-900 whitespace-pre-wrap text-sm text-gray-800 dark:text-slate-300 font-mono border-t border-gray-200 dark:border-slate-800">
          {job?.description || 'No description available.'}
        </div>
      </Modal>
    </div>
  );
};
