import "server-only";
import path from "node:path";

export const dataRoot = () => path.resolve(process.env.VORVEX_DATA_DIR ?? path.join(process.cwd(), ".vorvex-data"));
export const inboxPath = () => path.join(dataRoot(), "inbox");
export const quarantinePath = () => path.join(dataRoot(), "quarantine");
export const statePath = () => path.join(dataRoot(), "state.vorvex");
export const keyPath = () => path.join(dataRoot(), "state.key");
