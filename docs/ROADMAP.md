# Roadmap / TODO (Status Annotated)

Legend: ✅ Done | 🌓 Partial | ⏳ Not Started

- 🌓 Add API Gateway / Lambda URL module for proxy endpoints (local dev only today; infra module missing).
- ⏳ ECS Fargate module with AutoScaling for tile proxy.
- ⏳ CloudFront origin / path behavior for proxy with (optional) signed URLs.
- ⏳ WebSockets (API Gateway) for live lightning / tracks.
- ⏳ Particle wind layer (GPU) (timeline controller exists; particles visualization not yet begun).
- ⏳ pySTEPS nowcasting Lambda (container image) writing POE tiles to S3.
- ⏳ Meteograms + Skew‑T view (Lambda image rendering).
- ⏳ Auth (Cognito) + user prefs in DynamoDB.
- ⏳ Alert subscriptions + Web Push via SNS + CloudFront worker.
- ✅ Vendor credential shielding routes (FIRMS, OWM tiles, NWS UA) in proxy.
- ✅ FIRMS CSV ingestion → GeoJSON client parsing.
- ✅ Dynamic time dimension for radar/satellite (GIBS GeoColor timestamps discovery + selection & playback in 3D globe; further layers pending).
- 🌓 3D Globe V3 Enhancements (playback, FIRMS points, OWM temp overlay) – baseline implemented, performance & styling polish pending.
- 🌓 S3 tile cache mechanism (code path present, infra not provisioned).
- ⏳ 3D Globe (Cesium) — experimental gated feature (env + runtime flag); scaffolding merged, imagery & advanced layers pending.
