import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const ALLOWED_UPLOAD_FOLDERS = [
  'products',
  'requests',
  'returns',
  'receipts',
  'incidents',
  'evidence',
] as const;

export const ALLOWED_UPLOAD_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
] as const;

export class UploadEvidenceDto {
  @ApiProperty({ enum: ALLOWED_UPLOAD_FOLDERS })
  @IsString()
  @IsIn(ALLOWED_UPLOAD_FOLDERS)
  folder!: (typeof ALLOWED_UPLOAD_FOLDERS)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  filename!: string;

  @ApiProperty({ enum: ALLOWED_UPLOAD_MIMETYPES })
  @IsString()
  @IsIn(ALLOWED_UPLOAD_MIMETYPES)
  mimetype!: (typeof ALLOWED_UPLOAD_MIMETYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  base64!: string;
}
