import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Setting } from './entities/setting.entity';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let values: Map<string, unknown>;
  let repository: any;

  const makeRepository = (store: Map<string, unknown>) => ({
    findOne: jest.fn(async ({ where }: any) => store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null),
    find: jest.fn(async () => [...store].map(([key, value]) => ({ key, value }))),
    count: jest.fn(async ({ where }: any) => Number(store.has(where.key))),
    create: jest.fn((setting: any) => ({ ...setting })),
    save: jest.fn(async (setting: any) => { store.set(setting.key, setting.value); return setting; }),
  });

  beforeEach(async () => {
    values = new Map();
    repository = makeRepository(values);
    repository.manager = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<void>) => {
        const pending = new Map(values);
        const transactionalRepository = makeRepository(pending);
        const result = await callback({ getRepository: () => transactionalRepository });
        values = pending;
        repository.findOne.mockImplementation(({ where }: any) => Promise.resolve(values.has(where.key) ? { key: where.key, value: values.get(where.key) } : null));
        repository.find.mockImplementation(() => Promise.resolve([...values].map(([key, value]) => ({ key, value }))));
        return result;
      }),
    };
    const module = await Test.createTestingModule({
      providers: [SettingsService, { provide: getRepositoryToken(Setting), useValue: repository }],
    }).compile();
    service = module.get(SettingsService);
  });

  it('migrates legacy CV content exactly once', async () => {
    values.set('master_cv_cached_text', '  Exact legacy text\n');
    values.set('master_cv_cached_at', '2025-01-02T03:04:05.000Z');
    await service.onModuleInit();
    const cv = await service.getMasterCv();
    expect(cv).toMatchObject({ content: '  Exact legacy text\n', source: 'legacy_url', revision: 1 });
    expect((values.get('master_cv_state') as any).current.updated_at).toBe('2025-01-02T03:04:05.000Z');
  });

  it('saves, clears, and swaps the one-step backup for undo and redo', async () => {
    await service.saveMasterCv({ content: 'First version', source: 'manual', expected_revision: 0 });
    const second = await service.saveMasterCv({ content: 'Second version', source: 'file', filename: 'cv.MD', expected_revision: 1 });
    expect(second.previous).toMatchObject({ word_count: 2, source: 'manual' });
    const restored = await service.restoreMasterCv(2);
    expect(restored).toMatchObject({ content: 'First version', revision: 3 });
    const redone = await service.restoreMasterCv(3);
    expect(redone).toMatchObject({ content: 'Second version', revision: 4, filename: 'cv.MD' });
    const cleared = await service.clearMasterCv(4);
    expect(cleared).toMatchObject({ content: '', revision: 5 });
    expect(cleared.previous).toMatchObject({ word_count: 2 });
  });

  it('rejects stale revisions and leaves the state unchanged', async () => {
    await service.saveMasterCv({ content: 'Current', source: 'manual', expected_revision: 0 });
    await expect(service.saveMasterCv({ content: 'Stale', source: 'manual', expected_revision: 0 })).rejects.toBeInstanceOf(ConflictException);
    expect((await service.getMasterCv()).content).toBe('Current');
  });

  it('does not create a revision or backup for identical content', async () => {
    await service.saveMasterCv({ content: 'Same', source: 'manual', expected_revision: 0 });
    const result = await service.saveMasterCv({ content: 'Same', source: 'manual', expected_revision: 1 });
    expect(result).toMatchObject({ revision: 1, previous: null });
  });

  it.each([
    [{ content: '   ', source: 'manual', expected_revision: 0 }],
    [{ content: 'x'.repeat(1024 * 1024 + 1), source: 'manual', expected_revision: 0 }],
    [{ content: 'valid', source: 'file', expected_revision: 0 }],
    [{ content: 'valid', source: 'manual', filename: 'cv.txt', expected_revision: 0 }],
  ])('rejects invalid CV content or metadata', async (input: any) => {
    await expect(service.saveMasterCv(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the new CV for LLM consumers and retains a legacy fallback', async () => {
    values.set('master_cv_cached_text', 'Legacy');
    expect(await service.getMasterCvText()).toBe('Legacy');
    await service.saveMasterCv({ content: 'Authoritative', source: 'manual', expected_revision: 1 });
    expect(await service.getMasterCvText()).toBe('Authoritative');
  });

  it('returns only public keys and updates allowed values transactionally', async () => {
    values.set('master_cv_state', { current: null, previous: null, revision: 0 });
    values.set('master_cv_cached_text', 'secret');
    values.set('score_threshold', 70);
    await service.updateSettings({ score_threshold: 82, llm_model: 'gemini-2.5-flash' });
    const all = await service.getAll();
    expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(all).toMatchObject({ score_threshold: 82, llm_model: 'gemini-2.5-flash' });
    expect(all).not.toHaveProperty('master_cv_state');
    expect(all).not.toHaveProperty('master_cv_cached_text');
  });

  it('validates general updates before starting a transaction', async () => {
    await expect(service.updateSettings({ score_threshold: 101 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.manager.transaction).not.toHaveBeenCalled();
  });

  it('keeps the deprecated URL refresh endpoint writing the new state', async () => {
    values.set('master_cv_url', 'https://example.com/cv.txt');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => 'Imported CV' }) as jest.Mock;
    const result = await service.refreshCv();
    expect(result).toMatchObject({ message: 'CV refreshed successfully', revision: 1 });
    expect(await service.getMasterCvText()).toBe('Imported CV');
  });

  it('reports URL refresh failures without mutating the CV', async () => {
    values.set('master_cv_url', 'https://example.com/missing.txt');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as jest.Mock;
    await expect(service.refreshCv()).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(await service.getMasterCvText()).toBe('');
  });
});
