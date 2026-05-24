import { Wizard, WizardStep, SceneEnter } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';
import { JobsService } from '../../jobs/jobs.service';
import { LlmService } from '../../llm/llm.service';
import { Logger } from '@nestjs/common';
import { MetStatus } from '../../jobs/enums/met-status.enum';

@Wizard('ADD_JOB_WIZARD')
export class AddJobScene {
  private readonly logger = new Logger(AddJobScene.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly llmService: LlmService,
  ) {}

  @SceneEnter()
  async onEnter(ctx: Scenes.WizardContext): Promise<void> {
    await ctx.reply('🚀 Starting job addition flow.\n\nSend me the job URL:');
  }

  @WizardStep(1)
  async onUrl(ctx: Scenes.WizardContext): Promise<void> {
    const message = ctx.message as any;
    if (!message || !message.text) {
      await ctx.reply('Please send a valid URL.');
      return;
    }
    const url = message.text;
    if (!url.startsWith('http')) {
      await ctx.reply('Please send a valid URL starting with http/https.');
      return;
    }
    (ctx.wizard.state as any).url = url;
    await ctx.reply('Now paste the job description (or send a screenshot):');
    ctx.wizard.next();
  }

  @WizardStep(2)
  async onDescription(ctx: Scenes.WizardContext): Promise<void> {
    const message = ctx.message as any;

    if (message?.text) {
      (ctx.wizard.state as any).description = message.text;
    } else if (message?.photo) {
      await ctx.reply('⏳ Extracting text from image...');
      const fileId = message.photo[message.photo.length - 1].file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      
      try {
        const response = await fetch(fileLink.toString());
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const extractedText = await this.llmService.extractTextFromImage(base64);
        (ctx.wizard.state as any).description = extractedText;
        await ctx.reply('✅ Text extracted successfully.');
      } catch (error) {
        this.logger.error(`Failed to extract text from image: ${error}`);
        await ctx.reply('❌ Failed to extract text from image. Please paste the description manually.');
        return;
      }
    } else {
      await ctx.reply('Please send text or a photo.');
      return;
    }

    await ctx.reply('Company name? (or type "skip" to let me extract it)');
    ctx.wizard.next();
  }

  @WizardStep(3)
  async onCompany(ctx: Scenes.WizardContext): Promise<void> {
    const message = ctx.message as any;
    if (!message || !message.text) {
      await ctx.reply('Please send the company name or "skip".');
      return;
    }
    (ctx.wizard.state as any).company_name = message.text;
    await ctx.reply('Job title? (or type "skip")');
    ctx.wizard.next();
  }

  @WizardStep(4)
  async onTitle(ctx: Scenes.WizardContext): Promise<void> {
    const message = ctx.message as any;
    if (!message || !message.text) {
      await ctx.reply('Please send the job title or "skip".');
      return;
    }
    (ctx.wizard.state as any).title = message.text;

    await ctx.reply('⏳ Analyzing job posting. This may take a few seconds...');

    try {
      const state = ctx.wizard.state as any;
      const job = await this.jobsService.create({
        url: state.url,
        description: state.description,
        company_name: state.company_name,
        title: state.title,
      });

      const missingRequirements = job.requirements
        .filter((r) => r.met_status === MetStatus.NOT_MET)
        .map((r) => r.name)
        .slice(0, 5)
        .join(', ');

      const response = `
✅ <b>Added Successfully!</b>

🏢 <b>Company:</b> ${job.company_name}
📝 <b>Title:</b> ${job.title}
⭐ <b>Score:</b> ${job.llm_score}/100
🌐 <b>Domain:</b> ${job.domain}
✅ <b>Applicable:</b> ${job.llm_is_applicable ? 'YES' : 'NO'}

🔴 <b>Top Gaps:</b> ${missingRequirements || 'None identified'}

🔗 <a href="${job.url}">View Job Posting</a>
📊 <a href="${process.env.FRONTEND_URL || 'http://yuval-pc:5173'}/">Open Job Tracker Dashboard</a>
      `;

      await ctx.reply(response, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Failed to create job: ${error}`);
      await ctx.reply(`❌ Failed to add job: ${error.message || 'Unknown error'}`);
    }

    await ctx.scene.leave();
  }
}
