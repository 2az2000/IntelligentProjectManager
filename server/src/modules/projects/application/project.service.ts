import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors';
import { checkMembershipChange } from '../domain/membership-rules';
import { Project, type NewProject, type ProjectChanges } from '../domain/project.entity';
import { hasRole, type ProjectRole } from '../domain/project-role';
import type {
  MemberView,
  ProjectRepository,
  ProjectView,
  TeammateView,
} from './project.repository';

const notFound = () => new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');

export interface ProjectHooks {
  /** Called after a member leaves or is removed (e.g. to unassign their tasks). */
  onMemberRemoved?: (projectId: number, userId: number) => Promise<void>;
}

/** Lookup of users by id — provided by the users module. */
export interface UserLookup {
  exists(userId: number): Promise<boolean>;
}

export class ProjectService {
  readonly hooks: ProjectHooks = {};

  constructor(
    private readonly projects: ProjectRepository,
    private readonly users: UserLookup,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  listForUser(userId: number): Promise<ProjectView[]> {
    return this.projects.listViewsForUser(userId, this.clock());
  }

  async create(userId: number, input: NewProject): Promise<ProjectView> {
    const project = await this.projects.create(Project.validateNew(input, userId));
    return this.getForUser(project.id, userId);
  }

  async getForUser(projectId: number, userId: number): Promise<ProjectView> {
    const [view] = await this.projects.listViewsForUser(userId, this.clock(), projectId);
    if (!view) throw notFound();
    return view;
  }

  async update(userId: number, projectId: number, changes: ProjectChanges): Promise<ProjectView> {
    await this.assertRole(projectId, userId, 'ADMIN');
    const project = await this.projects.findById(projectId);
    if (!project) throw notFound();
    await this.projects.update(projectId, project.applyChanges(changes));
    return this.getForUser(projectId, userId);
  }

  async remove(userId: number, projectId: number): Promise<void> {
    await this.assertRole(projectId, userId, 'OWNER');
    await this.projects.softDelete(projectId, this.clock());
  }

  // ---- access control (also used by other modules through ProjectAccess) ------------------

  /**
   * Ensures the user has at least `required` on the project. Non-members get 404 (not 403)
   * so the existence of other people's projects is not revealed.
   */
  async assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole> {
    const role = await this.projects.findRole(projectId, userId);
    if (!role) throw notFound();
    if (!hasRole(role, required)) {
      throw new ForbiddenError('INSUFFICIENT_ROLE', `Requires ${required} role on this project`);
    }
    return role;
  }

  async hasRole(projectId: number, userId: number, required: ProjectRole): Promise<boolean> {
    const role = await this.projects.findRole(projectId, userId);
    return !!role && hasRole(role, required);
  }

  projectIdsForUser(userId: number): Promise<number[]> {
    return this.projects.projectIdsForUser(userId);
  }

  // ---- members ----------------------------------------------------------------------------

  async listMembers(userId: number, projectId: number): Promise<MemberView[]> {
    await this.assertRole(projectId, userId, 'VIEWER');
    return this.projects.listMembers(projectId);
  }

  async addMember(
    actorId: number,
    projectId: number,
    input: { userId: number; role: ProjectRole; skills?: string[] },
  ): Promise<MemberView> {
    const actorRole = await this.assertRole(projectId, actorId, 'VIEWER');
    this.enforce(checkMembershipChange({ actorRole, actorIsTarget: false, targetRole: null, newRole: input.role }));
    if (!(await this.users.exists(input.userId))) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found');
    }
    if (await this.projects.findRole(projectId, input.userId)) {
      throw new ConflictError('ALREADY_MEMBER', 'User is already a member of this project');
    }
    await this.projects.addMember(projectId, input.userId, input.role, input.skills ?? []);
    return this.getMember(projectId, input.userId);
  }

  /** Updates a member's role and/or skills (the two fields admins and members manage). */
  async updateMember(
    actorId: number,
    projectId: number,
    targetId: number,
    patch: { role?: ProjectRole; skills?: string[] },
  ): Promise<MemberView> {
    if (patch.role === undefined && patch.skills === undefined) {
      throw new ValidationError();
    }
    const actorRole = await this.assertRole(projectId, actorId, 'VIEWER');
    if (patch.role !== undefined) {
      const targetRole = await this.memberRole(projectId, targetId);
      this.enforce(
        checkMembershipChange({ actorRole, actorIsTarget: actorId === targetId, targetRole, newRole: patch.role }),
      );
    }
    if (patch.skills !== undefined && actorId !== targetId && !hasRole(actorRole, 'ADMIN')) {
      throw new ForbiddenError('INSUFFICIENT_ROLE', 'Only admins can edit someone else’s skills');
    }
    await this.projects.updateMember(projectId, targetId, patch);
    return this.getMember(projectId, targetId);
  }

  async removeMember(actorId: number, projectId: number, targetId: number): Promise<void> {
    const actorRole = await this.assertRole(projectId, actorId, 'VIEWER');
    const targetRole = await this.memberRole(projectId, targetId);
    this.enforce(
      checkMembershipChange({ actorRole, actorIsTarget: actorId === targetId, targetRole, newRole: null }),
    );
    await this.projects.removeMember(projectId, targetId);
    await this.hooks.onMemberRemoved?.(projectId, targetId);
  }

  teamForUser(userId: number): Promise<TeammateView[]> {
    return this.projects.teamForUser(userId, this.clock());
  }

  private async memberRole(projectId: number, userId: number): Promise<ProjectRole> {
    const role = await this.projects.findRole(projectId, userId);
    if (!role) throw new NotFoundError('MEMBER_NOT_FOUND', 'User is not a member of this project');
    return role;
  }

  private async getMember(projectId: number, userId: number): Promise<MemberView> {
    const member = (await this.projects.listMembers(projectId)).find((m) => m.user.id === userId);
    if (!member) throw new NotFoundError('MEMBER_NOT_FOUND', 'User is not a member of this project');
    return member;
  }

  private enforce(denial: ReturnType<typeof checkMembershipChange>): void {
    if (denial) throw new ForbiddenError(denial, 'This membership change is not allowed');
  }
}
