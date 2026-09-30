import type { ReactNode } from 'react';
import type { JSX } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisStatus, type Job } from '../../types';
import { AddJobModal } from './AddJobModal';

const mutate = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useJobs', () => ({
  useCreateJob: () => ({ mutate, isPending: false }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: toastSuccess, error: toastError },
}));

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

vi.mock('../shared/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: TestModalProps): JSX.Element | null =>
    isOpen ? (
      <section aria-label={title}>
        <button type="button" onClick={onClose}>
          Close
        </button>
        {children}
      </section>
    ) : null,
}));

const job = { company_name: 'Acme', title: 'Engineer' } as Job;

const LocationProbe = (): JSX.Element => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

describe('AddJobModal', () => {
  beforeEach(() => {
    mutate.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('closes immediately after the API accepts a pending job', async () => {
    mutate.mockImplementation(
      (
        _data: unknown,
        options: { onSuccess: (value: Job) => void },
      ): void => {
        options.onSuccess({
          ...job,
          analysis_status: AnalysisStatus.PENDING,
        });
      },
    );
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <AddJobModal isOpen onClose={onClose} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Company *'), 'Acme');
    await user.type(screen.getByLabelText('Job Title *'), 'Engineer');
    await user.type(screen.getByLabelText('Job URL *'), 'https://acme.test/job');
    await user.type(screen.getByLabelText('Job Description *'), 'Build things');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(toastSuccess).toHaveBeenCalledWith('Job saved. Analysis is running.');
  });

  it('keeps entered values and shows an inline error when saving fails', async () => {
    mutate.mockImplementation(
      (
        _data: unknown,
        options: { onError: (error: unknown) => void },
      ): void => {
        options.onError(new Error('request failed'));
      },
    );
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AddJobModal isOpen onClose={onClose} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Company *'), 'Acme');
    await user.type(screen.getByLabelText('Job Title *'), 'Engineer');
    await user.type(screen.getByLabelText('Job URL *'), 'https://acme.test/job');
    await user.type(screen.getByLabelText('Job Description *'), 'Build things');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(screen.getByLabelText('Company *')).toHaveValue('Acme');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save the job. Please try again.',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
