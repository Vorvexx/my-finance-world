# Canonical Financial Model

## Decision

Vorvex has one financial-model boundary. UI components consume the typed model exported by `lib/financial-model/canonical-financial-model.ts`; they do not own balances, financial totals, sample activity, or fallback financial constants.

The recovered browser-localStorage payload remains private and ignored by Git. A read-only provider supplies it to the ingestion pipeline without committing personal financial information. The UI receives only the resulting canonical model and cannot distinguish whether a future model came from a local snapshot, manual input, an import, an API, or a database.

## Structure

```text
Person
  └── Money
      ├── Source provenance
      ├── Accounts (authoritative ingested records)
      ├── Cash
      ├── Investments
      ├── Home (unknown)
      ├── Vehicle (asset value unknown; recovered loan appears in Credit / Debt)
      ├── Credit / Debt
      ├── Income (unknown)
      ├── Upcoming (unknown)
      └── Future Worlds (unknown)
```

Known Worlds reference account IDs; they do not copy account records. Totals and net worth are derived from the authoritative account collection using integer-cent arithmetic. Unknown Worlds return `null`, never a fabricated zero.

## Source and Privacy Boundary

- Private source: `local-backups/financial-data/2026-08-07/my-finance-world-real-accounts-v1.json`
- Source kind: recovered browser localStorage
- Storage key: `my-finance-world-real-accounts-v1`
- The entire `local-backups/` directory is ignored by Git.
- The application remains local and performs no API, cloud, CSV, PDF, or network integration.

## Permanent Ingestion Boundary

```text
Data provider
  ↓ raw, untrusted snapshot
Canonical ingestion pipeline
  ↓ schema validation
Canonical financial model
  ↓ provider-agnostic model
UI, Worlds, reports, insights, and future assistants
```

Providers only read source data. They do not calculate balances or shape the UI. The ingestion pipeline owns validation, World relationships, unknown-state handling, and derived totals. Every future data source must implement the provider contract and enter through this pipeline.

The first provider reads the ignored local backup at runtime. When the file is absent, it returns no snapshot and the pipeline creates a valid empty model whose financial values are Unknown. This makes a clean checkout buildable and runnable without weakening the private-data boundary.

## Validation Invariants

- Assets and liabilities are aggregated independently using integer cents.
- Net worth is derived as assets minus liabilities.
- Statement balances never silently replace canonical account balances.
- All recovered accounts must match the typed runtime schema before the model is created.
- Founder-specific values and account counts remain private local validation evidence and are not recorded in source control.

## Remaining Unknowns

- Home ownership, value, mortgage, and associated activity
- Vehicle asset identity and value; only the recovered car-loan liability is known
- Income and cash-flow history
- Upcoming financial events
- Other and future Worlds
- Browser profile and localhost-origin provenance for the recovered payload

Unknown information must remain unknown until a person supplies an authoritative record.
