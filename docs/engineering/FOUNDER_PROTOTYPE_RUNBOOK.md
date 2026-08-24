# Founder Prototype Runbook

## Purpose

This runbook operates the local Founder prototype without exposing financial data to external services.

## Start

```bash
npm ci
npm run build
npm start -- -H 127.0.0.1
```

Open `http://127.0.0.1:3000`.

## Add statements

1. Place intentionally selected TD chequing or TD credit-card CSV exports in `.vorvex-data/inbox/`.
2. Select **Scan inbox** in Vorvex.
3. Accepted source files are removed after their minimized canonical facts are encrypted into `.vorvex-data/state.vorvex`.
4. Exact duplicate statements are removed without creating duplicate transactions.
5. Unsupported or malformed files move to `.vorvex-data/quarantine/` with no partial import.

Vorvex reads only the configured inbox. Set `VORVEX_DATA_DIR` before launch to use a different dedicated data root; Vorvex will still read only its `inbox` child. It never searches Desktop, Documents, Downloads, iCloud, email, or sibling folders.

## Explore and review

- Use Day, Week, Fortnight, Month, Quarter, and Year to change the shared financial context.
- Coverage remains Partial for transaction CSVs because rows do not prove days with no activity.
- Select an item under **Needs Review** to add an authoritative category correction.
- Ask Vorvex factual questions about spending, inflows, outflows, comparisons, movements, missing data, and review items.

Current balances, Home values, and Vehicle values remain Unknown when statements do not contain authoritative facts.

## Persistence and recovery

Canonical state is AES-256-GCM encrypted. The local key and encrypted state are separate files with owner-only permissions. Writes use a temporary file followed by an atomic rename. Schema migration preserves earlier prototype state.

Back up the complete configured data root together; the encrypted state cannot be recovered without its key. Never commit or send that directory.

## Supported boundary

- Supported now: TD transaction CSV layouts containing date, description, and withdrawal/deposit or amount fields.
- Fail-closed now: PDF, OFX/QFX, unknown CSV layouts, zero or invalid amounts, invalid dates, and files over 10 MB.
- Deferred: authoritative statement balances, explicit statement-period metadata, additional institutions, automatic refresh, and encrypted user-controlled backup tooling.
