import { Test, TestingModule } from '@nestjs/testing';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { SettingsService } from '../settings/settings.service';
import { ExecutionContext } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';

describe('TelegramAuthGuard', () => {
  let guard: TelegramAuthGuard;
  let settingsService: SettingsService;

  const mockSettingsService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramAuthGuard,
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    guard = module.get<TelegramAuthGuard>(TelegramAuthGuard);
    settingsService = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if userId is in allowedChatIds', async () => {
    const userId = 123;
    mockSettingsService.get.mockResolvedValue([123, 456]);

    const context = {
      switchToHttp: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn().mockReturnValue('telegraf'),
      getArgByIndex: jest.fn().mockReturnValue({
        from: { id: userId },
      }),
    } as unknown as ExecutionContext;

    // We need to mock TelegrafExecutionContext.create
    jest.spyOn(TelegrafExecutionContext, 'create').mockReturnValue({
      getContext: jest.fn().mockReturnValue({ from: { id: userId } }),
    } as any);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access if userId is not in allowedChatIds', async () => {
    const userId = 999;
    mockSettingsService.get.mockResolvedValue([123, 456]);

    const context = {
      getType: jest.fn().mockReturnValue('telegraf'),
    } as unknown as ExecutionContext;

    jest.spyOn(TelegrafExecutionContext, 'create').mockReturnValue({
      getContext: jest.fn().mockReturnValue({ from: { id: userId } }),
    } as any);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should deny access if userId is missing', async () => {
    mockSettingsService.get.mockResolvedValue([123, 456]);

    const context = {
      getType: jest.fn().mockReturnValue('telegraf'),
    } as unknown as ExecutionContext;

    jest.spyOn(TelegrafExecutionContext, 'create').mockReturnValue({
      getContext: jest.fn().mockReturnValue({ from: {} }),
    } as any);

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });
});
