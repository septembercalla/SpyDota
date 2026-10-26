import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';

const reactions = [
  { id: 'punch', emoji: '👊', label: 'Punch', duration: 1200 },
  { id: 'laugh', emoji: '😂', label: 'Laugh', duration: 1900 },
  { id: 'fart', emoji: '💨', label: 'Fart', duration: 1500 }
];

function Reactions({ active }) {
  const [effect, setEffect] = useState(null);
  const [error, setError] = useState('');
  const audioRefs = useRef({});
  const currentAudio = useRef(null);
  const timer = useRef(null);
  const sequence = useRef(0);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    sequence.current++;
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      currentAudio.current = null;
    }
    setEffect(null);
  }, []);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') stop(); };
    const onVisibility = () => { if (document.hidden) stop(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timer.current);
      currentAudio.current?.pause();
    };
  }, [stop]);

  function trigger(reaction) {
    stop();
    setError('');
    const key = ++sequence.current;
    const audio = audioRefs.current[reaction.id];
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 0.65;
      currentAudio.current = audio;
      audio.play().catch(() => {
        if (sequence.current === key) setError('Sound unavailable');
      });
    }
    setEffect({ ...reaction, key });
    timer.current = window.setTimeout(() => setEffect(null), reaction.duration);
  }

  if (!active) return null;

  return (
    <>
      <div className="reaction-bar" role="group" aria-label="Reactions">
        {reactions.map(reaction => (
          <button key={reaction.id} type="button" className={`reaction-button${effect?.id === reaction.id ? ' is-playing' : ''}`} onClick={() => trigger(reaction)} aria-label={reaction.label} title={reaction.label}>
            <span aria-hidden="true">{reaction.emoji}</span>
          </button>
        ))}
        {reactions.map(reaction => <audio key={reaction.id} ref={element => { audioRefs.current[reaction.id] = element; }} data-reaction-sound={reaction.id} src={`assets/sounds/${reaction.id}.mp3`} preload="auto" />)}
      </div>
      <span className="reaction-status" role="status">{error}</span>
      {effect && createPortal(
        <div key={effect.key} className={`reaction-overlay reaction-${effect.id}`} style={{ '--reaction-duration': `${effect.duration}ms` }} aria-hidden="true">
          {effect.id === 'punch' && <span className="reaction-impact-ring" />}
          <span className="reaction-emoji">{effect.emoji}</span>
        </div>,
        document.body
      )}
    </>
  );
}

export function mountReactions(container) {
  const root = createRoot(container);
  root.render(<Reactions active={false} />);
  return {
    setActive(active) { root.render(<Reactions active={active} />); },
    unmount() { root.unmount(); }
  };
}
