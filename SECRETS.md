- FIRMS MAP_KEY works for both Global and US/Canada. Limit: 5000 tx / 10 min.
- OWM tiles use `appid=`; never expose from the browser.
- NWS requires a descriptive User-Agent.
- Front-end must call `/api/firms`, `/api/owm`, `/api/nws` — never the upstreams directly.

Additional Guidance:
* Store secrets in GitHub Actions Secrets; workflow exports them only to proxy test job environment.
* Local development: copy `services/proxy/.env.example` → `.env` and fill values (never commit the file).
* Rotate keys if accidental exposure suspected (scan build output for `appid=` to verify shielding remains intact).
* Avoid logging headers containing secrets; current proxy routes do **not** log request query strings to reduce leak risk.

