import AppKit
import Foundation

let label = "com.vorvex.founder-v1"
let uid = getuid()
let launch = Process()
launch.executableURL = URL(fileURLWithPath: "/bin/launchctl")
launch.arguments = ["kickstart", "-k", "gui/\(uid)/\(label)"]
try? launch.run()
launch.waitUntilExit()

let url = URL(string: "http://127.0.0.1:3210/")!
for _ in 0..<40 {
  if (try? Data(contentsOf: url)) != nil {
    NSWorkspace.shared.open(url)
    exit(0)
  }
  Thread.sleep(forTimeInterval: 0.25)
}
exit(1)
