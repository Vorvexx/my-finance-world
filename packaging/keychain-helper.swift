import Foundation
import Security

let service = "com.vorvex.founder-v1.persistence"
func query(_ account: String) -> [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] }
func read(_ account: String) -> Data? { var request = query(account); request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne; var result: CFTypeRef?; let status = SecItemCopyMatching(request as CFDictionary, &result); if status == errSecItemNotFound { return nil }; guard status == errSecSuccess, let result, CFGetTypeID(result) == CFDataGetTypeID() else { exit(2) }; return result as! CFData as Data }
func write(_ account: String, _ data: Data) { if read(account) != nil { guard SecItemUpdate(query(account) as CFDictionary, [kSecValueData as String: data] as CFDictionary) == errSecSuccess else { exit(4) } } else { var request = query(account); request[kSecValueData as String] = data; request[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly; guard SecItemAdd(request as CFDictionary, nil) == errSecSuccess else { exit(4) } } }
guard CommandLine.arguments.count == 2 else { exit(2) }
let operation = CommandLine.arguments[1]
if operation == "get" || operation == "get-or-create" { let account = "local-encryption-key"; if let existing = read(account) { guard existing.count == 32 else { exit(2) }; print(existing.base64EncodedString(), terminator: ""); exit(0) }; guard operation == "get-or-create" else { exit(44) }; var bytes = [UInt8](repeating: 0, count: 32); guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { exit(3) }; let key = Data(bytes); write(account, key); print(key.base64EncodedString(), terminator: ""); exit(0) }
let plaidAccounts = [
    "get-plaid-client-id": "plaid-client-id",
    "get-plaid-secret": "plaid-secret",
    "get-plaid-environment": "plaid-environment",
    "set-plaid-client-id": "plaid-client-id",
    "set-plaid-secret": "plaid-secret",
    "set-plaid-environment": "plaid-environment",
]
guard let account = plaidAccounts[operation] else { exit(2) }
if operation.hasPrefix("get-") { guard let value = read(account), !value.isEmpty else { exit(44) }; FileHandle.standardOutput.write(value); exit(0) }
let value = FileHandle.standardInput.readDataToEndOfFile(); guard !value.isEmpty, value.count <= 4096 else { exit(2) }; write(account, value)
