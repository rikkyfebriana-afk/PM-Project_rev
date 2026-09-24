# Supabase activation status

Project: `pm-project-rev` (`tgnqvcgvhncelrjtnjgs`), Singapore, Free project creation confirmed at 0/month.

On 2026-09-23 the four committed Prisma SQL migrations were applied together through Supabase MCP as `pcc_initial_prisma_schema_with_private_access`, followed in the same operation by `scripts/supabase-security.sql`. The 12 application tables exist, all have RLS enabled, and `anon`/`authenticated` cannot SELECT them. Security Advisor reports only the intentional informational notice "RLS Enabled No Policy": business access is through the Next.js server and its project authorization, not the Data API. Do not add permissive policies just to clear this notice.

## Baseline completed (2026-09-24)

Both session and transaction pooler connections were verified with the official Supabase CA and TLS certificate validation enabled. The four `migrate resolve --applied` commands below completed successfully; `prisma migrate status` reports the database up to date. Do not repeat the baseline commands. The security script was reapplied and all 13 public tables (including `_prisma_migrations`) have RLS enabled and no SELECT grants for anon/authenticated.

The public CA is checked in at `certs/supabase-ca.crt`, downloaded from the Database Settings certificate link (`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`). Runtime, seed, and deployment checks share `lib/postgres-config.ts`; Prisma migrations use strict certificate validation. Next.js tracing explicitly includes the certificate. Never disable TLS validation to work around a certificate error.

## Bootstrap reference (already completed)

Supabase MCP migration history is NOT Prisma migration history. Once the real `DIRECT_URL` is configured locally, baseline these already-applied migrations using Prisma's supported resolve command. Do not run `migrate dev`, reset the database, or run `db:deploy` before this baseline step on this project.

```powershell
pnpm exec prisma migrate resolve --applied 20260913000100_init
pnpm exec prisma migrate resolve --applied 20260913000200_project_invariants
pnpm exec prisma migrate resolve --applied 20260914000100_boq_import_metadata
pnpm exec prisma migrate resolve --applied 20260920000100_operations_finance
pnpm exec prisma migrate status
```

Use these resolve commands ONLY for this verified bootstrap, not for other databases or unapplied migrations. After baseline, rerun `scripts/supabase-security.sql` in SQL Editor to protect the newly created `_prisma_migrations` table as well. After future migrations, apply this security script and review new tables for RLS/access before exposing the deployment.

## Still required

The private `project-documents` bucket was created and verified on 2026-09-23: 26,214,400 bytes/file, PDF/JPEG/PNG/WebP/XLSX/XLS/CSV only. No public bucket or read policies were enabled.

The dashboard confirmed the shared transaction pooler host as `aws-0-ap-southeast-1.pooler.supabase.com`, port `6543`, username `postgres.tgnqvcgvhncelrjtnjgs`. The password must be supplied by the owner, not written into this document. Verify the session pooler connection in Connect before using it for migrations.

- Configure real runtime `DATABASE_URL` and migration `DIRECT_URL` in ignored local `.env`; keep secrets out of chat and Git. Use Supabase Connect to obtain the actual pooler host; do not guess it.
- Configure server-only Supabase URL/key and the private `project-documents` bucket with `pnpm storage:configure`.
- Choose initial admin credentials in ignored local `.env`, then run `pnpm db:seed`. Never use sample passwords.
- Add the required production environment variables in Vercel, using a strong `AUTH_SECRET`, `SESSION_COOKIE_NAME=__Host-pcc_session`, and the real HTTPS `APP_URL`.
- Run `pnpm deploy:check -- --live`, redeploy, and verify login, project isolation, and a private document upload/download.

The Supabase Free tier has quotas. No paid upgrades/add-ons are authorized. A successful Vercel build does not mean these activation steps are complete.
