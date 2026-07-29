import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../db/migrations/20260802_rebuild_food_search.sql", import.meta.url);

test("yeni migration eski kataloğu temizler, günlük geçmişini korur", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /update public\.food_entries set food_id = null/i);
  assert.match(sql, /drop table if exists public\.recipe_dishes/i);
  assert.match(sql, /drop table if exists public\.foods/i);
  assert.doesNotMatch(sql, /drop table if exists public\.food_entries/i);
});

test("pg_trgm, Türkçe normalizasyon, eş anlamlı, cache ve kişiselleştirme vardır", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create extension if not exists pg_trgm/i);
  assert.match(sql, /create or replace function public\.normalize_food_text/i);
  assert.match(sql, /gin_trgm_ops/i);
  assert.match(sql, /create table public\.food_aliases/i);
  assert.match(sql, /create table public\.food_query_synonyms/i);
  assert.match(sql, /create table public\.food_search_cache/i);
  assert.match(sql, /create table public\.food_selections/i);
  assert.match(sql, /create table public\.food_user_preferences/i);
  assert.match(sql, /revoke all on function public\.record_food_selection/i);
});

test("tek besin API yüzeyi ve sağlayıcı cache katmanı bulunur", async () => {
  const search = await readFile(new URL("../app/api/nutrition/search/route.ts", import.meta.url), "utf8");
  const data = await readFile(new URL("../lib/nutrition-data.ts", import.meta.url), "utf8");
  assert.match(search, /searchFoodCatalog/);
  assert.match(data, /searchUsdaFoodData/);
  assert.match(data, /food_search_cache/);
  assert.match(data, /cacheProviderFoods/);
  await assert.rejects(access(new URL("../app/api/nutrition/recipes/search/route.ts", import.meta.url)));
});
