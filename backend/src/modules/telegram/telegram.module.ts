import { Module, forwardRef } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { SettingsModule } from '../settings/settings.module';
import { JobsModule } from '../jobs/jobs.module';
import { LlmModule } from '../llm/llm.module';
import { GapModule } from '../gap/gap.module';
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
    forwardRef(() => GapModule),
  ],
  providers: [TelegramService, TelegramAuthGuard, AddJobScene],
  exports: [TelegramService],
})
export class TelegramModule {}
