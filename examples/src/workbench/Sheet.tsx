import { type ReactNode, useEffect, useRef } from 'react';

/** Native dialog supplies focus containment, Escape, and restoration. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="studio-sheet"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="studio-section-heading">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
