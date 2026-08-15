import Foundation
import Security

let service = "com.vorvex.founder-v1.persistence"
let account = "local-encryption-key"
let query: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrService as String: service,
  kSecAttrAccount as String: account,
]

func readKey() -> Data? {
  var readQuery = query
  readQuery[kSecReturnData as String] = true
  readQuery[kSecMatchLimit as String] = kSecMatchLimitOne
  var result: CFTypeRef?
  let status = SecItemCopyMatching(readQuery as CFDictionary, &result)
  if status == errSecItemNotFound { return nil }
  guard status == errSecSuccess else {
    FileHandle.standardError.write(Data("KEYCHAIN_READ_FAILED:\(status)".utf8))
    exit(2)
  }
  guard let result, CFGetTypeID(result) == CFDataGetTypeID() else {
    FileHandle.standardError.write(Data("KEYCHAIN_VALUE_INVALID".utf8))
    exit(2)
  }
  let data = result as! CFData as Data
  guard data.count == 32 else {
    FileHandle.standardError.write(Data("KEYCHAIN_VALUE_INVALID".utf8))
    exit(2)
  }
  return data
}

guard CommandLine.arguments.count == 2 else { exit(2) }
let operation = CommandLine.arguments[1]
if let existing = readKey() {
  FileHandle.standardOutput.write(Data(existing.base64EncodedString().utf8))
  exit(0)
}
guard operation == "get-or-create" else { exit(44) }

var bytes = [UInt8](repeating: 0, count: 32)
guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { exit(3) }
let key = Data(bytes)
var addQuery = query
addQuery[kSecValueData as String] = key
addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
guard addStatus == errSecSuccess else { exit(4) }
FileHandle.standardOutput.write(Data(key.base64EncodedString().utf8))
