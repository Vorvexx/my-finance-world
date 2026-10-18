#!/bin/sh
set -eu
helper="${VORVEX_KEYCHAIN_HELPER:-$HOME/Library/Application Support/Vorvex/runtime/keychain-helper}"
[ -x "$helper" ] || { printf 'Install the Vorvex Founder runtime first.\n' >&2; exit 1; }
printf 'Plaid Client ID: ' >&2; IFS= read -r client_id
printf 'Plaid Secret (hidden): ' >&2; stty -echo; IFS= read -r secret; stty echo; printf '\n' >&2
[ -n "$client_id" ] && [ -n "$secret" ] || { printf 'Both values are required.\n' >&2; exit 1; }
printf 'Plaid environment [sandbox/production] (sandbox): ' >&2; IFS= read -r environment
environment=${environment:-sandbox}
case "$environment" in sandbox|production) ;; *) printf 'Environment must be sandbox or production.\n' >&2; exit 1 ;; esac
printf %s "$client_id" | "$helper" set-plaid-client-id
printf %s "$secret" | "$helper" set-plaid-secret
printf %s "$environment" | "$helper" set-plaid-environment
unset client_id secret environment
printf 'Plaid credentials stored in macOS Keychain.\n'
