import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
export { mountReactions } from './reactions.jsx';

function HeroCarousel({ active, entries, mode }) {
  const [front, setFront] = useState(0);
  const [suspended, setSuspended] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactLayout = window.matchMedia('(max-width: 720px)');
    const sync = () => setSuspended(document.hidden || reducedMotion.matches || compactLayout.matches);
    sync();
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    compactLayout.addEventListener('change', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      reducedMotion.removeEventListener('change', sync);
      compactLayout.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!active || suspended || entries.length < 2) return;
    const timer = window.setInterval(() => setFront(index => (index + 1) % entries.length), 1300);
    return () => window.clearInterval(timer);
  }, [active, suspended, entries]);

  return (
    <div className={`hero-art hero-carousel ${mode === 'items' ? 'item-carousel' : ''}`} aria-hidden="true">
      {entries.map((entry, index) => {
        const offset = (index - front % entries.length + entries.length) % entries.length;
        const position = offset === 0 ? 'front' : offset === 1 ? 'left' : offset === entries.length - 1 ? 'right' : 'back';
        return (
          <div key={entry.slug} className={`carousel-card carousel-${position}`} data-entry={entry.slug}>
            <img src={entry.image} alt="" draggable="false" width="256" height="144" />
          </div>
        );
      })}
    </div>
  );
}

export function mountHeroCarousel(container, entries, mode) {
  const root = createRoot(container);
  let active = true;
  const render = () => root.render(<HeroCarousel active={active} entries={entries} mode={mode} />);
  render();
  return {
    setActive(value) { active = value; render(); },
    setEntries(value, nextMode) { entries = value; mode = nextMode; render(); },
    unmount() { root.unmount(); }
  };
}
