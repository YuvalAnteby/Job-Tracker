import { DataSource, Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { ApplicationStage } from '../jobs/enums/application-stage.enum';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { ApplicationsService } from './applications.service';
import {
  ApplicationAction,
  ApplicationActionState,
} from './entities/application-action.entity';
import { ApplicationActionEvent } from './entities/application-action-event.entity';
import {
  ReminderDelivery,
  ReminderDeliveryStatus,
} from './entities/reminder-delivery.entity';

describe('ApplicationsService reminders', () => {
  const due = new Date('2026-07-14T08:00:00Z');
  const action = Object.assign(new ApplicationAction(), {
    id: 'action-1',
    job_id: 'job-1',
    label: 'Follow up',
    due_at: due,
    state: ApplicationActionState.ACTIVE,
    revision: 1,
    job: {
      id: 'job-1',
      company_name: 'Acme',
      title: 'Engineer',
      application_stage: ApplicationStage.APPLIED,
    },
  });
  let deliveries: ReminderDelivery[];
  let sendAllowedMessage: jest.Mock;
  let service: ApplicationsService;

  beforeEach(() => {
    deliveries = [];
    sendAllowedMessage = jest.fn().mockResolvedValue(undefined);
    const actionRepository = {
      find: jest.fn().mockResolvedValue([action]),
    } as unknown as Repository<ApplicationAction>;
    const deliveryRepository = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: Partial<ReminderDelivery> }) =>
          Promise.resolve(
            deliveries.find(
              (item) =>
                item.action_id === where.action_id &&
                item.action_revision === where.action_revision &&
                item.chat_id === where.chat_id,
            ) ?? null,
          ),
        ),
      create: jest.fn((value: ReminderDelivery) =>
        Object.assign(new ReminderDelivery(), value),
      ),
      save: jest.fn((value: ReminderDelivery) => {
        const index = deliveries.findIndex((item) => item === value);
        if (index === -1) deliveries.push(value);
        return Promise.resolve(value);
      }),
    } as unknown as Repository<ReminderDelivery>;
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'reminders_enabled' ? true : [123]),
      ),
    } as unknown as SettingsService;
    service = new ApplicationsService(
      actionRepository,
      {} as Repository<ApplicationActionEvent>,
      deliveryRepository,
      {} as Repository<Job>,
      settings,
      { sendAllowedMessage } as unknown as TelegramService,
      {} as DataSource,
    );
  });

  it('sends once per action revision and chat', async () => {
    await service.deliverDueReminders(new Date('2026-07-14T09:00:00Z'));
    await service.deliverDueReminders(new Date('2026-07-14T09:01:00Z'));
    expect(sendAllowedMessage).toHaveBeenCalledTimes(1);
    expect(deliveries[0]).toMatchObject({
      status: ReminderDeliveryStatus.SENT,
      attempts: 1,
    });
  });

  it('records failures and retries them', async () => {
    sendAllowedMessage
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    await service.deliverDueReminders(new Date('2026-07-14T09:00:00Z'));
    expect(deliveries[0].status).toBe(ReminderDeliveryStatus.FAILED);
    await service.deliverDueReminders(new Date('2026-07-14T09:01:00Z'));
    expect(deliveries[0]).toMatchObject({
      status: ReminderDeliveryStatus.SENT,
      attempts: 2,
    });
  });

  it('groups due dates using the configured timezone', async () => {
    const actionRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { ...action, due_at: new Date('2026-07-14T20:45:00Z') },
        ]),
    } as unknown as Repository<ApplicationAction>;
    const settings = {
      get: jest.fn().mockResolvedValue('Asia/Jerusalem'),
    } as unknown as SettingsService;
    const timezoneService = new ApplicationsService(
      actionRepository,
      {} as Repository<ApplicationActionEvent>,
      {} as Repository<ReminderDelivery>,
      {} as Repository<Job>,
      settings,
      {} as TelegramService,
      {} as DataSource,
    );
    const result = await timezoneService.attention(
      new Date('2026-07-14T20:30:00Z'),
    );
    expect(result.due_today).toHaveLength(1);
    expect(result.timezone).toBe('Asia/Jerusalem');
  });

  it('uses the configured delay when scheduling without a due date', async () => {
    const actions = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: Partial<ApplicationAction>) =>
        Object.assign(new ApplicationAction(), value),
      ),
      save: jest.fn((value: ApplicationAction) =>
        Promise.resolve(Object.assign(value, { id: 'action-1' })),
      ),
    };
    const events = {
      create: jest.fn((value: Partial<ApplicationActionEvent>) =>
        Object.assign(new ApplicationActionEvent(), value),
      ),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const jobs = { existsBy: jest.fn().mockResolvedValue(true) };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Job) return jobs;
        if (entity === ApplicationAction) return actions;
        return events;
      }),
    };
    const dataSource = {
      transaction: jest.fn(
        (work: (value: typeof manager) => Promise<ApplicationAction>) =>
          work(manager),
      ),
    } as unknown as DataSource;
    const configuredService = new ApplicationsService(
      {} as Repository<ApplicationAction>,
      {} as Repository<ApplicationActionEvent>,
      {} as Repository<ReminderDelivery>,
      {} as Repository<Job>,
      { get: jest.fn().mockResolvedValue(2) } as unknown as SettingsService,
      {} as TelegramService,
      dataSource,
    );
    const started = Date.now();
    const result = await configuredService.schedule('job-1', {
      label: 'Follow up',
    });
    expect(result.due_at.getTime()).toBeGreaterThanOrEqual(
      started + 2 * 86_400_000,
    );
    expect(events.save).toHaveBeenCalled();
  });
});
