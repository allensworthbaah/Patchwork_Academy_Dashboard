# AllensworthOS — Academy Partner Record (Phase 1 scaffold)

A working implementation of the **Phase 1 / Phase 2 reporting layer** described
in the AllensworthOS PRD: a React frontend, a GraphQL API on Node, and a
PostgreSQL schema for Patchwork Academy's enrollment, attendance, sponsorship,
and supervised-hours data.

This has been built and tested end to end (Postgres → GraphQL → React) —
including the exact install flow below, on a clean checkout — so it should
just work.

## What's implemented vs. what's roadmap

**Implemented (Phase 1–2 of the PRD):**
- Postgres schema for the Academy module, kept separate from the clinical/ECM
  pipeline (see PRD Section 3).
- GraphQL API exposing cohort pipeline stats, weekly attendance trend,
  regional breakdown, sponsorship mix, and hour-verification tiers
  (Verified vs. Attested).
- Sponsor-scoped queries: passing a `sponsorId` returns only that sponsor's
  referred/sponsored students, aggregate-only — no individual-level data,
  matching the PRD's Phase 2 isolation requirement.
- A React dashboard that switches between "Patchwork staff (full view)" and
  a per-sponsor scoped view, so you can see the access model in action.

**Not implemented yet (later phases, intentionally):**
- Authentication — the sponsor selector in the UI is a dev-mode toggle to
  demonstrate scoping, not a login system.
- Individual-level drill-down (Phase 3) — blocked on the consent model
  discussed in the PRD, not a technical gap.
- The credential-passport hand-off, CBO turnkey flows, and MSW/LCSW hour
  categorization (fields exist in the schema, no UI or compliance review yet).

## Prerequisites

- **Node.js 20+** — a `.nvmrc` is included, so if you use [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm install
  nvm use
  ```
- **PostgreSQL**, installed and running locally.
  - macOS: `brew install postgresql@16 && brew services start postgresql@16`
    (if `psql`/`createdb` aren't found afterward, add
    `/opt/homebrew/opt/postgresql@16/bin` — or `/usr/local/opt/...` on Intel
    Macs — to your `PATH`)
  - Linux: `sudo apt install postgresql` (or your distro's equivalent), then
    make sure the service is running.

## Setup (one time)

```bash
git clone <this repo>
cd allensworthos-academy-portal
nvm use                # if using nvm — matches .nvmrc
npm install             # installs both server/ and web/ via npm workspaces
cp server/.env.example server/.env
npm run setup:db        # creates the database, loads schema + seed data
```

> **About that `.env` default:** it assumes a Postgres role with no
> username/password required for local connections — true for a fresh
> Homebrew install on macOS. If your Postgres has a `postgres` role with a
> password instead, edit `server/.env` to:
> `DATABASE_URL=postgresql://postgres:<password>@localhost:5432/allensworth_academy`

## Run it

```bash
npm run dev
```

This starts both the GraphQL API (`localhost:4000/graphql`) and the React
frontend (`localhost:5173`) together, labeled `[api]` / `[web]` in the same
terminal. Open `localhost:5173` in a browser.

Use the two dropdowns at the top to switch cohorts and to switch between the
full Patchwork-staff view and a scoped sponsor view (e.g. "HCAI") — the
numbers change to reflect what that access tier is allowed to see.

To run them separately instead: `npm run dev:server` / `npm run dev:web`.

## Project layout

```
.nvmrc                 # pinned Node version (20)
package.json            # npm workspaces root — one install, one dev command
scripts/
  setup-db.sh            # creates db + loads schema/seed, safe to re-run
server/
  .env.example           # copy to .env
  src/
    schema.sql            # Postgres schema — the PRD's Section 6 data model
    seed.sql              # illustrative seed data
    db.js                 # pg connection pool (reads .env via dotenv)
    schema.js             # GraphQL typeDefs + resolvers
    index.js              # GraphQL Yoga server entry point
web/
  .env.example            # optional — only needed if the API URL changes
  src/
    queries.js             # GraphQL query strings
    graphqlClient.js       # minimal fetch-based client
    App.jsx                # dashboard UI
    main.jsx               # React entry point
```

## Troubleshooting

- **`role "postgres" does not exist`** — your Postgres install doesn't have
  that role (common on fresh Homebrew installs). Use the `.env.example`
  default as-is, which omits a username and lets `pg` fall back to your OS
  login.
- **`createdb: command not found`** — PostgreSQL client tools aren't on your
  `PATH`. See the Homebrew note under Prerequisites above.
- **`Unexpected token '??='` or similar syntax errors** — your Node version
  is too old. Run `node --version`; if it's below 18, run `nvm use` (or
  `nvm install` first) to pick up the pinned version in `.nvmrc`.
- **npm dependency conflicts on `vite`** — this repo pins exact versions
  (no `^` ranges) specifically to avoid npm resolving to an incompatible
  major version. If you still see this, delete `node_modules` and
  `package-lock.json` everywhere (`rm -rf node_modules server/node_modules
  web/node_modules *.lock package-lock.json`) and run `npm install` again
  from the repo root.

## Next build steps, in PRD order

1. Add real authentication so `sponsorId` scoping is enforced server-side by
   a logged-in session, not chosen from a dropdown.
2. Wire the snapshot/export path (Phase 1's actual delivery mechanism to
   HCAI) — e.g. a scheduled job that renders this same data to PDF or CSV.
3. Build the supervisor-facing hour-logging flow (Allensworth login *and*
   the no-login attestation fallback) that writes into `hour_logs`.
4. Only after the above: individual-level drill-down, gated on the consent
   framework called out as an open question in the PRD.
