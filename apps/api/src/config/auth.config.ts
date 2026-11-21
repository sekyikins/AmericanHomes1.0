import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  otpProviderUrl: process.env.OTP_PROVIDER_URL ?? '',
  otpApiKey: process.env.OTP_API_KEY ?? '',
}));
