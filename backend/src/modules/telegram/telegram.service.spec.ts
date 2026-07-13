import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { Context } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';
import { JobsService } from '../jobs/jobs.service';
import { GapService } from '../gap/gap.service';

describe('TelegramService', () => {
  let service: TelegramService;

  const mockSettingsService = {
    get: jest.fn(),
  };

  const mockContext = {
    reply: jest.fn(),
  } as unknown as Context;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: getBotToken(), useValue: {} },
        { provide: JobsService, useValue: { findAll: jest.fn() } },
        { provide: GapService, useValue: {} },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    })
      .overrideGuard(TelegramAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onStart', () => {
    it('should reply with welcome message', async () => {
      await service.onStart(mockContext);
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Job Tracker Bot'),
      );
    });
  });

  describe('onHelp', () => {
    it('should reply with help message', async () => {
      await service.onHelp(mockContext);
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Available Commands'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });
  });
});
