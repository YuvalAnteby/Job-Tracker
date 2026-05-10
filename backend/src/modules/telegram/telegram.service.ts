import { Update, Start, Help, Command } from 'nestjs-telegraf';
import { Context, Scenes } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from './telegram-auth.guard';

@Update()
@UseGuards(TelegramAuthGuard)
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  @Start()
  async onStart(ctx: Context): Promise<void> {
    await ctx.reply(
      '👋 Welcome to Job Tracker Bot!\n\nI can help you manage your job search directly from Telegram. Use /help to see all available commands.',
    );
  }

  @Help()
  async onHelp(ctx: Context): Promise<void> {
    const helpMessage = `
🛠️ *Available Commands:*

/start - Welcome message
/help - Show this help message
/add - Start adding a new job (multi-step)
/jobs [n] - List last n jobs (default 5)
/applicable - List jobs marked as applicable
/gap [domain] - Trigger gap summary generation
/status <id_prefix> - Get status of a specific job
    `;
    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  @Command('add')
  async onAdd(ctx: Scenes.SceneContext): Promise<void> {
    await ctx.scene.enter('ADD_JOB_WIZARD');
  }
}
