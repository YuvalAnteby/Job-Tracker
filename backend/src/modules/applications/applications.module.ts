import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationAction } from './entities/application-action.entity';
import { ApplicationActionEvent } from './entities/application-action-event.entity';
import { ReminderDelivery } from './entities/reminder-delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      ApplicationAction,
      ApplicationActionEvent,
      ReminderDelivery,
    ]),
    SettingsModule,
    forwardRef(() => TelegramModule),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
