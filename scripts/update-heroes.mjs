import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const source = 'https://www.dota2.com/datafeed/herolist?language=english';
const cdn = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res;
    } catch (error) { if (attempt === 2) throw error; }
  }
}
await mkdir(`${publicDir}/assets/heroes`, { recursive: true });
let data;
if (process.argv.includes('--from-snapshot')) {
  data = JSON.parse((await readFile(new URL('../valve-heroes-source.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
} else data = await (await request(source)).json();
const roster = data.result?.data?.heroes;
if (!Array.isArray(roster) || roster.length < 120) throw new Error('Unexpected or incomplete Valve response. The existing list was kept.');
const heroes = roster.map(hero => {
  const slug = hero.name.replace(/^npc_dota_hero_/, '');
  if (!/^[a-z0-9_]+$/.test(slug) || !hero.name_loc) throw new Error('Invalid hero in source data');
  return { id: hero.id, name: hero.name_english_loc || hero.name_loc, slug, attribute: hero.primary_attr, image: `assets/heroes/${slug}.png`, sourceImage: `${cdn}${slug}.png` };
}).sort((a, b) => a.name.localeCompare(b.name, 'en'));
if (new Set(heroes.map(h => h.id)).size !== heroes.length || new Set(heroes.map(h => h.slug)).size !== heroes.length) throw new Error('Duplicate heroes in the Valve list');
let cursor = 0, downloaded = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < heroes.length) {
    const hero = heroes[cursor++];
    const filename = `${publicDir}/${hero.image}`;
    try { const existing = await readFile(filename); if (existing.length > 1000 && existing.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') continue; } catch {}
    const buffer = Buffer.from(await (await request(hero.sourceImage)).arrayBuffer());
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`The image for ${hero.name} is not a PNG`);
    await writeFile(filename, buffer);
    downloaded++;
  }
}));
await writeFile(`${publicDir}/heroes.json`, JSON.stringify({ source, imageSource: cdn, fetchedAt: new Date().toISOString(), count: heroes.length, heroes }, null, 2) + '\n');
await writeFile(new URL('../valve-heroes-source.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Done: ${heroes.length} heroes. Downloaded ${downloaded} portraits. All images verified.`);
