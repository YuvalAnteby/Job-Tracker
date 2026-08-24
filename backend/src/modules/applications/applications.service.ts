import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { Job } from '../jobs/entities/job.entity';
import { ApplicationStage } from '../jobs/enums/application-stage.enum';
import { ScheduleApplicationActionDto } from './dto/application-action.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  ApplicationAction,
  ApplicationActionState,
} from './entities/application-action.entity';
import {
  ApplicationActionEvent,
  ApplicationActionEventType,
} from './entities/application-action-event.entity';
import {
  ReminderDelivery,
  ReminderDeliveryStatus,
} from './entities/reminder-delivery.entity';
import {
  ApplicationAnalytics,
  calculateApplicationAnalytics,
} from './application-analytics';

export interface AttentionItem {
  action: ApplicationAction;
  job: Pick<Job, 'id' | 'company_name' | 'title' | 'application_stage'>;
}

@Injectable()
export class ApplicationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApplicationsService.name);
  private poller?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(ApplicationAction)
    private readonly actionRepository: Repository<ApplicationAction>,
    @InjectRepository(ApplicationActionEvent)
    private readonly eventRepository: Repository<ApplicationActionEvent>,
    @InjectRepository(ReminderDelivery)
    private readonly deliveryRepository: Repository<ReminderDelivery>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    const poll = (): void => {
      void this.deliverDueReminders().catch((error: unknown) =>
        this.logger.error(
          `Reminder polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    };
    poll();
    this.poller = setInterval(poll, 60_000);
  }

  onModuleDestroy(): void {
    if (this.poller) clearInterval(this.poller);
  }

  async schedule(
    jobId: string,
    input: ScheduleApplicationActionDto,
  ): Promise<ApplicationAction> {
    const defaultDays = await this.settingsService.get<number>(
      'reminder_default_days',
      3,
    );
    const dueAt =
      input.due_at ?? new Date(Date.now() + defaultDays * 86_400_000);
    return this.dataSource.transaction(async (manager) => {
      if (!(await manager.getRepository(Job).existsBy({ id: jobId }))) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }
      const actions = manager.getRepository(ApplicationAction);
      let action = await actions.findOne({
        where: { job_id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      const eventType = action
        ? ApplicationActionEventType.RESCHEDULED
        : ApplicationActionEventType.SCHEDULED;
      if (action) {
        action.label = input.label;
        action.due_at = dueAt;
        action.state = ApplicationActionState.ACTIVE;
        action.revision += 1;
      } else {
        action = actions.create({
          job_id: jobId,
          label: input.label,
          due_at: dueAt,
          state: ApplicationActionState.ACTIVE,
          revision: 1,
        });
      }
      action = await actions.save(action);
      await manager.getRepository(ApplicationActionEvent).save(
        manager.getRepository(ApplicationActionEvent).create({
          action_id: action.id,
          event_type: eventType,
          label: action.label,
          due_at: action.due_at,
          revision: action.revision,
        }),
      );
      return action;
    });
  }

  async reschedule(jobId: string, dueAt: Date): Promise<ApplicationAction> {
    const action = await this.getAction(jobId);
    return this.schedule(jobId, { label: action.label, due_at: dueAt });
  }

  async complete(jobId: string): Promise<ApplicationAction> {
    return this.finish(jobId, ApplicationActionState.COMPLETED);
  }

  async dismiss(jobId: string): Promise<ApplicationAction> {
    return this.finish(jobId, ApplicationActionState.DISMISSED);
  }

  async history(jobId: string): Promise<ApplicationActionEvent[]> {
    const action = await this.getAction(jobId);
    return this.eventRepository.find({
      where: { action_id: action.id },
      order: { occurred_at: 'ASC' },
    });
  }

  async attention(now = new Date()): Promise<{
    overdue: AttentionItem[];
    due_today: AttentionItem[];
    upcoming: AttentionItem[];
    timezone: string;
  }> {
    const timezone = await this.settingsService.get<string>(
      'reminder_timezone',
      'Asia/Jerusalem',
    );
    const actions = await this.actionRepository.find({
      where: { state: ApplicationActionState.ACTIVE },
      relations: ['job'],
      order: { due_at: 'ASC' },
    });
    const localDay = (date: Date): string =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    const today = localDay(now);
    const item = (action: ApplicationAction): AttentionItem => ({
      action,
      job: {
        id: action.job.id,
        company_name: action.job.company_name,
        title: action.job.title,
        application_stage: action.job.application_stage,
      },
    });
    return {
      overdue: actions.filter((action) => action.due_at < now).map(item),
      due_today: actions
        .filter(
          (action) => action.due_at >= now && localDay(action.due_at) === today,
        )
        .map(item),
      upcoming: actions
        .filter(
          (action) => action.due_at >= now && localDay(action.due_at) !== today,
        )
        .map(item),
      timezone,
    };
  }

  async analytics(filters: AnalyticsQueryDto): Promise<ApplicationAnalytics> {
    const jobs = await this.jobRepository.find({
      relations: ['application_events'],
      order: { application_events: { occurred_at: 'ASC' } },
    });
    return calculateApplicationAnalytics(jobs, filters);
  }

  async exportCsv(filters: AnalyticsQueryDto): Promise<string> {
    const jobs = await this.jobRepository.find({
      relations: ['application_events'],
    });
    const matching = jobs.filter((job) => {
      if (!job.applied_at) return false;
      if (filters.from && job.applied_at < filters.from) return false;
      if (filters.to && job.applied_at > filters.to) return false;
      if (filters.domain && job.effective_domain !== filters.domain)
        return false;
      if (
        filters.classification &&
        job.effective_classification !== filters.classification
      )
        return false;
      const source =
        job.application_events.find(
          (event) => event.new_stage === ApplicationStage.APPLIED,
        )?.source ?? 'UNKNOWN';
      return !filters.source || source === filters.source;
    });
    const csv = (value: string | number | null | undefined): string =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [
      [
        'company',
        'role',
        'source',
        'applied_at',
        'stage',
        'domain',
        'classification',
        'score',
        'recommendation',
      ],
      ...matching.map((job) => [
        job.company_name,
        job.title,
        job.application_events.find(
          (event) => event.new_stage === ApplicationStage.APPLIED,
        )?.source ?? 'UNKNOWN',
        job.applied_at?.toISOString(),
        job.application_stage,
        job.effective_domain,
        job.effective_classification,
        job.effective_score,
        job.recommendation,
      ]),
    ]
      .map((row) => row.map(csv).join(','))
      .join('\n');
  }

  async deliverDueReminders(now = new Date()): Promise<void> {
    if (!(await this.settingsService.get<boolean>('reminders_enabled', true)))
      return;
    const chatIds = await this.settingsService.get<number[]>(
      'telegram_allowed_chat_ids',
      [],
    );
    if (!chatIds.length) return;
    const actions = await this.actionRepository.find({
      where: {
        state: ApplicationActionState.ACTIVE,
        due_at: LessThanOrEqual(now),
      },
      relations: ['job'],
    });
    for (const action of actions) {
      for (const chatId of chatIds) {
        try {
          await this.deliver(action, chatId);
        } catch (error: unknown) {
          this.logger.error(
            `Could not persist reminder delivery for action ${action.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    }
  }

  private async deliver(
    action: ApplicationAction,
    chatId: number,
  ): Promise<void> {
    let delivery = await this.deliveryRepository.findOne({
      where: {
        action_id: action.id,
        action_revision: action.revision,
        chat_id: String(chatId),
      },
    });
    if (delivery?.status === ReminderDeliveryStatus.SENT) return;
    if (!delivery) {
      try {
        delivery = await this.deliveryRepository.save(
          this.deliveryRepository.create({
            action_id: action.id,
            action_revision: action.revision,
            chat_id: String(chatId),
            status: ReminderDeliveryStatus.FAILED,
            attempts: 0,
            last_error: null,
          }),
        );
      } catch (error: unknown) {
        // Another poller claimed this due state through the unique constraint.
        if (
          await this.deliveryRepository.findOne({
            where: {
              action_id: action.id,
              action_revision: action.revision,
              chat_id: String(chatId),
            },
          })
        )
          return;
        throw error;
      }
    }
    try {
      await this.telegramService.sendAllowedMessage(
        chatId,
        `Reminder: ${action.label}\n${action.job.company_name}, ${action.job.title}`,
      );
      delivery.status = ReminderDeliveryStatus.SENT;
      delivery.last_error = null;
    } catch (error: unknown) {
      delivery.status = ReminderDeliveryStatus.FAILED;
      delivery.last_error =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Delivery failed';
      this.logger.warn(`Reminder delivery failed for action ${action.id}`);
    }
    delivery.attempts += 1;
    await this.deliveryRepository.save(delivery);
  }

  private async finish(
    jobId: string,
    state: ApplicationActionState.COMPLETED | ApplicationActionState.DISMISSED,
  ): Promise<ApplicationAction> {
    return this.dataSource.transaction(async (manager) => {
      const actions = manager.getRepository(ApplicationAction);
      const action = await actions.findOne({
        where: { job_id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!action)
        throw new NotFoundException('No action is scheduled for this job');
      if (action.state !== ApplicationActionState.ACTIVE)
        throw new BadRequestException('The action is no longer active');
      action.state = state;
      action.revision += 1;
      await actions.save(action);
      await manager.getRepository(ApplicationActionEvent).save(
        manager.getRepository(ApplicationActionEvent).create({
          action_id: action.id,
          event_type:
            state === ApplicationActionState.COMPLETED
              ? ApplicationActionEventType.COMPLETED
              : ApplicationActionEventType.DISMISSED,
          label: action.label,
          due_at: action.due_at,
          revision: action.revision,
        }),
      );
      return action;
    });
  }

  private async getAction(jobId: string): Promise<ApplicationAction> {
    const action = await this.actionRepository.findOne({
      where: { job_id: jobId },
    });
    if (!action)
      throw new NotFoundException('No action is scheduled for this job');
    return action;
  }
}
