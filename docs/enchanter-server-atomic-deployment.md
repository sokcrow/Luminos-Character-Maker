# Enchanter's Update — privileged atomic checkout

**Status: implementation complete; Firebase Auth/RTDB/Functions emulator acceptance in CI; the production checkout remains disabled until separate security approval.**

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
2. Run the automated Node and Chromium regressions. **Enchanter Firebase
   Emulator Validation** now runs Auth, RTDB and actual Functions v2 emulators
   together. It calls the callable over HTTPS with a Firebase ID token and
   tests unauthenticated/stolen identity, concurrent same-ID submissions,
   charged application, unchanged Shop/Player state on rejection, removal,
   and a small six-client campaign-root contention fixture. The dedicated
   server release-guard smoke separately verifies default-off behavior.
   Timed intake/pickup has canonical service regression coverage; a deployed
   production checkout has NOT been certified.
3. Deploy using
   `firebase deploy --only functions:commitEnchanterService --project luminous-system`.
   Do **not** deploy if the build fails, security checks fail or service
   reliability/economy fixtures are not green.
4. After security, performance and live-flow sign-off, deliberately set
   `LUMINOUS_ENCHANTER_SERVER_ENABLED=true` on the deployed Functions
   environment **and** the controlled client configuration flag
   `window.LuminousEnchanterServerEnabled = true` before opening the
   Enchanter terminal. The callable now **fails closed by default** even if
   deployed accidentally. CI only enables the server variable inside the
   isolated Emulator process. The Player-subtree fallback remains active with
   both flags off and still rejects finite cross-Shop Shop stock consumption.
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

## Merge-ready code versus production activation

The **Enchanter implementation checklist is 350/350**. Its canonical
`on_skill`, `on_hit`, `on_damage_received` and selected
`before_getting_hit` trigger paths have real Chromium and Node regression
coverage. Unapproved Shield/Threshold Aegis numerical wear is not shipped as
authored Enchanter content; Magic Items and Magic Loot remain separate.

The PR may be reviewed as a **feature-gated code merge** if all required CI
checks pass. Neither the merge nor deployment may be interpreted as permission
to activate privileged monetary checkout. Both opt-in switches must remain
off by default. `tests/enchanter-safe-merge-policy-smoke.cjs` enforces this
default and exposes the economic trust boundary rather than hiding it.

**Live enablement remains blocked** until: (1) owner-writable Player wallet
and inventory data in `database.rules.json` is made authoritative without
breaking Shops, contracts and P2P; (2) the deployed Cloud Function, Firebase
permissions, Player/DM/browser round trip and reload receipts are verified;
and (3) real campaign-scale root-`campaña` contention and latency are
measured and accepted. The six-client emulator contention check is only an
isolated functional stress regression, not a production load certification.
Never invent Threshold Aegis Shield wear or an unapproved recharge rate.
