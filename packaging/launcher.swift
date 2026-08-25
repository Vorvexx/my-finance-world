import AppKit
import Foundation

let label = "com.vorvex.founder-v1"
let uid = getuid()
let url = URL(string: "http://127.0.0.1:3210/")!
let chrome = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.google.Chrome")

func openVorvex() {
  guard let chrome else { exit(1) }
  let configuration = NSWorkspace.OpenConfiguration()
  configuration.activates = true
  NSWorkspace.shared.open([url], withApplicationAt: chrome, configuration: configuration) { _, error in
    exit(error == nil ? 0 : 1)
  }
  RunLoop.current.run()
}

if (try? Data(contentsOf: url)) != nil {
  openVorvex()
}

let launch = Process()
launch.executableURL = URL(fileURLWithPath: "/bin/launchctl")
launch.arguments = ["kickstart", "-k", "gui/\(uid)/\(label)"]
try? launch.run()
launch.waitUntilExit()

for _ in 0..<40 {
  if (try? Data(contentsOf: url)) != nil {
    openVorvex()
  }
  Thread.sleep(forTimeInterval: 0.25)
}
exit(1)
