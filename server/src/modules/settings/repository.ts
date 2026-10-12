import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SettingsRow } from './helpers.js';

/**
 * F1 — settings data-access layer. The only place this module touches
 * `settings` directly.
 */
export class SettingsRepository {
  constructor(private db: Db) {}

  async listForWorkspace(workspaceId: string): Promise<SettingsRow[]> {
    return this.db.select().from(t.settings).where(eq(t.settings.workspaceId, workspaceId));
  }

  /** Upsert every key/value pair in one transaction, so a partial failure
   *  can't leave some settings updated and others not. */
  async upsertMany(
    workspaceId: string,
    userId: string,
    entries: { key: string; value: unknown }[],
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const { key, value } of entries) {
        await tx
          .insert(t.settings)
          .values({ workspaceId, userId, key, value })
          .onConflictDoUpdate({
            target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
            set: { value },
          });
      }
    });
  }
}
