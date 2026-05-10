import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(JobRequirement)
    private readonly requirementRepository: Repository<JobRequirement>,
    private readonly llmService: LlmService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    // 1. Deduplication check
    const existingJob = await this.jobRepository.findOne({
      where: { url: createJobDto.url },
      withDeleted: false,
    });

    if (existingJob) {
      throw new ConflictException(
        `Job with URL ${createJobDto.url} already exists.`,
      );
    }

    // 2. LLM Analysis
    this.logger.log(`Analyzing job from URL: ${createJobDto.url}`);
    const analysis = await this.llmService.analyzeJob(createJobDto.description);

    // 3. Application logic
    const scoreThreshold = await this.settingsService.get<number>(
      'score_threshold',
      70,
    );
    const applicableDomains = await this.settingsService.get<string[]>(
      'applicable_domains',
      ['BACKEND', 'FULLSTACK'],
    );

    const isApplicableByScore = analysis.score >= scoreThreshold;
    const isApplicableByDomain = applicableDomains.includes(analysis.domain);

    const company_name =
      createJobDto.company_name === 'skip'
        ? analysis.company_name || 'Unknown Company'
        : createJobDto.company_name;

    const title =
      createJobDto.title === 'skip'
        ? analysis.title || 'Unknown Title'
        : createJobDto.title;

    const job = this.jobRepository.create({
      ...createJobDto,
      company_name,
      title,
      llm_score: analysis.score,
      llm_domain: analysis.domain,
      domain: analysis.domain, // Default domain is LLM domain
      llm_summary: analysis.summary,
      llm_is_applicable: isApplicableByScore && isApplicableByDomain,
      posted_at: createJobDto.posted_at
        ? new Date(createJobDto.posted_at)
        : null,
      requirements: analysis.requirements.map((req, index) =>
        this.requirementRepository.create({
          name: req.name,
          met_status: req.met_status,
          reasoning: req.reasoning,
          order: index,
        }),
      ),
    });

    return this.jobRepository.save(job);
  }

  async findAll() {
    return this.jobRepository.find({
      order: { added_at: 'DESC' },
      relations: ['requirements'],
    });
  }

  async findOne(id: string) {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['requirements'],
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    const job = await this.findOne(id);

    // Merge updates
    Object.assign(job, updateJobDto);

    return this.jobRepository.save(job);
  }

  async remove(id: string) {
    const job = await this.findOne(id);
    return this.jobRepository.softRemove(job);
  }
}
