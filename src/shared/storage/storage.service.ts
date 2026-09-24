import { injectable } from 'tsyringe';
import { uploadImageBuffer, uploadImageBase64 } from '../utils/cloudinary.js';

const MAX_BASE64_BYTES = 2 * 1024 * 1024;

function assertSupportedImage(buffer: Buffer): void {
  const png = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const jpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const webp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpg && !webp) {
    throw new Error('Invalid image content. Allowed: jpg, jpeg, png, webp.');
  }
}

@injectable()
export class StorageService {
  async uploadBuffer(buffer: Buffer, folder: string): Promise<string> {
    assertSupportedImage(buffer);
    return uploadImageBuffer(buffer, folder);
  }

  async uploadBase64Maybe(base64OrUrl: string | null | undefined, folder: string): Promise<string | null> {
    if (!base64OrUrl) return null;
    if (!base64OrUrl.startsWith('data:')) return base64OrUrl;
    const commaIdx = base64OrUrl.indexOf(',');
    const b64 = commaIdx >= 0 ? base64OrUrl.slice(commaIdx + 1) : base64OrUrl;
    const approxBytes = Math.floor((b64.length * 3) / 4);
    if (approxBytes > MAX_BASE64_BYTES) {
      throw new Error('Image too large. Maximum size is 2MB.');
    }
    return uploadImageBase64(base64OrUrl, folder);
  }
}
