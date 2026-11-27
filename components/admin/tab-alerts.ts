'use client';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * The admin's new notifications outside the page itself (docs/admin-panel.md, "Header numbers"):
 * the browser tab shows the count before its title and a red dot on its icon, and, once an admin
 * turns them on, the computer shows a desktop alert for what arrives while the tab is in the
 * background.
 */

const COUNT_PREFIX = /^\(\d+\+?\)\s/;

/**
 * "(3) Dashboard | ZENTRA Admin" while something is new, the plain title otherwise. Next.js sets
 * the title again on every page change, so the count goes back on whenever the title changes.
 */
export function useTabBadge(count: number) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(COUNT_PREFIX, '');
      const next = count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(COUNT_PREFIX, '');
    };
  }, [count]);

  // The tab's icon with a red dot; the original icon comes back once nothing is new.
  useEffect(() => {
    if (count <= 0) return;
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    if (!links.length) return;
    const originals = links.map((link) => link.getAttribute('href') ?? '');
    const colors = getComputedStyle(document.documentElement);
    const dot = colors.getPropertyValue('--palette-status-cancelled').trim();
    const ring = colors.getPropertyValue('--palette-white').trim();
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (cancelled || !context || !dot) return;
      context.drawImage(image, 0, 0, size, size);
      context.beginPath();
      context.arc(size * 0.78, size * 0.22, size * 0.2, 0, Math.PI * 2);
      context.fillStyle = dot;
      context.fill();
      context.lineWidth = size * 0.06;
      context.strokeStyle = ring || dot;
      context.stroke();
      const badged = canvas.toDataURL('image/png');
      for (const link of links) link.href = badged;
    };
    // The page's own icon links (app/icon.svg and app/favicon.ico), the vector one when present.
    image.src = originals.find((href) => href.includes('.svg')) ?? originals[0];
    return () => {
      cancelled = true;
      links.forEach((link, index) => link.setAttribute('href', originals[index]));
    };
  }, [count]);
}

type AlertPermission = NotificationPermission | 'unsupported';

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
function currentPermission(): AlertPermission {
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported';
}

/** Whether desktop alerts are on, and the browser's own question to turn them on. */
export function useDesktopAlerts() {
  const permission = useSyncExternalStore<AlertPermission>(
    subscribe,
    currentPermission,
    () => 'unsupported',
  );
  async function enable() {
    if (currentPermission() === 'unsupported') return;
    await Notification.requestPermission();
    listeners.forEach((listener) => listener());
  }
  return { permission, enable };
}

/**
 * The app icon for desktop alerts: the page's touch icon (app/apple-icon.png), which the tab badge
 * leaves alone.
 */
function appIcon() {
  return document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href;
}

/** A desktop alert, only while the admin tab is in the background and alerts are on. */
export function showDesktopAlert(title: string, body: string) {
  if (currentPermission() !== 'granted' || !document.hidden) return;
  const icon = appIcon();
  // No tag: with a shared one, the next alert would quietly replace this one instead of showing.
  const alert = new Notification(title, { body, ...(icon ? { icon } : {}) });
  alert.onclick = () => {
    window.focus();
    alert.close();
  };
}
