export function randomIndex(length) {
  if (!Number.isInteger(length) || length < 1) throw new Error('The list is empty');
  const range = 2 ** 32;
  const limit = range - range % length;
  const bytes = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % length;
}
export function validateNames(names) {
  if (names.length < 3 || names.length > 12) throw new Error('Enter 3 to 12 players.');
  const trimmed = names.map(name => name.trim());
  if (trimmed.some(name => !name || name.length > 24)) throw new Error('Enter a name for each player, up to 24 characters.');
  if (new Set(trimmed.map(name => name.toLocaleLowerCase('ru'))).size !== trimmed.length) throw new Error('Player names must be unique.');
  return trimmed;
}
export function createRound(players, subjects, number, previousId = null, spyCount = 1, pick = randomIndex) {
  validateNames(players.map(player => player.name));
  if (![1, 2].includes(spyCount) || spyCount >= players.length) throw new Error('Choose 1 or 2 spies, with at least one team player.');
  const pool = subjects.filter(subject => subject.id !== previousId);
  if (!pool.length) throw new Error('Not enough cards for a new round.');
  const subject = pool[pick(pool.length)];
  const candidates = players.map((_, index) => index);
  const spyIndices = Array.from({ length: spyCount }, () => candidates.splice(pick(candidates.length), 1)[0]);
  return { number, subject, spyIndices, starterIndex: pick(players.length), settled: false, winner: null };
}
export function rerollStarter(round, playerCount, pick = randomIndex) {
  const candidates = Array.from({ length: playerCount }, (_, index) => index).filter(index => index !== round.starterIndex);
  if (!candidates.length) throw new Error('Not enough players to choose another starter.');
  return { ...round, starterIndex: candidates[pick(candidates.length)] };
}
export function roleFor(round, playerIndex) {
  return round.spyIndices.includes(playerIndex) ? { spy: true } : { spy: false, subject: round.subject };
}
export function settleRound(round, players, winner) {
  if (round.settled) throw new Error('Scores for this round have already been awarded.');
  if (!['spy', 'team'].includes(winner)) throw new Error('Choose a winner.');
  const scores = players.map((player, index) => ({ ...player, score: player.score + ((winner === 'spy') === round.spyIndices.includes(index) ? 1 : 0) }));
  return { round: { ...round, settled: true, winner }, players: scores };
}
