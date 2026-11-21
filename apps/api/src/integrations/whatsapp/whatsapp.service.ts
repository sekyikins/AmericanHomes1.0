import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  async sendTemplate(to: string, templateName: string, params: Record<string, string>) {
    const _phoneId = this.config.get<string>('integrations.whatsappPhoneId');
    this.logger.log(`sendTemplate stub to=${to} template=${templateName}`);
    return { sent: true, params };
  }
}
