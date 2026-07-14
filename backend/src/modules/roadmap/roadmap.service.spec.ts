import { DataSource, EntityManager, Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { RoadmapHistory } from './entities/roadmap-history.entity';
import { RoadmapItem } from './entities/roadmap-item.entity';
import { RoadmapProofArtifact } from './entities/roadmap-proof-artifact.entity';
import { RoadmapStatus } from './enums/roadmap-status.enum';
import { recommendedPriority, RoadmapService } from './roadmap.service';

describe('RoadmapService', () => {
  it('calculates the documented recommended priority', () => {
    expect(recommendedPriority(4, 5, 3, 2, 2)).toBe(60);
  });

  it('keeps completion separate from explicit evidence promotion', async () => {
    const item = {
      id: '4b994f85-a043-4de2-a677-897f8f0cd569',
      status: RoadmapStatus.PLANNED,
      cv_evidence: null,
      frequency: 1,
      importance: 5,
      relevance: 5,
      evidence_weakness: 5,
      effort: 3,
      recommended_priority: 41.67,
      priority_override: null,
      target_date: null,
    } as RoadmapItem;
    const artifact = {
      id: '2cf7f2b5-652d-4976-b986-f8d22a514388',
      item_id: item.id,
      title: 'Kafka event demo',
      repository_url: 'https://github.com/example/kafka-demo',
      url: null,
      notes: 'Implemented retries and idempotency.',
      promoted_at: null,
    } as RoadmapProofArtifact;
    const events: string[] = [];
    const itemRepository = {
      findOne: jest.fn().mockResolvedValue(item),
      save: jest.fn((value: RoadmapItem) => Promise.resolve(value)),
    } as unknown as Repository<RoadmapItem>;
    const artifactRepository = {
      findOne: jest.fn().mockResolvedValue(artifact),
      save: jest.fn((value: RoadmapProofArtifact) => Promise.resolve(value)),
    } as unknown as Repository<RoadmapProofArtifact>;
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === RoadmapProofArtifact ? artifactRepository : itemRepository,
      ),
      findOne: jest.fn().mockResolvedValue(item),
      create: jest.fn((_entity: unknown, value: RoadmapHistory) => value),
      save: jest.fn((entity: unknown, value: RoadmapItem | RoadmapHistory) => {
        if (entity === RoadmapHistory)
          events.push((value as RoadmapHistory).event);
        return Promise.resolve(value);
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async (work: (entityManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
      getRepository: jest.fn(() => itemRepository),
    } as unknown as DataSource;
    const service = new RoadmapService(dataSource, {} as SettingsService);

    await service.update(item.id, { status: RoadmapStatus.COMPLETED });
    expect(item.cv_evidence).toBeNull();

    await service.promoteArtifact(item.id, artifact.id);
    expect(item.cv_evidence).toContain('Kafka event demo');
    expect(artifact.promoted_at).toBeInstanceOf(Date);
    expect(events).toEqual(['UPDATED', 'EVIDENCE_PROMOTED']);
  });
});
