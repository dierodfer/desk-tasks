import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createTranslator, isLocale } from "./index.ts";

describe("createTranslator", () => {
  test("translates a known key", () => {
    const t = createTranslator("en");
    assert.equal(t("addTask"), "Add task");
  });

  test("substitutes variables in the message", () => {
    const t = createTranslator("en");
    assert.equal(t("onHoldSectionTitle", { count: 3 }), "On hold (3)");
  });

  test("leaves unknown placeholders untouched", () => {
    const t = createTranslator("en");
    assert.equal(t("holdUntilLabel"), "Until {date}");
  });

  test("falls back to english for unknown locales", () => {
    // @ts-expect-error intentionally passing an invalid locale
    const t = createTranslator("fr");
    assert.equal(t("addTask"), "Add task");
  });

  test("returns the spanish catalog for es", () => {
    const t = createTranslator("es");
    assert.equal(t("addTask"), "Añadir tarea");
  });
});

describe("isLocale", () => {
  test("accepts supported locales", () => {
    assert.equal(isLocale("en"), true);
    assert.equal(isLocale("es"), true);
  });

  test("rejects everything else", () => {
    assert.equal(isLocale("fr"), false);
    assert.equal(isLocale(null), false);
    assert.equal(isLocale(""), false);
  });
});
