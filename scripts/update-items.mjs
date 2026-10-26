import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseKeyValues, itemCategory } from './item-data.mjs';

const base = new URL('../', import.meta.url);
const source = 'https://www.dota2.com/datafeed/itemlist?language=english';
const availabilitySource = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-Dota2/master/game/dota/pak01_dir/scripts/npc/items.txt';
const cdn = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/';
const fromSnapshot = process.argv.includes('--from-snapshot');
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (error) { if (attempt === 2) throw error; }
  }
}

let snapshot;
if (fromSnapshot) {
  snapshot = JSON.parse(await readFile(new URL('valve-items-source.json', base), 'utf8'));
  if (!snapshot.availabilitySource) throw new Error('Snapshot has no availability flags; run update:items online first.');
} else {
  const [data, gameData] = await Promise.all([
    request(source).then(response => response.json()),
    request(availabilitySource).then(response => response.text())
  ]);
  const roster = data.result?.data?.itemabilities;
  const definitions = parseKeyValues(gameData).DOTAAbilities;
  if (!Array.isArray(roster) || roster.length < 300 || !definitions?.item_blink) throw new Error('Invalid Valve item data; existing catalog kept.');
  snapshot = {
    source, availabilitySource, fetchedAt: new Date().toISOString(),
    items: roster.map(entry => {
      const definition = definitions[entry.name];
      if (!definition) throw new Error(`Missing game definition: ${entry.name}`);
      return {
        id: entry.id, name: entry.name, name_loc: entry.name_english_loc || entry.name_loc,
        neutral_item_tier: entry.neutral_item_tier,
        purchasable: definition.ItemPurchasable !== '0',
        obsolete: definition.IsObsolete === '1', recipe: definition.ItemRecipe === '1',
        item_cost: Number(definition.ItemCost || 0)
      };
    })
  };
}
const queue = snapshot.items.filter(itemCategory);
if (queue.length < 200) throw new Error('Incomplete item pool; existing catalog kept.');
await mkdir(new URL('public/assets/items/', base), { recursive: true });
const items = [];
let cursor = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < queue.length) {
    const entry = queue[cursor++];
    const slug = entry.name.replace(/^item_/, '');
    if (!/^[a-z0-9_]+$/.test(slug)) throw new Error(`Invalid item name: ${slug}`);
    const detailSource = `https://www.dota2.com/datafeed/itemdata?language=english&item_id=${entry.id}`;
    if (!fromSnapshot) {
      const detail = (await (await request(detailSource)).json()).result?.data?.items?.[0];
      if (!detail || detail.id !== entry.id || detail.name !== entry.name || !detail.name_loc || !Number.isFinite(detail.item_cost)) throw new Error(`Invalid item data: ${slug}`);
      entry.name_loc = detail.name_loc;
      entry.item_cost = detail.item_cost;
      entry.source = detailSource;
    }
    const image = `assets/items/${slug}.png`;
    const sourceImage = `${cdn}${slug}.png`;
    const path = new URL(`public/${image}`, base);
    let buffer;
    try { buffer = await readFile(path); } catch {}
    if (!buffer || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      buffer = Buffer.from(await (await request(sourceImage)).arrayBuffer());
      if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${slug}`);
      await writeFile(path, buffer);
    }
    const baseName = entry.name_loc.replace(/\s+/g, ' ').trim();
    const level = /^dagon(?:_([2-5]))?$/.exec(slug);
    const name = level ? `${baseName} (Level ${level[1] || 1})` : baseName;
    const category = itemCategory(entry);
    items.push({ id: entry.id, name, baseName, slug, cost: entry.item_cost, category,
      ...(category === 'neutral' ? { tier: entry.neutral_item_tier + 1 } : {}), image, sourceImage });
  }
}));
items.sort((a, b) => a.name.localeCompare(b.name, 'en'));
if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => item.name)).size !== items.length) throw new Error('Duplicate items');
const categories = Object.fromEntries(['shop', 'neutral', 'drop'].map(category => [category, items.filter(item => item.category === category).length]));
snapshot.items.sort((a, b) => a.id - b.id);
await writeFile(new URL('valve-items-source.json', base), JSON.stringify(snapshot, null, 2) + '\n');
await writeFile(new URL('public/items.json', base), JSON.stringify({ source, availabilitySource,
  scope: 'Current shop items, components, consumables, neutral items and obtainable world/hero items. Excludes recipes, removed items, event/debug items and neutral enhancements.',
  fetchedAt: snapshot.fetchedAt, count: items.length, categories, items }, null, 2) + '\n');
console.log(`Done: ${items.length} items (${categories.shop} shop, ${categories.neutral} neutral, ${categories.drop} world/hero). All local PNGs verified.`);
