import { useMemo } from "react";
import { useAppStore } from "./store";
import type { Permission, Role } from "../types/domain";

export const rolePermissions: Record<Role, Permission[]> = {
  Administrator: [
    "scan:read", "scan:create", "scan:execute", "scan:cancel", "asset:read", "service:read", "crypto:read", "finding:read", "policy:read", "policy:manage", "policy:evaluate", "evidence:read", "evidence:raw:read", "evidence:upload", "cbom:export", "collector:read", "scope:read", "collector:manage", "scope:manage", "user:read", "user:manage", "role:assign", "audit:read", "settings:read", "settings:manage", "license:read", "license:manage",
  ],
  Operator: ["scan:read", "scan:create", "scan:execute", "scan:cancel", "asset:read", "service:read", "crypto:read", "finding:read", "policy:read", "evidence:read", "cbom:export", "collector:read", "scope:read", "settings:read", "license:read"],
  Analyst: ["scan:read", "asset:read", "service:read", "crypto:read", "finding:read", "policy:read", "policy:evaluate", "evidence:read", "evidence:raw:read", "evidence:upload", "cbom:export", "collector:read", "scope:read", "audit:read", "settings:read", "license:read"],
  Auditor: ["scan:read", "asset:read", "service:read", "crypto:read", "finding:read", "policy:read", "evidence:read", "evidence:raw:read", "cbom:export", "collector:read", "scope:read", "audit:read", "settings:read", "license:read"],
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function useCan(permission: Permission) {
  const role = useAppStore((state) => state.role);
  return useMemo(() => can(role, permission), [role, permission]);
}