import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { MetStatus } from '../jobs/enums/met-status.enum';
import { AnalysisClassification } from '../jobs/enums/analysis-classification.enum';
import { LlmService } from '../llm/llm.service';
import {
  TaxonomyConfidence,
  TaxonomyDecisionType,
} from '../llm/interfaces/skill-taxonomy.interface';
import { SkillAlias } from './entities/skill-alias.entity';
import { Skill } from './entities/skill.entity';
import {
  Actionability,
  classifyRequirement,
  Effort,
  GapType,
  normalizeAlias,
  RequirementPriority,
} from './skill-taxonomy';

export interface NormalizedRequirement {
  skill_id: string | null;
  priority: RequirementPriority;
  gap_type: GapType;
  actionability: Actionability;
  effort: Effort;
}

export interface RequirementTaxonomyInput {
  name: string;
  cv_evidence: string | null;
}

interface PendingNormalization {
  classification: ReturnType<typeof classifyRequirement>;
  key: string;
  manual_skill_id: string | null;
  canonical_name: string | null;
}

interface SkillOccurrence {
  requirement_id: string;
  job_id: string;
  company_name: string;
  title: string;
  requirement_text: string;
  excerpt: string | null;
  cv_evidence: string | null;
  met_status: MetStatus;
}

interface SkillAggregate {
  id: string;
  name: string;
  required_count: number;
  preferred_count: number;
  met_count: number;
  gap_count: number;
  gap_types: GapType[];
  actionability: Actionability;
  effort: Effort;
  supporting_jobs: SkillOccurrence[];
  sort_reason: string;
}

export interface SkillMatrix {
  sample_size: number;
  raw_job_count: number;
  skills: SkillAggregate[];
  non_learnable_gaps: SkillOccurrence[];
}

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(SkillAlias)
    private readonly aliasRepository: Repository<SkillAlias>,
    @InjectRepository(JobRequirement)
    private readonly requirementRepository: Repository<JobRequirement>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
  ) {}

  async normalizeRequirements(
    inputs: RequirementTaxonomyInput[],
  ): Promise<NormalizedRequirement[]> {
    const pending = await this.prepareNormalizations(inputs);
    const automaticSkillIds = await this.persistAutomaticAliases(pending, false);
    return this.toNormalized(pending, automaticSkillIds);
  }

  async setAlias(aliasText: string, skillName: string): Promise<SkillAlias> {
    const key = normalizeAlias(aliasText);
    return this.dataSource.transaction(async (manager) => {
      const skills = manager.getRepository(Skill);
      const aliases = manager.getRepository(SkillAlias);
      let skill = await skills.findOne({ where: { name: skillName } });
      skill ??= await skills.save(skills.create({ name: skillName }));
      let alias = await aliases.findOne({ where: { normalized_alias: key } });
      alias ??= aliases.create({ normalized_alias: key });
      Object.assign(alias, { skill_id: skill.id, skill, is_manual: true });
      alias = await aliases.save(alias);
      const requirements = await manager.getRepository(JobRequirement).find();
      const matching = requirements.filter(
        (requirement) => normalizeAlias(requirement.name) === key,
      );
      if (matching.length) {
        matching.forEach((requirement) => (requirement.skill_id = skill.id));
        await manager.getRepository(JobRequirement).save(matching);
      }
      return alias;
    });
  }

  async rebuild(): Promise<{ normalized: number; excluded: number }> {
    const requirements = await this.requirementRepository.find();
    const pending = await this.prepareNormalizations(requirements);
    const automaticSkillIds = await this.dataSource.transaction(
      async (manager) => {
        const skillIds = await this.persistAutomaticAliases(
          pending,
          true,
          manager,
        );
        const normalized = this.toNormalized(pending, skillIds);
        requirements.forEach((requirement, index) =>
          Object.assign(requirement, normalized[index]),
        );
        if (requirements.length)
          await manager.getRepository(JobRequirement).save(requirements);
        return skillIds;
      },
    );
    const normalized = this.toNormalized(pending, automaticSkillIds);
    const excluded = normalized.filter((requirement) => !requirement.skill_id).length;
    return { normalized: requirements.length - excluded, excluded };
  }

  private async prepareNormalizations(
    inputs: RequirementTaxonomyInput[],
  ): Promise<PendingNormalization[]> {
    const keys = [...new Set(inputs.map((input) => normalizeAlias(input.name)))].filter(
      Boolean,
    );
    const manualAliases = keys.length
      ? await this.aliasRepository.find({
          where: { normalized_alias: In(keys), is_manual: true },
        })
      : [];
    const manualSkillIds = new Map(
      manualAliases.map((alias) => [alias.normalized_alias, alias.skill_id]),
    );
    const pending: PendingNormalization[] = inputs.map((input) => {
      const key = normalizeAlias(input.name);
      const manualSkillId = manualSkillIds.get(key) ?? null;
      const classified = classifyRequirement(
        input.name,
        Boolean(input.cv_evidence),
      );
      const classification = manualSkillId
        ? {
            ...classified,
            gapType: input.cv_evidence ? GapType.EVIDENCE : GapType.SKILL,
            actionability: input.cv_evidence
              ? Actionability.MEDIUM
              : Actionability.HIGH,
            effort: input.cv_evidence ? Effort.SMALL : Effort.MEDIUM,
            learnable: true,
          }
        : classified;
      return {
        classification,
        key,
        manual_skill_id: manualSkillId,
        canonical_name: null,
      };
    });
    const terms = new Map<string, string>();
    pending.forEach((item, index) => {
      if (
        item.classification.learnable &&
        !item.manual_skill_id &&
        item.key &&
        !terms.has(item.key)
      ) {
        terms.set(item.key, inputs[index].name.trim());
      }
    });
    const canonicalNames = new Map<string, string>();
    for (const batch of this.batches([...terms.values()], 50)) {
      try {
        const decisions = await this.llmService.classifySkillTerms(batch);
        decisions.forEach((decision) => {
          if (
            decision.decision === TaxonomyDecisionType.TRACK &&
            decision.confidence === TaxonomyConfidence.HIGH &&
            decision.canonical_name
          ) {
            canonicalNames.set(normalizeAlias(decision.term), decision.canonical_name);
          }
        });
      } catch {
        // Provider failures are intentionally left unlinked instead of becoming raw skills.
      }
    }
    pending.forEach((item) => {
      item.canonical_name = canonicalNames.get(item.key) ?? null;
    });
    return pending;
  }

  private async persistAutomaticAliases(
    pending: PendingNormalization[],
    reset: boolean,
    manager?: EntityManager,
  ): Promise<Map<string, string>> {
    if (!manager) {
      return this.dataSource.transaction((transactionManager) =>
        this.persistAutomaticAliases(pending, reset, transactionManager),
      );
    }
    const aliases = manager.getRepository(SkillAlias);
    const skills = manager.getRepository(Skill);
    if (reset) await aliases.delete({ is_manual: false });
    const canonicalByAlias = new Map<string, string>();
    pending.forEach((item) => {
      if (!item.manual_skill_id && item.canonical_name) {
        canonicalByAlias.set(item.key, item.canonical_name);
      }
    });
    if (!canonicalByAlias.size) return new Map();
    const existingSkills = await skills.find();
    const skillsByName = new Map(
      existingSkills.map((skill) => [normalizeAlias(skill.name), skill]),
    );
    const ids = new Map<string, string>();
    for (const [key, canonicalName] of canonicalByAlias) {
      const canonicalKey = normalizeAlias(canonicalName);
      let skill = skillsByName.get(canonicalKey);
      if (!skill) {
        skill = await skills.save(skills.create({ name: canonicalName }));
        skillsByName.set(canonicalKey, skill);
      }
      let alias = await aliases.findOne({ where: { normalized_alias: key } });
      alias ??= aliases.create({ normalized_alias: key });
      Object.assign(alias, { skill_id: skill.id, skill, is_manual: false });
      await aliases.save(alias);
      ids.set(key, skill.id);
    }
    return ids;
  }

  private toNormalized(
    pending: PendingNormalization[],
    automaticSkillIds: Map<string, string>,
  ): NormalizedRequirement[] {
    return pending.map((item) => ({
      skill_id:
        item.manual_skill_id ?? automaticSkillIds.get(item.key) ?? null,
      priority: item.classification.priority,
      gap_type: item.classification.gapType,
      actionability: item.classification.actionability,
      effort: item.classification.effort,
    }));
  }

  private *batches<T>(items: T[], size: number): Generator<T[]> {
    for (let index = 0; index < items.length; index += size) {
      yield items.slice(index, index + size);
    }
  }

  async getMatrix(
    domain?: Domain,
    includeResearch = false,
  ): Promise<SkillMatrix> {
    const jobs = await this.jobRepository.find({
      relations: { requirements: { skill: true } },
    });
    const candidates = jobs.filter(
      (job) =>
        job.include_in_gap &&
        (!domain || job.effective_domain === domain) &&
        job.effective_classification !== AnalysisClassification.IRRELEVANT &&
        (includeResearch ||
          job.effective_classification !== AnalysisClassification.RESEARCH),
    );
    const fingerprints = new Set(
      candidates.map((job) =>
        normalizeAlias(`${job.company_name} ${job.title}`),
      ),
    );
    const aggregates = new Map<
      string,
      SkillAggregate & { fingerprints: Set<string> }
    >();
    const nonLearnable = new Map<string, SkillOccurrence>();

    for (const job of candidates) {
      const fingerprint = normalizeAlias(`${job.company_name} ${job.title}`);
      for (const requirement of job.requirements) {
        const occurrence = this.occurrence(job, requirement);
        if (!requirement.skill) {
          if (
            requirement.gap_type === GapType.TIME_BOUND ||
            requirement.gap_type === GapType.ROLE_MISMATCH
          ) {
            nonLearnable.set(`${fingerprint}:${requirement.name}`, occurrence);
          }
          continue;
        }
        let aggregate = aggregates.get(requirement.skill.id);
        if (!aggregate) {
          aggregate = {
            id: requirement.skill.id,
            name: requirement.skill.name,
            required_count: 0,
            preferred_count: 0,
            met_count: 0,
            gap_count: 0,
            gap_types: [],
            actionability: requirement.actionability,
            effort: requirement.effort,
            supporting_jobs: [],
            sort_reason: '',
            fingerprints: new Set(),
          };
          aggregates.set(requirement.skill.id, aggregate);
        }
        if (aggregate.fingerprints.has(fingerprint)) continue;
        aggregate.fingerprints.add(fingerprint);
        aggregate.supporting_jobs.push(occurrence);
        if (requirement.priority === RequirementPriority.REQUIRED) {
          aggregate.required_count += 1;
        } else {
          aggregate.preferred_count += 1;
        }
        if (requirement.met_status === MetStatus.MET) aggregate.met_count += 1;
        else aggregate.gap_count += 1;
        if (!aggregate.gap_types.includes(requirement.gap_type)) {
          aggregate.gap_types.push(requirement.gap_type);
        }
      }
    }

    const skills = [...aggregates.values()]
      .sort(
        (a, b) =>
          b.required_count - a.required_count ||
          b.preferred_count - a.preferred_count ||
          a.name.localeCompare(b.name),
      )
      .map((aggregate) => {
        const { fingerprints, ...skill } = aggregate;
        void fingerprints;
        return {
          ...skill,
          sort_reason: `${skill.required_count} required, ${skill.preferred_count} preferred across ${skill.supporting_jobs.length} distinct similar-role groups`,
        };
      });

    return {
      sample_size: fingerprints.size,
      raw_job_count: candidates.length,
      skills,
      non_learnable_gaps: [...nonLearnable.values()],
    };
  }

  private occurrence(job: Job, requirement: JobRequirement): SkillOccurrence {
    return {
      requirement_id: requirement.id,
      job_id: job.id,
      company_name: job.company_name,
      title: job.title,
      requirement_text: requirement.name,
      excerpt: requirement.job_description_excerpt,
      cv_evidence: requirement.cv_evidence,
      met_status: requirement.met_status,
    };
  }
}
