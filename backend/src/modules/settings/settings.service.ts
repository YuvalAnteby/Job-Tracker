import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Domain } from '../jobs/enums/domain.enum';
import {
  CvSource,
  MASTER_CV_MAX_BYTES,
  UpdateMasterCvDto,
} from './dto/master-cv.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TargetProfileDto } from './dto/target-profile.dto';
import { Setting } from './entities/setting.entity';
import { CvRevision } from './entities/cv-revision.entity';

export const AI_EXCLUDE_START = '<!-- AI-EXCLUDE-START -->';
export const AI_EXCLUDE_END = '<!-- AI-EXCLUDE-END -->';

export interface TargetProfileState {
  revision: number;
  profile: TargetProfileDto;
}

const EMPTY_TARGET_PROFILE: TargetProfileDto = {
  target_domains: [],
  target_roles: [],
  must_have_skills: [],
};

export interface MasterCvSnapshot {
  id?: string;
  content: string;
  updated_at: string;
  source: CvSource;
  filename?: string;
}

export interface MasterCvState {
  current: MasterCvSnapshot | null;
  previous: MasterCvSnapshot | null;
  revision: number;
}

const PUBLIC_SETTING_KEYS = [
  'score_threshold',
  'applicable_domains',
  'domain_keywords',
  'llm_provider',
  'llm_model',
  'telegram_allowed_chat_ids',
  'reminders_enabled',
  'reminder_default_days',
  'reminder_timezone',
] as const;
const UPDATABLE_SETTING_KEYS = [
  'score_threshold',
  'applicable_domains',
  'domain_keywords',
  'llm_model',
  'telegram_allowed_chat_ids',
  'reminders_enabled',
  'reminder_default_days',
  'reminder_timezone',
] as const;

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(CvRevision)
    private readonly cvRevisionRepository: Repository<CvRevision>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultSettings();
    await this.set('llm_provider', 'gemini');
    await this.migrateLegacyMasterCv();
  }

  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    return setting ? (setting.value as T) : (defaultValue as T);
  }

  async set(key: string, value: unknown): Promise<void> {
    let setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) setting = this.settingRepository.create({ key, value });
    else setting.value = value;
    await this.settingRepository.save(setting);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const settings = await this.settingRepository.find();
    const allowed = new Set<string>(PUBLIC_SETTING_KEYS);
    return settings.reduce<Record<string, unknown>>((result, setting) => {
      if (allowed.has(setting.key)) result[setting.key] = setting.value;
      return result;
    }, {});
  }

  async updateSettings(update: UpdateSettingsDto) {
    this.validateGeneralSettings(update);
    const allowed = new Set<string>(UPDATABLE_SETTING_KEYS);
    const entries = Object.entries(update).filter(
      ([key, value]) => allowed.has(key) && value !== undefined,
    );

    await this.settingRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Setting);
      for (const [key, value] of entries) {
        let setting = await repository.findOne({ where: { key } });
        if (!setting) setting = repository.create({ key, value });
        else setting.value = value;
        await repository.save(setting);
      }
    });

    return this.getAll();
  }

  async getMasterCv() {
    const state = await this.loadMasterCvState();
    return this.toMasterCvResponse(state);
  }

  async getMasterCvText(): Promise<string> {
    return (await this.getMasterCvContext()).text;
  }

  async getMasterCvContext(): Promise<{
    id: string | null;
    revision: number | null;
    text: string;
  }> {
    const state = await this.loadMasterCvState();
    if (!state.current) return { id: null, revision: null, text: '' };
    const revision = state.current.id
      ? await this.cvRevisionRepository.findOne({
          where: { id: state.current.id },
        })
      : null;
    return {
      id: revision?.id ?? null,
      revision: revision?.revision ?? state.revision,
      text:
        revision?.ai_visible_text ?? this.aiVisibleText(state.current.content),
    };
  }

  async getMasterCvHistory(): Promise<Record<string, unknown>[]> {
    const revisions = await this.cvRevisionRepository.find({
      order: { revision: 'DESC' },
    });
    return revisions.map((revision) => this.toRevisionMetadata(revision));
  }

  async getTargetProfile(): Promise<TargetProfileState> {
    return this.get<TargetProfileState>('target_profile_state', {
      revision: 0,
      profile: EMPTY_TARGET_PROFILE,
    });
  }

  async saveTargetProfile(
    expectedRevision: number,
    profile: TargetProfileDto,
  ): Promise<TargetProfileState> {
    return this.settingRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Setting);
      const setting = await repository.findOne({
        where: { key: 'target_profile_state' },
        lock: { mode: 'pessimistic_write' },
      });
      const current = (setting?.value ?? {
        revision: 0,
        profile: EMPTY_TARGET_PROFILE,
      }) as TargetProfileState;
      if (current.revision !== expectedRevision) {
        throw new ConflictException({
          message: 'The target profile changed since it was loaded.',
          current_revision: current.revision,
        });
      }
      const next: TargetProfileState = {
        revision: current.revision + 1,
        profile: {
          target_domains: [...new Set(profile.target_domains)],
          target_roles: this.cleanStrings(profile.target_roles),
          must_have_skills: this.cleanStrings(profile.must_have_skills),
          ...(profile.seniority?.trim()
            ? { seniority: profile.seniority.trim() }
            : {}),
          ...(profile.location?.trim()
            ? { location: profile.location.trim() }
            : {}),
        },
      };
      const row = setting ?? repository.create({ key: 'target_profile_state' });
      row.value = next;
      await repository.save(row);
      return next;
    });
  }

  async saveMasterCv(input: UpdateMasterCvDto) {
    this.validateSnapshotInput(input);
    const aiVisibleText = this.aiVisibleText(input.content);
    return this.mutateMasterCv(
      input.expected_revision,
      async (state, repository) => {
        if (state.current?.content === input.content) return state;
        const revision = await repository.save(
          repository.create({
            revision: state.revision + 1,
            content: input.content,
            ai_visible_text: aiVisibleText,
            source: input.source,
            filename: input.filename ?? null,
          }),
        );
        const snapshot: MasterCvSnapshot = {
          id: revision.id,
          content: input.content,
          updated_at: new Date().toISOString(),
          source: input.source,
          ...(input.filename ? { filename: input.filename } : {}),
        };
        return {
          current: snapshot,
          previous: state.current,
          revision: state.revision + 1,
        };
      },
    );
  }

  async clearMasterCv(expectedRevision: number) {
    return this.mutateMasterCv(expectedRevision, (state) =>
      state.current
        ? {
            current: null,
            previous: state.current,
            revision: state.revision + 1,
          }
        : state,
    );
  }

  async restoreMasterCv(expectedRevision: number) {
    return this.mutateMasterCv(expectedRevision, async (state, repository) => {
      if (!state.previous)
        throw new BadRequestException('No previous CV version is available.');
      const restored = await repository.save(
        repository.create({
          revision: state.revision + 1,
          content: state.previous.content,
          ai_visible_text: this.aiVisibleText(state.previous.content),
          source: state.previous.source,
          filename: state.previous.filename ?? null,
        }),
      );
      return {
        current: {
          ...state.previous,
          id: restored.id,
          updated_at: restored.created_at.toISOString(),
        },
        previous: state.current,
        revision: state.revision + 1,
      };
    });
  }

  /** @deprecated Use PUT /settings/master-cv. */
  async refreshCv(): Promise<{
    message: string;
    cached_at: string;
    revision: number;
  }> {
    const cvUrl = await this.get<string>('master_cv_url', '');
    if (!cvUrl)
      throw new BadRequestException(
        'Master CV URL is not configured in settings.',
      );

    try {
      const fetchUrl = this.toLegacyDownloadUrl(cvUrl);
      const response = await fetch(fetchUrl);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const content = await response.text();
      const state = await this.loadMasterCvState();
      const saved = await this.saveMasterCv({
        content,
        source: 'legacy_url',
        expected_revision: state.revision,
      });
      return {
        message: 'CV refreshed successfully',
        cached_at: saved.updated_at!,
        revision: saved.revision,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`CV refresh failed: ${message}`);
      throw new InternalServerErrorException(`CV refresh failed: ${message}`);
    }
  }

  private async loadMasterCvState(): Promise<MasterCvState> {
    const state = await this.get<MasterCvState | null>('master_cv_state', null);
    if (state) return state;
    await this.migrateLegacyMasterCv();
    return this.get<MasterCvState>('master_cv_state', {
      current: null,
      previous: null,
      revision: 0,
    });
  }

  private async mutateMasterCv(
    expectedRevision: number,
    mutate: (
      state: MasterCvState,
      revisions: Repository<CvRevision>,
    ) => MasterCvState | Promise<MasterCvState>,
  ) {
    // Ensure the singleton row exists before acquiring a row-level lock.
    await this.loadMasterCvState();
    return this.settingRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Setting);
      const setting = await repository.findOne({
        where: { key: 'master_cv_state' },
        lock: { mode: 'pessimistic_write' },
      });
      const state = setting?.value as MasterCvState;
      this.assertRevision(state, expectedRevision);
      const next = await mutate(state, manager.getRepository(CvRevision));
      if (next !== state) {
        setting!.value = next;
        await repository.save(setting!);
      }
      return this.toMasterCvResponse(next);
    });
  }

  private async migrateLegacyMasterCv() {
    const existing = await this.get<MasterCvState | null>(
      'master_cv_state',
      null,
    );
    if (existing) return;

    const content = await this.get<string>('master_cv_cached_text', '');
    const cachedAt = await this.get<string>('master_cv_cached_at', '');
    const current = content.trim()
      ? {
          content,
          updated_at: this.validDateOrNow(cachedAt),
          source: 'legacy_url' as const,
        }
      : null;
    await this.set('master_cv_state', {
      current,
      previous: null,
      revision: current ? 1 : 0,
    } satisfies MasterCvState);
  }

  private toMasterCvResponse(state: MasterCvState) {
    const current = state.current;
    return {
      content: current?.content ?? '',
      updated_at: current?.updated_at ?? null,
      source: current?.source ?? null,
      filename: current?.filename ?? null,
      word_count: this.countWords(current?.content ?? ''),
      character_count: current?.content.length ?? 0,
      ai_visible_content: current ? this.aiVisibleText(current.content) : '',
      ai_visible_character_count: current
        ? this.aiVisibleText(current.content).length
        : 0,
      previous: state.previous
        ? {
            updated_at: state.previous.updated_at,
            source: state.previous.source,
            filename: state.previous.filename ?? null,
            word_count: this.countWords(state.previous.content),
            character_count: state.previous.content.length,
          }
        : null,
      revision: state.revision,
    };
  }

  private validateSnapshotInput(input: UpdateMasterCvDto) {
    if (!input.content.trim())
      throw new BadRequestException('CV content cannot be empty.');
    if (Buffer.byteLength(input.content, 'utf8') > MASTER_CV_MAX_BYTES) {
      throw new BadRequestException('CV content exceeds the 1 MiB limit.');
    }
    if (input.source === 'file') {
      if (!input.filename || !/\.(md|txt)$/i.test(input.filename)) {
        throw new BadRequestException(
          'File-sourced CVs require a .md or .txt filename.',
        );
      }
    } else if (input.filename) {
      throw new BadRequestException(
        'A filename is only valid when the source is file.',
      );
    }
  }

  private aiVisibleText(content: string): string {
    let visible = '';
    let cursor = 0;
    while (cursor < content.length) {
      const start = content.indexOf(AI_EXCLUDE_START, cursor);
      const strayEnd = content.indexOf(AI_EXCLUDE_END, cursor);
      if (strayEnd !== -1 && (start === -1 || strayEnd < start)) {
        throw new BadRequestException(
          'CV has an exclusion end marker without a start marker.',
        );
      }
      if (start === -1) return visible + content.slice(cursor);
      visible += content.slice(cursor, start);
      const end = content.indexOf(
        AI_EXCLUDE_END,
        start + AI_EXCLUDE_START.length,
      );
      if (end === -1)
        throw new BadRequestException('CV has an unclosed AI exclusion block.');
      const nested = content.indexOf(
        AI_EXCLUDE_START,
        start + AI_EXCLUDE_START.length,
      );
      if (nested !== -1 && nested < end) {
        throw new BadRequestException(
          'CV AI exclusion blocks cannot be nested.',
        );
      }
      cursor = end + AI_EXCLUDE_END.length;
    }
    return visible;
  }

  private toRevisionMetadata(revision: CvRevision): Record<string, unknown> {
    return {
      id: revision.id,
      revision: revision.revision,
      updated_at: revision.created_at,
      source: revision.source,
      filename: revision.filename,
      word_count: this.countWords(revision.content),
      character_count: revision.content.length,
      ai_visible_character_count: revision.ai_visible_text.length,
    };
  }

  private validateGeneralSettings(update: UpdateSettingsDto) {
    if (
      update.score_threshold !== undefined &&
      (!Number.isInteger(update.score_threshold) ||
        update.score_threshold < 0 ||
        update.score_threshold > 100)
    ) {
      throw new BadRequestException(
        'Score threshold must be an integer from 0 to 100.',
      );
    }
    if (
      update.applicable_domains &&
      update.applicable_domains.some(
        (domain) => !Object.values(Domain).includes(domain),
      )
    ) {
      throw new BadRequestException(
        'Applicable domains contain an invalid value.',
      );
    }
    if (
      update.llm_model !== undefined &&
      (!/^gemini-[a-zA-Z0-9._-]+$/.test(update.llm_model) ||
        update.llm_model.length > 100)
    ) {
      throw new BadRequestException(
        'Gemini model must be a valid Gemini model name.',
      );
    }
    if (
      update.telegram_allowed_chat_ids?.some((id) => !Number.isSafeInteger(id))
    ) {
      throw new BadRequestException('Telegram chat IDs must be safe integers.');
    }
    if (update.domain_keywords) {
      for (const [domain, keywords] of Object.entries(update.domain_keywords)) {
        if (
          !Object.values(Domain).includes(domain as Domain) ||
          !Array.isArray(keywords) ||
          keywords.some(
            (keyword) =>
              typeof keyword !== 'string' ||
              !keyword.trim() ||
              keyword.length > 100,
          )
        ) {
          throw new BadRequestException(
            'Domain keywords must be non-empty strings mapped to valid domains.',
          );
        }
      }
    }
    if (update.reminder_timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en', {
          timeZone: update.reminder_timezone,
        }).format();
      } catch {
        throw new BadRequestException(
          'Reminder timezone must be a valid IANA timezone.',
        );
      }
    }
  }

  private assertRevision(state: MasterCvState, expectedRevision: number) {
    if (state.revision !== expectedRevision) {
      throw new ConflictException({
        message: 'The master CV changed since it was loaded.',
        current_revision: state.revision,
      });
    }
  }

  private countWords(content: string) {
    return content.trim() ? content.trim().split(/\s+/u).length : 0;
  }

  private cleanStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private validDateOrNow(value: string) {
    return value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toISOString()
      : new Date().toISOString();
  }

  private toLegacyDownloadUrl(cvUrl: string) {
    const docsId = cvUrl.match(
      /docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/,
    )?.[1];
    if (docsId)
      return `https://docs.google.com/document/export?format=txt&id=${docsId}`;
    const driveId = cvUrl.match(
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
    )?.[1];
    return driveId
      ? `https://drive.google.com/uc?export=download&id=${driveId}`
      : cvUrl;
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
      llm_model: 'gemini-2.5-flash',
      telegram_allowed_chat_ids: [],
      reminders_enabled: true,
      reminder_default_days: 3,
      reminder_timezone: 'Asia/Jerusalem',
      master_cv_url: '',
      master_cv_cached_text: '',
      master_cv_cached_at: '',
      target_profile_state: {
        revision: 0,
        profile: EMPTY_TARGET_PROFILE,
      } satisfies TargetProfileState,
    };
    for (const [key, value] of Object.entries(defaults)) {
      if ((await this.settingRepository.count({ where: { key } })) === 0)
        await this.set(key, value);
    }
  }
}
