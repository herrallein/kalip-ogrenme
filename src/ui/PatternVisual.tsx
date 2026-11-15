import { useState } from 'react';
import { visualFor } from '../data/visuals';

interface Props {
  id: string;
  size: 'full' | 'small' | 'tiny';
  showCue?: boolean;
  eager?: boolean;
}

// Görsel yüklenemezse (dosya henüz yok, çevrimdışı) sessizce hiçbir şey göstermez.
export function PatternVisual({ id, size, showCue, eager }: Props) {
  const v = visualFor(id);
  const [failed, setFailed] = useState(false);
  if (!v || failed) return null;
  return (
    <figure className={`pvisual ${size}`}>
      <img
        src={v.src}
        alt={v.alt}
        width={320}
        height={200}
        decoding="async"
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
      {showCue && v.cue && <figcaption className="cue">💡 {v.cue}</figcaption>}
    </figure>
  );
}
