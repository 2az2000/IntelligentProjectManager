import { Router } from 'express';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { ProjectService } from '../application/project.service';
import { toMemberDto, toProjectDto, toTeammateDto } from './project.dto';
import {
  addMemberBody,
  createProjectBody,
  fromTemplateBody,
  memberParams,
  projectIdParams,
  updateMemberBody,
  updateProjectBody,
} from './project.schemas';
import { PROJECT_TEMPLATES } from '../templates';

/** Mounted at /projects */
export function createProjectRouter(projects: ProjectService): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    handle({}, async (_input, req, res) => {
      res.json((await projects.listForUser(currentUserId(req))).map(toProjectDto));
    }),
  );

  router.post(
    '/',
    handle({ body: createProjectBody }, async ({ body }, req, res) => {
      res.status(201).json(toProjectDto(await projects.create(currentUserId(req), body)));
    }),
  );

  // §11 project templates: list them; create-from-template returns the full project.
  router.get(
    '/templates',
    handle({}, async (_input, _req, res) => {
      res.json(PROJECT_TEMPLATES);
    }),
  );
  router.post(
    '/from-template',
    handle({ body: fromTemplateBody }, async ({ body }, req, res) => {
      const { templateId, ...projectInput } = body;
      const view = await projects.createFromTemplate(currentUserId(req), projectInput, templateId);
      res.status(201).json({ ...toProjectDto(view), templateApplied: view.templateApplied });
    }),
  );

  router.get(
    '/:projectId',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(toProjectDto(await projects.getForUser(params.projectId, currentUserId(req))));
    }),
  );

  router.patch(
    '/:projectId',
    handle({ params: projectIdParams, body: updateProjectBody }, async ({ params, body }, req, res) => {
      res.json(toProjectDto(await projects.update(currentUserId(req), params.projectId, body)));
    }),
  );

  router.delete(
    '/:projectId',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      await projects.remove(currentUserId(req), params.projectId);
      res.status(204).end();
    }),
  );

  // ---- members ----
  router.get(
    '/:projectId/members',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json((await projects.listMembers(currentUserId(req), params.projectId)).map(toMemberDto));
    }),
  );

  router.post(
    '/:projectId/members',
    handle({ params: projectIdParams, body: addMemberBody }, async ({ params, body }, req, res) => {
      const member = await projects.addMember(currentUserId(req), params.projectId, body);
      res.status(201).json(toMemberDto(member));
    }),
  );

  router.patch(
    '/:projectId/members/:userId',
    handle({ params: memberParams, body: updateMemberBody }, async ({ params, body }, req, res) => {
      const member = await projects.updateMember(currentUserId(req), params.projectId, params.userId, body);
      res.json(toMemberDto(member));
    }),
  );

  router.delete(
    '/:projectId/members/:userId',
    handle({ params: memberParams }, async ({ params }, req, res) => {
      await projects.removeMember(currentUserId(req), params.projectId, params.userId);
      res.status(204).end();
    }),
  );

  return router;
}

/** Mounted at /me */
export function createTeamRouter(projects: ProjectService): Router {
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/team',
    handle({}, async (_input, req, res) => {
      res.json((await projects.teamForUser(currentUserId(req))).map(toTeammateDto));
    }),
  );
  return router;
}
