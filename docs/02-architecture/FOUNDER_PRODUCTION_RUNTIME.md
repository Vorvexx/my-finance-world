# Founder Production Runtime v1

**Status:** Current macOS production architecture

**Established:** 2026-08-08

## Boundary

Founder v1 is one macOS user, one local machine, macOS Keychain, owner-only application storage, one owner LaunchAgent, and a Next.js interface bound only to `127.0.0.1:3210`. It has no LAN listener, tunnel, cloud service, telemetry, remote analytics, or external AI call.

The runtime orchestrates existing canonical ingestion, review, learning, relationship, and homepage services. Provider adapters remain at acquisition edges; the runtime and UI operate on canonical records.

## Local state

Private state lives under `~/Library/Application Support/Vorvex/` with mode `0700`. Database and configuration files use mode `0600`. It contains databases, configuration, runtime logs, a minimized audit log, backups reserved for a future tested export, and a Vorvex-managed canonical snapshot copied from a Founder-selected source after schema validation. The source backup remains untouched.

Configuration contains only the account registry, canonical mapping IDs, approved local locations, and setup time. It contains no bank account numbers, credentials, encryption key, transaction payloads, filenames, statement paths, hashes, or parser evidence.

## Secret custody and recovery

Provisioning generates 32 random bytes locally and stores them as the macOS Keychain item `com.vorvex.founder-v1.persistence` for the current user. Existing Founder state never falls back to an environment or plaintext key. Missing, malformed, denied, or deleted Keychain material blocks the runtime; Vorvex does not silently replace it.

Deleting that Keychain item makes the encrypted databases unreadable. Founder v1 does not yet provide key escrow or a recovery export. Before the databases become the sole copy of irreplaceable history, a separately authorized and tested encrypted backup and key-recovery process remains required.

## Provisioning

The local `/setup` interface validates the Founder-selected snapshot, requires exact display-name confirmation for TD Chequing and TD Credit Card, rejects ambiguous evidence, creates protected state and the acquisition inbox, copies the validated snapshot without altering its source, initializes encrypted stores, registers confirmed accounts, and starts the worker. No account mapping is inferred. Unknown remains valid.

## Runtime lifecycle

Next.js instrumentation starts the worker once per production server after validating configuration, Keychain access, databases, folder permissions, ownership, and schemas. Process-global ownership prevents duplicate workers inside the server. The LaunchAgent maintains one server process and restarts it after failure. `SIGINT` and `SIGTERM` close the watcher and databases.

The inbox is `~/Documents/Vorvex Bank Statements`. Supported sources are deleted only after verified canonical receipt and relationship evaluation. Unsupported, ambiguous, failed, or unsafe inputs remain. No raw statement archive is created.

## Launcher and installation

`npm run install:founder` is the reproducible compatible-Mac installation step. It requires the canonical repository, Node.js 24+, and installed dependencies, builds production, installs `~/Applications/Vorvex.app`, and installs `~/Library/LaunchAgents/com.vorvex.founder-v1.plist`.

After installation, normal use requires no Terminal: open **Vorvex** from Finder. The launcher starts the LaunchAgent, waits for `127.0.0.1:3210`, and opens the local UI. This is a Founder-v1 launcher, not a public installer or update system.

## Browser-safe and audit boundaries

Homepage operations expose safe status, aggregate dates/counts, coverage honesty, and minimized import explanations. They never expose local paths, filenames, database IDs, canonical IDs, hashes, fingerprints, encryption metadata, or parser provenance. Review and relationship actions use short-lived sealed action tokens.

The append-only audit records time, mutation kind, authority, source, and a non-financial reason. It excludes amounts, descriptions, account IDs, transaction IDs, paths, filenames, hashes, and encrypted payloads.

## Acceptance workflow

On a compatible Founder Mac:

1. run the one-time documented installation;
2. open Vorvex from Finder;
3. complete setup with the verified snapshot and explicit account display names;
4. confirm Ready health;
5. place supported synthetic TD Chequing and TD Credit Card statements in the inbox;
6. confirm receipt, source deletion, homepage facts, queues, and explanations;
7. save classification and relationship decisions and confirm homepage refresh;
8. restart Vorvex and confirm state and learning remain;
9. place a renamed duplicate and confirm no duplicate canonical impact;
10. place another supported statement and confirm automatic processing continues.

Real Founder statements and the private August 3 source are Founder-controlled acceptance inputs. They are never committed to Git or copied into test fixtures.
