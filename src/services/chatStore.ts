/**
 * Per-course chat transcripts for "اسأل كواكلي".
 *
 * Kept in a database of its own, keyed by course id: Course A's questions can
 * never surface inside Course B, and appending a message never rewrites the
 * (much larger) course record.
 */
import { createStore, get, set, del, UseStore } from 'idb-keyval';

import { CourseChatMessage, CourseChatThread } from '../types';

const DB_NAME = 'quakly-chat';
const STORE_NAME = 'threads';

/** Trimmed on write so a long-running course never bloats local storage. */
const MAX_STORED_MESSAGES = 60;

let cachedStore: UseStore | null = null;

function chatStoreRef(): UseStore {
  if (!cachedStore) cachedStore = createStore(DB_NAME, STORE_NAME);
  return cachedStore;
}

export async function getThread(courseId: string): Promise<CourseChatMessage[]> {
  if (!courseId) return [];
  const thread = await get<CourseChatThread>(courseId, chatStoreRef());
  return thread?.messages ?? [];
}

/** Appends one turn and returns the full, trimmed transcript. */
export async function appendMessage(
  courseId: string,
  message: CourseChatMessage
): Promise<CourseChatMessage[]> {
  const existing = await getThread(courseId);
  const messages = [...existing, message].slice(-MAX_STORED_MESSAGES);
  await set(courseId, { courseId, messages, updatedAt: Date.now() }, chatStoreRef());
  return messages;
}

export async function clearThread(courseId: string): Promise<void> {
  if (!courseId) return;
  await del(courseId, chatStoreRef());
}
