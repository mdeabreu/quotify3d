# Payload Ecommerce

A set of utilities... more to come

## Stripe confirmation retries

Stripe confirmation is idempotent per ecommerce transaction: retries return the same order and public `transactionID`. Core atomically claims a pending transaction before creating the order, updating the cart, and decrementing inventory. PostgreSQL users must generate and apply a schema migration that adds `processing` to the ecommerce transaction status enum; MongoDB and SQLite require no schema migration for this change.

Database adapters with transaction support roll back the complete settlement on failure. Without database transactions, concurrent requests are still serialized by the transaction status claim, but a process crash can leave a transaction in `processing`. This state fails closed and must be investigated; it is not reset automatically because the system cannot safely infer which side effects completed.

## Vendored upstream baseline

This directory incorporates `packages/plugin-ecommerce` from Payload v3.90.2
(upstream commit `6254c3bf561a205223849a6497d7dae824d4e81b`).
The `payload_ecommerce_plugin` branch tracks pristine upstream snapshots at its
root: v3.84.1, v3.88.0, and v3.90.2. Its first snapshot exactly matches the original
vendored copy in website commit `79bdbc1`.

When updating, compare that branch's previous snapshot to the target release and
merge the delta into this directory using the previous snapshot as the common
base. Preserve the local build configuration and workspace dependency versions.
Run `pnpm test:plugin`, the website integration tests, and the production build.
Regenerate Payload types and check whether a database migration is needed.

### Local customizations

- Payment hooks and persisted summaries support discounts and pickup validation.
  Confirmation copies the transaction summary into the new order during
  settlement. After-confirm hooks run after endpoint-owned transactions commit
  and must tolerate retries for the same transaction; the website's coupon hook
  deduplicates redemptions.
- Stripe metadata values are capped at 500 characters. If a large cart snapshot
  is omitted, confirmation uses the stored transaction items at depth zero while
  retaining upstream validation of the provider payment and purchaser. Item
  comparisons ignore regenerated top-level array row IDs while checking product,
  variant, quantity, and custom data (including nested IDs).
- Package exports, TypeScript/SWC build settings, and dependency versions support
  standalone builds and shared React/Payload UI contexts in this workspace.

The pristine upstream branch contains none of these website customizations.
