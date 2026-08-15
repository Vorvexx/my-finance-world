export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { applyFounderRuntimeEnvironment } = await import("./lib/runtime/paths.ts");
    applyFounderRuntimeEnvironment();
    const { startFounderRuntime } = await import("./lib/runtime/founder-runtime.ts");
    await startFounderRuntime();
  }
}
