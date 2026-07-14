import { type RoadmapItem, RoadmapStatus } from '../../types';

export const visibleRoadmapItems = (
  items: RoadmapItem[],
  status: RoadmapStatus | 'ALL',
  semester: string,
): RoadmapItem[] =>
  items
    .filter((item) => status === 'ALL' || item.status === status)
    .filter((item) => semester === 'ALL' || item.semester === semester)
    .sort(
      (a, b) =>
        b.effective_priority - a.effective_priority ||
        a.title.localeCompare(b.title),
    );

export const groupRoadmapItems = (
  items: RoadmapItem[],
): Map<string, RoadmapItem[]> => {
  const groups = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    const label = item.month ?? 'Backlog';
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return groups;
};
