#!/bin/sh
set -eu

case "$(uname -s)" in Darwin) ;; *) echo "Vorvex Founder v1 requires macOS." >&2; exit 1 ;; esac

repository_path=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node_path=$(command -v node)
npm_path=$(command -v npm)
node_bin_path=$(dirname "$node_path")
application_root="$HOME/Applications"
application_path="$application_root/Vorvex.app"
launch_agents="$HOME/Library/LaunchAgents"
label="com.vorvex.founder-v1"
plist_path="$launch_agents/$label.plist"
log_root="$HOME/Library/Application Support/Vorvex/runtime"
keychain_helper="$log_root/keychain-helper"

"$npm_path" run build
mkdir -p "$application_path/Contents/MacOS" "$launch_agents" "$log_root"
chmod 700 "$HOME/Library/Application Support/Vorvex" "$log_root"
xcrun swiftc packaging/keychain-helper.swift -o "$keychain_helper" -framework Security
find "$log_root" -type f -exec chmod 600 {} \;
chmod 700 "$keychain_helper"

sed "s|__NPM_PATH__|$npm_path|g; s|__NODE_BIN_PATH__|$node_bin_path|g; s|__REPOSITORY_PATH__|$repository_path|g; s|__LOG_ROOT__|$log_root|g; s|__KEYCHAIN_HELPER__|$keychain_helper|g" packaging/com.vorvex.founder-v1.plist > "$plist_path"
chmod 600 "$plist_path"
cp packaging/Vorvex.app/Contents/Info.plist "$application_path/Contents/Info.plist"
xcrun swiftc packaging/launcher.swift -o "$application_path/Contents/MacOS/Vorvex" -framework AppKit
chmod 755 "$application_path/Contents/MacOS/Vorvex"

launchctl bootout "gui/$(id -u)/$label" >/dev/null 2>&1 || true
if ! launchctl bootstrap "gui/$(id -u)" "$plist_path"; then
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$plist_path"
fi
launchctl enable "gui/$(id -u)/$label"
open "$application_path"

printf 'Vorvex is installed at %s using Node %s.\n' "$application_path" "$node_path"
