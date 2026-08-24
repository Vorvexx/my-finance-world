import "server-only";
import path from "node:path";

const defaultDataRoot = path.join(process.cwd(), ".vorvex-data");
export const dataRoot = () => process.env.VORVEX_DATA_DIR ? path.resolve(process.env.VORVEX_DATA_DIR) : defaultDataRoot;
export const inboxPath = () => path.join(dataRoot(), "inbox");
export const quarantinePath = () => path.join(dataRoot(), "quarantine");
export const statePath = () => path.join(dataRoot(), "state.vorvex");
export const keyPath = () => path.join(dataRoot(), "state.key");
