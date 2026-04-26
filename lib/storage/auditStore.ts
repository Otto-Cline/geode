// lib/storage/auditStore.ts
import type { AuditResponse } from "@/lib/models/audit";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

type Entry = { value: AuditResponse; expiresAt: number };

declare global {
  // Use globalThis so HMR doesn't blow the map away during dev.
  var __auditStore: Map<string, Entry> | undefined;
}

const store: Map<string, Entry> =
  globalThis.__auditStore ?? (globalThis.__auditStore = new Map());

function gc() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export function putAudit(value: AuditResponse): void {
  gc();
  store.set(value.auditId, { value, expiresAt: Date.now() + TTL_MS });
}

export function getAudit(id: string): AuditResponse | null {
  gc();
  const e = store.get(id);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return e.value;
}
