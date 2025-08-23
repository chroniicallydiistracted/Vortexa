import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fetch } from 'undici';

const isLocal = process.env.NODE_ENV === 'development' || process.env.AWS_SAM_LOCAL === 'true';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-west-2',
  endpoint: isLocal ? (process.env.DYNAMODB_ENDPOINT || 'http://host.docker.internal:8000') : undefined,
  credentials: isLocal ? { accessKeyId: 'dummyKeyId', secretAccessKey: 'dummySecretKey' } : undefined,
}));
const TABLE = process.env.TABLE || '';

type NWSAlertFeature = { id?: string; properties?: { id?: string } };
type NWSAlertResponse = { features?: NWSAlertFeature[] };

export const handler = async () => {
  const ua = process.env.NWS_USER_AGENT || 'WestFamWeather/0.0.1 (admin@example.com)';
  const r = await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert', {
    headers: { 'User-Agent': ua }
  });
  const data = (await r.json()) as NWSAlertResponse;
  const items = (data.features ?? []).slice(0, 100);
  for(const f of items){
    const id = f.id || f.properties?.id;
    if(!id) continue;
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { pk:`alert#${id}`, sk:'v1', data:f, ttl: Math.floor(Date.now()/1000)+3600 } }));
  }
  return { ingested: items.length };
};
