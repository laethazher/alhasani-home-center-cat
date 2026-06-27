import {
  ROLE_PERMISSIONS,
  type Permission,
} from "./constants";
import type { Role, SessionUser } from "./types";

export function can(user: Pick<SessionUser, "role"> | null, perm: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(perm) ?? false;
}

export function canAny(user: SessionUser | null, perms: Permission[]): boolean {
  return perms.some((p) => can(user, p));
}

export class ForbiddenError extends Error {
  constructor(msg = "ليست لديك صلاحية لهذا الإجراء") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

export function assertCan(user: SessionUser | null, perm: Permission) {
  if (!can(user, perm)) throw new ForbiddenError();
}

/**
 * Row-level visibility rule for documents.
 * - ADMIN: everything
 * - EMPLOYEE: published documents in their department or org-wide (non-restricted)
 */
export function documentVisibilityScope(user: SessionUser): {
  allDepartments: boolean;
  departmentId?: string | null;
} {
  if (user.role === "ADMIN") return { allDepartments: true };
  return { allDepartments: false, departmentId: user.departmentId };
}

export function roleHomePath(role: Role): string {
  return "/dashboard";
}
