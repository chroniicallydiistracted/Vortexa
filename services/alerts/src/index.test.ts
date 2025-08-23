import { describe, it, expect, vi } from 'vitest';
import { handler } from './index';

// Capture headers passed to fetch
let lastUA: string | undefined;
vi.mock('undici', () => ({
  fetch: vi.fn(async (_url: string, init?: any) => {
    lastUA = init?.headers?.['User-Agent'];
    return {
      json: async () => ({ features: [ { id: 'TEST1' }, { properties: { id: 'TEST2' } } ] })
    } as any;
  })
}));

// Mock AWS SDK DynamoDB client
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class { } }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) },
  PutCommand: class { constructor(public input: any){} }
}));

describe('alerts handler', () => {
  it('ingests features and sets custom User-Agent', async () => {
    process.env.TABLE = 'dummy';
    process.env.NWS_USER_AGENT = 'WestFamWeather/1.0 (admin@example.com)';
    const result = await handler();
    expect(result.ingested).toBe(2);
    expect(lastUA).toContain('WestFamWeather/1.0');
  });
});
