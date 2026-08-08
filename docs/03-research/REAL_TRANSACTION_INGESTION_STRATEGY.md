# Real Transaction Ingestion Strategy

**Status:** Approved architecture decision; no external provider approved or implemented

**Date:** 2026-08-08

**Scope:** TD Canada Trust chequing and credit-card transactions first

## 1. Executive recommendation

Vorvex should ship a **fully local statement inbox first**, beginning with TD CSV exports and adding OFX/QFX as soon as current TD samples confirm their field quality. PDF statements should remain a local, opt-in fallback for historical recovery—not the routine feed.

The permanent strategy should be hybrid:

```text
Local CSV / OFX / PDF       Optional aggregator       Future Canadian CDB
          \                       |                         /
           \                      |                        /
            +---- source-specific provider adapters ------+
                                  |
                         raw transaction contract
                                  |
              existing canonical ingestion pipeline
                                  |
                     canonical transaction ledger
                                  |
                    Worlds / queries / UI / reports
```

This challenges one assumption in the task: a live bank connection should not be Vorvex's first real-data milestone. For an early-stage financial digital twin, automatic connectivity does not yet justify the additional credential-adjacent dependency, token custody, central breach radius, vendor contract, and operational burden. Local export ingestion provides real evidence sooner while preserving the architecture required for automation later.

**Decision:** connect the file system first, not TD. Implement one local TD CSV adapter behind the existing provider boundary, a durable import journal, and a scheduled inbox scan with a manual trigger. Evaluate OFX/QFX from sanitized real samples in the same implementation cycle. Add an aggregator only after the local pipeline is proven and users identify download friction as a material barrier.

## 2. Explicit answers

| Question | Answer |
|---|---|
| What should we connect first? | A user-controlled local inbox containing TD chequing and credit-card exports. No institution connection is required. |
| Should the founder begin with local statements or an API? | Local statements. Start with TD CSV; prefer OFX/QFX for routine imports if current samples prove stable and complete. |
| What is the safest route? | Entirely local, read-only file ingestion with no bank credentials, provider tokens, or cloud transfer. |
| What is the cheapest route? | Local CSV/OFX ingestion: no provider fee and negligible storage cost. It does require parser and desktop-worker engineering. |
| What is the best UX route? | A reliable consent-based API connection with automatic refresh and pending activity. Today that means an aggregator; eventually it should mean Canada's consumer-driven banking APIs through an accredited intermediary. |
| Can one architecture support all three? | Yes. Local files, aggregators, and future open-banking connections should be provider adapters producing the same raw contract for the canonical pipeline. |
| Which option minimizes future rework? | The hybrid provider boundary plus canonical ledger. Provider-specific parsing, tokens, and refresh logic must never enter the UI or canonical model. |
| When should Plaid/Flinks/Open Banking be added? | Pilot Plaid and Flinks when repeated manual exports impede use or external beta users require automatic refresh. Choose only after live TD chequing/card tests, pricing, residency, retention, deletion, and incident terms are verified. Adopt Canadian CDB when production APIs and accredited intermediaries offer adequate TD coverage and reliability; do not wait for it or become a direct participant initially. |

## 3. TD-specific recommendation

TD documents EasyWeb downloads in Quicken, QuickBooks, spreadsheet CSV, and accounting formats, with the cited download page describing account activity since the last download up to 45 days. The exact current formats and history window must be verified in the founder's present EasyWeb interface before parser commitments. TD separately provides downloadable PDF statements and advertises up to seven years of online statements. ([TD transaction downloads](https://td.intelliresponse.com/rewards/?id=352&question=How+do+I+download+my+account+information&requestType=NormalRequest&source=3), [TD online statements](https://www.td.com/ca/en/personal-banking/how-to/easy-web/access-online-statement))

Recommended order:

1. **TD CSV first:** fastest transparent parser, easy to inspect, and officially documented. Build distinct chequing and credit-card dialect fixtures because column names, signs, and date semantics can differ.
2. **OFX/QFX validation immediately:** if the current TD export contains stable transaction identifiers, account/currency metadata, and reliable signed amounts, prefer it for normal recurring imports. Never rely on its source ID alone; retain a secondary content fingerprint for resilience.
3. **PDF only for history gaps:** process text-based PDFs locally when CSV/OFX history is unavailable. Reject unknown layouts and scanned/image PDFs initially rather than silently extracting bad financial facts.

Statement downloads normally contain posted activity, not a dependable live pending feed. Therefore the local route cannot promise pending transactions or automatic daily refresh. Those capabilities are the reason—not architecture—to add an API later.

### Format ranking

| Rank | Format | Reliability | Privacy | Effort | Completeness | Policy |
|---|---|---|---|---|---|---|
| 1 | OFX/QFX | Highest when institution IDs are stable; structured financial semantics | Excellent; local and selective extraction | Medium | Usually strong for posted activity and metadata | Preferred recurring format after TD sample validation |
| 2 | CSV | High with versioned TD dialects; weaker semantics and IDs | Excellent; easy to minimize locally | Lowest | Good posted activity; variable history and metadata | First implementation |
| 3 | PDF | Layout-dependent and vulnerable to silent parsing errors | Good only with fully local extraction and strict minimization | Highest ongoing maintenance | Best historical document availability, weakest machine semantics | Fallback only; never primary |

## 4. Founder and commercial recommendations

### Founder personal use

Use the local inbox exclusively for the first real ledger. The founder downloads TD files directly while signed into TD; Vorvex never sees bank credentials. A local worker scans periodically, and a visible **Process inbox now** action provides deterministic control. Keep encrypted source files for 30 days by default so early parser errors can be repaired, then purge them automatically after verified extraction; allow immediate deletion or indefinite encrypted retention as explicit choices.

Do not place a production aggregator token on the founder's device yet. It adds complexity without validating the essential product question: whether transaction evidence makes Worlds more useful.

### Commercial product

Keep local import as a first-class privacy mode, then offer an optional automatic connection. Run a time-boxed TD bake-off between Plaid and Flinks using non-production engineering data first and consenting internal TD accounts only after security review. Test connection success, chequing/card coverage, history, pending-to-posted reconciliation, refresh latency, duplicate behavior, reconnection frequency, deletion, and support—not merely whether Link/Connect succeeds.

Plaid is the practical first pilot because it offers self-serve Sandbox, a small production Trial, documented transaction synchronization, and public Canadian/TD positioning. Flinks should be the mandatory Canadian comparison because of its Canadian focus and institution coverage. Wealthica is a secondary candidate when investment aggregation becomes important; MX and Yodlee are later RFP candidates if coverage or enterprise requirements justify them.

Do not build direct TD screen scraping. Do not distribute a provider client secret in a browser or desktop binary. Do not become a direct Canadian consumer-driven-banking participant initially; use an accredited intermediary when that ecosystem is operational.

## 5. Option comparison

Ratings are directional and must be confirmed by a TD production pilot. “Unknown” means a vendor quote or technical confirmation is required.

| Path | TD / Canada | History and pending | Refresh / reliability | Setup and cost | Local-first / offline | Lock-in and UX | Recommendation |
|---|---|---|---|---|---|---|---|
| Canadian CDB | Intended national framework; production coverage is still emerging | Standards should support consented data, but actual TD scope must be proven | Not yet a dependable v1 dependency | Direct participation brings accreditation, security, insurance, compliance, and operations; intermediary pricing unknown | Remote only while connected; canonical local cache can work offline | Best long-term portability and consent model | Align interfaces now; adopt through an accredited intermediary later |
| Plaid | Plaid identifies TD Canada Trust among its Canadian launch institutions; exact current products must be checked in Dashboard/API | Transactions supports up to 24 months and pending/posted data where the institution supplies it | Commonly checks one or more times daily; webhooks and sync; institution variance remains | Free Sandbox; eligible new CA/US accounts have a 10-production-Item Trial; paid Transactions pricing is not public | Requires remote provider and backend token custody; cached ledger works offline | Strong onboarding UX; provider-specific connection lifecycle | First aggregator pilot |
| Flinks | Strong Canadian positioning and broad institution search including TD | Must verify exact TD chequing/card history and pending behavior in a pilot | Daily/on-demand behavior and reconnect rate require contract confirmation | Sales/onboarding; public price/minimum unavailable | Remote provider; cached ledger works offline | Canadian specialization; non-expiring login identifier and provider retention increase lifecycle duties | Mandatory comparison to Plaid |
| Wealthica | 150+ Canadian institutions; oriented toward wealth aggregation | Transactions and daily/manual synchronization documented; TD transaction quality must be tested | Provider can be API, OAuth, or scraper; outage/reconnect behavior varies | Sales contact for keys/production; public price unavailable | Remote provider; cached ledger works offline | Attractive for future investments, less clearly optimal for TD spending first | Revisit for investment Worlds |
| MX / Yodlee | Broad North American coverage claims; TD specifics require testing | Mature aggregation generally; contract/product dependent | Enterprise-oriented | Developer/sandbox entry exists; production pricing is sales-led | Remote provider | Higher procurement/operational weight | Later RFP or coverage fallback |
| Local OFX/QFX | Current TD availability must be verified; Quicken/QuickBooks export is documented | Posted history only; structured fields, often transaction IDs; no dependable pending | User refreshes by downloading; deterministic local processing | No provider fee; medium parser effort | Excellent; fully offline | No vendor lock-in; manual download friction | Preferred local format if sample quality passes |
| Local CSV | TD explicitly documents spreadsheet CSV | Posted history; limited metadata/IDs; no pending | User refreshes; reliable with versioned dialects | No provider fee; lowest implementation effort | Excellent; fully offline | No provider lock-in; manual download friction | Build first |
| Local PDF | TD offers years of statements | Posted statement history; no pending; layout-dependent | User refreshes; brittle across statement-layout changes | No provider fee; highest parser/test maintenance | Excellent if no cloud OCR | Useful recovery UX, high silent-error risk | Fallback only |

### Provider evidence and caveats

- Plaid documents transaction history up to 730 days, pending/posted updates, synchronization, and institution-dependent checks typically one or more times daily. Coverage Explorer and a live development call—not a marketing page—must determine current TD product support. ([Plaid Transactions](https://plaid.com/docs/transactions/), [Plaid Transactions API](https://plaid.com/docs/api/products/transactions/), [Plaid institutions](https://plaid.com/docs/institutions/))
- Plaid's public pricing describes month-to-month Pay as You Go and a contracted Growth tier but does not publish the applicable Canadian Transactions dollar rate. Sandbox is free, and eligible new accounts after April 15, 2026 can test up to 10 production Items. ([Plaid pricing](https://plaid.com/pricing/), [Plaid Sandbox](https://plaid.com/docs/sandbox/), [Plaid environments and Trial](https://support.plaid.com/hc/en-us/articles/16110110883479-How-are-Sandbox-Production-Trial-plan-and-Limited-Production-different))
- Flinks Connect handles login/MFA in its hosted experience while Vorvex's server exchanges authorization and stores the resulting identifier. Flinks documents OAuth and credential-based connections; “Vorvex does not see credentials” does not mean “no intermediary ever handles credentials.” ([Flinks standard integration](https://help.flinks.com/support/solutions/articles/43000765790-flinks-standard-integration-flinks-connect-api-), [Flinks Connect](https://docs.flinks.com/guides/connect/flinks-connect/flinks-connect))
- Flinks describes its `loginId` as non-expiring until deletion and its associated data as retained while the client is active. Contractual deletion and retention behavior must therefore be tested. ([Flinks retention](https://help.flinks.com/support/solutions/articles/43000723738-loginid-vs-requestid-concept-and-data-retention-), [Flinks data safety](https://www.flinks.com/data-safety))
- Wealthica documents Connect, transaction synchronization, daily sync, OAuth/API/scraper provider classes, and sales-assisted production access. ([Wealthica documentation](https://wealthica.com/docs/), [Wealthica API](https://wealthica.com/docs/api/), [Wealthica providers](https://wealthica.com/docs/manage-providers/))

## 6. Realistic cost analysis

No responsible dollar comparison is possible before vendor quotes: Plaid does not publicly expose the applicable Transactions unit price, and Flinks, Wealthica, MX, and Yodlee use sales-led production pricing. The next decision must not invent estimates.

| Cost area | Local ingestion | Aggregator | Direct CDB participation |
|---|---|---|---|
| Provider fees | $0 | Usage/subscription, possible platform/minimum/support and refresh add-ons; written quote required | Network/intermediary fee may apply; “fee-free consumer data sharing” is not proof that participation costs are zero |
| Initial engineering | CSV/OFX parsers, journal, watcher, encrypted store | Hosted-link flow, backend, token vault, webhooks, sync/reconciliation, consent/revocation | Accreditation integration, standards, certificates, consent, registry, compliance |
| Ongoing engineering | Format fixtures and parser updates; PDF is highest | Institution outages, reconnects, webhook operations, API migrations | Regulatory and certification changes, 24/7 security and operational controls |
| Security/compliance | Device-focused threat model | Central token/data service, privacy counsel, vendor due diligence, incident response, audits | Highest governance, insurance, oversight, assurance burden |
| User/support cost | Repeated downloads and account mapping | Connection troubleshooting and consent renewal | Connection/support behavior unknown until ecosystem matures |

For a quote, request a price sheet covering connected Item versus account billing, Transactions subscription, history initialization, on-demand refresh, recurring transactions, sandbox/trial limits, minimums, Canadian taxes/currency, overages, support tier, termination, export, and deletion. Model monthly cost as active connections × contracted subscription plus refresh/add-ons and fixed minimums; do not extrapolate from another customer's contract.

## 7. Security architecture

### Credential boundary

- **Local statement mode:** Vorvex never receives a TD username, password, PIN, MFA response, or session cookie. The user authenticates directly with TD and supplies an exported file.
- **Aggregator mode:** use only provider-hosted Link/Connect or bank OAuth. Vorvex UI must never render its own bank-credential form. With non-OAuth institutions, the aggregator may still handle credentials; disclose that distinction clearly.
- Reject custom browser automation and screen scraping.

### Token boundary

For a commercial service, access tokens and connection identifiers live only in a backend token vault. Encrypt each token with a per-record data key; wrap that key with a managed KMS/HSM key. Store provider client secrets in a separate secret manager. Never place either in browser storage, client logs, analytics, crash reports, source control, or desktop application bundles.

A purely personal local service could encrypt an access token with a key held in macOS Keychain/Secure Enclave-backed storage, but normal aggregator integrations also require a confidential application secret. Shipping that secret in a desktop app makes extraction possible. Therefore local-only tokens are acceptable only when the provider contract and authorization design explicitly support a public/native client; otherwise retain the backend boundary.

### Least privilege and lifecycle

- Request only read-only accounts/balances and transactions required by an approved feature. Do not request identity, payments, routing/account-number authorization, investments, liabilities, or income by default.
- Use short-lived one-time Link/Connect session tokens. Rotate application secrets and encryption keys through documented procedures.
- Record consent purpose, requested data, provider, connection timestamp, and revocation state without logging sensitive payloads.
- Disconnect must revoke/delete the provider connection, remove local token material, stop webhooks, and apply the selected local-ledger retention choice.
- Verify webhook signatures, timestamps, replay protection, and connection ownership before scheduling sync.

### Data at rest, backups, and logging

- Store the local canonical ledger in an encrypted database; keep its key in the OS keychain, not beside the database. Require FileVault as a recommended device control.
- Use TLS for all remote traffic. Use restrictive file permissions and private application directories for local files.
- Never persist credentials, MFA answers, PIN/CVV, full card/account numbers, unnecessary addresses, raw hosted-link payloads, or secrets in provenance.
- Redact logs by default: no descriptions, amounts, tokens, source rows, account numbers, or statement contents. Use internal event IDs, parser version, counts, status codes, and pseudonymous connection references.
- Encrypt backups independently; never back up keys in the same artifact. Test restoration. Raw statement backups are opt-in and time-limited.

Financial data is sensitive personal information. Canadian privacy guidance requires limiting collection and retention, using safeguards proportionate to sensitivity, controlling access, and securely disposing of data no longer required. This should shape the product before commercial launch, alongside counsel determining applicable federal/provincial obligations. ([OPC fair information principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/), [OPC safeguards](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_safeguards/), [OPC retention](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/safeguarding-personal-information/gd_rd_201406/))

## 8. Threat model

| Threat | Consequence | Primary controls | Residual reality |
|---|---|---|---|
| Founder device compromised | Statements, decrypted ledger, or a local token may be read or altered | FileVault, OS keychain, encrypted DB, app lock, least privilege, signed updates, no plaintext archive | Malware with access to an unlocked user session may see what the user can see |
| Aggregator compromised | Tokens, transaction data, and possibly credentials for non-OAuth connections may be exposed | Prefer OAuth/API connections, minimize scope/retention, vendor assurance and breach terms, rapid revocation, avoid unnecessary raw storage | A third party remains in the trust chain |
| Vorvex backend compromised | Multi-user token/data breach and fraudulent sync requests | Segmentation, envelope encryption, KMS policy, no credentials, service identity, audit/alerting, key rotation, tenant isolation | Commercial centralization increases breach radius compared with local-only use |
| Malicious/malformed statement | Parser exploit, resource exhaustion, formula injection, or corrupted ledger | Treat files as hostile; size/type limits, magic-byte checks, isolated parsers, no macro execution, dependency pinning, strict schemas, quarantine | Complex PDF parsers retain more attack surface than CSV/OFX parsers |
| Duplicate/overlapping exports | Double-counted activity and false conclusions | File SHA-256 journal plus canonical transaction dedupe, atomic commits, visible import receipts | Similar legitimate transactions require conservative matching and review |
| Partial file or interrupted process | Truncated parse or inconsistent ledger | Stability checks, atomic claim/rename, journal states, database transaction, resumable recovery | Network/cloud-synced folders can have unusual file semantics; keep inbox local |
| Provider outage/schema change | Stale data or ingestion failure | Provider isolation, last-success timestamp, retry/backoff, local imports remain available, contract tests | Automatic data can still become stale; UI must say so |
| Insider/support access | Unauthorized viewing of financial details | No routine plaintext access, role separation, audited just-in-time access, redacted support bundles | Commercial operations require governance, not encryption alone |

## 9. Fully local automated statement ingestion

### Recommended local structure

```text
~/Vorvex/
├── Inbox/
│   └── TD/
│       ├── Chequing/
│       └── CreditCard/
├── Archive/                 # encrypted originals; opt-in, retention-controlled
├── Quarantine/              # failed originals plus non-sensitive reason receipt
└── Receipts/                # hashes and import metadata; no source rows

~/Library/Application Support/Vorvex/
└── Data/
    ├── vorvex.db            # encrypted canonical ledger and import journal
    └── parser-fixtures/      # non-personal format metadata only
```

The database belongs in the operating system's private application-data location, not a conspicuous user folder or synced Documents directory. The visible `~/Vorvex` tree is the controlled handoff surface. The inbox should be local rather than iCloud/Dropbox-backed by default.

### Detection decision

Use a **scheduled folder scan as the source of truth**, plus a manual **Process inbox now** action. A native filesystem watcher may wake the scanner sooner, but it must not be the only detector: events can be coalesced or missed during sleep, and files may be observed before a browser finishes downloading them. OS folder automation is harder to support and audit across platforms.

| Approach | Safety and reliability | Decision |
|---|---|---|
| Scheduled scan | Recovers after sleep/crash and naturally retries; modest latency | Primary automatic mechanism |
| Manual trigger | Explicit, observable, easiest recovery path | Always available |
| Filesystem watcher | Low latency but events may be missed/duplicated and files may be partial | Optional wake-up hint only |
| OS folder automation | Hidden external configuration, platform-specific permissions and support | Do not require |

### Idempotent, resumable workflow

1. Scan only approved inbox roots; ignore hidden, temporary, and symlinked files.
2. Require size and modification time to remain stable across two observations and verify the file can be opened exclusively.
3. Atomically rename the candidate to a processing name on the same volume, preventing concurrent workers from claiming it.
4. Compute SHA-256 over the original bytes before parsing. If the import journal already records a successful identical hash, create a duplicate receipt without ingesting transactions.
5. Check size, extension, MIME/magic signature, parser version, and institution/account dialect. Enforce resource/time limits and parse in an isolated worker.
6. Validate the raw record schema before normalization. Extract only date, amount/direction, description, status when available, source transaction ID, account alias, and necessary provenance.
7. Map the source account through a user-approved local alias. Do not persist a full account number; retain last four digits only if the user needs disambiguation, preferably alongside a salted local lookup hash.
8. Send raw records through the existing canonical validation, normalization, deduplication, and deterministic World-attribution pipeline. Use provider source ID when trustworthy plus source/file/row evidence; apply a conservative semantic fingerprint to overlapping exports without merging ambiguous legitimate transactions.
9. Commit the canonical ledger changes and import-journal transition atomically. Store hash, source kind, sanitized filename, parser version, counts, account alias, date range, imported timestamp, and outcome—not full source rows.
10. Verify committed counts/totals against parser output and produce a user-readable receipt. Only then archive or delete the source according to policy.
11. On failure, move the original to Quarantine and write a generic reason code. Never include statement contents in an error log.
12. On restart, reconcile journal states (`discovered`, `claimed`, `parsed`, `committed`, `archived`) and processing files. Re-run only steps that were not durably completed.

The file hash prevents duplicate files; canonical identity/deduplication prevents duplicate transactions in overlapping exports. Both layers are necessary.

## 10. Data-retention policy

| Data | Founder default | Commercial default | Deletion rule |
|---|---|---|---|
| Bank credentials / MFA / session cookies | Never collect | Never collect; provider-hosted only | Not applicable because Vorvex does not persist them |
| Original CSV/OFX/PDF | Encrypted archive for 30 days to support early parser recovery | Delete immediately after verified import unless the user explicitly opts into encrypted retention | Crypto-delete the archive key and remove file after successful commit/verification and retention expiry |
| Canonical transactions | Retain until user deletes ledger/account | Retain for the stated service purpose and user-selected history | Cascade deletion with auditable tombstone that contains no transaction facts |
| Import receipt/fingerprint | Retain while ledger exists to preserve idempotency and provenance | Same, subject to purpose/consent | Delete with associated ledger/source; treat metadata as sensitive |
| Quarantined files | Notify immediately; auto-delete after 7 days unless user retries | Same or shorter | Never retain indefinitely |
| Provider tokens | None initially | Until disconnect, expiry, or revocation; encrypted separately | Revoke at provider, then cryptographically erase local token material |
| Operational logs | Minimal local logs, 14 days | Redacted security/operations logs, 30–90 days based on documented need | Automated expiry; no financial payloads |
| Backups | Encrypted canonical DB; source archive excluded by default | Encrypted, access-controlled, defined expiry | Deletion propagates within a published backup-expiry window |

On APFS/SSD storage, overwriting a file does not guarantee physical erasure because of copy-on-write and wear leveling. Encryption from creation and destruction of the relevant key provide a stronger practical deletion mechanism than claiming a “secure overwrite.” Retention periods are product recommendations, not legal conclusions; formal policy must account for applicable law and documented purposes before launch.

## 11. Migration path to optional APIs

1. Keep source identity and connection lifecycle outside the canonical record; retain provider/source provenance in the established form.
2. Add aggregator adapters that emit the same raw transaction contract used by file adapters.
3. Introduce a separate connection service for consent, tokens, sync cursors, webhook verification, retries, and revocation. It may schedule providers but cannot bypass canonical ingestion.
4. Reconcile overlap conservatively. A TD CSV transaction and later Plaid transaction may represent the same event; use stable institution IDs where available and a reviewable cross-source match proposal. Do not silently merge on amount/date/merchant alone.
5. Preserve local mode permanently. Users can stay local, enable API-only, or use API plus statements for backfill/recovery.
6. When Canadian CDB is ready, add an accredited-intermediary adapter and migrate connections without changing the ledger/UI. Use standardized consent and data fields where available.

Canada's framework is intended to replace credential sharing/screen scraping with secure APIs and participant oversight, but implementation is still progressing. In June 2026 the government described proposed regulations and the Bank of Canada's future oversight/registry; that is a direction to design toward, not a generally dependable TD integration to ship today. ([Canada CDB framework](https://www.canada.ca/en/department-finance/programs/financial-sector-policy/open-banking-implementation/budget-2025-canadas-framework-for-consumer-driven-banking.html), [June 2026 regulations update](https://www.canada.ca/en/department-finance/news/2026/06/government-pre-publishes-regulations-to-prevent-fraud-and-facilitate-the-next-phase-of-consumer-driven-banking.html))

## 12. Risks and failure modes

- **False confidence from Sandbox:** mock data does not reproduce TD MFA, outages, history limits, pending behavior, or connection repair. A controlled production pilot is mandatory.
- **Format drift:** TD can alter CSV columns or PDF layouts. Version parsers, preserve sanitized structural fixtures, fail closed, and show actionable quarantine reasons.
- **Sign ambiguity:** credit-card exports may express purchases/payments differently from chequing. Require account-type-specific rules and invariant tests; never guess silently.
- **Missing pending activity:** local exports can look current while excluding authorizations. Label data freshness and posted-only scope explicitly.
- **Overlap across sources:** switching from files to APIs can double-count history. Maintain source provenance and require conservative cross-source reconciliation.
- **Aggregator degradation:** institution connections can break independently of Vorvex. Display last successful sync and connection state without implying completeness.
- **Vendor lock-in:** proprietary IDs, categories, and enrichment can leak into product logic. Keep them in adapter evidence; Vorvex owns normalization and World attribution.
- **Excess retention:** original statements create little long-term product value but high breach impact. Default to short encrypted retention and verified deletion.
- **PDF extraction error:** a plausible but wrong amount is more dangerous than a rejected file. Accept known text layouts only, reconcile totals where available, and require review for low-confidence extraction.
- **Local device loss:** local-first reduces central breach radius but does not create a backup automatically. Offer encrypted user-controlled backup with tested restore.
- **Regulatory drift:** Canadian CDB and privacy obligations will evolve. Conduct privacy/security review before external beta and legal review before commercial operation.

## 13. Proposed implementation sequence

### Phase 1 — local real-data pilot

1. Obtain sanitized structural samples from current TD chequing and credit-card CSV plus Quicken/QuickBooks exports; preserve no real values in Git.
2. Write a narrow source-adapter contract and versioned TD CSV dialect parsers behind the existing raw transaction provider interface.
3. Add import journal, file hashing, atomic commits, receipts, quarantine, and conservative overlapping-export deduplication.
4. Add scheduled local scanner plus manual trigger; add an optional watcher only as a latency hint.
5. Add encrypted local database/keychain boundary and configurable source retention before using private files.
6. Validate totals, reversals, payments, dates, sign conventions, duplicate files, overlapping ranges, malformed files, interruption, and resume behavior.
7. Enable the founder's TD chequing and credit-card inbox locally; do not commit fixtures or private files.

### Phase 2 — format breadth

8. Add OFX/QFX if the samples outperform CSV on identity and metadata; select it as the suggested export while retaining CSV.
9. Add a known-layout, text-only PDF fallback for historical gaps. Defer OCR and unknown-layout inference.

### Phase 3 — automatic connection pilot

10. Define measurable thresholds: manual-import frequency, user drop-off, required pending visibility, freshness target, support tolerance, and cost ceiling.
11. Obtain written Plaid and Flinks coverage, residency, retention/deletion, security, SLA/support, and pricing terms.
12. Run the TD bake-off through the same canonical pipeline. No provider categories or UI models become canonical.
13. Security-review the backend token vault, consent/revocation lifecycle, webhooks, and incident response before external production use.
14. Choose one provider only if its live results materially improve UX at acceptable reliability and total cost. Keep local ingestion available.

### Phase 4 — Canadian CDB adoption

15. Monitor the Bank of Canada participant registry, accreditation, common API standards, TD availability, and accredited intermediary offerings.
16. Prefer an accredited intermediary that reduces direct compliance burden. Migrate only when production evidence exceeds the selected aggregator or materially improves privacy, portability, reliability, or cost.

## 14. Decision gate for an aggregator

It becomes worthwhile to add Plaid or Flinks when at least one is true:

- active users must import more often than the product's acceptable manual cadence;
- missing pending/daily activity prevents a core World experience;
- import friction materially reduces activation or retention;
- commercial customers require automated feeds;
- a provider demonstrates reliable TD chequing/card coverage and reconnection behavior in production.

Proceed only if all are true:

- written pricing fits the per-active-user economics, including minimums and add-ons;
- Vorvex never receives bank credentials and has an acceptable disclosure for any aggregator credential handling;
- Canadian data residence/transfer, subprocessors, retention, deletion, breach notice, and export terms are acceptable;
- tokens remain backend-only and encrypted, consent/revocation is complete, and local mode still works;
- transaction identity, pending-to-posted handling, and overlapping history pass canonical-ledger tests.

## Final recommendation

**Build the fully local automated statement-inbox workflow next.** Start with TD CSV, evaluate OFX/QFX concurrently, and treat PDF as a constrained historical fallback. This is the safest route, the cheapest route, and the fastest way to validate real transaction value without surrendering the future UX.

The best eventual UX is an optional automatic connection. Plaid should be the first technical pilot and Flinks the Canadian control comparison, but neither should be selected from documentation alone. Canada's consumer-driven-banking system is the preferred long-term direction once real TD APIs and accredited intermediaries are operational and proven.

The existing provider-independent transaction pipeline is the correct permanent boundary. Preserving it makes local statements, commercial aggregators, and future open banking additive sources rather than competing architectures.
