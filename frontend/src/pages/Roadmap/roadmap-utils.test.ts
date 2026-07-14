import { describe, expect, it } from 'vitest';
import { type RoadmapItem, RoadmapStatus } from '../../types';
import { groupRoadmapItems, visibleRoadmapItems } from './roadmap-utils';

const makeItem = (
  id: string,
  priority: number,
  month: string | null,
): RoadmapItem =>
  ({
    id,
    title: id,
    effective_priority: priority,
    month,
    semester: month ? '2026 H2' : 'Backlog',
    status: RoadmapStatus.PLANNED,
  }) as RoadmapItem;

describe('roadmap grouping', () => {
  it('keeps backlog separate and sorts each view by effective priority', () => {
    const items = [
      makeItem('low', 2, '2026-08'),
      makeItem('high', 9, '2026-08'),
      makeItem('later', 5, null),
    ];
    const visible = visibleRoadmapItems(items, 'ALL', 'ALL');
    expect(visible.map((item) => item.id)).toEqual(['high', 'later', 'low']);
    expect(groupRoadmapItems(visible).get('Backlog')?.[0].id).toBe('later');
  });
});
