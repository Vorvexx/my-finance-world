# Plaid live cutover boundary

Plaid evidence stays in the encrypted provider store. It cannot write the canonical ledger. Cross-source overlap is only a review proposal, never authority to insert or merge events. Statement ingestion and Founder decisions remain authoritative.

Connections retain their environment. Existing connections without environment metadata are Sandbox evidence. Switching credentials never relabels that evidence as live; tokens from another environment are rejected before API use. Actual sync removes superseded pending records when posted records reference them.

The Founder can enter Production/Trial Plaid developer credentials in Chrome on the local Connections page. The setup route requires the exact loopback port, Host, Origin, same-origin fetch metadata and JSON content type. It passes credentials through stdin to the existing Keychain helper, never returns or logs them, and rejects environment-variable overrides. Setup requires an existing recoverable configuration and attempts rollback on a helper write failure. The three Keychain entries are not a crash-atomic transaction; recheck configuration if the process or Keychain is interrupted during setup. This local setup surface trusts processes running as the device owner and is not suitable for network hosting or multi-user deployment.

The Founder personally enters all bank authentication and MFA in Plaid/TD. No TD credentials belong in this setup form. Do not capture the form or authentication window after credential entry. Sandbox credentials are replaced in the existing Keychain slots; Sandbox evidence remains encrypted and preserved, but refreshing it requires restoring the Sandbox configuration.

Live acceptance still requires actual account discovery, Founder balance comparison, transaction coverage and pending lifecycle checks, conservative cross-source reconciliation, restart persistence and full regression validation. A passing synthetic test does not establish those live facts.
