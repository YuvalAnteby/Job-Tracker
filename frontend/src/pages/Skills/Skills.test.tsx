import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Skills from './Skills';
import { useSkillsData } from './useSkillsData';

vi.mock('./useSkillsData');

describe('Skills', () => {
  it('shows sample size, sorting evidence, and source jobs', () => {
    vi.mocked(useSkillsData).mockReturnValue({
      data: {
        sample_size: 2,
        raw_job_count: 3,
        non_learnable_gaps: [],
        skills: [
          {
            id: 'skill-1',
            name: 'Kafka',
            required_count: 2,
            preferred_count: 0,
            met_count: 0,
            gap_count: 2,
            gap_types: ['SKILL'],
            actionability: 'HIGH',
            effort: 'MEDIUM',
            sort_reason: '2 required across 2 distinct similar-role groups',
            supporting_jobs: [
              {
                job_id: 'job-1',
                company_name: 'Acme',
                title: 'Backend Engineer',
                requirement_text: 'Kafka',
                excerpt: 'Kafka required',
                cv_evidence: null,
                met_status: 'NOT_MET',
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      alias: { mutate: vi.fn(), isPending: false },
      rebuild: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useSkillsData>);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Skills />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/distinct role groups/)).toBeInTheDocument();
    expect(
      screen.getByText('Kafka', { selector: 'summary span' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Acme, Backend Engineer' }),
    ).toBeInTheDocument();
  });
});
