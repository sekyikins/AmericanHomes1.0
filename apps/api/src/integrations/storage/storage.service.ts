import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  private getCredentials(bucket?: string) {
    const supabaseUrl = (this.config.get<string>('storage.supabaseUrl') ?? '').replace(/\/+$/, '');
    const serviceKey = this.config.get<string>('storage.supabaseServiceKey') ?? '';
    const targetBucket = bucket ?? this.config.get<string>('storage.bucket') ?? 'AmericanHomes';

    if (!supabaseUrl || !serviceKey) {
      throw new InternalServerErrorException('Supabase Storage credentials are not configured');
    }

    return { supabaseUrl, serviceKey, targetBucket };
  }

  private normalizePath(path: string): string {
    return path.replace(/^\/+/, '');
  }

  async uploadFile(
    path: string,
    buffer: Buffer,
    mimetype: string,
    bucket?: string,
  ): Promise<{ path: string; bucket: string; publicUrl: string }> {
    const { supabaseUrl, serviceKey, targetBucket } = this.getCredentials(bucket);
    const objectPath = this.normalizePath(path);

    const res = await fetch(`${supabaseUrl}/storage/v1/object/${targetBucket}/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': mimetype,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Supabase upload failed (${res.status}): ${text}`);
      throw new InternalServerErrorException('Failed to upload file to Supabase Storage');
    }

    return {
      bucket: targetBucket,
      path: objectPath,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${objectPath}`,
    };
  }

  async getSignedUrl(path: string, expiresIn = 3600, bucket?: string): Promise<string> {
    const { supabaseUrl, serviceKey, targetBucket } = this.getCredentials(bucket);
    const objectPath = this.normalizePath(path);

    const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${targetBucket}/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Supabase sign failed (${res.status}): ${text}`);
      throw new InternalServerErrorException('Failed to create signed storage URL');
    }

    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) {
      throw new InternalServerErrorException('Supabase Storage did not return a signed URL');
    }

    return `${supabaseUrl}/storage/v1${data.signedURL}`;
  }

  getPublicUrl(path: string, bucket?: string): string {
    const { supabaseUrl, targetBucket } = this.getCredentials(bucket);
    return `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${this.normalizePath(path)}`;
  }

  async deleteFile(path: string, bucket?: string): Promise<void> {
    const { supabaseUrl, serviceKey, targetBucket } = this.getCredentials(bucket);
    const objectPath = this.normalizePath(path);

    const res = await fetch(`${supabaseUrl}/storage/v1/object/${targetBucket}/${objectPath}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Supabase delete failed (${res.status}): ${text}`);
      throw new InternalServerErrorException('Failed to delete file from Supabase Storage');
    }
  }
}
