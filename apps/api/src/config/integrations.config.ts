import { registerAs } from '@nestjs/config';

export const integrationsConfig = registerAs('integrations', () => ({
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? '',
  whatsappToken: process.env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID ?? '',
  whatsappWebhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET ?? '',
  evatBaseUrl: process.env.GRA_EVAT_BASE_URL ?? '',
  evatApiKey: process.env.GRA_EVAT_API_KEY ?? '',
  evatTin: process.env.GRA_EVAT_TIN ?? '',
  evatBusinessName: process.env.GRA_EVAT_BUSINESS_NAME ?? 'AmericanHomes Ltd',
  evatBusinessAddress: process.env.GRA_EVAT_BUSINESS_ADDRESS ?? 'Tema Warehouse Showroom, Ghana',
}));
