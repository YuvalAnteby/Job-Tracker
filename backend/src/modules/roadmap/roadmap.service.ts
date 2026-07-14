import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { MetStatus } from '../jobs/enums/met-status.enum';
import { SettingsService } from '../settings/settings.service';
import { Skill } from '../skills/entities/skill.entity';
import { Effort, GapType, RequirementPriority } from '../skills/skill-taxonomy';
import {
  CreateProofArtifactDto,
  CreateRoadmapItemDto,
  UpdateRoadmapItemDto,
} from './dto/roadmap.dto';
import { RoadmapHistory } from './entities/roadmap-history.entity';
import { RoadmapItem } from './entities/roadmap-item.entity';
import { RoadmapProofArtifact } from './entities/roadmap-proof-artifact.entity';
import { RoadmapStatus } from './enums/roadmap-status.enum';

export interface RoadmapView extends RoadmapItem {
  effective_priority: number;
  priority_reason: string;
  semester: string;
  month: string | null;
  overdue: boolean;
}

export const recommendedPriority = (
  frequency: number,
  importance: number,
  relevance: number,
  evidenceWeakness: number,
  effort: number,
): number =>
  Math.round(
    (frequency * importance * relevance * evidenceWeakness * 100) / effort,
  ) / 100;

@Injectable()
export class RoadmapService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
  ) {}

  async list(): Promise<RoadmapView[]> {
    const items = await this.dataSource.getRepository(RoadmapItem).find({
      relations: {
        skill: true,
        jobs: true,
        requirements: true,
        artifacts: true,
        history: true,
      },
      order: { created_at: 'DESC' },
    });
    return items.map((item) => this.view(item));
  }

  async create(dto: CreateRoadmapItemDto): Promise<RoadmapView> {
    const gapType = dto.gap_type ?? GapType.SKILL;
    if (
      (gapType === GapType.TIME_BOUND ||
        gapType === GapType.ROLE_MISMATCH ||
        dto.relevance === 0) &&
      !dto.confirm_non_learnable
    ) {
      throw new BadRequestException(
        'Confirm this irrelevant or time-bound gap before adding it to the roadmap.',
      );
    }
    const profileRevision = (await this.settingsService.getTargetProfile())
      .revision;
    const item = await this.dataSource.transaction(async (manager) => {
      const skill = dto.skill_id
        ? await manager.findOne(Skill, { where: { id: dto.skill_id } })
        : null;
      if (dto.skill_id && !skill)
        throw new NotFoundException('Skill not found.');

      let requirements = dto.requirement_ids?.length
        ? await manager.find(JobRequirement, {
            where: { id: In(dto.requirement_ids) },
            relations: { job: true },
          })
        : [];
      if (skill && !dto.requirement_ids?.length) {
        requirements = await manager.find(JobRequirement, {
          where: { skill_id: skill.id },
          relations: { job: true },
        });
      }
      const jobIds = [
        ...new Set([
          ...(dto.job_ids ?? []),
          ...requirements.map((requirement) => requirement.job_id),
        ]),
      ];
      const jobs = jobIds.length
        ? await manager.find(Job, { where: { id: In(jobIds) } })
        : [];
      const factors = this.factors(requirements, dto.relevance, dto.effort);
      const itemRepository = manager.getRepository(RoadmapItem);
      const saved = await itemRepository.save(
        itemRepository.create({
          title: dto.title,
          notes: dto.notes?.trim() || null,
          skill_id: skill?.id ?? null,
          skill,
          status: RoadmapStatus.PLANNED,
          gap_type: gapType,
          target_date: dto.target_date ?? null,
          ...factors,
          recommended_priority: recommendedPriority(
            factors.frequency,
            factors.importance,
            factors.relevance,
            factors.evidence_weakness,
            factors.effort,
          ),
          priority_override: dto.priority_override ?? null,
          target_profile_revision: profileRevision,
          cv_evidence: null,
          jobs,
          requirements,
        }),
      );
      await this.record(manager, saved.id, 'CREATED', {
        target_profile_revision: profileRevision,
      });
      return saved;
    });
    return this.get(item.id);
  }

  async update(id: string, dto: UpdateRoadmapItemDto): Promise<RoadmapView> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RoadmapItem);
      const item = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Roadmap item not found.');
      const changes: Record<string, unknown> = {};
      for (const key of [
        'status',
        'target_date',
        'priority_override',
        'notes',
      ] as const) {
        if (dto[key] !== undefined && dto[key] !== item[key]) {
          changes[key] = { from: item[key], to: dto[key] };
          Object.assign(item, { [key]: dto[key] });
        }
      }
      await repository.save(item);
      if (Object.keys(changes).length)
        await this.record(manager, id, 'UPDATED', changes);
    });
    return this.get(id);
  }

  async addArtifact(
    id: string,
    dto: CreateProofArtifactDto,
  ): Promise<RoadmapProofArtifact> {
    if (!dto.url && !dto.repository_url && !dto.notes && !dto.resources) {
      throw new BadRequestException(
        'Add a URL, repository, note, or resource for this proof.',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      await this.requireItem(manager, id);
      const repository = manager.getRepository(RoadmapProofArtifact);
      const artifact = await repository.save(
        repository.create({
          item_id: id,
          title: dto.title,
          url: dto.url ?? null,
          repository_url: dto.repository_url ?? null,
          notes: dto.notes?.trim() || null,
          resources: dto.resources?.trim() || null,
          promoted_at: null,
        }),
      );
      await this.record(manager, id, 'PROOF_ADDED', {
        artifact_id: artifact.id,
      });
      return artifact;
    });
  }

  async promoteArtifact(id: string, artifactId: string): Promise<RoadmapView> {
    await this.dataSource.transaction(async (manager) => {
      const item = await this.requireItem(manager, id);
      const repository = manager.getRepository(RoadmapProofArtifact);
      const artifact = await repository.findOne({
        where: { id: artifactId, item_id: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!artifact) throw new NotFoundException('Proof artifact not found.');
      const evidence = [
        artifact.title,
        artifact.notes,
        artifact.url,
        artifact.repository_url,
      ]
        .filter(Boolean)
        .join(' | ');
      item.cv_evidence = evidence;
      artifact.promoted_at = new Date();
      await manager.save(RoadmapItem, item);
      await repository.save(artifact);
      await this.record(manager, id, 'EVIDENCE_PROMOTED', {
        artifact_id: artifact.id,
        evidence,
      });
    });
    return this.get(id);
  }

  private async get(id: string): Promise<RoadmapView> {
    const item = await this.dataSource.getRepository(RoadmapItem).findOne({
      where: { id },
      relations: {
        skill: true,
        jobs: true,
        requirements: true,
        artifacts: true,
        history: true,
      },
    });
    if (!item) throw new NotFoundException('Roadmap item not found.');
    return this.view(item);
  }

  private factors(
    requirements: JobRequirement[],
    relevance = 5,
    effort?: number,
  ) {
    const frequency = Math.max(
      1,
      new Set(requirements.map((requirement) => requirement.job_id)).size,
    );
    const importance = requirements.some(
      (requirement) => requirement.priority === RequirementPriority.REQUIRED,
    )
      ? 5
      : requirements.length
        ? 3
        : 1;
    const gaps = requirements.filter(
      (requirement) => requirement.met_status !== MetStatus.MET,
    ).length;
    const evidenceWeakness = requirements.length
      ? Math.max(1, Math.ceil((gaps / requirements.length) * 5))
      : 1;
    const inferredEffort = requirements.some(
      (requirement) => requirement.effort === Effort.LARGE,
    )
      ? 5
      : requirements.some((requirement) => requirement.effort === Effort.MEDIUM)
        ? 3
        : 1;
    return {
      frequency,
      importance,
      relevance,
      evidence_weakness: evidenceWeakness,
      effort: effort ?? inferredEffort,
    };
  }

  private view(item: RoadmapItem): RoadmapView {
    const now = new Date();
    const date = item.target_date
      ? new Date(`${item.target_date}T00:00:00`)
      : null;
    const semester = date
      ? `${date.getFullYear()} H${date.getMonth() < 6 ? 1 : 2}`
      : 'Backlog';
    return Object.assign(item, {
      effective_priority: item.priority_override ?? item.recommended_priority,
      priority_reason: `${item.frequency} frequency × ${item.importance} importance × ${item.relevance} relevance × ${item.evidence_weakness} evidence weakness ÷ ${item.effort} effort`,
      semester,
      month: item.target_date?.slice(0, 7) ?? null,
      overdue: Boolean(
        date && date < now && item.status !== RoadmapStatus.COMPLETED,
      ),
    });
  }

  private async requireItem(
    manager: EntityManager,
    id: string,
  ): Promise<RoadmapItem> {
    const item = await manager.findOne(RoadmapItem, { where: { id } });
    if (!item) throw new NotFoundException('Roadmap item not found.');
    return item;
  }

  private async record(
    manager: EntityManager,
    itemId: string,
    event: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await manager.save(
      RoadmapHistory,
      manager.create(RoadmapHistory, { item_id: itemId, event, details }),
    );
  }
}
