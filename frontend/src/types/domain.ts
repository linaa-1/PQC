export type Role = "Administrator" | "Operator" | "Analyst" | "Auditor";

export type Permission =
  | "scan:read" | "scan:create" | "scan:execute" | "scan:cancel"
  | "asset:read" | "service:read" | "crypto:read"
  | "finding:read" | "policy:read" | "policy:manage" | "policy:evaluate"
  | "evidence:read" | "evidence:raw:read" | "evidence:upload"
  | "cbom:export" | "collector:read" | "scope:read" | "collector:manage" | "scope:manage"
  | "user:read" | "user:manage" | "role:assign" | "audit:read"
  | "settings:read" | "settings:manage" | "license:read" | "license:manage";

export type ObservationMode = "NEGOTIATED" | "SUPPORTED" | "DECLARED";
export type PqcClassification = "QUANTUM_VULNERABLE" | "LEGACY" | "WEAK" | "MIGRATION_REQUIRED" | "PQC_READY" | "UNKNOWN";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface Asset {
  id: string;
  canonical_name: string;
  ips: string[];
  hostnames: string[];
  status: "ACTIVE" | "PARTIAL" | "UNKNOWN";
  first_seen: string;
  last_seen: string;
  identity_confidence: "HIGH" | "MEDIUM" | "LOW";
  identity_ambiguous?: boolean;
}

export interface Service {
  id: string;
  asset_id: string;
  transport: "TCP" | "UDP";
  port: number;
  protocol: string;
  version: string;
  tls_version?: string;
  state: "OPEN" | "CLOSED" | "REFUSED" | "FILTERED" | "TIMEOUT" | "UNREACHABLE" | "PARTIAL" | "ERROR" | "CANCELLED" | "UNKNOWN";
  first_seen: string;
  last_seen: string;
}

export interface StorageVolume {
  id: string;
  asset_id: string;
  device: string;
  technology: "LUKS" | "BitLocker" | "Other";
  encryption_state: "ENCRYPTED" | "PARTIAL" | "UNKNOWN";
  provenance: "COLLECTOR" | "MANUAL_UPLOAD";
  evidence_id: string;
}

export interface Evidence {
  id: string;
  asset_id: string;
  service_id?: string;
  collector_id?: string;
  source_kind: "COLLECTOR" | "MANUAL_UPLOAD";
  tool: string;
  tool_version: string;
  hash_sha256: string;
  collected_at: string;
  uploaded_at?: string;
  processing_status: "RECEIVED" | "VALIDATED" | "PROCESSING" | "PROCESSED" | "UNSUPPORTED" | "REJECTED" | "FAILED" | "PROCESSING_FAILED";
  uploaded_by?: string;
  payload: Record<string, unknown>;
}

export interface Observation {
  id: string;
  asset_id: string;
  evidence_id: string;
  service_id?: string;
  volume_id?: string;
  observation_mode?: ObservationMode;
  observed_at: string;
  state: string;
  fact: string;
}

export interface CryptoObject {
  id: string;
  asset_id: string;
  evidence_id: string;
  object_type: "CERTIFICATE" | "KEY";
  subject: string;
  issuer: string;
  algorithm: string;
  key_size?: string;
  signature_algorithm?: string;
  fingerprint_sha256: string;
  valid_from?: string;
  valid_to?: string;
  observation_mode: ObservationMode;
}

export interface CryptoUsage {
  id: string;
  asset_id: string;
  service_id?: string;
  volume_id?: string;
  evidence_id: string;
  observation_id: string;
  algorithm: string;
  size_curve: string;
  role: "KEY_ESTABLISHMENT" | "DATA_ENCRYPTION" | "SIGNATURE/AUTH";
  protocol: string;
  target: string;
  observation_mode: ObservationMode;
  classical_weakness: "WEAK" | "NO_KNOWN_WEAKNESS" | "UNKNOWN";
  quantum_risk: "VULNERABLE" | "PQC_READY" | "UNKNOWN";
  first_seen: string;
  last_seen: string;
}

export interface Finding {
  id: string;
  asset_id: string;
  title: string;
  classification: PqcClassification;
  severity: Severity;
  classical_weakness: "WEAK" | "NO_KNOWN_WEAKNESS" | "UNKNOWN";
  quantum_risk: "VULNERABLE" | "PQC_READY" | "UNKNOWN";
  target: string;
  reason_code: string;
  explanation: string;
  evidence_ids: string[];
  observation_ids: string[];
  crypto_usage_ids: string[];
  policy_pack: string;
  policy_version: string;
  evaluated_at: string;
}

export interface Collector {
  id: string;
  name: string;
  lifecycle: "PENDING" | "ACTIVE" | "DISABLED";
  health: "ONLINE" | "DEGRADED" | "OFFLINE" | "HEARTBEAT_MISSED";
  version: string;
  last_activity: string;
  active_jobs: number;
  max_jobs: number;
  workers: number;
  spool_percent: number;
  mtls: "VALID" | "EXPIRING" | "EXPIRED" | "REVOKED";
  certificate_expires: string;
  scopes: string[];
  backlog: number;
  disk_health: string;
  connectivity: string;
}

export interface NetworkScope {
  id: string;
  name: string;
  cidr: string;
  collector_id: string;
  active: boolean;
  created_at: string;
}

export type ScanStatus = "QUEUED" | "RUNNING" | "PAUSED" | "FAILED" | "CANCELLED" | "COMPLETED" | "PARTIAL" | "CANCEL_REQUESTED";

export interface ScanTask {
  id: string;
  tool: "ZMap" | "ZGrab2" | "testssl.sh";
  target: string;
  status: string;
  attempt: number;
  max_attempts: number;
  failure_reason?: string;
  retryable: boolean;
  evidence_ids: string[];
  tls_detected: boolean;
}

export interface ScanJob {
  id: string;
  correlation_id: string;
  status: ScanStatus;
  target_cidr: string;
  collector_id: string;
  profile: "Conservateur" | "Standard" | "Rapide";
  ports: string;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  tasks: ScanTask[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  severity: Severity;
  category: "AUDIT" | "SECURITY" | "OPERATIONAL";
  action: string;
  actor: string;
  source: string;
  result: "SUCCESS" | "DENIED" | "FAILED" | "INFO";
  reason_code: string;
  resource: string;
  correlation_id: string;
}