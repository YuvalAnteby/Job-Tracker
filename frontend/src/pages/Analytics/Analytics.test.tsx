import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationStage } from '../../types';
import Analytics from './Analytics';

const mutate = vi.fn();
vi.mock('../../hooks/useApplications', () => ({
  useAttention: () => ({
    isLoading: false,
    isError: false,
    data: {
      timezone: 'Asia/Jerusalem',
      overdue: [
        {
          action: {
            id: 'action-1',
            job_id: 'job-1',
            label: 'Follow up',
            due_at: '2026-07-14T08:00:00Z',
            state: 'ACTIVE',
            revision: 1,
          },
          job: {
            id: 'job-1',
            company_name: 'Acme',
            title: 'Engineer',
            application_stage: ApplicationStage.APPLIED,
          },
        },
      ],
      due_today: [],
      upcoming: [],
    },
  }),
  useApplicationAnalytics: () => ({
    isLoading: false,
    isError: false,
    data: {
      sample_size: 1,
      disclaimer:
        'Small samples are directional. These correlations do not establish causation.',
      weekly_applications: [{ week: '2026-07-13', count: 1 }],
      response_by_role: {
        Engineer: { total: 1, responses: 0, response_rate: 0 },
      },
      response_by_source: { WEB: { total: 1, responses: 0, response_rate: 0 } },
      stage_conversion: { APPLIED: { count: 1, rate: 100 } },
      median_time_to_first_response_hours: null,
      rejection_reasons: {},
      outcomes_by_recommendation: { APPLY: { APPLIED: 1 } },
      outcomes_by_fit_band: { '80-100': { APPLIED: 1 } },
    },
  }),
  useApplicationActions: () => ({
    finish: { mutate, isPending: false },
    reschedule: { mutate, isPending: false },
    schedule: { mutate, isPending: false },
  }),
  downloadAnalyticsCsv: vi.fn(),
}));

describe('Analytics', () => {
  it('puts actionable reminders before honest analytics', () => {
    render(<Analytics />);
    const attention = screen.getByRole('heading', { name: 'Needs attention' });
    const analytics = screen.getByRole('heading', {
      name: 'Application analytics',
    });
    expect(attention.compareDocumentPosition(analytics)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText('Follow up')).toBeInTheDocument();
    expect(
      screen.getByText(/correlations do not establish causation/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Asia/Jerusalem')).toBeInTheDocument();
  });
});
