'use client';
export async function developerApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (response.status === 401) {
    window.location.replace('/developer/access');
    throw new Error('Session expired. Sign in again.');
  }
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
export type Mutation = (input: Record<string, unknown>) => Promise<void>;
