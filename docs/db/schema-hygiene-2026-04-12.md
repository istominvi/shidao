# Schema hygiene audit — 2026-04-12

Scope reviewed:

- `supabase/migrations/*.sql`
- Runtime domains: auth/session, methodology/lesson content, homework runtime, communication runtime.

## What is clean already

- Migration chain is chronological and domain-oriented (auth -> onboarding -> school scope -> lesson/homework/communication runtime).
- Product model aligns with DB model: methodology source layer + scheduled lesson runtime layer.
- Security-sensitive flows (auth/session, invite, pin) are represented explicitly in schema evolution.

## What was cleaned in this pass

- No destructive schema drops were made (safety first).
- Database hygiene findings were moved into dedicated docs so migration chain remains unchanged.
- Bootstrap/demo fixture concerns were documented as deferred rather than mixed into schema changes without full production impact analysis.

## Legacy / compatibility items intentionally kept

- Backfill-oriented compatibility steps in older migrations were kept intact to preserve existing production upgrade paths.
- Profile + role evolution fields remain unchanged because they still participate in routing/session policies.
- Security-definer and onboarding repair migrations were preserved as historical corrections in chain.

## Risks and deferred work

1. **Seed/bootstrap separation**
   - A later pass should extract any non-schema bootstrap content into explicit seed scripts (or idempotent post-migration jobs) after verifying deployment workflows.
2. **Migration squash/baseline**
   - Introducing a fresh-install baseline migration could reduce setup time, but should only happen with a tested replay strategy for existing environments.
3. **Function/trigger inventory sheet**
   - Add an explicit inventory doc mapping RPC/function ownership to product domains.

## Recommendation

Keep current migration chain for production safety. Do schema reductions only with explicit usage proofs and replay-tested rollback plans.
