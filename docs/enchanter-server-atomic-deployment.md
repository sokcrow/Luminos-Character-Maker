# Enchanter's Update — privileged atomic checkout

**Status: authored backend + deterministic smoke; not production-certified.**

This is an implementation of the missing trusted cross-entity payment path,
separate from the **Player-subtree-only** browser RTDB transaction. It does not
promote the unapproved 119-entry Enchantment review catalog, nor does it bring
Magic Loot or native Relics into PR #931.

## Authority and invariants

- `functions/index.cjs` exports authenticated callable `commitEnchanterService`.
- The caller may submit **service intent**, but never a final Item snapshot,
  outcome roll, discount, money amount, free-service flag or vendor stock
  adjustment. The backend re-reads Player and Shop, verifies the auth UID owns
  the Player, builds a canonical provider and recalculates the quote using
  `LuminousItemEnchanterServiceRuntime`.
- `functions/enchanter-atomic.cjs` makes **one Firebase Admin RTDB transaction
  at `campaña`**, the current lowest common ancestor of
  `campaña/jugadores/{playerId}` and `campaña/tiendas/{shopId}`.
  The same transaction changes the Player Item, wallet, consumed materials,
  vendor material supply, Enchanter receipt and wallet journal. A rejected
  attempt returns without charging, consuming or modifying either subtree.
- A stable request/receipt ID prevents double application across browser tabs.
  Timed jobs escrow the Item until pickup and use the DM campaign calendar.
  A pickup request ID must be `<jobId>:delivery`.
- Players must **not** receive write access to `campaña` or vendor stock.
  The Admin SDK is the only holder of privilege here. No database rule was
  relaxed.
- `functions/build-enchanter-bundle.cjs` copies the canonical runtime into
  `functions/vendor/js` for Function deployment; these generated copies
  are excluded from Git. Canonical source remains under `js/`.

## Deployment and opt-in

1. Provision a Firebase Functions-compatible project with Node.js 22 support
   and the required billing plan; install the dependencies from
   `functions/package.json`.
2. Run the automated
   `tests/enchanter-server-atomic-smoke.cjs`,
   `tests/item-enchantment-triggered-combat-smoke.cjs`, and Player UI/browser
   tests. Use the Firebase Emulator to validate **real auth, RTDB transactions,
   Firebase rules, timed intake/pickup and two-client races**. A fake database
   is not sufficient to certify release readiness.
3. Deploy using
   `firebase deploy --only functions:commitEnchanterService --project luminous-system`.
   Do **not** deploy if the build fails, security checks fail or service
   reliability/economy fixtures are not green.
4. Only after successful backend verification, enable the non-UI application
   flag `window.LuminousEnchanterServerEnabled = true` from controlled app
   configuration **before opening** the Enchanter terminal. The character
   sheet includes Firebase Functions SDK v8.10.1. With the flag off, the
   existing Player-subtree save path remains active and rejects finite
   cross-Shop provider-stock consumption instead of allowing unsafe debits.
5. Verify Player AHN, material stock, receipts, permanent and timed Item
   mutations, duplicate submissions and shop balance display after reload.

## Important performance and safety limitation

Firebase RTDB only offers true multi-path compare-and-commit transactions at
one shared ancestor. With the current schema, that ancestor is all of
`campaña`, which can be large and highly contended by unrelated game systems.
This implementation provides a correctness boundary **but not a production
performance guarantee**. Load-test and monitor retries, read size, latency
and contention before activating it. If that is too costly, migrate the
authoritative payment/stock/Item ledger to a compact shared subtree or another
trusted transactional database; do not replace the atomic operation with two
best-effort client writes.

## Remaining acceptance

No claims are made here that the six outstanding Enchanter-specific checklist
items are complete in production. In particular, the server callable needs
a deployed integration run and the combat event system still needs explicit
Player-selected `Before Getting Hit` reaction support. Do not invent the
Threshold Aegis shield value or automatically choose reactions.
