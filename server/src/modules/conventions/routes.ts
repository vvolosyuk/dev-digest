import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import {
  CATEGORY_MAX,
  MAX_MERGE_IDS,
  RULE_MAX,
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_DESCRIPTION_MIN,
  SKILL_NAME_MAX,
  SKILL_NAME_PATTERN,
} from './constants.js';
import { cleanCategory } from './helpers.js';
import { ConventionsService } from './service.js';

/**
 * L02 — conventions extractor.
 *   GET   /repos/:id/conventions          → candidates + last scan time
 *   POST  /repos/:id/conventions/extract  → sample → LLM → ground → persist (re-scan keeps decisions)
 *   PATCH /conventions/:id                → accept / reject / reset, edit rule + category
 *   POST  /repos/:id/conventions/skill-draft → LLM-drafted description + body (template fallback)
 *   POST  /repos/:id/conventions/skill    → merge accepted candidates into one `extracted` skill (201),
 *                                           or a new version of a same-named skill (200, on_conflict=new_version)
 */

const PatchBody = z
  .object({
    status: z.enum(['pending', 'accepted', 'rejected']).optional(),
    rule: z.string().trim().min(3).max(RULE_MAX).optional(),
    category: z.string().trim().min(1).max(CATEGORY_MAX).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Nothing to update');

const ConventionIds = z.array(z.string().uuid()).min(1).max(MAX_MERGE_IDS);

const DraftSkillBody = z.object({
  convention_ids: ConventionIds,
  /** The skill name as currently typed — becomes the body's `# heading`. */
  name: z.string().trim().min(1).max(SKILL_NAME_MAX),
});

const CreateSkillBody = z.object({
  name: z.string().regex(SKILL_NAME_PATTERN, 'Lowercase letters, digits and dashes (2–63 chars)'),
  description: z.string().trim().min(SKILL_DESCRIPTION_MIN).max(SKILL_DESCRIPTION_MAX),
  type: SkillType,
  body: z.string().min(1).max(SKILL_BODY_MAX),
  enabled: z.boolean().default(true),
  convention_ids: ConventionIds,
  /** Name taken: `fail` → 409 `{ name, skill_id, version }`; `new_version` → bump the existing skill. */
  on_conflict: z.enum(['fail', 'new_version']).default('fail'),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post('/repos/:id/conventions/extract', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.extract(workspaceId, req.params.id);
  });

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: PatchBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const { category, ...rest } = req.body;
      const updated = await service.update(workspaceId, req.params.id, {
        ...rest,
        ...(category !== undefined ? { category: cleanCategory(category) } : {}),
      });
      if (!updated) throw new NotFoundError('Convention not found');
      return updated;
    },
  );

  app.post(
    '/repos/:id/conventions/skill-draft',
    { schema: { params: IdParams, body: DraftSkillBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.draftSkill(workspaceId, req.params.id, req.body.convention_ids, req.body.name);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const { skill, created } = await service.createSkill(workspaceId, req.params.id, req.body);
      return reply.code(created ? 201 : 200).send(skill);
    },
  );
}
