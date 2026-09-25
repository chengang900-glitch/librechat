import path from 'path';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';

export type PortalUpload = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const allowedFormats = new Set(['jpeg', 'png', 'webp']);
const safeIconName = /^[0-9a-f-]{36}\.webp$/i;

export class PortalIconError extends Error {
  readonly status = 400;
}

export async function savePortalIcon(file: PortalUpload, iconDir: string): Promise<string> {
  if (file.size > 1_048_576) {
    throw new PortalIconError('Icon must not exceed 1 MB');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    throw new PortalIconError('Icon must be PNG, JPEG, or WebP');
  }

  let output: Buffer;
  try {
    const image = sharp(file.buffer, { failOn: 'error' });
    const metadata = await image.metadata();
    if (!metadata.format || !allowedFormats.has(metadata.format)) {
      throw new PortalIconError('Icon content is not a supported raster image');
    }
    output = await image
      .rotate()
      .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  } catch (error) {
    if (error instanceof PortalIconError) {
      throw error;
    }
    throw new PortalIconError('Icon content is not a supported raster image');
  }
  const fileName = `${randomUUID()}.webp`;
  await fs.mkdir(iconDir, { recursive: true });
  await fs.writeFile(path.join(iconDir, fileName), output, { flag: 'wx' });
  return fileName;
}

export async function removePortalIcon(
  iconRef: string | undefined,
  iconDir: string,
): Promise<void> {
  if (!iconRef || !safeIconName.test(iconRef)) {
    return;
  }
  try {
    await fs.unlink(path.join(iconDir, iconRef));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
