# Installation Department - Phase 1 (Data Only)

This phase introduces a fully isolated data foundation for `installation` without touching existing Tajhiz behavior.
It supports:
- same Supabase project (recommended by current request), or
- dedicated Supabase project.

## Environment

Set these variables in `.env` or `.env.local`:

- `VITE_SUPABASE_ENABLED_INSTALLATION=true`
- `SUPABASE_DB_URL` (same-project mode) or `SUPABASE_DB_URL_INSTALLATION` (separate-project mode)

Optional only for dedicated installation project:
- `VITE_SUPABASE_URL_INSTALLATION`
- `VITE_SUPABASE_ANON_KEY_INSTALLATION`

## Apply schema and seed

```bash
npm run db:installation:apply-schema
npm run db:installation:apply-seed
npm run db:installation:validate
npm run db:installation:smoke-test
```

## Optional Excel-driven seed

Place files inside `data/import`:

- `اسماء الكادر الفني.xlsx`
- `مركبات كادر التركيب.xlsx`
- `معدات كادر التركيب.xlsx`

Generate SQL:

```bash
npm run db:installation:seed-from-excel
```

Then apply:

```bash
node scripts/apply-installation-sql.mjs --file supabase-installation/seed.generated.sql
```

## Repository layer

Dual data-source repositories are available in `src/data/repositories`.

- Pass department as `tajhiz` or `installation`.
- Tajhiz continues to use current Supabase project.
- Installation uses dedicated credentials if provided; otherwise it automatically falls back to current project credentials while staying isolated by `installation_*` tables.
