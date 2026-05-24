import { Injectable, OnModuleInit, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultSettings();
  }

  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) {
      return defaultValue as T;
    }
    return setting.value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    let setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingRepository.create({ key, value });
    } else {
      setting.value = value;
    }
    await this.settingRepository.save(setting);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const settings = await this.settingRepository.find();
    return settings.reduce(
      (acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  async refreshCv(): Promise<{ message: string; cached_at: string }> {
    const cvUrl = await this.get<string>('master_cv_url', '');

    if (!cvUrl) {
      throw new BadRequestException('Master CV URL is not configured in settings.');
    }

    try {
      let fetchUrl = cvUrl;

      // Auto-convert Google Docs edit URLs to direct text export URLs
      if (cvUrl.includes('docs.google.com/document/d/')) {
        const match = cvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          const docId = match[1];
          fetchUrl = `https://docs.google.com/document/export?format=txt&id=${docId}`;
        }
      } 
      // Auto-convert Google Drive file view URLs to direct download URLs
      else if (cvUrl.includes('drive.google.com/file/d/')) {
        const match = cvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          const fileId = match[1];
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      this.logger.log(`Fetching CV from: ${fetchUrl}`);
      const response = await fetch(fetchUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();

      if (!text || text.trim().length === 0) {
        throw new Error('Fetched CV document is empty.');
      }

      const cachedAt = new Date().toISOString();
      await this.set('master_cv_cached_text', text.trim());
      await this.set('master_cv_cached_at', cachedAt);

      this.logger.log('CV refreshed successfully');
      return { message: 'CV refreshed successfully', cached_at: cachedAt };
    } catch (error: any) {
      this.logger.error(`CV refresh failed: ${error.message}`);
      throw new InternalServerErrorException(`CV refresh failed: ${error.message}`);
    }
  }

  private async ensureDefaultSettings() {
    const defaults: Record<string, unknown> = {
      score_threshold: 70,
      applicable_domains: ['BACKEND', 'FULLSTACK'],
      domain_keywords: {
        ML: [
          'machine learning',
          'deep learning',
          'llm',
          'nlp',
          'pytorch',
          'tensorflow',
          'mlops',
        ],
        DEVOPS: [
          'kubernetes',
          'terraform',
          'ci/cd',
          'devops',
          'sre',
          'infrastructure',
          'helm',
        ],
        BACKEND: ['backend', 'back-end', 'server-side', 'api', 'microservices'],
        FULLSTACK: ['full stack', 'fullstack', 'full-stack'],
      },
      llm_provider: 'gemini',
      llm_model: 'gemini-1.5-flash',
      telegram_allowed_chat_ids: [],
      master_cv_url: '',
      master_cv_cached_text: '',
      master_cv_cached_at: '',
    };

    for (const [key, value] of Object.entries(defaults)) {
      const exists = await this.settingRepository.count({ where: { key } });
      if (exists === 0) {
        this.logger.log(`Initializing default setting: ${key}`);
        await this.set(key, value);
      }
    }
  }
}
