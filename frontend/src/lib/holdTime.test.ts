import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getTomorrowAtEightAM, parseTodayTimeInput } from "./holdTime.ts";

describe("getTomorrowAtEightAM", () => {
  test("returns 08:00:00.000 on the next calendar day", () => {
    const now = new Date();
    const result = getTomorrowAtEightAM();

    const expectedDay = new Date(now);
    expectedDay.setDate(expectedDay.getDate() + 1);

    assert.equal(result.getDate(), expectedDay.getDate());
    assert.equal(result.getHours(), 8);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
  });
});

describe("parseTodayTimeInput", () => {
  test("returns null for invalid formats", () => {
    assert.equal(parseTodayTimeInput(""), null);
    assert.equal(parseTodayTimeInput("not a time"), null);
    assert.equal(parseTodayTimeInput("24:00"), null);
    assert.equal(parseTodayTimeInput("12:60"), null);
    assert.equal(parseTodayTimeInput("1:30"), null);
  });

  test("parses a time later today as today", () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    const hh = String(future.getHours()).padStart(2, "0");
    const mm = String(future.getMinutes()).padStart(2, "0");

    const result = parseTodayTimeInput(`${hh}:${mm}`);

    assert.ok(result);
    assert.equal(result.getDate(), now.getDate());
    assert.equal(result.getHours(), future.getHours());
    assert.equal(result.getMinutes(), future.getMinutes());
  });

  test("rolls over to tomorrow when the time has already passed today", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    const hh = String(past.getHours()).padStart(2, "0");
    const mm = String(past.getMinutes()).padStart(2, "0");

    const result = parseTodayTimeInput(`${hh}:${mm}`);

    assert.ok(result);
    assert.ok(result.getTime() > now.getTime());

    const expectedDay = new Date(now);
    expectedDay.setDate(expectedDay.getDate() + 1);
    assert.equal(result.getDate(), expectedDay.getDate());
  });

  test("trims surrounding whitespace", () => {
    const result = parseTodayTimeInput("  08:30  ");
    assert.ok(result);
    assert.equal(result.getHours(), 8);
    assert.equal(result.getMinutes(), 30);
  });
});
