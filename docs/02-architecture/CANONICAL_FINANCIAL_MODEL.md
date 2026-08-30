# Canonical Financial Model

## Decision

Vorvex has one financial-model boundary. UI components consume the typed model exported by `lib/financial-model/canonical-financial-model.ts`; they do not own balances, financial totals, sample activity, or fallback financial constants.

The Founder runtime keeps a validated canonical account snapshot under owner-only Application Support storage. A read-only provider supplies it to the ingestion pipeline without committing personal financial information. Founder-managed factual overrides and additional accounts are applied through the validated local facts boundary. The UI receives only the resulting canonical model and does not depend on source format.

## Structure

```text
Person
  └── Money
      ├── Source provenance
      ├── Accounts (authoritative ingested records)
      ├── Cash
      ├── Investments
      ├── Home (Known, Partial, or Unknown from Founder facts and liabilities)
      ├── Vehicle (Known, Partial, or Unknown from Founder facts and liabilities)
      ├── Credit / Debt
      ├── Income (derived from canonical transaction evidence)
      ├── Upcoming (known statement obligations and evidence-based expectations)
      └── Future Worlds (unknown)
```

Known Worlds reference account IDs; they do not copy account records. Totals and net worth are derived from the authoritative account collection using integer-cent arithmetic. Unknown Worlds return `null`, never a fabricated zero.

## Source and Privacy Boundary

- Production source: validated owner-local canonical snapshot and Founder facts under `~/Library/Application Support/Vorvex/`.
- Transaction, statement-fact, investment-snapshot, review, and relationship payloads remain encrypted in owner-local stores.
- Supported TD PDFs enter only through the Founder-controlled inbox boundary; the UI and financial model remain provider-independent.
- The application performs no cloud, telemetry, external analytics, or network financial integration.

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

- Historical account positions and whole-person net worth where synchronized balance evidence is absent
- Home and Vehicle facts not explicitly supplied by the Founder or supported by canonical accounts
- Future obligations beyond statement facts and evidence-labelled recurrence
- DCP/PRPP history and contribution splits without source statements
- Other and future Worlds

Unknown information must remain unknown until a person supplies an authoritative record.
