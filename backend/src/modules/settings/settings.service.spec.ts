import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { Setting } from './entities/setting.entity';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('SettingsService', () => {
  let service: SettingsService;
  let repositoryMock: any;

  beforeEach(async () => {
    repositoryMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(Setting),
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('refreshCv', () => {
    it('should throw BadRequestException if master_cv_url is missing', async () => {
      repositoryMock.findOne.mockResolvedValue(null);
      await expect(service.refreshCv()).rejects.toThrow(BadRequestException);
    });

    it('should fetch and save CV text', async () => {
      const mockUrl = 'https://example.com/cv.txt';
      const mockText = 'Sample CV Content';
      
      repositoryMock.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'master_cv_url') return Promise.resolve({ value: mockUrl });
        return Promise.resolve(null);
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockText),
      });

      repositoryMock.save.mockResolvedValue({});

      const result = await service.refreshCv();

      expect(result.message).toBe('CV refreshed successfully');
      expect(repositoryMock.save).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if fetch fails', async () => {
      repositoryMock.findOne.mockResolvedValue({ value: 'https://example.com/cv.txt' });
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(service.refreshCv()).rejects.toThrow(InternalServerErrorException);
    });
  });
});
