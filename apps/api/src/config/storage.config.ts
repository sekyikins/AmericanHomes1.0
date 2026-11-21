import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  bucket: process.env.STORAGE_BUCKET ?? 'AmericanHomes',
  prefixes: {
    products: 'products',
    evidence: 'evidence',
    exports: 'exports',
  },
}));
