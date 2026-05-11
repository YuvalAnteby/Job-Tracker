import React from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../shared/Modal';
import { useCreateJob } from '../../hooks/useJobs';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface JobFormData {
  company_name: string;
  title: string;
  url: string;
  posted_at?: string;
  description: string;
}

export const AddJobModal: React.FC<AddJobModalProps> = ({ isOpen, onClose }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<JobFormData>();

  const createJob = useCreateJob();

  const onSubmit = (data: JobFormData) => {
    createJob.mutate(data, {
      onSuccess: (job) => {
        toast.success(`âœ… ${job.company_name} â€” ${job.title} added (Score: ${job.effective_score})`);
        reset();
        onClose();
      },
      onError: (error: any) => {
        if (error.response?.status === 409) {
          toast.error('This job URL already exists.');
        } else {
          toast.error('Failed to add job. Analysis might have failed.');
        }
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Job">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Company *</label>
          <input
            {...register('company_name', { required: 'Company is required' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-slate-500"
            placeholder="e.g. Google"
          />
          {errors.company_name && <p className="mt-1 text-xs text-red-500">{errors.company_name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job Title *</label>
          <input
            {...register('title', { required: 'Job title is required' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-slate-500"
            placeholder="e.g. Backend Engineer"
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job URL *</label>
          <input
            {...register('url', { 
              required: 'Job URL is required',
              pattern: {
                value: /^https?:\/\/.+/,
                message: 'Must be a valid URL starting with http:// or https://'
              }
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-slate-500"
            placeholder="https://linkedin.com/jobs/..."
          />
          {errors.url && <p className="mt-1 text-xs text-red-500">{errors.url.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Posted Date (optional)</label>
          <input
            {...register('posted_at')}
            type="date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job Description *</label>
          <textarea
            {...register('description', { required: 'Job description is required' })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none placeholder-gray-400 dark:placeholder-slate-500"
            placeholder="Paste the full job description here..."
          />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createJob.isPending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {createJob.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
