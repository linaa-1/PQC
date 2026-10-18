import { create } from "zustand";
import type { AuditEvent, Collector, Evidence, NetworkScope, Role, ScanJob } from "../types/domain";
import { auditEvents, collectors, evidence as seedEvidence, scans as seedScans, scopes } from "../mocks/data";

interface AppState {
  role: Role;
  isLight: boolean;
  collapsed: boolean;
  scans: ScanJob[];
  evidence: Evidence[];
  collectors: Collector[];
  scopes: NetworkScope[];
  auditEvents: AuditEvent[];
  setRole: (role: Role) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  addAudit: (event: Partial<AuditEvent> & Pick<AuditEvent, "action" | "reason_code">) => void;
  addScan: (job: ScanJob) => void;
  requestCancel: (id: string) => void;
  retryTask: (jobId: string, taskId: string) => void;
  addScope: (scope: NetworkScope) => void;
  updateScope: (id: string, updates: Partial<NetworkScope>) => void;
  disableScope: (id: string) => void;
  addCollector: (collector: Collector) => void;
  updateCollector: (id: string, updates: Partial<Collector>) => void;
  addEvidence: (item: Evidence) => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: "Administrator",
  isLight: false,
  collapsed: false,
  scans: seedScans,
  evidence: seedEvidence,
  collectors,
  scopes,
  auditEvents,
  setRole: (role) => set({ role }),
  toggleTheme: () => set((state) => ({ isLight: !state.isLight })),
  toggleSidebar: () => set((state) => ({ collapsed: !state.collapsed })),
  addAudit: (event) => set((state) => ({
    auditEvents: [{
      id: crypto.randomUUID(), timestamp: new Date().toISOString(), severity: "INFO", category: "AUDIT", actor: "a.martin", source: "console", result: "SUCCESS", resource: "console", correlation_id: `corr-${crypto.randomUUID().slice(0, 8)}`,
      ...event,
    }, ...state.auditEvents],
  })),
  addScan: (job) => set((state) => ({ scans: [job, ...state.scans] })),
  requestCancel: (id) => set((state) => ({ scans: state.scans.map((job) => job.id === id ? { ...job, status: "CANCEL_REQUESTED" } : job) })),
  retryTask: (jobId, taskId) => set((state) => ({ scans: state.scans.map((job) => job.id !== jobId ? job : { ...job, status: "RUNNING", tasks: job.tasks.map((task) => task.id === taskId ? { ...task, status: "QUEUED", attempt: Math.min(task.attempt + 1, task.max_attempts), failure_reason: undefined } : task) }) })),
  addScope: (scope) => set((state) => ({ scopes: [...state.scopes, scope] })),
  updateScope: (id, updates) => set((state) => ({ scopes: state.scopes.map((scope) => scope.id === id ? { ...scope, ...updates } : scope) })),
  disableScope: (id) => set((state) => ({ scopes: state.scopes.map((scope) => scope.id === id ? { ...scope, active: false } : scope) })),
  addCollector: (collector) => set((state) => ({ collectors: [...state.collectors, collector] })),
  updateCollector: (id, updates) => set((state) => ({ collectors: state.collectors.map((collector) => collector.id === id ? { ...collector, ...updates } : collector) })),
  addEvidence: (item) => set((state) => ({ evidence: [item, ...state.evidence] })),
}));