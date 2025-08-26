# Environment Setup and Configuration Guide

## Issues Resolved

### 1. Tile Proxy Warning Fixed ✅

- **Issue**: "Using default tile proxy, Falling back to http://localhost:4000/tiles"
- **Solution**: Created `web/.env.local` with `VITE_TILE_BASE=http://localhost:4000/tiles`
- **File**: `web/.env.local`

### 2. Missing Proxy Environment Configuration Fixed ✅

- **Issue**: 400 errors on upstream URLs due to missing API keys
- **Solution**: Created `services/proxy/.env` with all required environment variables
- **File**: `services/proxy/.env`

## API Usage Analysis

### ✅ APIs Currently Used by Frontend

1. **GIBS (NASA)** - `/api/gibs/` - Satellite imagery, timestamps
   - Required: `EARTHDATA_AUTH_KEY` (optional for some endpoints)
   - Status: ⚠️ **CRITICAL** - Core functionality

2. **FIRMS (Fire Data)** - `/api/firms/` - Fire/thermal anomaly data
   - Required: `FIRMS_MAP_KEY`
   - Status: 🔥 **ACTIVE** - Used in 3D globe view

3. **OpenWeatherMap** - `/api/owm/` - Weather tile overlays
   - Required: `OWM_API_KEY`
   - Status: 🌤️ **ACTIVE** - Temperature layers

4. **CartoDB** - `/api/cartodb/` - Base map tiles
   - No API key required
   - Status: ✅ **ACTIVE** - Base mapping

5. **Feature Flags** - `/api/flags` - Runtime configuration
   - No API key required
   - Status: ⚙️ **ACTIVE** - 3D mode toggle

### ⚠️ APIs Configured But Not Used by Frontend

1. **NWS (National Weather Service)** - `/api/nws/`
   - Required: `NWS_USER_AGENT`
   - Status: 🚫 **UNUSED** - No frontend calls found

2. **AirNow** - Air quality data
   - Required: `AIRNOW_API_KEY`
   - Status: 🚫 **UNUSED** - No frontend calls found

3. **OpenAQ** - Air quality data
   - Required: `OPENAQ_API_KEY`
   - Status: 🚫 **UNUSED** - No frontend calls found

## Environment Variables Guide

### Required for Current Functionality

```bash
# Essential for avoiding 400 errors
FIRMS_MAP_KEY=your_firms_api_key_here
OWM_API_KEY=your_openweathermap_api_key_here

# AWS (required if using S3 caching)
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_DEFAULT_REGION=us-west-2
S3_BUCKET=your_s3_bucket_name
```

### Optional/Future Use

```bash
# These may be needed for future features
EARTHDATA_AUTH_KEY=your_earthdata_auth_key_here
CESIUM_ION_TOKEN=your_cesium_ion_token_here

# Currently unused - consider removing
NWS_USER_AGENT=YourApp/1.0 (contact: your-email@example.com)
AIRNOW_API_KEY=your_airnow_api_key_here
OPENAQ_API_KEY=your_openaq_api_key_here
```

## AWS Deployment Recommendations

### 1. Route 53 Hosted Zone Setup

```bash
# Domain configuration for production
VITE_TILE_BASE=https://your-domain.com/tiles
```

### 2. S3 Integration

- S3 bucket for tile caching (improves performance)
- Configure CORS for web access
- Set appropriate lifecycle policies for cache management

### 3. Environment Variable Management

```yaml
# For AWS deployment, store in:
# - Parameter Store (recommended)
# - Secrets Manager (for sensitive keys)
# - Environment variables in ECS/Lambda

Production Environment:
  FIRMS_MAP_KEY: '{{resolve:secretsmanager:app/api-keys:FIRMS_MAP_KEY}}'
  OWM_API_KEY: '{{resolve:secretsmanager:app/api-keys:OWM_API_KEY}}'
  AWS_DEFAULT_REGION: us-west-2
  S3_BUCKET: your-production-bucket
```

### 4. Service Architecture

- **Frontend**: S3 + CloudFront distribution
- **API Proxy**: ECS or Lambda behind Application Load Balancer
- **Caching**: S3 for tiles, ElastiCache for API responses
- **DNS**: Route 53 for custom domain

## Cleanup Recommendations

### Safe to Remove (Not Used)

- NWS API integration and related environment variables
- AirNow API integration
- OpenAQ API integration

### Keep for Future Use

- EARTHDATA_AUTH_KEY (may be needed for enhanced GIBS features)
- CESIUM_ION_TOKEN (for premium Cesium features)

## Next Steps

1. **Immediate**: Fill in actual API keys in `services/proxy/.env`
2. **Development**: Test all endpoints with real API keys
3. **Production**:
   - Set up AWS infrastructure
   - Configure secrets management
   - Update VITE_TILE_BASE to production domain
   - Remove unused API configurations

## Security Notes

- Never commit `.env` files to version control
- Use AWS Parameter Store or Secrets Manager for production
- Rotate API keys if accidentally exposed
- Monitor usage limits for third-party APIs
- Configure ALLOW_HOSTS properly for production security
