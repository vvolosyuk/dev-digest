import type {
  Settings,
  SettingsUpdate,
  ConnTestRequest,
  ConnTestResult,
  SecretsStatus,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { SettingsRepository } from './repository.js';
import { rowsToSettings } from './helpers.js';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';

/**
 * F1 — settings service. Non-secret prefs (persisted) + provider
 * connection tests (live, not persisted beyond the optional BYO-key save).
 * No HTTP and no raw SQL live here — persistence goes through
 * SettingsRepository, pure transforms through helpers.ts.
 */
export class SettingsService {
  private repo: SettingsRepository;

  constructor(private container: Container) {
    this.repo = new SettingsRepository(container.db);
  }

  async get(workspaceId: string): Promise<Settings> {
    const rows = await this.repo.listForWorkspace(workspaceId);
    return rowsToSettings(rows);
  }

  async update(workspaceId: string, userId: string, patch: SettingsUpdate): Promise<Settings> {
    const entries = Object.entries(patch).map(([key, value]) => ({ key, value }));
    await this.repo.upsertMany(workspaceId, userId, entries);
    return this.get(workspaceId);
  }

  /** Which provider keys are configured (booleans only — the values are
   *  NEVER returned). Drives the "Configured / Not set" badges. */
  async secretsStatus(): Promise<SecretsStatus> {
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, string][]).map(
        async ([provider, key]) =>
          [provider, Boolean(await this.container.secrets.get(key))] as const,
      ),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  async testConnection(input: ConnTestRequest): Promise<ConnTestResult> {
    const { provider, key } = input;
    try {
      // If the UI supplied a key, persist it (BYO key) before testing so the
      // test reflects — and the rest of the app can use — the new value.
      if (key) {
        if (!this.container.secrets.set) {
          return { provider, ok: false, message: 'Secrets backend is read-only' };
        }
        await this.container.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
        this.container.invalidateSecretCaches();
      }
      if (provider === GITHUB_PROVIDER) {
        const gh = await this.container.github();
        const login = await gh.currentLogin();
        return { provider, ok: true, message: `Connected as @${login}` };
      }
      const llm = await this.container.llm(provider);
      const models = await llm.listModels();
      return { provider, ok: true, message: `OK — ${models.length} models available` };
    } catch (err) {
      return { provider, ok: false, message: (err as Error).message };
    }
  }
}
