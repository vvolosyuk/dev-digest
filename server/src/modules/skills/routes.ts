import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import {
  IMPORT_BODY_LIMIT_BYTES,
  SKILL_BODY_MAX,
  SKILL_BODY_MIN,
  SKILL_DESCRIPTION_MAX,
  SKILL_DESCRIPTION_MIN,
  SKILL_NAME_PATTERN,
  SKILL_NOTE_MAX,
  SKILL_SEARCH_MAX,
} from './constants.js';
import { SkillsService } from './service.js';

/**
 * L02 — skills module.
 *   GET    /skills                          → list (+agent_count), ?q= search
 *   GET    /skills/:id                      → one skill
 *   POST   /skills                          → create (v1 + snapshot)
 *   PUT    /skills/:id                      → patch (config change → version+1)
 *   DELETE /skills/:id                      → delete, { ok, unlinked_agents }
 *   GET    /skills/:id/versions             → snapshots, newest first
 *   GET    /skills/:id/versions/:v          → one snapshot
 *   POST   /skills/:id/versions/:v/restore  → new version with v's content
 *   GET    /skills/:id/agents               → agents linking the skill
 *   POST   /skills/import/preview           → parse .md/.zip, persists nothing
 */

const SkillName = z
  .string()
  .regex(SKILL_NAME_PATTERN, 'Lowercase letters, digits and dashes (2–63 chars)');
const SkillDescription = z.string().trim().min(SKILL_DESCRIPTION_MIN).max(SKILL_DESCRIPTION_MAX);
const SkillBody = z.string().min(SKILL_BODY_MIN).max(SKILL_BODY_MAX);

const ListQuery = z.object({ q: z.string().max(SKILL_SEARCH_MAX).optional() });

const CreateSkillBody = z.object({
  name: SkillName,
  description: SkillDescription,
  type: SkillType,
  body: SkillBody,
  /** UI-created → `manual`; saved from the import preview → `imported_url`. */
  source: z.enum(['manual', 'imported_url']).optional(),
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: SkillName.optional(),
  description: SkillDescription.optional(),
  type: SkillType.optional(),
  body: SkillBody.optional(),
  enabled: z.boolean().optional(),
  /** Change note stored on the new version snapshot (ignored if nothing versioned changed). */
  note: z.string().trim().max(SKILL_NOTE_MAX).optional(),
});

const VersionParams = z.object({
  id: z.string().uuid(),
  v: z.coerce.number().int().positive(),
});

const ImportPreviewBody = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().min(1).regex(/^[A-Za-z0-9+/=\s]+$/, 'Invalid base64'),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', { schema: { querystring: ListQuery } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.query.q);
  });

  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_BODY_LIMIT_BYTES, schema: { body: ImportPreviewBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const bytes = new Uint8Array(Buffer.from(req.body.content_base64, 'base64'));
      return service.importPreview(workspaceId, req.body.filename, bytes);
    },
  );

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: UpdateSkillBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.update(workspaceId, req.params.id, req.body);
      if (!skill) throw new NotFoundError('Skill not found');
      return skill;
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const unlinked = await service.delete(workspaceId, req.params.id);
    if (unlinked === undefined) throw new NotFoundError('Skill not found');
    return { ok: true, unlinked_agents: unlinked };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.get('/skills/:id/versions/:v', { schema: { params: VersionParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const version = await service.getVersion(workspaceId, req.params.id, req.params.v);
    if (!version) throw new NotFoundError('Skill version not found');
    return version;
  });

  app.post(
    '/skills/:id/versions/:v/restore',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.restoreVersion(workspaceId, req.params.id, req.params.v);
      if (!skill) throw new NotFoundError('Skill version not found');
      return skill;
    },
  );

  app.get('/skills/:id/agents', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const agents = await service.agents(workspaceId, req.params.id);
    if (!agents) throw new NotFoundError('Skill not found');
    return agents;
  });
}
