import type { Container } from '../../platform/container.js';
import { WorkspaceRepository } from './repository.js';
import { toRepoSummaryDto, type RepoSummary } from './helpers.js';

/**
 * F1 — workspace service. Where clones live + a summary of cloned repos.
 * No HTTP and no raw SQL live here — persistence goes through
 * WorkspaceRepository, pure transforms through helpers.ts.
 */
export class WorkspaceService {
  private repo: WorkspaceRepository;

  constructor(private container: Container) {
    this.repo = new WorkspaceRepository(container.db);
  }

  async getOverview(
    workspaceId: string,
  ): Promise<{ workspaceId: string; cloneDir: string; repos: RepoSummary[] }> {
    const repos = await this.repo.listReposForWorkspace(workspaceId);
    return {
      workspaceId,
      cloneDir: this.container.config.cloneDir,
      repos: repos.map(toRepoSummaryDto),
    };
  }
}
