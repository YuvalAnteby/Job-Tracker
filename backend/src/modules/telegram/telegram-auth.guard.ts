import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafContext = TelegrafExecutionContext.create(context);
    const ctx = telegrafContext.getContext<Context>();
    
    const allowedChatIds = await this.settingsService.get<number[]>(
      'telegram_allowed_chat_ids',
      [],
    );
    
    const userId = ctx.from?.id;

    if (userId && allowedChatIds.includes(userId)) {
      return true;
    }

    this.logger.warn(`Unauthorized access attempt from ID: ${userId}`);
    // Returning false will prevent the handler from being called.
    // In nestjs-telegraf, this silently ignores the update.
    return false;
  }
}
