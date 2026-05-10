import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { SettingsModule } from '../settings/settings.module';
import { JobsModule } from '../jobs/jobs.module';
import { LlmModule } from '../llm/llm.module';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { AddJobScene } from './scenes/add-job.scene';

import { session } from 'telegraf';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
        middlewares: [session()],
      }),
    }),
    SettingsModule,
    JobsModule,
    LlmModule,
  ],
  providers: [TelegramService, TelegramAuthGuard, AddJobScene],
})
export class TelegramModule {}
