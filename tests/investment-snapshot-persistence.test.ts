import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalIngestionStore } from "../lib/persistence/local-ingestion-store.ts";
import type { CanonicalInvestmentSnapshot } from "../types/investments.ts";

const snapshot: CanonicalInvestmentSnapshot = {
  id: "investment-snapshot:one", accountId: "investment-account", providerId: "td", accountType: "tfsa",
  parserVersion: "td-multi-holding-investment-v1", statementPeriodStart: "2099-04-01", statementPeriodEnd: "2099-06-30",
  endingValueCents: 2_000_000, bookCostCents: 1_500_000, contributionsCents: null, withdrawalsCents: null,
  employeeContributionsCents: null, employerContributionsCents: null, sourceSha256: "private-source-hash", recordedAt: "2099-07-01T00:00:00.000Z",
};

test("persists factual investment snapshots encrypted and deduplicated", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vorvex-investment-"));
  const databasePath = path.join(directory, "ingestion.sqlite");
  const key = Buffer.alloc(32, 7);
  try {
    const store = new LocalIngestionStore({ databasePath, encryptionKey: key });
    assert.equal(store.saveInvestmentSnapshot(snapshot), "saved");
    assert.equal(store.saveInvestmentSnapshot({ ...snapshot, id: "investment-snapshot:duplicate" }), "duplicate");
    assert.deepEqual(store.getInvestmentSnapshots("investment-account"), [snapshot]);
    store.close();
    const bytes = await readFile(databasePath);
    assert.equal(bytes.includes(Buffer.from("2000000")), false);
    assert.equal(bytes.includes(Buffer.from("1500000")), false);
  } finally { key.fill(0); await rm(directory, { recursive: true, force: true }); }
});
