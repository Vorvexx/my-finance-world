# Automatic Bank Statement Drop Folder

**Status:** Current architecture boundary

**Supported automatically:** characterized TD Chequing PDF v2 and TD Credit Card PDF v2

**Established:** 2026-08-08

## Decision

Vorvex supports one configurable, user-controlled local folder named `Vorvex Bank Statements`. An explicitly started server/local-process worker scans that folder on startup, watches for changes while running, and performs periodic reconciliation scans. Filesystem events prompt work but never establish correctness; secure intake, the import journal, source SHA-256, and database constraints remain authoritative.

The configured folder is both the complete discovery boundary and the approved validation root. Scans read that exact path plus one level inside the six Founder-authorized provider/account folders: `TD Chequing`, `TD Credit`, `TD TFSA`, `TD RRSP`, `Desjardin DCP`, and `Canada Life PRPP`. Vorvex does not recurse below those folders or enumerate a parent, sibling directories, the user home directory, Desktop, Downloads, iCloud, external drives, or historical archives. The broader Documents directory is not an approved root.

```text
configured private folder
  → stability check
  → process-wide claim
  → secure PDF intake
  → structural classifier
  → provider registry/router
  → approved account mapping
  → parser and canonical importer
  → atomic persistence
  → canonical relationship evaluation
  → safe result
  → verified source deletion
```

No browser upload, dashboard integration, archive hierarchy, telemetry, cloud service, or permanent source copy is involved.

## Configuration and creation

The default configuration resolves to `Documents/Vorvex Bank Statements` under the current operating-system home directory. `VORVEX_BANK_STATEMENTS_DIR` may select another explicit location and that configured inbox itself becomes the approved root. No Founder-specific absolute path is compiled into the application.

The folder creation helper creates only the selected folder with owner-only permissions. Startup fails safely when the folder is missing, not a directory, a symbolic link, outside its approved root, owned by another local user, or accessible by group/other users. Vorvex does not silently broaden or repair permissions on an existing user-selected directory.

The current build exposes explicit `start()` and `stop()` lifecycle methods. The application host must create one worker instance using its protected persistence key and approved canonical account mapping. The worker is not started from React rendering, route evaluation, or module import, preventing accidental duplicate watchers during development hot reload.

## Detection, stability, and claiming

The worker combines an initial startup scan, filesystem change notification, and a periodic two-second reconciliation scan by default.

Each scan is sequential. Candidates are sorted only to make local processing deterministic; names never enter results or persistence. Dot files, editor backups, partial-download suffixes, directories, symbolic links, and empty files are skipped. Non-PDF files receive a safe unsupported result and never reach PDF intake.

Unapproved directories and directories below an authorized child are skipped and never traversed. Loose root files retain the existing delete-after-receipt behavior. Founder originals inside organized authorized child folders are retained after import or deduplication.

A candidate's device, inode, size, and modification time must match across a short stability interval before processing. Secure intake then independently verifies the extension, signature, end marker, size, type, and approved-root boundary. The file identity is checked again before deletion, so a replaced or modified path is retained with a safe attention code rather than deleting different bytes.

Scans are serialized within each worker. A process-wide resolved-path claim prevents duplicate watcher events or multiple worker instances in the same process from handling one file concurrently. Across process crashes or restarts, recoverable journal entries and database uniqueness provide the durable boundary; this is not a distributed multi-process locking system.

## Classification and provider routing

The worker owns no TD parsing rules. It calls a provider-route registry after generic secure intake. A route is selected only when positioned document evidence satisfies that adapter's supported structure and required TD/account-type evidence. Filename, folder name, and statement identity fields do not participate.

Classification returns supported, unsupported, or ambiguous. Zero recognized routes is unsupported; more than one is ambiguous and needs attention. The selected adapter owns parsing and canonical import behind one provider-independent worker interface. The production registry entries are:

`td-chequing → TD Chequing one-page PDF → td-chequing-pdf-v1`

`td-credit-card → TD Credit Card PDF → td-credit-card-pdf-v2`

Other institutions, image-only PDFs, and uncharacterized TD layouts are not automatically supported.

## Account mapping and import recovery

The host supplies an approved route-to-canonical-account mapping. The value is an internal Vorvex account ID, never a bank account or card number. The durable store verifies TD Chequing mappings as cash assets and TD Credit Card mappings as debt liabilities. Missing or invalid mappings produce a safe needs-attention result and preserve the source.

Before parsing, the worker looks for a recoverable `received`, `parsing`, or `proposed` import with the same source hash, account, provider, and account type. It reuses that internal import ID so a restart can complete the same journal entry. If an earlier import committed, the new arrival receives a new attempt/import identity and becomes a verified file duplicate. The canonical ledger remains exactly once.

## Source deletion and failure retention

The worker deletes a candidate only when the canonical importer returns `safeToDeleteSource: true` and the candidate still has its claimed identity. This applies to committed imports and completed-file duplicates. Deletion failure or source replacement becomes needs-attention and leaves the source available.

After a durable import, an optional relationship processor receives canonical transactions for the configured accounts. It receives no PDF, path, filename, or parser structure. A relationship-evaluation failure cannot roll back the committed ledger: the worker records safe `RELATIONSHIP_EVALUATION_FAILED`, retains the source, and permits retry after restart.

Malformed, unsupported, ambiguous, rejected, missing-mapping, and persistence-failure sources are never automatically deleted. Unchanged failures are not retried continuously during the same worker lifetime; modifying the file or restarting the worker permits a safe re-evaluation. There are no `processing`, `processed`, `archive`, or `rejected` subfolder copies. The import journal and safe result history are the processing record.

Filesystem deletion removes the directory entry but is not a cryptographic secure erase. Operating-system snapshots, backups, synchronization tools, filesystem journals, and storage-device behavior may retain prior bytes outside Vorvex's control. Users should select a local, non-synchronized folder when that retention is unacceptable.

## Safe status boundary

Schema version 2 added durable `statement_folder_results`; schema version 3 retains that boundary unchanged. A result contains only random result and optional internal import IDs; supported route/provider/account type when known; status; transaction and duplicate counts; a stable safe reason code; and processed timestamp.

It contains no source path, filename, file hash, canonical account ID, transaction, description, amount, balance, statement period, or personal identifier. Server-side callers may query this DTO for a future attention indicator. Raw filesystem or persistence rows must not be serialized to browser code.

## Privacy and operational limits

The worker emits no logs and transmits no data. PDF bytes and extracted text remain transient memory owned by the local process and are cleared after processing. It creates no lock files, temporary statement copies, sidecars, or telemetry. Finder and other operating-system interfaces may independently expose filenames and metadata because the user owns the source folder.

Explicit host integration is still required to provision the protected database key, existing canonical account registration/mapping, one worker lifecycle, and the selected folder. Multi-process leader election, OS service installation, keychain integration, UI configuration, attention UI, secure-erasure guarantees, and retention expiry automation are not implemented.
