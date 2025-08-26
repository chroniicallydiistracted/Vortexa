import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './index';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Mock S3 client behavior: first Get fails (cache miss), second succeeds.
class FakeBody {
  constructor(private data: Buffer) {}
  pipe(res: any) {
    res.end(this.data);
  }
}
let stored: { key: string; body: Buffer; contentType?: string } | null = null;

class FakeS3 extends S3Client {
  constructor() {
    super({});
  }
  send(cmd: any) {
    if (cmd instanceof GetObjectCommand) {
      if (!stored || stored.key !== cmd.input.Key) return Promise.reject(new Error('NoSuchKey'));
      return Promise.resolve({
        Body: new FakeBody(stored.body),
        ContentType: stored.contentType,
      });
    }
    if (cmd instanceof PutObjectCommand) {
      stored = {
        key: cmd.input.Key as string,
        body: cmd.input.Body as Buffer,
        contentType: cmd.input.ContentType,
      };
      return Promise.resolve({});
    }
    return Promise.resolve({});
  }
}

// Mock fetch for upstream
vi.mock('undici', () => ({
  fetch: vi.fn(async (_url: string) => ({
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => Buffer.from('PNGDATA'),
  })),
}));

describe('proxy cache flow', () => {
  const app = createApp({
    allowHosts: ['example.com'],
    s3Bucket: 'cache-bkt',
    s3Client: new FakeS3() as any,
  });
  const target = 'https://example.com/tiles/1/2/3.png';
  it('miss then hit', async () => {
    const miss = await request(app).get('/proxy').query({ url: target });
    expect(miss.status).toBe(200);
    expect(stored).not.toBeNull();
    const hit = await request(app).get('/proxy').query({ url: target });
    expect(hit.status).toBe(200);
  });
});
