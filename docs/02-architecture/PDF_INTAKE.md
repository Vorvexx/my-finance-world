# Secure PDF Intake and Structural Analysis

**Status:** Current architecture boundary

**Established:** 2026-08-08

## Decision

PDF is the first TD statement format available to the Founder. Vorvex therefore begins with local TD PDF analysis while preserving the same provider-independent boundary that can later accept CSV, OFX/QFX, APIs, or databases.

```text
Caller-owned local financial file
               ↓
Generic secure PDF intake
               ↓ validated ephemeral bytes and safe provenance
Provider-specific structure analyzer
               ↓ constrained structural evidence or provider parser selection
Versioned TD statement parser
               ↓ reconciled TD-specific statement facts
Canonical normalization and persistence
```

The generic intake layer contains no TD terminology or statement-layout rules. TD-specific detection and interpretation live in separate versioned chequing and credit-card analyzers/parsers. None of those modules creates or persists canonical transactions.

## Trust and validation boundary

Every PDF is highly sensitive and untrusted. Before PDF.js receives any bytes, intake:

- requires a `.pdf` extension and a `%PDF-` byte signature;
- requires an end-of-file marker as an early truncation check;
- rejects empty files and files over 10 MiB;
- resolves an explicitly approved root and rejects files outside it;
- rejects symbolic links and non-regular files;
- opens read-only with no-follow behavior where the operating system supports it;
- generates an internal file ID rather than retaining the original filename;
- calculates SHA-256 for future import identity;
- emits safe error codes without source paths, names, content, or financial values.

PDF.js then enforces a 50-page limit, 25,000 extracted-text-item limit, 500,000-character limit, and five-second limit on each parser operation. Parsing disables XFA, WebAssembly, font rendering, worker fetching, and error recovery not required for text analysis. These controls reduce risk but do not provide a fully isolated parser process or a hard CPU/memory kill boundary.

## Dependency decision

The implementation pins Mozilla `pdfjs-dist` 6.2.108. It is maintained by the PDF.js project, has no runtime dependencies of its own, processes local bytes deterministically, exposes page count and positioned embedded text, and does not add OCR or hosted services.

Version 6.1.200 was rejected during dependency review because npm reported a high-severity malicious-PDF JavaScript-execution advisory affecting versions before 6.2.108. The fixed version is pinned and its direct package advisory is resolved. The same review exposed high-severity advisories in the pre-existing Next.js production dependency tree, so Next.js and its matching lint configuration were updated from 16.2.10 to the audit-recommended 16.3.0 and safe transitive fixes were applied. The resulting production and full dependency audits report zero known vulnerabilities.

## Text extraction and TD structural evidence

The analyzer checks embedded positioned text before considering OCR. It groups text by line and looks for semantic TD Chequing signals equivalent to:

- Description, Withdrawals, Deposits, Date, and Balance headers;
- starting and closing balance markers;
- withdrawal and deposit total markers;
- statement-period wording;
- date-bearing likely transaction rows;
- withdrawal, deposit, and running-balance column occupancy.

The returned result contains only internal file metadata, parser version, safe status/reason, page count, booleans, and row counts. It never returns raw text, descriptions, original names/paths, account identifiers, balances, totals, or transaction amounts.

The structural result indicates whether future parsing could obtain the evidence needed to verify, using exact integer-cent arithmetic:

```text
Starting Balance + Total Deposits - Total Withdrawals = Closing Balance
```

The checked-in structural analyzer does not return monetary values or perform reconciliation.

## Sanitized real TD Chequing validation

On 2026-08-08, the boundary was validated locally against one sanitized real TD Chequing statement. The source remained in its caller-owned private directory, was not rendered for model inspection, was not copied into the repository, and was not retained in Git. Only constrained structural results were emitted.

The validated statement has a usable embedded text layer and parses within the existing byte, page, text-item, character, and operation limits. Its extracted structure differs from the original synthetic assumptions in several important ways:

- the five table headers appear together on one extracted line and occur once in the validated one-page statement;
- the statement period is an unlabelled month/day date range with a year, not text prefixed by `Statement period`;
- transaction dates may contain no space between the month abbreviation and day;
- every observed transaction row carries a date, including multiple transactions sharing a date;
- descriptions can consist of multiple positioned text blocks on the same extracted line, but no wrapped continuation line was observed;
- withdrawal versus deposit sign is represented by column placement, not by a signed amount;
- running balances are present on some rows and absent on others;
- the starting-balance row follows the column header, and the closing-balance row follows the transaction rows;
- a generic `Totals` row after the closing-balance row carries withdrawal and deposit totals in their respective columns;
- unrelated fee, rebate, overdraft, interest, and promotional content follows the totals row. That lower content contains monetary structures and may contain a date-plus-money structure, so scanning all page text for transaction-like rows is unsafe.

The safe transaction boundary for this observed layout is:

```text
combined Description / Withdrawals / Deposits / Date / Balance header
  → starting balance
  → structurally interpretable transaction rows
  → closing balance
  → generic totals row with withdrawal and deposit column values
  → STOP
```

The analyzer now requires that complete boundary, recognizes the real statement-period and compact-date forms, restricts row counting to the transaction section, and excludes everything after the totals row. The real statement exposed starting balance, closing balance, total withdrawals, and total deposits, and exact integer-cent reconciliation passed locally. No real identity, description, identifier, or monetary value was retained in the repository or this document.

## Production TD Chequing parser

Parser version `td-chequing-pdf-v1` accepts a generic `ValidatedPdfSource` plus a constrained import context. This makes it callable by the future drop-folder worker without coupling it to a browser upload, file picker, UI state, watcher, or source path. The caller owns the validated byte lifetime and clears it after parser selection and use.

The parser remains TD-specific and pre-canonical. Its output is:

```ts
type TdChequingParsedStatement = {
  parser: {
    providerId: "td";
    accountType: "chequing";
    version: "td-chequing-pdf-v1";
  };
  source: {
    importId: string;
    internalFileId: string;
    sha256: string;
    byteSize: number;
    intakeTimestamp: string;
  };
  currency: "CAD";
  statementPeriod: {
    startDate: string; // ISO calendar date
    endDate: string;   // ISO calendar date
  };
  openingBalanceCents: number;
  closingBalanceCents: number;
  totalWithdrawalsCents: number;
  totalDepositsCents: number;
  transactions: Array<{
    sourceRowNumber: number;
    transactionDate: string; // ISO calendar date
    sourceDescription: string;
    normalizedDescription: string;
    maskedReferenceToken: string | null;
    withdrawalCents: number | null;
    depositCents: number | null;
    runningBalanceCents: number | null;
  }>;
  reconciliation: {
    status: "passed";
    calculatedClosingBalanceCents: number;
    calculatedWithdrawalsCents: number;
    calculatedDepositsCents: number;
    runningBalancesChecked: number;
  };
};
```

Exactly one of `withdrawalCents` and `depositCents` is non-null for every accepted row. `runningBalanceCents` remains nullable because TD omits it on some rows. Account-holder identity, address, account identifiers, source path, filename, and unrelated statement content never enter this contract. The local hash and internal file/import IDs are provenance, remain sensitive, and must not enter normal logs or UI.

### Dates and currency

The statement period supports the validated abbreviated month/day range. An explicit embedded year is authoritative. When the text omits a year, the parser uses the PDF's own creation metadata only when it parses exactly and falls from zero to seven days after the statement-period end. December-to-January transitions derive the starting year from the ending year. The parser never uses the computer's current year or the source filename. Every transaction date must be a real calendar date within the resolved inclusive statement period.

The validated Canadian TD Chequing format does not expose independent multi-currency evidence. Version 1 therefore declares `CAD` as an explicit adapter/account constraint. It does not infer CAD from amounts and must not be reused for a different TD account or currency without a new validated adapter/version.

### Exact money and reconciliation

All amounts use a reusable unsigned decimal parser backed by decimal-string validation and integer/`BigInt` arithmetic. Comma-separated and unseparated values with exactly two fractional digits are accepted; signs, currency symbols, malformed separators, missing decimals, ambiguous placement, and unsafe integer ranges are rejected.

An accepted result proves all of the following:

```text
opening + reported deposits - reported withdrawals = closing
sum(parsed withdrawals) = reported withdrawals
sum(parsed deposits) = reported deposits
each displayed running balance = prior displayed/starting balance
                                 + intervening deposits
                                 - intervening withdrawals
```

Missing running balances are allowed. Every displayed running balance is checked, and any contradiction rejects the complete statement.

Masked transfer references materially distinguished multiple rows with the same normalized base description in the validated statement. The parser preserves the whitespace-normalized source description, conservatively extracts one structurally unambiguous trailing masked token, and removes only that token from `normalizedDescription`. Ambiguous tokens remain embedded in source evidence and produce `null`. The token remains sensitive: it must not be logged, used for display by default, treated as identity, or retained when a future source row has no matching/deduplication utility.

### Fail-closed confidence boundary

The production parser accepts only when all of the following are true:

- the input passes secure PDF intake and contains usable embedded text;
- the validated TD Chequing header and the complete start/end boundary are unambiguous;
- the single-page source contains a TD marker, exactly one supported table header, one starting balance, one closing balance, and one immediately following totals row;
- the statement period is resolved from embedded evidence and every date falls inside it;
- every transaction row resolves to a date, description, exactly one amount column, and an optional running balance;
- no unparsed or ambiguous line remains inside the transaction section;
- integer-cent reconciliation passes;
- lower-page content begins only after the recognized totals end marker;
- the statement uses the validated one-page layout. Multi-page statements return `TD_CHEQUING_MULTIPAGE_NOT_SUPPORTED` until repeated-header and continuation behavior is characterized with sanitized evidence.

Reject or quarantine the statement when any required signal is missing or duplicated, import context is invalid, a monetary/date field cannot be parsed exactly, columns are ambiguous, reconciliation fails, a row is left unparsed, or the table/layout version differs from the validated structure. Errors contain only stable reason codes. No partial result is returned. False rejection is preferable to silent incorrect ingestion.

## Sanitized real TD Credit Card characterization

On 2026-08-08, the same secure boundary was used locally to characterize one sanitized real TD Visa statement. The source remained in its caller-owned private directory and was not copied into the repository or retained in Git. The checked-in analyzer emits only structural counts, booleans, parser version, internal file provenance, and safe reason codes.

The PDF has a usable embedded text layer and a seven-page envelope. Four numbered statement pages are present, with transaction activity on statement pages one, three, and four; a terms page occupies statement page two. Additional marketing, agreement-change, and control pages follow. Those unrelated pages contain dates, percentages, and financial language and are outside the activity boundary.

Observed transaction structure:

- separate transaction-date and posting-date columns;
- one signed amount column, with positive charges and negative payments/credits;
- repeated transaction headers on every activity page;
- explicit continuation markers after the first two activity segments;
- one `TOTAL NEW BALANCE` terminal marker on the final activity page;
- descriptions usually contained within extracted activity rows, with one observed tightly adjacent wrapped continuation;
- an explicit statement period and statement date;
- previous balance, payments and credits, purchases and other charges, cash advances, interest, fees, subtotal, and new balance summary fields;
- reliably positioned minimum-payment and payment-due-date facts.

The safe extraction boundary is therefore the union of each structurally recognized activity segment:

```text
transaction/posting/activity/amount header
  → rows containing both dates, transaction-specific description, and signed amount
  → Continued

final repeated header
  → rows
  → TOTAL NEW BALANCE
  → STOP
```

The analyzer requires all four numbered statement pages, the complete summary/payment evidence, every repeated header boundary, at least one activity row, and exactly one terminal marker. It separately requires TD document evidence and a credit-card product marker, so the folder router can distinguish this source from TD Chequing without using its filename.

## Production TD Credit Card parser

Parser version `td-credit-card-pdf-v2` accepts the same validated source/import boundary. It stops strictly at repeated transaction-table and terminal boundaries, validates the document's own consistent `page of total` evidence, and permits a transaction date up to seven days before the reporting period only when its posting date remains inside the period. It uses signed integer cents and emits only constrained semantic evidence for purchase, payment, refund/credit, interest, fee, reversal, cash advance, or balance transfer. A continuation is accepted only in the observed description column, on the same page, and within the characterized vertical distance from the preceding row.

It accepts only when transaction sums match the grouped statement totals and both `subtotal = purchases + cash advances + interest + fees` and `previous balance - payments and credits + subtotal = new balance` reconcile exactly. Statement date, period, payment due date, minimum payment, previous balance, and new balance are returned separately for encrypted statement-fact persistence. Identity, account/card number, address, unrelated page content, filename, and path remain outside the contract.

## Privacy, lifetime, and logging

Raw PDF bytes and extracted text exist only in process memory during validation and analysis. The analyzer does not copy source files or create temporary files. PDF.js receives a disposable byte copy, and the intake buffer is cleared on exit when it remains attached. The caller retains ownership of the source file.

The durable ingestion boundary returns a constrained `safeToDeleteSource` signal only after verified canonical commit or verified completed-file duplication. The [Automatic Bank Statement Drop Folder](./STATEMENT_DROP_FOLDER.md) uses that signal after re-verifying file identity. Failed or quarantined sources remain for user action, and no permanent raw-statement archive is created. See [Local Transaction Persistence](./LOCAL_TRANSACTION_PERSISTENCE.md).

Normal logs may contain only internal IDs, parser version, stage/status, safe reason code, page count, and structural counts. They must not contain original filenames or paths, file hashes, source text, descriptions, identity information, account numbers, balances, or amounts. Current intake and analysis code emits no logs.

No PDF bytes, extracted text, transaction data, metadata, or structural evidence is transmitted to an external service. Extracted financial text is data, never instructions. Merchant or document text that resembles a prompt remains untrusted source content and must never be promoted into system/developer instructions or granted execution authority.

## Source-retention policy

The analysis stage leaves its caller-owned source untouched. The automatic supported-statement folder routes follow this lifecycle:

```text
Read locally → validate → parse → reconcile → atomically commit → delete source
```

Temporary files are avoided. If a later parser genuinely requires one, it must use a generated name outside the web root, restrictive permissions, and guaranteed cleanup on success, failure, timeout, and restart.

## Known limitations

- Embedded-text extraction and structural recognition are proven against one sanitized real, one-page TD Chequing statement; other statement periods, layout versions, and multi-page statements remain unproven.
- Production parsing exists only for the explicitly versioned `td-chequing-pdf-v2`, `td-credit-card-pdf-v2`, and TD Multi-Holding investment snapshot layouts.
- TD Credit Card parsing is validated against one real statement and a synthetic multi-page regression fixture; other card products and layout versions remain unproven.
- Credit-card wrapped descriptions are supported only for the single tightly constrained extraction shape observed in the validated source.
- Image-only PDFs return `IMAGE_ONLY_PDF`; OCR is not installed or approved.
- Parser timeouts cannot forcibly terminate synchronous CPU work inside the current process.
- Object-count and decompressed-stream limits are not directly exposed by PDF.js; byte, page, text-item, character, and image limits provide bounded first-stage controls.
- Parser process isolation and malware/content-disarm scanning remain future hardening.
