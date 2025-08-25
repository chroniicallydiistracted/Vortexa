# Commit Conventions

Format: <prefix>(<area>): <summary>

## Allowed Prefixes

- feat: user-visible feature
- fix: bug fix
- refactor: internal restructuring
- perf: performance improvement
- test: test-only changes
- docs: documentation only
- chore: build tooling / maintenance
- infra: infrastructure / terraform
- ci: continuous integration pipeline

## Area Examples

- web, services/proxy, services/alerts, services/shared, infra/terraform, tests, docs, ci

## Examples

- feat(web): add layer selection dropdown
- fix(services/proxy): handle 502 response gracefully
- test(tests): add cache hit/miss coverage
- infra(infra/terraform): add CloudFront OAC policy

## Rules

1. One logical change per commit when practical
2. Keep summary <= 72 chars
3. Reference issue/PR in body if applicable
4. No secrets / credentials
5. For multi-area, pick primary or use + (e.g., feat(web+proxy): ...)

## Rationale

Consistent prefixes support automated changelog generation and risk scanning.
