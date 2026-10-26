import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRound, roleFor, settleRound } from '../public/game.js';

const metadata = JSON.parse(await readFile(new URL('../public/items.json', import.meta.url), 'utf8'));
const snapshot = JSON.parse(await readFile(new URL('../valve-items-source.json', import.meta.url), 'utf8'));

test('full item catalog has matching Valve names, prices, IDs and local PNGs', async () => {
  assert.ok(metadata.count >= 240);
  assert.equal(metadata.items.length, metadata.count);
  assert.equal(new Set(metadata.items.map(item => item.id)).size, metadata.count);
  assert.equal(new Set(metadata.items.map(item => item.slug)).size, metadata.count);
  assert.equal(new Set(metadata.items.map(item => item.name)).size, metadata.count);
  assert.equal(metadata.source, 'https://www.dota2.com/datafeed/itemlist?language=english');
  for (const item of metadata.items) {
    const original = snapshot.items.find(entry => entry.id === item.id);
    assert.equal(item.baseName, original.name_loc.replace(/\s+/g, ' ').trim());
    if (item.slug.startsWith('dagon')) assert.match(item.name, /^Dagon \(Level [1-5]\)$/);
    else assert.equal(item.name, item.baseName);
    assert.equal(item.slug, original.name.replace(/^item_/, ''));
    assert.equal(item.cost, original.item_cost);
    assert.ok(item.cost >= 0);
    assert.equal(original.obsolete, false);
    assert.equal(original.recipe, false);
    if (item.category === 'neutral') assert.equal(item.tier, original.neutral_item_tier + 1);
    assert.ok(!item.slug.startsWith('recipe_'));
    assert.equal(item.image, `assets/items/${item.slug}.png`);
    const png = await readFile(new URL(`../public/${item.image}`, import.meta.url));
    assert.ok(png.length > 1000);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  for (const name of ['Black King Bar', 'Manta Style', 'Daedalus', 'Parasma', 'Khanda', 'Divine Rapier', 'Iron Branch', 'Clarity', 'Observer Ward', 'Aegis of the Immortal', 'Chipped Vest', 'Block of Cheese']) {
    assert.ok(metadata.items.some(item => item.name === name), name);
  }
});

test('catalog includes every available shop and neutral item and excludes removed/event entries', () => {
  const ids = new Set(metadata.items.map(item => item.id));
  for (const entry of snapshot.items) {
    if (entry.obsolete || entry.recipe || entry.name.startsWith('item_recipe_') || !entry.name_loc) {
      assert.ok(!ids.has(entry.id), entry.name);
    } else if (entry.purchasable || entry.neutral_item_tier >= 0) {
      assert.ok(ids.has(entry.id), entry.name);
    }
  }
  assert.equal(metadata.categories.shop, metadata.items.filter(item => item.category === 'shop').length);
  assert.equal(metadata.categories.neutral, metadata.items.filter(item => item.category === 'neutral').length);
  assert.equal(metadata.categories.drop, metadata.items.filter(item => item.category === 'drop').length);
  assert.equal(Object.values(metadata.categories).reduce((a, b) => a + b, 0), metadata.count);
  for (const slug of ['necronomicon', 'courier', 'pocket_roshan', 'enhancement_alert', 'arcane_ring']) {
    assert.ok(!metadata.items.some(item => item.slug === slug), slug);
  }
  assert.ok(metadata.items.some(item => item.cost === 0));
  assert.equal(metadata.items.filter(item => item.slug === 'dagon' || /^dagon_[2-5]$/.test(item.slug)).length, 5);
});

test('item rounds share one item, hide it from both spies, retain the pool and score correctly', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ name: `Player ${i + 1}`, score: 0 }));
  const first = createRound(players, metadata.items, 1, null, 2, () => 0);
  const roles = players.map((_, i) => roleFor(first, i));
  assert.equal(roles.filter(role => role.spy).length, 2);
  roles.filter(role => role.spy).forEach(role => assert.deepEqual(role, { spy: true }));
  roles.filter(role => !role.spy).forEach(role => assert.equal(role.subject, first.subject));
  assert.ok(first.subject.image.startsWith('assets/items/'));
  const result = settleRound(first, players, 'team');
  assert.deepEqual(result.players.map(player => player.score), [0, 0, 1, 1, 1]);
  const next = createRound(result.players, metadata.items, 2, first.subject.id, 2, () => 0);
  assert.notEqual(next.subject.id, first.subject.id);
  assert.ok(metadata.items.includes(next.subject));
  assert.equal(next.spyIndices.length, 2);
});
