import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type RoadmapItem, RoadmapStatus } from '../../types';
import Roadmap from './Roadmap';
import { useCreateRoadmapItem, useRoadmapData } from './useRoadmapData';

vi.mock('./useRoadmapData');

const item = {
  id: 'item-1',
  title: 'Build Kafka proof',
  notes: null,
  skill_id: null,
  skill: null,
  status: RoadmapStatus.PLANNED,
  gap_type: 'SKILL',
  target_date: null,
  frequency: 2,
  importance: 5,
  relevance: 5,
  evidence_weakness: 4,
  effort: 3,
  recommended_priority: 66.67,
  priority_override: null,
  effective_priority: 66.67,
  priority_reason:
    '2 frequency × 5 importance × 5 relevance × 4 evidence weakness ÷ 3 effort',
  target_profile_revision: 2,
  cv_evidence: null,
  jobs: [],
  requirements: [],
  artifacts: [],
  history: [],
  semester: 'Backlog',
  month: null,
  overdue: false,
  created_at: '2026-07-14T00:00:00Z',
  updated_at: '2026-07-14T00:00:00Z',
} as RoadmapItem;

describe('Roadmap', () => {
  const create = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateRoadmapItem).mockReturnValue({
      mutate: create,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateRoadmapItem>);
    vi.mocked(useRoadmapData).mockReturnValue({
      data: [item],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      update: { mutate: update, isPending: false },
      addArtifact: { mutate: vi.fn(), isPending: false },
      promote: { mutate: vi.fn(), isPending: false },
    } as unknown as ReturnType<typeof useRoadmapData>);
  });

  it('creates, reprioritizes, completes, and filters roadmap work', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Roadmap />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Outcome'), 'Practice system design');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Practice system design' }),
      expect.any(Object),
    );

    const statusControls = screen.getAllByLabelText('Status');
    await user.selectOptions(statusControls[1], RoadmapStatus.COMPLETED);
    await user.type(screen.getByLabelText('Priority override'), '88');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        body: expect.objectContaining({
          status: RoadmapStatus.COMPLETED,
          priority_override: 88,
        }),
      }),
    );

    await user.selectOptions(statusControls[0], RoadmapStatus.BLOCKED);
    expect(screen.queryByText('Build Kafka proof')).not.toBeInTheDocument();
  });
});
