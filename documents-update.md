## Implementation notes and decisions (added during build)

### Status
- Phase 1 done: stack, folder structure, database schema and first migration.
- Phase 2 done: Google sign-in, dashboard, Register Purchases.
- Set Setup written (first version). Register Customer & Event and Google Calendar integration still to build.

### Stack
- Next.js 16 (App Router) with TypeScript, Tailwind CSS
- PostgreSQL (Neon) with Prisma 7. Prisma is pinned to version 7 on purpose: the schema and config files are written for it, and Prisma 8 rejects them.
- Auth.js (next-auth v5 beta), Google provider, JWT sessions (no auth tables in the database)
- Zod for form validation; Server Actions for saving data

### Schema changes versus the original spec
- `Assets` is the rentable **set** (not the individual item).
- New table `asset_items`: which purchased items make up one set, with the quantity per set (primary key: asset + purchase).
- New table `event_assets`: the sets rented in an event, with a quantity per set (primary key: event + asset). A customer can rent several sets in one event. This replaces `Events.asset_id`.
- `event_no` is an auto-incrementing unique number used as a running count of events rented.
- Single business owner: no owner column, no multi-tenancy.
- Added `created_at` and `updated_at` to every table.
- `pending_payment` and `total_amount` are stored columns, but the app calculates them: `rent_total_price - down_payment_amount` and `price * quantity`.
- Time columns (`start_time`, `end_time`) are stored as PostgreSQL `Time`.

### Availability rule
A set is available for a date and time slot when:

```
available = assets.asset_amount - SUM(event_assets.quantity)
            over events on that date whose time range overlaps the requested one
```

- A booking is only allowed if every set in it has enough units left.
- Sets with no units left for the chosen date and time must not be shown as available when scheduling an event.
- The server checks availability again when saving (inside a transaction).
- When editing an event, that event is excluded from its own count.

### Authentication
- Only Google accounts listed in the `ALLOWED_EMAILS` environment variable can sign in (comma-separated).
- Every page except `/login` requires a session (`proxy.ts`).
- Environment variables: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`. Real values live only in `.env`, which is never committed.

### Register Purchases
- Fields: item name, quantity, unit price, provider, status, color, measures. The total is calculated on the server.
- Statuses: pending purchase, paid, in delivery, received, completed.
- Status can be changed from the purchases table. A purchase already used in a set cannot move away from "completed".

### Set Setup rules
- Only purchases with status **completed** can be added to a set.
- A set has: name (unique), rental price per event, number of units owned, optional color and measures, and the items it contains (units of each item per set).
- Unit check: for each purchase, (units per set x sets owned), summed across all sets, cannot exceed the quantity bought.

### Developer setup notes
- Run `npx prisma generate` after every schema change and after a fresh clone (the `generated` folder is not committed).
- Add `export const instant = false;` to pages that read the session or the database (Next.js 16 blocking-route notice).

### Open questions
- Buffer time between events for delivery, setup and pickup (configurable number of minutes, or none).
- Editing and deleting sets, and editing purchases beyond their status.
