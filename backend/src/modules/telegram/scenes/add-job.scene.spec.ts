import { Test, TestingModule } from '@nestjs/testing';
import { AddJobScene } from './add-job.scene';
import { JobsService } from '../../jobs/jobs.service';
import { LlmService } from '../../llm/llm.service';
import { Scenes } from 'telegraf';

describe('AddJobScene', () => {
  let scene: AddJobScene;
  let jobsService: JobsService;
  let llmService: LlmService;

  const mockJobsService = {
    create: jest.fn(),
  };

  const mockLlmService = {
    extractTextFromImage: jest.fn(),
  };

  const mockContext = {
    reply: jest.fn(),
    wizard: {
      state: {},
      next: jest.fn(),
    },
    scene: {
      leave: jest.fn(),
    },
    message: {
      text: 'test',
    },
  } as unknown as Scenes.WizardContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddJobScene,
        { provide: JobsService, useValue: mockJobsService },
        { provide: LlmService, useValue: mockLlmService },
      ],
    }).compile();

    scene = module.get<AddJobScene>(AddJobScene);
    jobsService = module.get<JobsService>(JobsService);
    llmService = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(scene).toBeDefined();
  });

  it('onEnter should reply with welcome message', async () => {
    await scene.onEnter(mockContext);
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining('Starting job addition flow'),
    );
  });

  it('onUrl should save url and call next', async () => {
    const ctx = {
      ...mockContext,
      message: { text: 'https://google.com' },
      wizard: { state: {}, next: jest.fn() },
    } as any;
    await scene.onUrl(ctx);
    expect(ctx.wizard.state.url).toBe('https://google.com');
    expect(ctx.wizard.next).toHaveBeenCalled();
  });

  it('onDescription should save text description and call next', async () => {
    const ctx = {
      ...mockContext,
      message: { text: 'Job description' },
      wizard: { state: {}, next: jest.fn() },
    } as any;
    await scene.onDescription(ctx);
    expect(ctx.wizard.state.description).toBe('Job description');
    expect(ctx.wizard.next).toHaveBeenCalled();
  });
});
