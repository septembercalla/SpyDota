import { createRound, roleFor, settleRound, validateNames, rerollStarter } from './game.js';
import { mountHeroCarousel, mountReactions } from './hero-carousel.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const state = { heroes: [], items: [], mode: 'heroes', previews: {}, metadata: null, draft: ['', '', '', ''], seconds: 3, spyCount: 1, players: [], round: null, phase: 'setup', cursor: 0, page: 'play' };
let clock = null, deadline = 0, toastTimer;
let videoVisible = false, resumeVideo = true;
let heroCarousel = null;
const selectedPool = () => state[state.mode];
const subjectLabel = () => state.mode === 'items' ? 'item' : 'hero';
const modeIcon = mode => mode === 'heroes'
  ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Z" stroke="currentColor" stroke-width="1.5"/><path d="m9 11 2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 3-5 6 9 12 9-12-5-6H8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 9h18M8 3l4 18 4-18" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const panel = $('#game-panel');
const modal = $('#modal');
const reactionBar = mountReactions($('#reaction-controls'));
const crown = '<span class="starter-crown" role="img" aria-label="Starts the discussion" title="Starts the discussion"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m3 5 4 4 3-6 3 6 4-4-1.5 10h-11L3 5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 17h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>';

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
}
function stopClock() { clearInterval(clock); clock = null; }
function pausePrivate() {
  if (!['countdown', 'reveal'].includes(state.phase)) return;
  stopClock();
  state.phase = 'ready';
  renderGame();
  notify('Role hidden');
}
function showDialog(html) {
  pausePrivate();
  $('#modal-content').innerHTML = html;
  if (!modal.open) modal.showModal();
}
function closeDialog() { modal.close(); }
function progress() {
  if (!state.round) return '';
  return `<div class="deal-progress" aria-label="Roles revealed: ${['discussion', 'result'].includes(state.phase) ? state.players.length : state.cursor + (state.phase === 'between' ? 1 : 0)} of ${state.players.length}">${state.players.map((_, i) => `<span class="${['discussion', 'result'].includes(state.phase) || i < state.cursor || (i === state.cursor && state.phase === 'between') ? 'done' : i === state.cursor ? 'current' : ''}"></span>`).join('')}</div>`;
}
function renderSetup() {
  panel.classList.remove('stage-active');
  panel.innerHTML = `<div class="panel-heading"><h1>New game</h1></div><form id="setup-form" class="panel-body" novalidate><div class="mode-options" role="group" aria-label="Game mode">${['heroes', 'items'].map(mode => `<button type="button" class="mode-option" data-action="choose-mode" data-mode="${mode}" aria-pressed="${state.mode === mode}">${modeIcon(mode)}${mode === 'heroes' ? 'Heroes' : 'Items'}</button>`).join('')}</div><div class="count-row"><label class="field-label" for="player-count">Players <small>3–12</small></label><div class="stepper"><button type="button" data-action="count-minus" aria-label="Remove player">−</button><input id="player-count" type="number" min="3" max="12" value="${state.draft.length}" required aria-label="Number of players"><button type="button" data-action="count-plus" aria-label="Add player">+</button></div></div><div class="player-fields">${state.draft.map((name, i) => `<label class="player-input"><span>${i + 1}</span><input id="player-${i}" data-player="${i}" value="${escape(name)}" maxlength="24" required placeholder="Player name" aria-label="Player name ${i + 1}" autocomplete="off"></label>`).join('')}</div><div class="settings-row"><span id="spy-count-label">Spies</span><div class="spy-options" role="group" aria-labelledby="spy-count-label"><button type="button" class="spy-option" data-action="choose-spies" data-count="1" aria-pressed="${state.spyCount === 1}">1 spy</button><button type="button" class="spy-option" data-action="choose-spies" data-count="2" aria-pressed="${state.spyCount === 2}">2 spies</button></div></div><div class="settings-row"><label for="show-time">Reveal time</label><select id="show-time"><option value="3" ${state.seconds === 3 ? 'selected' : ''}>3 seconds</option><option value="5" ${state.seconds === 5 ? 'selected' : ''}>5 seconds</option><option value="7" ${state.seconds === 7 ? 'selected' : ''}>7 seconds</option></select></div><p id="setup-error" class="error" role="alert"></p><button class="primary wide start-btn" type="submit">Start game</button></form>`;
}
function renderAside() {
  if (state.phase === 'setup') {
    if (!heroCarousel) heroCarousel = mountHeroCarousel($('#side-content'), state.previews[state.mode], state.mode);
    heroCarousel.setActive(state.page === 'play');
  } else {
    heroCarousel?.unmount();
    heroCarousel = null;
    $('#side-content').innerHTML = `<section class="panel"><div class="aside-body"><div class="score-heading"><h2 class="aside-title">Scores</h2>${state.phase !== 'result' ? '<button class="text-btn starter-reroll" data-action="randomize-starter" aria-label="Randomize starting player">Randomize</button>' : ''}</div><div aria-live="polite">${state.players.map((p, i) => `<div class="score-row${i === state.round.starterIndex ? ' starter' : ''}"><span class="score-name">${i === state.round.starterIndex ? crown : ''}${escape(p.name)}</span><span class="score-value">${p.score}${state.phase === 'result' && ((state.round.winner === 'spy') === state.round.spyIndices.includes(i)) ? '<span class="score-plus">+1</span>' : ''}</span></div>`).join('')}</div></div></section>`;
  }
}
function syncGameplayVideo() {
  const video = $('#gameplay-video');
  $('#gameplay-video-panel').hidden = state.phase === 'setup';
  const active = state.phase !== 'setup' && state.page === 'play';
  if (active === videoVisible) return;
  videoVisible = active;
  if (active) {
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    if (resumeVideo) video.play().catch(() => {});
  } else {
    resumeVideo = !video.paused;
    video.pause();
  }
}
function renderGame() {
  reactionBar.setActive(state.phase !== 'setup' && state.page === 'play');
  syncGameplayVideo();
  $('#play-page').classList.toggle('playing', state.phase !== 'setup');
  if (state.phase === 'setup') { renderSetup(); renderAside(); return; }
  panel.classList.toggle('stage-active', state.phase === 'reveal');
  const name = escape(state.players[state.cursor]?.name || '');
  let content = '';
  const current = state.cursor + 1;
  if (state.phase === 'ready') {
    content = `<h2>${name}</h2><p>Everyone else, look away</p><button class="primary" data-action="show-role">Reveal role</button><div class="stage-actions">${state.cursor === 0 ? `<button class="text-btn" data-action="reroll">Reroll ${subjectLabel()}</button>` : ''}</div>`;
  } else if (state.phase === 'countdown') {
    content = `<div class="stage-eyebrow">${name}</div><div class="timer-ring"><h2 class="timer-number" id="countdown-number">3</h2></div><button class="text-btn" data-action="hide-role">Cancel</button>`;
  } else if (state.phase === 'reveal') {
    const role = roleFor(state.round, state.cursor);
    content = `<div class="stage-eyebrow">${name}</div><div class="reveal-wrap">${role.spy ? '<div class="spy-symbol" aria-hidden="true">◈</div><h2 class="reveal-name spy-title">Spy</h2>' : `<img class="reveal-image${state.mode === 'items' ? ' item-image' : ''}" src="${role.subject.image}" alt="${escape(role.subject.name)}"><h2 class="reveal-name">${escape(role.subject.name)}</h2>`}<div class="reveal-timer"><div id="reveal-bar"></div></div><div class="reveal-remaining"><span id="reveal-seconds">${state.seconds}</span> sec</div></div><button class="text-btn" data-action="finish-reveal">Hide</button>`;
  } else if (state.phase === 'between') {
    const next = escape(state.players[state.cursor + 1]?.name || '');
    content = `<p>Next player</p><h2>${next}</h2><button class="primary" data-action="next-player">Continue</button>`;
  } else if (state.phase === 'discussion') {
    content = `<h2>Who won?</h2><div class="round-buttons"><button class="winner-choice" data-action="win-team">Team</button><button class="winner-choice spy-choice" data-action="win-spy">${state.round.spyIndices.length === 2 ? 'Spies' : 'Spy'}</button></div>`;
  } else if (state.phase === 'result') {
    content = `<h2 class="result-title">${state.round.winner === 'spy' ? (state.round.spyIndices.length === 2 ? 'Spies win' : 'Spy wins') : 'Team wins'}</h2><div class="result-details${state.mode === 'items' ? ' item-result' : ''}"><img src="${state.round.subject.image}" alt="${escape(state.round.subject.name)}"><div><strong>${escape(state.round.subject.name)}</strong><p>${state.round.spyIndices.length === 2 ? 'Spies' : 'Spy'} — ${state.round.spyIndices.map(index => escape(state.players[index].name)).join(', ')}</p></div></div><button class="primary" data-action="next-round">Next round</button>`;
  }
  panel.innerHTML = `<div class="panel-heading"><h1>Round ${state.round.number}</h1>${['ready', 'countdown', 'reveal', 'between'].includes(state.phase) ? `<span class="step">${current} / ${state.players.length}</span>` : ''}</div><div class="stage-body">${content}</div>${state.phase === 'result' ? '' : progress()}<div class="round-meta">${state.phase !== 'result' ? '<button class="text-btn" data-action="redeal">Redeal</button>' : ''}<button class="text-btn" data-action="new-game">New game</button></div>`;
  renderAside();
}
function changeCount(value) {
  const count = Math.max(3, Math.min(12, Math.round(Number(value) || 3)));
  state.draft = Array.from({ length: count }, (_, i) => state.draft[i] || '');
  renderSetup();
}
function startRound(number, previousId = null) {
  stopClock();
  state.round = createRound(state.players, selectedPool(), number, previousId, state.spyCount);
  state.cursor = 0;
  state.phase = 'ready';
  renderGame();
}
function startGame() {
  try {
    const names = validateNames(state.draft);
    state.players = names.map(name => ({ name, score: 0 }));
    startRound(1);
  } catch (error) { $('#setup-error').textContent = error.message; }
}
function beginClock(duration, tick, complete) {
  stopClock();
  deadline = performance.now() + duration;
  clock = setInterval(() => {
    const remaining = deadline - performance.now();
    if (remaining <= 0) { stopClock(); complete(); }
    else tick(remaining);
  }, 50);
}
function showRole() {
  if (state.phase !== 'ready') return;
  state.phase = 'countdown';
  renderGame();
  beginClock(3000, remaining => {
    $('#countdown-number').textContent = Math.ceil(remaining / 1000);
  }, () => {
    state.phase = 'reveal';
    renderGame();
    beginClock(state.seconds * 1000, remaining => {
      $('#reveal-seconds').textContent = Math.ceil(remaining / 1000);
      $('#reveal-bar').style.width = `${remaining / (state.seconds * 10)}%`;
    }, finishReveal);
  });
}
function finishReveal() {
  if (state.phase !== 'reveal') return;
  stopClock();
  state.phase = state.cursor === state.players.length - 1 ? 'discussion' : 'between';
  renderGame();
}
function confirmWinner(winner) {
  if (state.phase !== 'discussion') return;
  showDialog(`<h2>${winner === 'spy' ? (state.round.spyIndices.length === 2 ? 'Spies win?' : 'Spy wins?') : 'Team wins?'}</h2><div class="dialog-buttons"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="confirm-${winner}">Confirm</button></div>`);
}
function finishRound(winner) {
  if (state.phase !== 'discussion') return;
  const result = settleRound(state.round, state.players, winner);
  state.round = result.round;
  state.players = result.players;
  state.phase = 'result';
  closeDialog();
  renderGame();
}
function setPage(page) {
  pausePrivate();
  state.page = page;
  $('#play-page').hidden = page !== 'play';
  $('#heroes-page').hidden = page === 'play';
  $('#page-label').textContent = page === 'play' ? 'Lobby' : page === 'items' ? 'All items' : 'All heroes';
  const search = $('#hero-search');
  search.value = '';
  search.placeholder = page === 'items' ? 'Search items…' : 'Search heroes…';
  search.setAttribute('aria-label', page === 'items' ? 'Search items' : 'Search heroes');
  heroCarousel?.setActive(page === 'play');
  reactionBar.setActive(state.phase !== 'setup' && page === 'play');
  syncGameplayVideo();
  document.querySelectorAll('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === page));
  if (page !== 'play') renderCatalog();
}
function renderCatalog() {
  const query = $('#hero-search').value.trim().toLowerCase();
  const pool = state.page === 'items' ? state.items : state.heroes;
  const filtered = pool.filter(hero => hero.name.toLowerCase().includes(query) || hero.slug.replaceAll('_', ' ').includes(query));
  $('#filtered-count').textContent = `${filtered.length} / ${pool.length}`;
  $('#hero-grid').innerHTML = filtered.length ? filtered.map(hero => `<article class="hero-tile${state.page === 'items' ? ' item-tile' : ''}"><img loading="lazy" src="${hero.image}" alt="${escape(hero.name)}" width="256" height="144"><p>${escape(hero.name)}</p></article>`).join('') : `<p class="empty-search">No ${state.page === 'items' ? 'items' : 'heroes'} found</p>`;
}
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-nav]');
  if (nav) { setPage(nav.dataset.nav); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'close-modal') closeDialog();
  if (action === 'count-minus') changeCount(state.draft.length - 1);
  if (action === 'count-plus') changeCount(state.draft.length + 1);
  if (action === 'choose-mode' && state.phase === 'setup' && ['heroes', 'items'].includes(button.dataset.mode)) {
    state.mode = button.dataset.mode;
    document.querySelectorAll('[data-action="choose-mode"]').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.mode === state.mode)));
    heroCarousel?.setEntries(state.previews[state.mode], state.mode);
  }
  if (action === 'choose-spies' && state.phase === 'setup') {
    state.spyCount = Number(button.dataset.count);
    document.querySelectorAll('[data-action="choose-spies"]').forEach(option => {
      option.setAttribute('aria-pressed', String(Number(option.dataset.count) === state.spyCount));
    });
  }
  if (action === 'show-role') showRole();
  if (action === 'hide-role') pausePrivate();
  if (action === 'finish-reveal') finishReveal();
  if (action === 'randomize-starter' && state.round && state.phase !== 'result') {
    state.round = rerollStarter(state.round, state.players.length);
    renderAside();
  }
  if (action === 'next-player' && state.phase === 'between') { state.cursor++; state.phase = 'ready'; renderGame(); }
  if (action === 'reroll' && state.phase === 'ready' && state.cursor === 0) { state.round = createRound(state.players, selectedPool(), state.round.number, state.round.subject.id, state.spyCount); renderGame(); notify(state.mode === 'items' ? 'Item rerolled' : 'Hero rerolled'); }
  if (action === 'next-round' && state.phase === 'result') startRound(state.round.number + 1, state.round.subject.id);
  if (action === 'win-team') confirmWinner('team');
  if (action === 'win-spy') confirmWinner('spy');
  if (action === 'confirm-team') finishRound('team');
  if (action === 'confirm-spy') finishRound('spy');
  if (action === 'new-game') showDialog('<h2>New game?</h2><p>Scores will reset.</p><div class="dialog-buttons"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="reset">Start over</button></div>');
  if (action === 'reset') { stopClock(); state.draft = state.players.map(p => p.name); state.players = []; state.round = null; state.cursor = 0; state.phase = 'setup'; closeDialog(); renderGame(); }
  if (action === 'redeal') showDialog(`<h2>Redeal?</h2><p>New ${subjectLabel()} and ${state.round.spyIndices.length === 2 ? 'spies' : 'spy'}. Scores stay the same.</p><div class="dialog-buttons"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="confirm-redeal">Redeal</button></div>`);
  if (action === 'confirm-redeal' && state.phase !== 'result') { closeDialog(); startRound(state.round.number, state.round.subject.id); notify('Roles reassigned'); }
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-player]')) state.draft[Number(event.target.dataset.player)] = event.target.value;
});
document.addEventListener('change', event => {
  if (event.target.id === 'player-count') changeCount(event.target.value);
  if (event.target.id === 'show-time') state.seconds = Number(event.target.value);
});
document.addEventListener('submit', event => {
  if (event.target.id === 'setup-form') { event.preventDefault(); startGame(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') pausePrivate(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pausePrivate(); });
window.addEventListener('blur', pausePrivate);
document.addEventListener('error', event => {
  if (!(event.target instanceof HTMLImageElement)) return;
  if (event.target.classList.contains('reveal-image')) event.target.outerHTML = '<div class="image-fallback">Image unavailable</div>';
  else { event.target.classList.add('image-error'); event.target.alt ||= 'Image unavailable'; }
}, true);
$('#modal-close').addEventListener('click', closeDialog);
modal.addEventListener('click', event => { if (event.target === modal) { const box = modal.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(); } });
$('.brand').addEventListener('click', event => { event.preventDefault(); setPage('play'); });
$('#hero-search').addEventListener('input', renderCatalog);

try {
  const [metadata, itemMetadata] = await Promise.all(['heroes', 'items'].map(async kind => {
    const response = await fetch(kind + '.json');
    if (!response.ok) throw new Error('Could not read ' + kind + '.json');
    const data = await response.json();
    if (!data[kind]?.length) throw new Error('The ' + kind + ' list is empty');
    return data;
  }));
  state.heroes = metadata.heroes;
  state.items = itemMetadata.items;
  state.metadata = metadata;
  for (const mode of ['heroes', 'items']) {
    const pool = state[mode];
    const count = Math.min(12, pool.length);
    state.previews[mode] = Array.from({ length: count }, (_, index) => pool[Math.floor(index * pool.length / count)]);
  }
  $('#nav-count').textContent = state.heroes.length;
  $('#nav-items-count').textContent = state.items.length;
  renderGame();
} catch (error) {
  panel.innerHTML = `<div class="load-error"><strong>Could not load game data.</strong><p>${escape(error.message)}</p><p>Start the site with <code>npm start</code>, then open <code>http://localhost:3000</code>. Keep <code>heroes.json</code> and <code>items.json</code> in the public folder.</p><button class="secondary" data-action="reload">Try again</button></div>`;
  document.querySelector('[data-action="reload"]').addEventListener('click', () => location.reload());
}


