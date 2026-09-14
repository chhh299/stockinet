import test from "node:test";
import assert from "node:assert/strict";
import { getActiveAdapters } from "../lib/sources/index";

test("getActiveAdapters returns all adapters matching market when no env is set", () => {
  const usAdapters = getActiveAdapters("US", undefined);
  const usIds = usAdapters.map((a) => a.id);
  assert.ok(usIds.includes("googlenews"));
  assert.ok(usIds.includes("yahoo"));
  assert.ok(usIds.includes("finnhub"));
  // EastMoney / CLS / Sina don't support US
  assert.equal(usIds.includes("eastmoney"), false);
  assert.equal(usIds.includes("cls"), false);
  assert.equal(usIds.includes("sina"), false);

  const cnAdapters = getActiveAdapters("CN", undefined);
  const cnIds = cnAdapters.map((a) => a.id);
  assert.ok(cnIds.includes("eastmoney"));
  assert.ok(cnIds.includes("tencent"));
  assert.ok(cnIds.includes("cls"));
  assert.ok(cnIds.includes("sina"));
  assert.ok(cnIds.includes("ths"));
  assert.ok(cnIds.includes("research"));
  // GoogleNews / Yahoo / Finnhub 仅限海外市场，不支持 CN
  assert.equal(cnIds.includes("googlenews"), false);
  assert.equal(cnIds.includes("yahoo"), false);
  assert.equal(cnIds.includes("finnhub"), false);
});

test("getActiveAdapters filters by ENABLED_NEWS_SOURCES", () => {
  const envSources = "eastmoney, tencent";
  const adapters = getActiveAdapters("CN", envSources);
  const ids = adapters.map((a) => a.id);

  assert.deepEqual(ids.sort(), ["eastmoney", "tencent"]);
});

test("getActiveAdapters handles invalid / unknown source IDs in env gracefully", () => {
  const envSources = "unknown_source, yahoo";
  const adapters = getActiveAdapters("US", envSources);
  const ids = adapters.map((a) => a.id);

  assert.deepEqual(ids, ["yahoo"]);
});
