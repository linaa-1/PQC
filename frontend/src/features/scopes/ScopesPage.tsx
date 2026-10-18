import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertTriangle, Check, CircleSlash, Network, Plus, ShieldCheck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassButton, GlassCard, GlassModal, PageHeader, PermissionButton, StatusBadge } from "../../components/glass";
import { cidrsOverlap, isValidCidr } from "../../lib/cidr";
import { useAppStore } from "../../lib/store";
import { useCan } from "../../lib/permissions";
import type { NetworkScope } from "../../types/domain";

const scopeSchema = z.object({ name: z.string().min(2, "Nom de scope requis."), cidr: z.string().min(1, "Saisissez un CIDR.").refine(isValidCidr, "CIDR IPv4 invalide."), collector_id: z.string().min(1, "Un Collector propriétaire est obligatoire."), active: z.boolean() });
type ScopeForm = z.infer<typeof scopeSchema>;

export function ScopesPage() {
  const scopes = useAppStore((state) => state.scopes);
  const collectors = useAppStore((state) => state.collectors);
  const addAudit = useAppStore((state) => state.addAudit);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkScope | null>(null);
  const [disabling, setDisabling] = useState<NetworkScope | null>(null);
  const [message, setMessage] = useState("");
  const disableScope = useAppStore((state) => state.disableScope);
  const addScope = useAppStore((state) => state.addScope);
  const updateScope = useAppStore((state) => state.updateScope);
  const updateCollector = useAppStore((state) => state.updateCollector);
  const canManage = useCan("scope:manage");
  const columns = useMemo<ColumnDef<NetworkScope, any>[]>(() => [
    { accessorKey: "name", header: "NetworkScope", cell: ({ row }) => <><strong className="table-primary">{row.original.name}</strong><span className="table-secondary">UUID · {row.original.id}</span></> },
    { accessorKey: "cidr", header: "CIDR", cell: ({ getValue }) => <CopyChip value={getValue<string>()} /> },
    { id: "owner", header: "Collector propriétaire", accessorFn: (row) => collectors.find((collector) => collector.id === row.collector_id)?.name ?? "—", cell: ({ getValue }) => <><span className="table-primary">{getValue<string>()}</span><span className="table-secondary">Propriétaire unique</span></> },
    { accessorKey: "active", header: "Statut", cell: ({ getValue }) => <StatusBadge status={getValue<boolean>() ? "ACTIVE" : "DISABLED"} /> },
    { accessorKey: "created_at", header: "Créé (UTC)", cell: ({ getValue }) => <span className="table-mono">{getValue<string>().slice(0, 10)}</span> },
    { id: "actions", header: "Gestion", enableSorting: false, cell: ({ row }) => <div className="button-group"><button className="text-button" title={canManage ? "Modifier le scope" : "Permission requise : scope:manage"} disabled={!canManage} onClick={(event) => { event.stopPropagation(); setEditing(row.original); setOpen(true); }}>Modifier</button>{row.original.active && <button className="icon-action icon-action-danger" title={canManage ? "Désactiver le scope" : "Permission requise : scope:manage"} disabled={!canManage} aria-label={`Désactiver ${row.original.name}`} onClick={(event) => { event.stopPropagation(); setDisabling(row.original); }}><CircleSlash size={13} /></button>}</div> },
  ], [collectors, canManage]);
  const save = (values: ScopeForm) => {
    const conflict = scopes.find((scope) => scope.id !== editing?.id && cidrsOverlap(scope.cidr, values.cidr));
    if (conflict) {
      const owner = collectors.find((collector) => collector.id === conflict.collector_id)?.name ?? "inconnu";
      setMessage(`Chevauchement refusé : ${values.cidr} entre en conflit avec le scope « ${conflict.name} » (${conflict.cidr}), propriétaire ${owner}.`);
      addAudit({ action: "OVERLAP_REJECTED", reason_code: "NETWORK_SCOPE_CIDR_OVERLAP", category: "SECURITY", severity: "HIGH", result: "DENIED", resource: `${values.cidr} ↔ ${conflict.name} (${owner})` });
      return;
    }
    const scopeId = editing?.id ?? crypto.randomUUID();
    const ownerBefore = editing?.collector_id;
    const updated: NetworkScope = { id: scopeId, name: values.name, cidr: values.cidr, collector_id: values.collector_id, active: values.active, created_at: editing?.created_at ?? new Date().toISOString() };
    if (editing) updateScope(scopeId, updated); else addScope(updated);
    if (ownerBefore && ownerBefore !== values.collector_id) {
      const oldCollector = collectors.find((collector) => collector.id === ownerBefore);
      if (oldCollector) updateCollector(oldCollector.id, { scopes: oldCollector.scopes.filter((id) => id !== scopeId) });
    }
    const newCollector = collectors.find((collector) => collector.id === values.collector_id);
    if (newCollector && !newCollector.scopes.includes(scopeId)) updateCollector(newCollector.id, { scopes: [...newCollector.scopes, scopeId] });
    addAudit({ action: editing ? "NETWORK_SCOPE_UPDATED" : "NETWORK_SCOPE_CREATED", reason_code: editing ? "SCOPE_OWNER_AND_CIDR_UPDATED" : "UNIQUE_COLLECTOR_OWNER_ASSIGNED", resource: `scope/${values.name}` });
    setOpen(false); setEditing(null); setMessage(`${values.name} ${editing ? "mis à jour" : "créé"} avec un propriétaire Collector unique.`);
  };
  const closeEditor = () => { setOpen(false); setEditing(null); };
  const confirmDisable = () => { if (!disabling) return; disableScope(disabling.id); addAudit({ action: "NETWORK_SCOPE_DISABLED", reason_code: "SCOPE_RETAINED_NOT_AUTHORIZED_FOR_SCANS", resource: `scope/${disabling.name}` }); setMessage(`${disabling.name} désactivé. Le CIDR reste dans l'historique et n'accepte plus de nouveau scan.`); setDisabling(null); };
  const startNew = () => { setEditing(null); setOpen(true); };
  return <>
    <PageHeader eyebrow="INFRASTRUCTURE / PORTÉE AUTORISÉE" title="Network Scopes" description="Chaque CIDR a un propriétaire Collector unique. Les scopes désactivés restent dans l'historique et ne sont plus scannables." actions={<PermissionButton permission="scope:manage" onClick={startNew}><Plus size={15} /> Créer un scope</PermissionButton>} />
    {message && <div className="page-banner"><AlertTriangle size={14} /><span>{message}</span><button className="text-button" onClick={() => setMessage("")}>Fermer</button></div>}
    <div className="page-banner"><ShieldCheck size={14} /><span><strong>Prévention de chevauchement.</strong> Exemple de tentative refusée : <code>10.20.4.0/24</code> recouvre « DC production » (<code>10.20.0.0/16</code>) possédé par <code>collector-dc1</code>. Le refus produit <code>OVERLAP_REJECTED</code>.</span></div>
    <div className="scope-topology"><div className="scope-topology-head"><Network size={14} /><div><strong>Plages autorisées et propriétaires</strong><span>Visualisation synthétique des préfixes CIDR actifs</span></div></div><div className="scope-map">{scopes.map((scope) => { const owner = collectors.find((collector) => collector.id === scope.collector_id); const prefix = Number(scope.cidr.split("/")[1] ?? 0); return <div className={`scope-map-row ${scope.active ? "" : "scope-map-disabled"}`} key={scope.id}><div className="scope-map-meta"><strong>{scope.name}</strong><code>{scope.cidr}</code></div><div className="scope-map-track"><span style={{ width: `${Math.max(10, (prefix / 32) * 100)}%` }} /></div><span className="scope-map-owner">{owner?.name ?? "Sans propriétaire"}</span>{!scope.active && <StatusBadge status="DISABLED" />}</div>; })}</div></div>
    <GlassCard className="content-panel"><DataTable data={scopes} columns={columns} initialPageSize={8} searchPlaceholder="CIDR, scope, Collector propriétaire..." /></GlassCard>
    <ScopeEditor key={editing?.id ?? "new"} open={open} editing={editing} collectors={collectors} onClose={closeEditor} onSave={save} />
    <GlassModal open={!!disabling} onClose={() => setDisabling(null)} title="Désactiver ce NetworkScope ?" description="Le propriétaire et la plage restent dans l'historique."><div className="inline-alert"><AlertTriangle size={14} /><span><strong>{disabling?.name} · {disabling?.cidr}</strong> n'acceptera plus de nouvelles missions. Les scans antérieurs et leurs Evidence sont conservés.</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={() => setDisabling(null)}>Retour</GlassButton><GlassButton variant="danger" onClick={confirmDisable}>Désactiver le scope</GlassButton></div></GlassModal>
  </>;
}

function ScopeEditor({ open, editing, collectors, onClose, onSave }: { open: boolean; editing: NetworkScope | null; collectors: ReturnType<typeof useAppStore.getState>["collectors"]; onClose: () => void; onSave: (values: ScopeForm) => void }) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ScopeForm>({ resolver: zodResolver(scopeSchema), defaultValues: editing ? { name: editing.name, cidr: editing.cidr, collector_id: editing.collector_id, active: editing.active } : { name: "", cidr: "", collector_id: collectors.find((collector) => collector.lifecycle === "ACTIVE")?.id ?? "", active: true } });
  return <GlassModal open={open} onClose={onClose} title={editing ? "Modifier le NetworkScope" : "Créer un NetworkScope"} description="Validation CIDR et contrôle de chevauchement avant écriture.">
    <form className="form-stack" onSubmit={handleSubmit(onSave)}><div className="form-field"><label htmlFor="scope-name">Nom du scope</label><input id="scope-name" {...register("name")} placeholder="DC production" />{errors.name && <small className="field-error">{errors.name.message}</small>}</div><div className="form-field"><label htmlFor="scope-cidr">CIDR IPv4</label><input id="scope-cidr" {...register("cidr")} placeholder="10.30.0.0/16" aria-invalid={!!errors.cidr} /><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><small className="field-hint">Exemple de conflit : 10.20.4.0/24 recouvre DC production.</small><button className="text-button" type="button" onClick={() => setValue("cidr", "10.20.4.0/24", { shouldValidate: true })}>Tester exemple ↗</button></div>{errors.cidr && <small className="field-error">{errors.cidr.message}</small>}</div><div className="form-field"><label htmlFor="scope-owner">Collector propriétaire unique</label><select id="scope-owner" {...register("collector_id")}>{collectors.filter((collector) => collector.lifecycle !== "DISABLED").map((collector) => <option value={collector.id} key={collector.id}>{collector.name} · {collector.lifecycle}</option>)}</select>{errors.collector_id && <small className="field-error">{errors.collector_id.message}</small>}</div>{editing && <label className="check-line"><input type="checkbox" {...register("active")} /> Scope actif · accepte les nouveaux ScanJobs</label>}<div className="inline-alert inline-alert-info"><Network size={14} /><span>Un CIDR qui recouvre une plage existante est refusé et inscrit dans l'audit. Le frontend n'autorise jamais un scan hors scope.</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={onClose}>Annuler</GlassButton><GlassButton type="submit"><Check size={14} />{editing ? "Enregistrer" : "Créer le scope"}</GlassButton></div></form>
  </GlassModal>;
}