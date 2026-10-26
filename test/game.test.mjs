import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createRound, roleFor, settleRound, validateNames, randomIndex, rerollStarter } from '../public/game.js';

const players = ['Аня', 'Боря', 'Вася'].map(name => ({ name, score: 0 }));
const heroes = [{ id: 1, name: 'Anti-Mage' }, { id: 8, name: 'Juggernaut' }];

test('two spies are distinct and neither receives the shared hero', () => {
  const group = Array.from({ length: 4 }, (_, index) => ({ name: `Player ${index + 1}`, score: 0 }));
  const pairs = new Set();
  for (let first = 0; first < group.length; first++) {
    for (let secondPick = 0; secondPick < group.length - 1; secondPick++) {
      const picks = [0, first, secondPick, 0];
      const round = createRound(group, heroes, 1, null, 2, () => picks.shift());
      assert.equal(new Set(round.spyIndices).size, 2);
      const roles = group.map((_, index) => roleFor(round, index));
      assert.equal(roles.filter(role => role.spy).length, 2);
      roles.filter(role => role.spy).forEach(role => assert.deepEqual(role, { spy: true }));
      roles.filter(role => !role.spy).forEach(role => assert.equal(role.subject, round.subject));
      pairs.add([...round.spyIndices].sort().join(','));
    }
  }
  assert.equal(pairs.size, 6);
});

test('two-spy scoring awards only winners and prevents duplicate points', () => {
  const group = Array.from({ length: 4 }, (_, index) => ({ name: `Player ${index + 1}`, score: index + 2 }));
  const round = createRound(group, heroes, 1, null, 2, () => 0);
  assert.deepEqual(round.spyIndices, [0, 1]);
  const spies = settleRound(round, group, 'spy');
  assert.deepEqual(spies.players.map(player => player.score), [3, 4, 4, 5]);
  const team = settleRound(round, group, 'team');
  assert.deepEqual(team.players.map(player => player.score), [2, 3, 5, 6]);
  assert.throws(() => settleRound(spies.round, spies.players, 'spy'));
  const next = createRound(spies.players, heroes, 2, round.subject.id, 2, () => 0);
  assert.equal(next.spyIndices.length, 2);
  assert.notEqual(next.subject.id, round.subject.id);
  assert.deepEqual(group.map(player => player.score), [2, 3, 4, 5]);
});

test('spy count allows one or two spies while keeping at least one team player', () => {
  assert.equal(createRound(players, heroes, 1, null, 2).spyIndices.length, 2);
  for (const count of [0, 3, 1.5, '2']) assert.throws(() => createRound(players, heroes, 1, null, count));
});

test('any player can start the discussion, independently of the spy', () => {
  for (let starter = 0; starter < players.length; starter++) {
    const picks = [0, 1, starter];
    const round = createRound(players, heroes, 1, null, 1, () => picks.shift());
    assert.equal(round.starterIndex, starter);
    assert.deepEqual(round.spyIndices, [1]);
  }
});

test('randomizing the starter changes only the starter and selects another player', () => {
  for (let starter = 0; starter < players.length; starter++) {
    const round = { ...createRound(players, heroes, 1, null, 1, () => 0), starterIndex: starter };
    const alternatives = new Set();
    for (let choice = 0; choice < players.length - 1; choice++) {
      const changed = rerollStarter(round, players.length, () => choice);
      assert.notEqual(changed.starterIndex, starter);
      assert.deepEqual({ ...changed, starterIndex: starter }, round);
      assert.equal(round.starterIndex, starter);
      alternatives.add(changed.starterIndex);
    }
    assert.equal(alternatives.size, players.length - 1);
  }
});
test('один шпион, всем остальным один и тот же герой, шпион не получает героя', () => {
  for (let spy = 0; spy < players.length; spy++) {
    let calls = 0;
    const round = createRound(players, heroes, 1, null, 1, () => calls++ === 0 ? 1 : spy);
    const roles = players.map((_, i) => roleFor(round, i));
    assert.equal(roles.filter(r => r.spy).length, 1);
    assert.deepEqual(roles[spy], { spy: true });
    roles.filter(r => !r.spy).forEach(r => assert.equal(r.subject.name, 'Juggernaut'));
  }
});
test('очки начисляются только победителям и один раз за раунд', () => {
  const round = createRound(players, heroes, 1, null, 1, () => 0);
  const spy = settleRound(round, players, 'spy');
  assert.deepEqual(spy.players.map(p => p.score), [1, 0, 0]);
  assert.throws(() => settleRound(spy.round, spy.players, 'spy'));
  const team = settleRound(round, players, 'team');
  assert.deepEqual(team.players.map(p => p.score), [0, 1, 1]);
  assert.deepEqual(players.map(p => p.score), [0, 0, 0]);
  assert.throws(() => settleRound(round, players, 'nobody'));
});
test('реролл и новый раунд исключают прошлого героя', () => {
  const round = createRound(players, heroes, 2, 1, 1, () => 0);
  assert.equal(round.subject.id, 8);
  assert.equal(round.number, 2);
  assert.equal(round.settled, false);
});
test('границы числа игроков и уникальные имена', () => {
  assert.throws(() => validateNames(['Аня', 'аня', 'Вася']));
  assert.throws(() => validateNames(['Аня', ' ', 'Вася']));
  assert.throws(() => validateNames(['Аня', 'Вася']));
  assert.throws(() => validateNames(Array.from({ length: 13 }, (_, i) => `P${i}`)));
  assert.deepEqual(validateNames([' Аня ', 'Боря', 'Вася']), ['Аня', 'Боря', 'Вася']);
  assert.equal(validateNames(Array.from({ length: 12 }, (_, i) => `P${i}`)).length, 12);
});
test('случайный индекс укладывается в границы', () => {
  for (let i = 0; i < 1000; i++) {
    const index = randomIndex(127);
    assert.ok(index >= 0 && index < 127 && Number.isInteger(index));
  }
});
test('официальный каталог: уникальные id, точные связи имён и локальные PNG всех героев', async () => {
  const metadata = JSON.parse(await readFile(new URL('../public/heroes.json', import.meta.url), 'utf8'));
  const source = JSON.parse((await readFile(new URL('../valve-heroes-source.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
  assert.equal(metadata.heroes.length, metadata.count);
  assert.ok(metadata.count >= 127);
  assert.equal(new Set(metadata.heroes.map(h => h.id)).size, metadata.count);
  assert.equal(new Set(metadata.heroes.map(h => h.image)).size, metadata.count);
  for (const hero of metadata.heroes) {
    const original = source.result.data.heroes.find(item => item.id === hero.id);
    assert.equal(hero.name, original.name_english_loc || original.name_loc);
    assert.equal(hero.slug, original.name.replace('npc_dota_hero_', ''));
    const url = new URL(`../public/${hero.image}`, import.meta.url);
    assert.ok((await stat(url)).size > 1000);
    assert.equal((await readFile(url)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  for (const name of ['Muerta', 'Juggernaut', 'Largo', 'Kez', 'Ringmaster']) assert.ok(metadata.heroes.some(h => h.name === name));
});
