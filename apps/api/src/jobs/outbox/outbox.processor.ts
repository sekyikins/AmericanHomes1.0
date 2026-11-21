import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from '../../integrations/whatsapp/whatsapp.service';

// Polls PostgreSQL outbox table per ADR 007 & ADR 011 (no Redis initially).
@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Interval(5000)
  async processOutbox(): Promise<void> {
    if (!process.env.DATABASE_URL) return;
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING' },
      take: 50,
    });
    for (const event of events) {
      try {
        if (event.eventType.startsWith('whatsapp.')) {
          const payload = event.payload as {
            phone?: string;
            template?: string;
            params?: Record<string, string>;
          };
          if (payload.phone && payload.template) {
            await this.whatsapp.sendTemplate(
              payload.phone,
              payload.template,
              payload.params ?? {},
            );
            await this.prisma.notificationDeliveryAttempt.create({
              data: {
                channel: 'WHATSAPP',
                recipient: payload.phone,
                status: 'SENT',
                providerRef: event.id,
              },
            });
          }
        }
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'DELIVERED', processedAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Outbox event ${event.id} failed`, err);
        const payload = event.payload as { phone?: string };
        if (event.eventType.startsWith('whatsapp.') && payload?.phone) {
          await this.prisma.notificationDeliveryAttempt
            .create({
              data: {
                channel: 'WHATSAPP',
                recipient: payload.phone,
                status: 'FAILED',
                errorMessage: String(err),
              },
            })
            .catch(() => {});
        }
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { attempts: { increment: 1 }, lastError: String(err) },
        });
      }
    }
  }
}
