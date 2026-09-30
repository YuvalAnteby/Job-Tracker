import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { useCreateJob } from '../../hooks/useJobs';
import type { CreateJobPayload } from '../../hooks/useJobs';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type JobFormData = CreateJobPayload;

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }
  const response = error.response;
  if (
    typeof response !== 'object' ||
    response === null ||
    !('status' in response)
  ) {
    return undefined;
  }
  return typeof response.status === 'number' ? response.status : undefined;
};

const inputClassName =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export const AddJobModal: React.FC<AddJobModalProps> = ({
  isOpen,
  onClose,
}): React.JSX.Element => {
  const navigate = useNavigate();
  const createJob = useCreateJob();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<JobFormData>({
    defaultValues: {
      company_name: '',
      title: '',
      url: '',
      posted_at: '',
      description: '',
    },
  });

  const onSubmit: SubmitHandler<JobFormData> = (data): void => {
    setSubmissionError(null);
    createJob.mutate(data, {
      onSuccess: (): void => {
        reset();
        onClose();
        navigate('/');
        toast.success('Job saved. Analysis is running.');
      },
      onError: (error: unknown): void => {
        const message =
          getErrorStatus(error) === 409
            ? 'This job URL already exists.'
            : 'Could not save the job. Please try again.';
        setSubmissionError(message);
        toast.error(message);
      },
    });
  };

  const handleClose = (): void => {
    if (!createJob.isPending) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Job">
      <form
        onSubmit={handleSubmit(onSubmit, () => setSubmissionError(null))}
        noValidate
        className="space-y-6"
      >
        <fieldset disabled={createJob.isPending} className="space-y-6">
          <div>
            <label
              htmlFor="add-job-company"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              Company *
            </label>
            <input
              id="add-job-company"
              {...register('company_name', { required: 'Company is required' })}
              aria-invalid={errors.company_name ? 'true' : 'false'}
              aria-describedby={
                errors.company_name ? 'add-job-company-error' : undefined
              }
              className={inputClassName}
              placeholder="e.g. Google"
            />
            {errors.company_name && (
              <p
                id="add-job-company-error"
                role="alert"
                className="mt-1 text-xs text-red-500"
              >
                {errors.company_name.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="add-job-title"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              Job Title *
            </label>
            <input
              id="add-job-title"
              {...register('title', { required: 'Job title is required' })}
              aria-invalid={errors.title ? 'true' : 'false'}
              aria-describedby={errors.title ? 'add-job-title-error' : undefined}
              className={inputClassName}
              placeholder="e.g. Backend Engineer"
            />
            {errors.title && (
              <p
                id="add-job-title-error"
                role="alert"
                className="mt-1 text-xs text-red-500"
              >
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="add-job-url"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              Job URL *
            </label>
            <input
              id="add-job-url"
              {...register('url', {
                required: 'Job URL is required',
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Must be a valid URL starting with http:// or https://',
                },
              })}
              aria-invalid={errors.url ? 'true' : 'false'}
              aria-describedby={errors.url ? 'add-job-url-error' : undefined}
              className={inputClassName}
              placeholder="https://linkedin.com/jobs/..."
            />
            {errors.url && (
              <p
                id="add-job-url-error"
                role="alert"
                className="mt-1 text-xs text-red-500"
              >
                {errors.url.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="add-job-posted-at"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              Posted Date (optional)
            </label>
            <input
              id="add-job-posted-at"
              {...register('posted_at')}
              type="date"
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="add-job-description"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              Job Description *
            </label>
            <textarea
              id="add-job-description"
              {...register('description', {
                required: 'Job description is required',
              })}
              aria-invalid={errors.description ? 'true' : 'false'}
              aria-describedby={
                errors.description ? 'add-job-description-error' : undefined
              }
              rows={6}
              className={`${inputClassName} resize-none`}
              placeholder="Paste the full job description here..."
            />
            {errors.description && (
              <p
                id="add-job-description-error"
                role="alert"
                className="mt-1 text-xs text-red-500"
              >
                {errors.description.message}
              </p>
            )}
          </div>
        </fieldset>

        {submissionError && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            {submissionError}
          </p>
        )}

        <div className="flex justify-end space-x-3 border-t border-gray-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={createJob.isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createJob.isPending}
            className="flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {createJob.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
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
