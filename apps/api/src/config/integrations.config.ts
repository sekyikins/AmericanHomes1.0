import { registerAs } from '@nestjs/config';

export const integrationsConfig = registerAs('integrations', () => ({
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? '',
  whatsappToken: process.env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID ?? '',
  whatsappWebhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET ?? '',
}));
