import os, json, time, hashlib
import boto3, requests

S3_BUCKET = os.environ.get('BUCKET','')
CATALOG_STR = os.environ.get('CATALOG','{}')
CATALOG = json.loads(CATALOG_STR)

s3 = boto3.client('s3')

def fetch_and_store(url, key, content_type=None):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    extra = {'ContentType': content_type} if content_type else {}
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=r.content, **extra)

def handler(event, context):
    entries = CATALOG.get('entries', [])[:50]
    stored = 0
    for e in entries:
        base = e.get('base_url')
        layer = e.get('layer')
        provider = e.get('provider')
        if not base or not layer: 
            continue
        # naive ping (could be a WMTS GetCapabilities)
        url = base if 'http' in base else None
        if not url: 
            continue
        key = f"raw/{provider}/{hashlib.sha1(url.encode()).hexdigest()}.txt"
        try:
            fetch_and_store(url, key, 'text/plain')
            stored += 1
        except Exception as ex:
            print('warn', ex)
    return {'stored': stored}
