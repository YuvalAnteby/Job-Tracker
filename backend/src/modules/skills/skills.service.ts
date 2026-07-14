import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { MetStatus } from '../jobs/enums/met-status.enum';
import { AnalysisClassification } from '../jobs/enums/analysis-classification.enum';
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
  ) {}

  async normalizeRequirement(
    name: string,
    cvEvidence: string | null,
  ): Promise<NormalizedRequirement> {
    const classification = classifyRequirement(name, Boolean(cvEvidence));
    if (!classification.learnable) {
      return {
        skill_id: null,
        priority: classification.priority,
        gap_type: classification.gapType,
        actionability: classification.actionability,
        effort: classification.effort,
      };
    }

    const key = normalizeAlias(name);
    let alias = await this.aliasRepository.findOne({
      where: { normalized_alias: key },
      relations: ['skill'],
    });
    if (!alias) {
      const skillName = name.trim().slice(0, 120);
      let skill = await this.skillRepository.findOne({
        where: { name: skillName },
      });
      skill ??= await this.skillRepository.save(
        this.skillRepository.create({ name: skillName }),
      );
      alias = await this.aliasRepository.save(
        this.aliasRepository.create({
          normalized_alias: key,
          skill_id: skill.id,
          skill,
          is_manual: false,
        }),
      );
    }

    return {
      skill_id: alias.skill_id,
      priority: classification.priority,
      gap_type: classification.gapType,
      actionability: classification.actionability,
      effort: classification.effort,
    };
  }

  async setAlias(aliasText: string, skillName: string): Promise<SkillAlias> {
    const key = normalizeAlias(aliasText);
    let skill = await this.skillRepository.findOne({
      where: { name: skillName },
    });
    skill ??= await this.skillRepository.save(
      this.skillRepository.create({ name: skillName }),
    );

    let alias = await this.aliasRepository.findOne({
      where: { normalized_alias: key },
    });
    alias ??= this.aliasRepository.create({ normalized_alias: key });
    Object.assign(alias, { skill_id: skill.id, skill, is_manual: true });
    await this.aliasRepository.save(alias);

    const requirements = await this.requirementRepository.find();
    const matching = requirements.filter(
      (requirement) => normalizeAlias(requirement.name) === key,
    );
    if (matching.length) {
      matching.forEach((requirement) => (requirement.skill_id = skill.id));
      await this.requirementRepository.save(matching);
    }
    return alias;
  }

  async rebuild(): Promise<{ normalized: number; excluded: number }> {
    const requirements = await this.requirementRepository.find();
    let excluded = 0;
    for (const requirement of requirements) {
      const normalized = await this.normalizeRequirement(
        requirement.name,
        requirement.cv_evidence,
      );
      Object.assign(requirement, normalized);
      if (!normalized.skill_id) excluded += 1;
    }
    if (requirements.length)
      await this.requirementRepository.save(requirements);
    return { normalized: requirements.length - excluded, excluded };
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
