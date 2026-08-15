import os from "node:os";
import path from "node:path";

export const founderRuntimePaths = (home = os.homedir()) => {
  const root = path.join(home, "Library", "Application Support", "Vorvex");
  return {
    root,
    databases: path.join(root, "databases"),
    configuration: path.join(root, "configuration"),
    runtime: path.join(root, "runtime"),
    audit: path.join(root, "audit"),
    backups: path.join(root, "backups"),
    canonicalSnapshot: path.join(root, "canonical-snapshot"),
    configFile: path.join(root, "configuration", "founder-runtime-v1.json"),
    worldFactsFile: path.join(root, "configuration", "founder-world-facts-v1.json"),
    ingestionDatabase: path.join(root, "databases", "ingestion.sqlite"),
    reviewDatabase: path.join(root, "databases", "review.sqlite"),
    relationshipDatabase: path.join(root, "databases", "relationships.sqlite"),
    auditFile: path.join(root, "audit", "events.jsonl"),
    statementFolder: path.join(home, "Documents", "Vorvex Bank Statements"),
    statementApprovedRoot: path.join(home, "Documents", "Vorvex Bank Statements"),
  };
};

export const applyFounderRuntimeEnvironment = (home?: string) => {
  const paths = founderRuntimePaths(home);
  process.env.VORVEX_INGESTION_DATABASE_PATH = paths.ingestionDatabase;
  process.env.VORVEX_REVIEW_DATABASE_PATH = paths.reviewDatabase;
  process.env.VORVEX_RELATIONSHIP_DATABASE_PATH = paths.relationshipDatabase;
  process.env.VORVEX_FINANCIAL_SNAPSHOT_DIR = paths.canonicalSnapshot;
  process.env.VORVEX_BANK_STATEMENTS_DIR = paths.statementFolder;
  return paths;
};
