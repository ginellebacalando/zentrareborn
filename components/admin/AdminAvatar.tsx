'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './admin.module.css';

export default function AdminAvatar({
  user,
  size = 'header',
}: {
  user: { fullName: string | null; username: string; profileImage: string | null };
  size?: 'header' | 'menu' | 'profile';
}) {
  const [failed, setFailed] = useState(false);
  const pixels = size === 'profile' ? 84 : size === 'menu' ? 48 : 40;
  const name = user.fullName?.trim() || user.username;
  return (
    <span
      className={`${styles.profileAvatar} ${size === 'menu' ? styles.profileAvatarLarge : ''} ${size === 'profile' ? styles.profileAvatarPortrait : ''}`}
      aria-hidden="true"
    >
      {user.profileImage && !failed ? (
        <Image
          src={user.profileImage}
          alt=""
          width={pixels}
          height={pixels}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
