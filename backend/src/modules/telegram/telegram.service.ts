import { Update, Start, Help, Command, InjectBot } from 'nestjs-telegraf';
import { Context, Scenes, Telegraf } from 'telegraf';
import { UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { JobsService } from '../jobs/jobs.service';
import { GapService } from '../gap/gap.service';
import { SettingsService } from '../settings/settings.service';
import { Domain } from '../jobs/enums/domain.enum';

@Update()
@UseGuards(TelegramAuthGuard)
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly jobsService: JobsService,
    @Inject(forwardRef(() => GapService))
    private readonly gapService: GapService,
    private readonly settingsService: SettingsService,
  ) {}

  @Start()
  async onStart(ctx: Context): Promise<void> {
    await ctx.reply(
      '👋 Welcome to Job Tracker Bot!\n\nI can help you manage your job search directly from Telegram. Use /help to see all available commands.',
    );
  }

  @Help()
  async onHelp(ctx: Context): Promise<void> {
    const helpMessage = `
🛠️ <b>Available Commands:</b>

/start - Welcome message
/help - Show this help message
/add - Start adding a new job (multi-step)
/jobs [n] - List last n jobs (default 5)
/applicable - List jobs marked as applicable
/gap [domain] - Trigger gap summary generation
/status &lt;id_prefix&gt; - Get status of a specific job
    `;
    await ctx.reply(helpMessage, { parse_mode: 'HTML' });
  }

  @Command('add')
  async onAdd(ctx: Scenes.SceneContext): Promise<void> {
    await ctx.scene.enter('ADD_JOB_WIZARD');
  }

  @Command('jobs')
  async onJobs(ctx: Context): Promise<void> {
    const message = this.messageText(ctx);
    const args = message.split(' ');
    const limit = args[1] ? parseInt(args[1], 10) : 5;

    const jobs = await this.jobsService.findAll();
    const recentJobs = jobs.slice(0, isNaN(limit) ? 5 : limit);

    if (recentJobs.length === 0) {
      await ctx.reply('No jobs found.');
      return;
    }

    let response = `📋 <b>Last ${recentJobs.length} Jobs:</b>\n\n`;
    recentJobs.forEach((job) => {
      response += `🏢 <b>${job.company_name}</b> - ${job.title}\n`;
      response += `⭐ Score: ${job.llm_score || 'N/A'} | Status: ${job.status}\n`;
      response += `🆔 <code>${job.id.substring(0, 8)}</code>\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'HTML' });
  }

  @Command('applicable')
  async onApplicable(ctx: Context): Promise<void> {
    const jobs = await this.jobsService.findAll();
    const applicableJobs = jobs.filter((job) => job.llm_is_applicable);

    if (applicableJobs.length === 0) {
      await ctx.reply('No applicable jobs found.');
      return;
    }

    let response = `✅ <b>Applicable Jobs:</b>\n\n`;
    applicableJobs.forEach((job) => {
      response += `🏢 <b>${job.company_name}</b> - ${job.title}\n`;
      response += `⭐ Score: ${job.llm_score} | Domain: ${job.domain}\n`;
      response += `🆔 <code>${job.id.substring(0, 8)}</code>\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'HTML' });
  }

  @Command('gap')
  async onGap(ctx: Context): Promise<void> {
    const message = this.messageText(ctx);
    const args = message.split(' ');
    const domainArg = args[1]?.toUpperCase();

    let domain: Domain | undefined;
    if (domainArg && Object.values(Domain).includes(domainArg as Domain)) {
      domain = domainArg as Domain;
    }

    await this.gapService.generate({ domain_filter: domain });

    await ctx.reply(
      `⏳ Gap analysis enqueued${domain ? ` for <b>${domain}</b>` : ''}. I will notify you when it's ready.`,
      { parse_mode: 'HTML' },
    );
  }

  @Command('status')
  async onStatus(ctx: Context): Promise<void> {
    const message = this.messageText(ctx);
    const args = message.split(' ');
    const prefix = args[1];

    if (!prefix) {
      await ctx.reply('Please provide a job ID prefix (e.g., /status ab12).');
      return;
    }

    const jobs = await this.jobsService.findAll();
    const job = jobs.find((j) => j.id.startsWith(prefix));

    if (!job) {
      await ctx.reply(`No job found starting with "${prefix}".`);
      return;
    }

    const response = `
🏢 <b>${job.company_name}</b> - ${job.title}
⭐ <b>Score:</b> ${job.llm_score || 'N/A'}
🌐 <b>Domain:</b> ${job.domain}
✅ <b>Applicable:</b> ${job.llm_is_applicable ? 'YES' : 'NO'}
📊 <b>Status:</b> ${job.status}
📅 <b>Added:</b> ${job.added_at.toLocaleDateString()}

📝 <b>Summary:</b>
${job.llm_summary || 'No summary available.'}
    `;

    await ctx.reply(response, { parse_mode: 'HTML' });
  }

  async broadcastMessage(message: string): Promise<void> {
    const allowedChatIds = await this.settingsService.get<number[]>(
      'telegram_allowed_chat_ids',
      [],
    );

    if (allowedChatIds.length === 0) {
      this.logger.warn(
        'No allowed chat IDs configured for Telegram notifications.',
      );
      return;
    }

    for (const chatId of allowedChatIds) {
      try {
        await this.bot.telegram.sendMessage(chatId, message, {
          parse_mode: 'HTML',
        });
      } catch (error: unknown) {
        this.logger.error(
          `Failed to send message to chat ${chatId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  async sendAllowedMessage(chatId: number, message: string): Promise<void> {
    const allowedChatIds = await this.settingsService.get<number[]>(
      'telegram_allowed_chat_ids',
      [],
    );
    if (!allowedChatIds.includes(chatId)) {
      throw new Error('Telegram chat is not allow-listed');
    }
    await this.bot.telegram.sendMessage(chatId, message);
  }

  private messageText(ctx: Context): string {
    return ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  }
}
