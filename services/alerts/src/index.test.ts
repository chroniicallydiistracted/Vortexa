import { describe, it, expect, vi } from 'vitest';
import { handler } from './index';

// Mock undici fetch
vi.mock('undici', () => ({
  fetch: vi.fn(async () => ({
    json: async () => ({ features: [ { id: 'TEST1' }, { properties: { id: 'TEST2' } } ] })
  }))
}));

// Mock AWS SDK DynamoDB client
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class { } }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) },
  PutCommand: class { constructor(public input: any){} }
}));

describe('alerts handler', () => {
  it('ingests features', async () => {
    process.env.TABLE = 'dummy';
    const result = await handler();
    expect(result.ingested).toBe(2);
  });
});
