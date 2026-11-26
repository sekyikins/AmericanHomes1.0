import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const token = (this.config.get<string>('integrations.whatsappToken') ?? '').trim();
    const phoneId = (this.config.get<string>('integrations.whatsappPhoneId') ?? '').trim();
    if (!token || !phoneId) return false;
    if (/your[_-]|placeholder|changeme/i.test(token) || /your[_-]|placeholder|changeme/i.test(phoneId)) {
      return false;
    }
    return true;
  }

  async sendTemplate(
    to: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<{ sent: boolean; messageId?: string; reason?: string; params: Record<string, string> }> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `WhatsApp Cloud API not configured — message to ***${to.slice(-4)} (${templateName}) not sent`,
      );
      return { sent: false, reason: 'WHATSAPP_NOT_CONFIGURED', params };
    }

    const token = (this.config.get<string>('integrations.whatsappToken') ?? '').trim();
    const phoneId = (this.config.get<string>('integrations.whatsappPhoneId') ?? '').trim();
    const cleanTo = to.replace(/[^\d]/g, '');

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanTo,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: Object.keys(params).length
              ? [
                  {
                    type: 'body',
                    parameters: Object.values(params).map((text) => ({ type: 'text', text })),
                  },
                ]
              : undefined,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        const reason = json.error?.message ?? `WhatsApp API HTTP ${res.status}`;
        this.logger.error(`WhatsApp send failed to ***${cleanTo.slice(-4)}: ${reason}`);
        return { sent: false, reason, params };
      }
      return { sent: true, messageId: json.messages?.[0]?.id, params };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'WhatsApp network error';
      this.logger.error(`WhatsApp network error to ***${cleanTo.slice(-4)}: ${reason}`);
      return { sent: false, reason, params };
    }
  }
}
