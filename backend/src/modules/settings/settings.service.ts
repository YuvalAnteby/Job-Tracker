import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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

  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) {
      return defaultValue as T;
    }
    return setting.value as T;
  }

  async set(key: string, value: any): Promise<void> {
    let setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingRepository.create({ key, value });
    } else {
      setting.value = value;
    }
    await this.settingRepository.save(setting);
  }

  async getAll(): Promise<Record<string, any>> {
    const settings = await this.settingRepository.find();
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, any>);
  }

  private async ensureDefaultSettings() {
    const defaults: Record<string, any> = {
      score_threshold: 70,
      applicable_domains: ['BACKEND', 'FULLSTACK'],
      domain_keywords: {
        ML: ['machine learning', 'deep learning', 'llm', 'nlp', 'pytorch', 'tensorflow', 'mlops'],
        DEVOPS: ['kubernetes', 'terraform', 'ci/cd', 'devops', 'sre', 'infrastructure', 'helm'],
        BACKEND: ['backend', 'back-end', 'server-side', 'api', 'microservices'],
        FULLSTACK: ['full stack', 'fullstack', 'full-stack'],
      },
      llm_provider: 'gemini',
      llm_model: 'gemini-1.5-flash',
      telegram_allowed_chat_ids: [],
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
