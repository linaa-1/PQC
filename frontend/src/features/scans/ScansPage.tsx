import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, Check, Play, Plus, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, GlassButton, GlassCard, GlassModal, GlassSheet, PageHeader, PermissionButton, StatusBadge, CopyChip } from "../../components/glass";
import { api } from "../../lib/services";
import { cidrAddressCount, cidrContains, countPorts, isValidCidr, portsAreValid } from "../../lib/cidr";
import { useAppStore } from "../../lib/store";
import { evidence, scopes as seedScopes } from "../../mocks/data";
import type { ScanJob } from "../../types/domain";
import { useCan } from "../../lib/permissions";

const formSchema = z.object({
  target: z.string().min(1, "Saisissez un réseau cible.").refine(isValidCidr, "CIDR IPv4 invalide. Exemple : 10.20.12.0/24."),
  ports: z.string().min(1, "Au moins un port est requis.").refine(portsAreValid, "Ports invalides. Utilisez 22,443,8000-8100 (1 à 65535)."),
  profile: z.enum(["Conservateur", "Standard", "Rapide"]),
});
type ScanForm = z.infer<typeof formSchema>;

export function ScansPage() {
  const jobs = useAppStore((state) => state.scans);
  const collectors = useAppStore((state) => state.collectors);
  const requestCancel = useAppStore((state) => state.requestCancel);
  const addAudit = useAppStore((state) => state.addAudit);
  const canCancel = useCan("scan:cancel");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const columns = useMemo<ColumnDef<ScanJob, any>[]>(() => [
    { accessorKey: "target_cidr", header: "Cible", cell: ({ row }) => <Link className="table-primary table-mono" to={`/scans/${row.original.id}`}>{row.original.target_cidr}</Link> },
    { accessorKey: "status", header: "Statut", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "collector", header: "Collector", accessorFn: (row) => collectors.find((collector) => collector.id === row.collector_id)?.name ?? "—", cell: ({ getValue }) => <span className="table-mono">{getValue<string>()}</span> },
    { accessorKey: "profile", header: "Profil" },
    { accessorKey: "progress", header: "Progression", cell: ({ getValue }) => <div className="scan-row-progress" style={{ minWidth: 90 }}><div className="progress-line"><span style={{ width: `${getValue<number>()}%` }} /></div><code>{getValue<number>()}%</code></div> },
    { accessorKey: "created_at", header: "Créé (UTC)", cell: ({ getValue }) => <span className="table-mono">{getValue<string>().slice(0, 16).replace("T", " ")}</span> },
    { accessorKey: "correlation_id", header: "Correlation-ID", cell: ({ getValue }) => <CopyChip compact value={getValue<string>()} /> },
    { id: "actions", header: "Action", enableSorting: false, cell: ({ row }) => ["QUEUED", "RUNNING", "PAUSED"].includes(row.original.status) ? <button className="icon-action icon-action-danger" aria-label={`Demander l'annulation du scan ${row.original.target_cidr}`} title={canCancel ? "Demander l'annulation" : "Permission requise : scan:cancel"} disabled={!canCancel} onClick={(event) => { event.stopPropagation(); setCancelId(row.original.id); }}><Ban size={13} /></button> : <span className="table-muted">—</span> },
  ], [collectors, canCancel]);
  const confirmCancel = () => {
    if (!cancelId) return;
    requestCancel(cancelId);
    addAudit({ action: "SCAN_JOB_CANCEL_REQUESTED", reason_code: "OPERATOR_CANCEL_REQUEST", category: "AUDIT", resource: `scan/${cancelId}` });
    setCancelId(null);
  };
  return <>
    <PageHeader eyebrow="DÉCOUVERTE / EXÉCUTION" title="Scans" description="Missions réseau limitées aux NetworkScopes actifs. Les tâches et leurs preuves partielles restent consultables après interruption." actions={<PermissionButton permission="scan:create" onClick={() => setWizardOpen(true)}><Plus size={15} /> Nouveau scan</PermissionButton>} />
    {notice && <div className="page-banner"><Check size={15} /><span>{notice}</span><button className="text-button" onClick={() => setNotice("")}>Fermer</button></div>}
    <div className="page-banner"><AlertTriangle size={14} /><span><strong>Règle de portée active.</strong> Chaque scan est affecté automatiquement au Collector propriétaire du CIDR autorisé. Les scopes désactivés n'acceptent pas de nouvelle mission.</span></div>
    <GlassCard className="content-panel"><DataTable data={jobs} columns={columns} initialPageSize={8} onRowClick={(job) => navigate(`/scans/${job.id}`)} emptyText="Aucun ScanJob" searchPlaceholder="Rechercher une cible, un statut ou un correlation ID" /></GlassCard>
    <ScanWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={(job) => { setNotice(`Mission ${job.correlation_id} créée et placée en file du Collector propriétaire.`); setWizardOpen(false); navigate(`/scans/${job.id}`); }} />
    <GlassModal open={!!cancelId} onClose={() => setCancelId(null)} title="Confirmer l'annulation" description="Le Collector reçoit une demande d'annulation. Les résultats valides déjà reçus sont conservés.">
      <div className="inline-alert"><AlertTriangle size={15} /><span>Le statut passe à <strong>CANCEL_REQUESTED</strong> avant confirmation finale du Collector. Cette action sera inscrite dans les Audit Logs.</span></div>
      <div className="modal-actions"><GlassButton variant="secondary" onClick={() => setCancelId(null)}>Continuer le scan</GlassButton><GlassButton variant="danger" onClick={confirmCancel}><Ban size={14} /> Demander l'annulation</GlassButton></div>
    </GlassModal>
  </>;
}

function ScanWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (job: ScanJob) => void }) {
  const [step, setStep] = useState(1);
  const [scopeError, setScopeError] = useState("");
  const [ownerScope, setOwnerScope] = useState<typeof seedScopes[number] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const addScan = useAppStore((state) => state.addScan);
  const addAudit = useAppStore((state) => state.addAudit);
  const allScopes = useAppStore((state) => state.scopes);
  const canExecute = useCan("scan:execute");
  const { register, getValues, trigger, formState: { errors }, reset } = useForm<ScanForm>({ resolver: zodResolver(formSchema), defaultValues: { target: "", ports: "22,443,5432", profile: "Standard" } });
  const onOpenChange = () => { reset({ target: "", ports: "22,443,5432", profile: "Standard" }); setStep(1); setScopeError(""); setOwnerScope(null); setServiceError(""); onClose(); };
  const checkTarget = async () => {
    setScopeError("");
    if (!(await trigger("target"))) return;
    const target = getValues("target");
    const matched = allScopes.find((scope) => scope.active && cidrContains(scope.cidr, target));
    if (!matched) {
      setScopeError("Cette cible n'est entièrement couverte par aucun NetworkScope actif. Aucun Collector ne sera affecté.");
      addAudit({ action: "TARGET_OUTSIDE_AUTHORIZED_SCOPE", reason_code: "TARGET_OUTSIDE_AUTHORIZED_SCOPE", category: "SECURITY", severity: "HIGH", result: "DENIED", resource: target });
      return;
    }
    setOwnerScope(matched);
    setStep(2);
  };
  const checkPorts = async () => { if (await trigger(["ports", "profile"])) setStep(3); };
  const launch = async () => {
    if (!canExecute) return;
    if (!ownerScope) { setStep(1); return; }
    const values = getValues();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const job: ScanJob = { id, correlation_id: `corr-scan-${Date.now().toString(16).toUpperCase()}`, status: "QUEUED", target_cidr: values.target, collector_id: ownerScope.collector_id, profile: values.profile, ports: values.ports, progress: 0, created_at: now, tasks: [{ id: crypto.randomUUID(), tool: "ZMap", target: `${values.target}:${values.ports}`, status: "QUEUED", attempt: 0, max_attempts: 3, retryable: true, evidence_ids: [], tls_detected: false }] };
    setSubmitting(true); setServiceError("");
    try {
      await api.createScan(job);
      addScan(job);
      addAudit({ action: "SCAN_JOB_CREATED", reason_code: "AUTHORIZED_SCOPE_MATCH", resource: `scan/${id}`, correlation_id: job.correlation_id });
      onCreated(job);
      onOpenChange();
    } catch (error) { setServiceError(error instanceof Error ? error.message : "Erreur simulée lors de la création."); }
    finally { setSubmitting(false); }
  };
  const collector = ownerScope ? useAppStore.getState().collectors.find((item) => item.id === ownerScope.collector_id) : undefined;
  const values = getValues();
  const hostCount = cidrAddressCount(values.target);
  return <GlassSheet open={open} onClose={onOpenChange} title="Nouveau scan" description="Assistant de lancement · scope vérifié avant exécution">
    <div className="stepper">{["Cible", "Ports et profil", "Récapitulatif"].map((label, index) => <div key={label} style={{ display: "contents" }}><div className={`stepper-step ${step === index + 1 ? "stepper-step-active" : ""} ${step > index + 1 ? "stepper-step-done" : ""}`}><span className="stepper-number">{step > index + 1 ? <Check size={12} /> : index + 1}</span><span>{label}</span></div>{index < 2 && <span className="stepper-line" />}</div>)}</div>
    {step === 1 && <div className="form-stack">
      <div className="form-field"><label htmlFor="target-cidr">Réseau cible <span>· CIDR IPv4</span></label><input id="target-cidr" placeholder="10.20.12.0/24" {...register("target")} aria-invalid={!!errors.target} />{errors.target && <small className="field-error">{errors.target.message}</small>}<small className="field-hint">Seul un sous-réseau entièrement inclus dans un scope actif peut être lancé.</small></div>
      {scopeError && <div className="inline-alert inline-alert-danger"><Ban size={14} /><span>{scopeError} L'événement <code>TARGET_OUTSIDE_AUTHORIZED_SCOPE</code> a été ajouté à l'audit simulé.</span></div>}
      <div className="page-banner" style={{ margin: 0 }}><ShieldCheckIcon /><span>Exemple de scope autorisé : <code>10.20.0.0/16</code>. Une tentative de <code>10.20.4.0/24</code> est détectée comme chevauchement à la création d'un scope, et ne contourne jamais son propriétaire.</span></div>
      <div className="form-actions"><GlassButton variant="secondary" onClick={onOpenChange}>Fermer</GlassButton><GlassButton onClick={checkTarget}>Vérifier le scope <ArrowRight size={14} /></GlassButton></div>
    </div>}
    {step === 2 && <div className="form-stack">
      {ownerScope && <div className="inline-alert inline-alert-info"><Check size={14} /><span><strong>{ownerScope.name}</strong> · <code>{ownerScope.cidr}</code><br />Collector propriétaire sélectionné automatiquement : <code>{collector?.name}</code></span></div>}
      <div className="form-field"><label htmlFor="scan-ports">Ports</label><input id="scan-ports" {...register("ports")} placeholder="22,443,5432,8000-8100" aria-invalid={!!errors.ports} />{errors.ports && <small className="field-error">{errors.ports.message}</small>}<small className="field-hint">Liste ou plages séparées par des virgules. Nombre de ports : {countPorts(values.ports || "22,443,5432")}.</small></div>
      <div className="form-field"><label htmlFor="scan-profile">Profil de scan</label><select id="scan-profile" {...register("profile")}><option value="Conservateur">Conservateur — impact réseau minimal</option><option value="Standard">Standard — découverte équilibrée</option><option value="Rapide">Rapide — ports essentiels</option></select><small className="field-hint">Les paramètres techniques restent contrôlés par la politique d'administration.</small></div>
      <div className="form-actions"><GlassButton variant="secondary" onClick={() => setStep(1)}><ArrowLeft size={14} /> Cible</GlassButton><GlassButton onClick={checkPorts}>Continuer <ArrowRight size={14} /></GlassButton></div>
    </div>}
    {step === 3 && <div className="form-stack">
      <div className="wizard-summary"><div className="summary-row"><span>Réseau autorisé</span><code>{values.target}</code></div><div className="summary-row"><span>Adresses estimées</span><strong>{hostCount.toLocaleString("fr-FR")} IP</strong></div><div className="summary-row"><span>Ports demandés</span><strong>{countPorts(values.ports).toLocaleString("fr-FR")} ports <small>({values.ports})</small></strong></div><div className="summary-row"><span>Profil</span><strong>{values.profile}</strong></div><div className="summary-row"><span>Scope propriétaire</span><strong>{ownerScope?.name} · <code>{ownerScope?.cidr}</code></strong></div><div className="summary-row"><span>Collector affecté</span><strong>{collector?.name}</strong></div></div>
      {collector?.spool_percent && collector.spool_percent >= 85 && <div className="inline-alert"><AlertTriangle size={14} /><span>Collector saturé : le job sera conservé en file jusqu'à réduction du spool.</span></div>}
      {serviceError && <div className="inline-alert inline-alert-danger">{serviceError}</div>}
      <div className="form-actions"><GlassButton variant="secondary" onClick={() => setStep(2)}><ArrowLeft size={14} /> Modifier</GlassButton><GlassButton disabled={!canExecute || submitting} title={canExecute ? undefined : "Permission requise : scan:execute"} onClick={launch}><Play size={14} />{submitting ? "Mise en file..." : "Lancer le scan"}</GlassButton></div>
      {!canExecute && <small className="field-error">Permission requise : scan:execute</small>}
    </div>}
  </GlassSheet>;
}

function ShieldCheckIcon() { return <Check size={14} />; }

export function ScanDetailPage() {
  const { id = "" } = useParams();
  const job = useAppStore((state) => state.scans.find((scan) => scan.id === id));
  const collectors = useAppStore((state) => state.collectors);
  const requestCancel = useAppStore((state) => state.requestCancel);
  const retryTask = useAppStore((state) => state.retryTask);
  const addAudit = useAppStore((state) => state.addAudit);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [cancelRequested, setCancelRequested] = useState(false);
  const collector = job ? collectors.find((item) => item.id === job.collector_id) : undefined;
  const linkedEvidence = job ? evidence.filter((item) => job.tasks.some((task) => task.evidence_ids.includes(item.id))) : [];
  if (!job) return <><PageHeader eyebrow="DÉCOUVERTE / SCANS" title="Scan introuvable" description="Ce ScanJob n'existe pas dans le jeu de données simulé." actions={<GlassButton variant="secondary" onClick={() => history.back()}><ArrowLeft size={14} /> Retour</GlassButton>} /><EmptyScan /></>;
  const cancel = () => { requestCancel(job.id); addAudit({ action: "SCAN_JOB_CANCEL_REQUESTED", reason_code: "OPERATOR_CANCEL_REQUEST", resource: `scan/${job.id}`, correlation_id: job.correlation_id }); setConfirm(false); setCancelRequested(true); };
  return <>
    <PageHeader eyebrow="DÉCOUVERTE / SCANS / DÉTAIL" title="Mission de scan" description="Job et tâches concrètes · faits de scanner conservés, même en résultat partiel." actions={<><CopyChip value={job.correlation_id} label="Correlation-ID" /><PermissionButton permission="scan:cancel" variant="danger" onClick={() => setConfirm(true)}><Ban size={14} /> Annuler</PermissionButton></>} />
    {notice && <div className="page-banner"><Check size={14} /><span>{notice}</span><button className="text-button" onClick={() => setNotice("")}>Fermer</button></div>}
    {(job.status === "PARTIAL" || job.status === "CANCEL_REQUESTED" || cancelRequested) && <div className="page-banner"><AlertTriangle size={14} /><span>{job.status === "PARTIAL" ? <><strong>Résultat partiel conservé.</strong> Interruption réseau temporaire ; les tâches TIMEOUT sont en tentative 2/3 et restent retryables.</> : <><strong>Annulation demandée.</strong> Le Collector termine le cycle en cours. Les résultats valides déjà reçus restent attachés au job.</>}</span></div>}
    <GlassCard className="scan-detail-header"><div><div className="eyebrow">SCAN JOB · {job.created_at.slice(0, 10)}</div><h2 style={{ margin: "0 0 9px", fontSize: 17, fontWeight: 600 }}><code>{job.target_cidr}</code></h2><div className="risk-pair"><StatusBadge status={job.status} /><span className="table-muted">Profil {job.profile}</span><span className="table-muted">·</span><span className="table-muted">{collector?.name}</span></div></div><div className="scan-detail-progress"><div><span className="dim-label">Progression</span><div className="progress-line"><span style={{ width: `${job.progress}%` }} /></div></div><code>{job.progress}%</code></div></GlassCard>
    <div className="detail-layout"><div className="detail-main">
      <GlassCard className="detail-section"><h3 className="detail-section-title">ScanTasks <small>{job.tasks.length} étapes · outils autorisés par profil</small></h3><div className="task-list">{job.tasks.map((task) => <div className="task-item" key={task.id}><div className="task-main"><div className="task-title"><strong>{task.tool}</strong><code>{task.target}</code><StatusBadge status={task.status} /></div><div className="task-meta"><span>Tentative {task.attempt}/{task.max_attempts}</span><span>{task.retryable && task.attempt < task.max_attempts ? "Retryable" : "Finale"}</span>{task.tls_detected && <span>Endpoint TLS détecté</span>}</div>{task.failure_reason && <div className="task-message">Raison : {task.failure_reason}</div>}{task.tls_detected && <div className="task-meta"><Link className="table-primary" to={`/assets?search=${encodeURIComponent(task.target.split(":")[0])}&tab=services`}>Détail TLS disponible uniquement sur endpoint détecté ↗</Link></div>}<div className="task-meta"><PermissionButton permission="scan:execute" variant="ghost" className="task-retry-button" disabled={!task.retryable || task.attempt >= task.max_attempts || task.status === "RUNNING" || task.status === "QUEUED"} title={!task.retryable || task.attempt >= task.max_attempts ? "Cette tâche n'est plus retryable" : undefined} onClick={() => { retryTask(job.id, task.id); addAudit({ action: "SCAN_TASK_RETRIED", reason_code: "RETRYABLE_TASK_REQUEUED", resource: `scan/${job.id}/task/${task.id}`, correlation_id: job.correlation_id }); setNotice(`${task.tool} remise en file pour la tentative ${Math.min(task.attempt + 1, task.max_attempts)}/${task.max_attempts}.`); }}><RotateCcw size={12} /> Relancer la tâche</PermissionButton></div></div><div style={{ justifySelf: "end", alignSelf: "center" }}>{task.evidence_ids.length > 0 ? task.evidence_ids.map((evidenceId) => <Link key={evidenceId} to={`/evidence?selected=${evidenceId}`} className="text-button">Evidence ↗</Link>) : <span className="table-muted">Aucune Evidence</span>}</div></div>)}</div></GlassCard>
      <GlassCard className="detail-section"><h3 className="detail-section-title">Evidence produites <small>Origine brute et traitement distincts</small></h3>{linkedEvidence.length ? <div className="detail-list">{linkedEvidence.map((item) => <div className="detail-list-row" key={item.id}><div><strong>{item.tool} · {item.tool_version}</strong><small><code>{item.hash_sha256.slice(0, 20)}…</code> · {item.collected_at}</small></div><div className="button-group"><StatusBadge status={item.processing_status} /><Link className="text-button" to={`/evidence?selected=${item.id}`}>Inspecter ↗</Link></div></div>)}</div> : <div className="raw-locked"><span>Aucune preuve associée pour le moment.</span></div>}</GlassCard>
    </div><aside className="detail-sidebar"><GlassCard className="detail-section"><h3 className="detail-section-title">Récapitulatif</h3><div className="detail-kv"><div className="detail-kv-item"><span>Créé (UTC)</span><code>{job.created_at}</code></div><div className="detail-kv-item"><span>Démarré (UTC)</span><code>{job.started_at ?? "En attente"}</code></div><div className="detail-kv-item"><span>Collecteur</span><strong>{collector?.name ?? "—"}</strong></div><div className="detail-kv-item"><span>Ports</span><code>{job.ports}</code></div><div className="detail-kv-item"><span>Correlation-ID</span><CopyChip compact value={job.correlation_id} /></div></div></GlassCard><GlassCard className="detail-section"><h3 className="detail-section-title">Reprise & back-pressure</h3><p className="field-hint">Les tâches retryable reprennent selon la disponibilité du Collector. Un back-pressure ne supprime pas les Evidence reçues.</p>{collector?.spool_percent && collector.spool_percent >= 85 ? <div className="inline-alert"><AlertTriangle size={13} /><span>Collector saturé à {collector.spool_percent}% · file d'attente locale de {collector.backlog} éléments.</span></div> : <div className="inline-alert inline-alert-info"><RotateCcw size={13} /><span>Fenêtre de retry disponible jusqu'à 3 tentatives, selon la réponse du réseau.</span></div>}</GlassCard></aside></div>
    <GlassModal open={confirm} onClose={() => setConfirm(false)} title="Annuler cette mission ?" description="Les résultats valides déjà collectés seront conservés."><div className="inline-alert"><AlertTriangle size={14} /><span>Le statut passera d'abord à <strong>CANCEL_REQUESTED</strong>. Le Collector finalise les tâches en cours.</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={() => setConfirm(false)}>Retour</GlassButton><GlassButton variant="danger" onClick={cancel}>Confirmer l'annulation</GlassButton></div></GlassModal>
  </>;
}

function EmptyScan() { return <GlassCard className="content-panel"><div className="empty-state"><div className="empty-mark"><AlertTriangle size={18} /></div><h3>Scan introuvable</h3><p>Le lien peut pointer vers une mission qui n'est plus disponible.</p><Link to="/scans" className="text-button">Retour à la liste des scans</Link></div></GlassCard>; }