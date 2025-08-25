### What & Why

<!-- Summary + link to issue/vision -->

### Changes

-

### Risk / Rollback

- Risk:
- Rollback: `git revert <sha>`

### Tests / Evidence

```bash
pnpm run validate:catalog
pnpm run validate:inventory
pnpm -w run typecheck && pnpm -w run test
```

### Checklist

- [ ] No secrets in diff
- [ ] No breaking route/contract changes
- [ ] Docs updated (if needed)## Summary
      Provide a 1-3 sentence high-level summary.

## Change Type

- [ ] add
- [ ] modify
- [ ] delete
- [ ] refactor
- [ ] docs

## Areas / Categories Impacted

List primary area(s) (e.g., web, services/proxy, infra/terraform, tests) and category if different.

## Vision Alignment

## Relates to VISION.md goals (list IDs & titles):

## Rationale

Why is this change needed? Link issues or context.

## Implementation Notes

Key decisions, trade-offs, and assumptions.

## Risk

Risk level: low | medium | high
Risk details and mitigation steps.

## Cost Impact

Operational / infra cost impact: none | negligible | low | medium | high (explain if not none)

## Validation

Pre / post change checks performed (copy from logs):

- build:pass
- tests:pass

## Screenshots / Outputs (if UI or CLI)

## Follow Ups

-

## Checklist

- [ ] Updated AGENTUPDATEHISTORY.jsonl entry (schema v2.0)
- [ ] Added/updated tests
- [ ] Docs updated (README / RUNBOOK if required)
- [ ] No secrets or credentials committed
- [ ] Lint & type check pass locally
