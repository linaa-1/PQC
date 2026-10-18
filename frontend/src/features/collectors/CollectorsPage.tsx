import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Activity, AlertTriangle, Ban, Check, Cpu, HardDrive, KeyRound, Plus, RotateCw, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassButton, GlassCard, GlassModal, GlassSheet, LifecycleBadge, PageHeader, PermissionButton, StatusBadge } from "../../components/glass";
import { useAppStore } from "../../lib/store";
import { useCan } from "../../lib/permissions";
import type { Collector, NetworkScope } from "../../types/domain";

const collectorSchema = z.object({ name: z.string().min(3, "Nom trop court.").max(40), identity: z.string().min(4, "Identité de Collector requise."), scope_id: z.string() });
type CollectorForm = z.infer<typeof collectorSchema>;

export function CollectorsPage() {
  const collectors = useAppStore((state) => state.collectors);
  const scopes = useAppStore((state) => state.scopes);
  const updateCollector = useAppStore((state) => state.updateCollector);
  const addAudit = useAppStore((state) => state.addAudit);
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<Collector | null>(null);
  const [message, setMessage] = useState("");
  const selectedId = searchParams.get("selected");
  const selected = collectors.find((collector) => collector.id === selectedId);
  const canManage = useCan("collector:manage");
  const columns = useMemo<ColumnDef<Collector, any>[]>(() => [
    { accessorKey: "name", header: "Collector", cell: ({ row }) => <button className="table-primary table-mono" style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }} onClick={(event) => { event.stopPropagation(); open(row.original.id); }}>{row.original.name}<span className="table-secondary">{row.original.id}</span></button> },
    { accessorKey: "lifecycle", header: "Cycle de vie", cell: ({ getValue }) => <LifecycleBadge value={getValue<Collector["lifecycle"]>()} /> },
    { accessorKey: "health", header: "Santé", cell: ({ getValue }) => <StatusBadge status={getValue<Collector["health"]>()} /> },
    { accessorKey: "version", header: "Version", cell: ({ getValue }) => <span className="table-mono">{getValue<string>()}</span> },
    { accessorKey: "last_activity", header: "Dernière activité (UTC)", cell: ({ getValue }) => <span className="table-mono">{getValue<string>().slice(0, 16).replace("T", " ")}</span> },
    { id: "jobs", header: "Jobs actifs", accessorFn: (row) => `${row.active_jobs}/${row.max_jobs}`, cell: ({ row }) => <span className="table-mono">{row.original.active_jobs} / {row.original.max_jobs}</span> },
    { accessorKey: "spool_percent", header: "Spool local", cell: ({ getValue }) => <Spool value={getValue<number>()} /> },
    { accessorKey: "mtls", header: "Certificat mTLS", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => <button className="icon-action" disabled={!canManage} title={canManage ? "Détails et actions" : "Permission requise : collector:manage"} aria-label={`Détails ${row.original.name}`} onClick={(event) => { event.stopPropagation(); open(row.original.id); }}><Cpu size={13} /></button> },
  ], [canManage, collectors, searchParams]);
  function open(id: string) { const next = new URLSearchParams(searchParams); next.set("selected", id); setSearchParams(next); }
  const close = () => { const next = new URLSearchParams(searchParams); next.delete("selected"); setSearchParams(next, { replace: true }); };
  const toggleLife = (collector: Collector) => {
    const lifecycle = collector.lifecycle === "DISABLED" ? "ACTIVE" : "DISABLED";
    updateCollector(collector.id, { lifecycle });
    addAudit({ action: lifecycle === "DISABLED" ? "COLLECTOR_DISABLED" : "COLLECTOR_REACTIVATED", reason_code: lifecycle === "DISABLED" ? "NO_NEW_JOBS_HISTORY_RETAINED" : "ADMIN_REACTIVATED", resource: `collector/${collector.name}` });
    setConfirmDisable(null); setMessage(lifecycle === "DISABLED" ? `${collector.name} désactivé : aucun nouveau job ne sera envoyé, l'historique est conservé.` : `${collector.name} réactivé.`);
  };
  const rotate = (collector: Collector, revoke = false) => {
    updateCollector(collector.id, { mtls: revoke ? "REVOKED" : "VALID", certificate_expires: revoke ? collector.certificate_expires : new Date(Date.now() + 365 * 86400000).toISOString() });
    addAudit({ action: revoke ? "COLLECTOR_CERTIFICATE_REVOKED" : "COLLECTOR_CERTIFICATE_ROTATED", reason_code: revoke ? "ADMIN_CERTIFICATE_REVOCATION" : "ADMIN_CERTIFICATE_ROTATION", severity: revoke ? "HIGH" : "INFO", resource: `collector/${collector.name}` });
    setMessage(revoke ? `Certificat mTLS révoqué pour ${collector.name}.` : `Rotation mTLS simulée pour ${collector.name}.`);
  };
  return <>
    <PageHeader eyebrow="INFRASTRUCTURE / SONDES" title="Collectors" description="Les Collectors opèrent dans le réseau on-premise et ne scannent que leurs NetworkScopes attribués." actions={<PermissionButton permission="collector:manage" onClick={() => setAddOpen(true)}><Plus size={15} /> Ajouter un Collector</PermissionButton>} />
    {message && <div className="page-banner"><Check size={14} /><span>{message}</span><button className="text-button" onClick={() => setMessage("")}>Fermer</button></div>}
    <div className="page-banner"><AlertTriangle size={14} /><span><strong>Séparation des états.</strong> Le cycle de vie (puce carrée neutre) ne décrit pas la santé. Un heartbeat manqué isolé reste un état intermédiaire, pas OFFLINE.</span></div>
    <GlassCard className="content-panel"><DataTable data={collectors} columns={columns} initialPageSize={8} onRowClick={(collector) => open(collector.id)} searchPlaceholder="Nom, version, état, certificat..." /></GlassCard>
    <CollectorDetail collector={selected} scopes={scopes} onClose={close} onToggle={() => selected && (selected.lifecycle === "DISABLED" ? toggleLife(selected) : setConfirmDisable(selected))} onRotate={() => selected && rotate(selected)} onRevoke={() => selected && rotate(selected, true)} />
    <AddCollector open={addOpen} onClose={() => setAddOpen(false)} />
    <GlassModal open={!!confirmDisable} onClose={() => setConfirmDisable(null)} title="Désactiver ce Collector ?" description="L'historique du Collector et les preuves existantes seront conservés."><div className="inline-alert"><AlertTriangle size={14} /><span><strong>{confirmDisable?.name}</strong> ne recevra plus de nouveaux jobs. Les tâches en cours et l'historique restent visibles.</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={() => setConfirmDisable(null)}>Retour</GlassButton><GlassButton variant="danger" onClick={() => confirmDisable && toggleLife(confirmDisable)}><Ban size={14} /> Désactiver</GlassButton></div></GlassModal>
  </>;
}

function Spool({ value }: { value: number }) { return <div style={{ minWidth: 75 }}><span className="table-mono">{value}%</span><div className={`spool-bar ${value >= 85 ? "spool-bar-critical" : value >= 70 ? "spool-bar-warning" : ""}`}><span style={{ width: `${value}%` }} /></div></div>; }

function CollectorDetail({ collector, scopes, onClose, onToggle, onRotate, onRevoke }: { collector?: Collector; scopes: NetworkScope[]; onClose: () => void; onToggle: () => void; onRotate: () => void; onRevoke: () => void }) {
  const relatedScopes = collector ? scopes.filter((scope) => collector.scopes.includes(scope.id)) : [];
  return <GlassSheet open={!!collector} onClose={onClose} title={collector?.name ?? "Collector"} description="Santé, capacité locale et historique des événements">
    {collector && <div className="form-stack"><div className="button-group"><LifecycleBadge value={collector.lifecycle} /><StatusBadge status={collector.health} /><CopyChip compact value={collector.id} label="UUID" /></div><div className="settings-grid"><GlassCard className="detail-section"><h3 className="detail-section-title"><Activity size={14} /> Capacité</h3><div className="detail-kv"><div className="detail-kv-item"><span>Jobs actifs / max</span><strong>{collector.active_jobs} / {collector.max_jobs}</strong></div><div className="detail-kv-item"><span>Workers</span><strong>{collector.workers}</strong></div><div className="detail-kv-item"><span>Backlog Evidence</span><strong>{collector.backlog}</strong></div><div className="detail-kv-item"><span>Version</span><code>{collector.version}</code></div></div></GlassCard><GlassCard className="detail-section"><h3 className="detail-section-title"><HardDrive size={14} /> Santé locale</h3><div className="detail-kv"><div className="detail-kv-item"><span>Spool</span><Spool value={collector.spool_percent} /></div><div className="detail-kv-item"><span>Disque</span><StatusBadge status={collector.disk_health} /></div><div className="detail-kv-item"><span>Connectivité</span><StatusBadge status={collector.connectivity} /></div><div className="detail-kv-item"><span>Heartbeat UTC</span><code>{collector.last_activity}</code></div></div></GlassCard></div>
      <GlassCard className="detail-section"><h3 className="detail-section-title"><ShieldCheck size={14} /> Certificat mTLS</h3><div className="detail-kv"><div className="detail-kv-item"><span>État</span><StatusBadge status={collector.mtls} /></div><div className="detail-kv-item"><span>Expiration</span><code>{collector.certificate_expires}</code></div></div>{collector.mtls === "EXPIRING" && <div className="inline-alert" style={{ marginTop: 12 }}><AlertTriangle size={14} /><span>Expiration dans 14 jours. Les informations privées de clé ne sont jamais affichées.</span></div>}<div className="modal-actions" style={{ justifyContent: "flex-start" }}><PermissionButton permission="collector:manage" variant="secondary" onClick={onRotate}><RotateCw size={13} /> Rotation simulée</PermissionButton><PermissionButton permission="collector:manage" variant="danger" onClick={onRevoke}><KeyRound size={13} /> Révoquer</PermissionButton></div></GlassCard>
      <GlassCard className="detail-section"><h3 className="detail-section-title">NetworkScopes associés <small>Propriétaire unique</small></h3>{relatedScopes.length ? relatedScopes.map((scope) => <div className="detail-list-row" key={scope.id}><div><strong>{scope.name}</strong><small><code>{scope.cidr}</code></small></div><StatusBadge status={scope.active ? "ACTIVE" : "DISABLED"} /></div>) : <p className="field-hint">Aucun scope attribué. Les scopes existants ne peuvent pas être attachés à un second Collector.</p>}</GlassCard>
      <PermissionButton permission="collector:manage" variant={collector.lifecycle === "DISABLED" ? "primary" : "danger"} onClick={onToggle}>{collector.lifecycle === "DISABLED" ? "Réactiver le Collector" : "Désactiver le Collector"}</PermissionButton>
      <GlassCard className="detail-section"><h3 className="detail-section-title">Événements récents</h3><div className="detail-list-row"><div><strong>Heartbeat {collector.health === "ONLINE" ? "reçu" : collector.health === "DEGRADED" ? "avec dégradation spool" : collector.health === "HEARTBEAT_MISSED" ? "manqué · état intermédiaire" : "non reçu"}</strong><small>{collector.last_activity}</small></div><StatusBadge status={collector.health} /></div><div className="detail-list-row"><div><strong>Collector heartbeat</strong><small>Version {collector.version} · connectivité {collector.connectivity}</small></div><LifecycleBadge value={collector.lifecycle} /></div></GlassCard>
    </div>}
  </GlassSheet>;
}

function AddCollector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCollector = useAppStore((state) => state.addCollector);
  const addAudit = useAppStore((state) => state.addAudit);
  const scopes = useAppStore((state) => state.scopes);
  const collectors = useAppStore((state) => state.collectors);
  const updateScope = useAppStore((state) => state.updateScope);
  const updateCollector = useAppStore((state) => state.updateCollector);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CollectorForm>({ resolver: zodResolver(collectorSchema), defaultValues: { name: "", identity: "collector-agent://northstar/", scope_id: "" } });
  const close = () => { reset({ name: "", identity: "collector-agent://northstar/", scope_id: "" }); onClose(); };
  const submit = handleSubmit((values) => {
    const id = crypto.randomUUID();
    const item: Collector = { id, name: values.name, lifecycle: "PENDING", health: "HEARTBEAT_MISSED", version: "2.8.1", last_activity: new Date().toISOString(), active_jobs: 0, max_jobs: 8, workers: 4, spool_percent: 0, mtls: "VALID", certificate_expires: new Date(Date.now() + 365 * 86400000).toISOString(), scopes: values.scope_id ? [values.scope_id] : [], backlog: 0, disk_health: "UNKNOWN", connectivity: "AWAITING_ENROLLMENT" };
    if (values.scope_id) {
      const oldOwner = scopes.find((scope) => scope.id === values.scope_id)?.collector_id;
      const previous = collectors.find((collector) => collector.id === oldOwner);
      if (previous) updateCollector(previous.id, { scopes: previous.scopes.filter((scopeId) => scopeId !== values.scope_id) });
      updateScope(values.scope_id, { collector_id: id });
    }
    addCollector(item); addAudit({ action: "COLLECTOR_ENROLLMENT_CREATED", reason_code: "ADMIN_CREATED_PENDING_COLLECTOR", resource: `collector/${values.name}` }); close();
  });
  return <GlassModal open={open} onClose={close} title="Ajouter un Collector" description="Création simulée d'une identité d'enrôlement. Le Collector reste PENDING jusqu'à un heartbeat valide.">
    <form className="form-stack" onSubmit={submit}><div className="stepper"><div className="stepper-step stepper-step-active"><span className="stepper-number">1</span><span>Identité</span></div><span className="stepper-line" /><div className="stepper-step"><span className="stepper-number">2</span><span>Scopes exclusifs</span></div></div><div className="form-field"><label htmlFor="collector-name">Nom du Collector</label><input id="collector-name" {...register("name")} placeholder="collector-dr-site" />{errors.name && <small className="field-error">{errors.name.message}</small>}</div><div className="form-field"><label htmlFor="collector-identity">Identité d'enrôlement</label><input id="collector-identity" {...register("identity")} /><small className="field-hint">Identifiant non-secret. La clé privée mTLS ne sera jamais affichée ici.</small>{errors.identity && <small className="field-error">{errors.identity.message}</small>}</div><div className="form-field"><label htmlFor="collector-scope">Scope non attribué</label><select id="collector-scope" {...register("scope_id")}><option value="">Aucun scope pour le moment</option>{scopes.filter((scope) => !scope.active).map((scope) => <option key={scope.id} value={scope.id}>{scope.name} · {scope.cidr}</option>)}</select><small className="field-hint">Un scope actif a un propriétaire unique. Les CIDR déjà affectés ne peuvent pas être réutilisés.</small></div><div className="inline-alert inline-alert-info"><AlertTriangle size={14} /><span>Après création, le cycle de vie sera <strong>PENDING</strong> et la santé <strong>Heartbeat manqué</strong> jusqu'à réception du premier heartbeat.</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={close}>Annuler</GlassButton><GlassButton type="submit"><Plus size={14} /> Créer l'identité</GlassButton></div></form>
  </GlassModal>;
}