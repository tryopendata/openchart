/**
 * The desk's transport: Previous, Pause or Play, and Next. It renders only once
 * the live chart is mounted, so there is never a control that does nothing.
 */

export type TransportProps = {
  playing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
};

export function Transport({ playing, onPrevious, onNext, onTogglePlay }: TransportProps) {
  return (
    <div className="hero-controls">
      <button
        type="button"
        className="hero-control"
        aria-label="Previous step"
        onClick={onPrevious}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button type="button" className="hero-control hero-control-play" onClick={onTogglePlay}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" className="hero-control" aria-label="Next step" onClick={onNext}>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
