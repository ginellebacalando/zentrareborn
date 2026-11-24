'use client';

import styles from './MediaPlaybackControl.module.css';

type MediaPlaybackControlProps = {
  label: string;
  onClick: () => void;
  className?: string;
};

export function MediaPlaybackControl({ label, onClick, className }: MediaPlaybackControlProps) {
  return (
    <button
      type="button"
      className={`media-control ${styles.control} ${className ?? ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
