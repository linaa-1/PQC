import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Activity, AlertTriangle, Check, CircleHelp, FileKey2, KeyRound, Save, Shield, ShieldCheck, Users, Wifi, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassButton, GlassCard, GlassModal, PageHeader, PermissionButton, StatusBadge } from "../../components/glass";
import { rolePermissions, useCan } from "../../lib/permissions";
import { mockRequest } from "../../lib/services";
import { useAppStore } from "../../lib/store";
import { license as seedLicense, users as seedUsers } from "../../mocks/data";
import type { Role } from "../../types/domain";

const invitationSchema = z.object({ name: z.string().min(2, "Nom requis."), email: z.string().email("Adresse e-mail invalide."), role: z.enum(["Administrator", "Operator", "Analyst", "Auditor"]) });
type Invitation = z.infer<typeof invitationSchema>;
const roles: Role[] = ["Administrator", "Operator", "Analyst", "Auditor"];

export function UsersPage() {
  const [activeTab, setActiveTab] = useState<"users" | "matrix">("users");
  const [users, setUsers] = useState(seedUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [message, setMessage] = useState("");
  const addAudit = useAppStore((state) => state.addAudit);
  const canAssign = useCan("role:assign");
  const canManage = useCan("user:manage");
  const columns = useMemo<ColumnDef<(typeof seedUsers)[number], any>[]>(() => [
    { accessorKey: "name", header: "Utilisateur", cell: ({ row }) => <><strong>{row.original.name}</strong><span className="table-secondary">{row.original.email}</span></> },
    { accessorKey: "role", header: "Rôle simulé", cell: ({ row }) => <select aria-label={`Rôle de ${row.original.name}`} title={canAssign ? "Assigner un rôle" : "Permission requise : role:assign"} disabled={!canAssign} className="filter-select" value={row.original.role} onChange={(event) => { const newRole = event.target.value as Role; setUsers((current) => current.map((user) => user.id === row.original.id ? { ...user, role: newRole } : user)); addAudit({ action: "ROLE_ASSIGNED", reason_code: "ADMIN_ROLE_ASSIGNMENT", resource: `user/${row.original.email}` }); }}><option value="Administrator">Administrator</option><option value="Operator">Operator</option><option value="Analyst">Analyst</option><option value="Auditor">Auditor</option></select> },
    { accessorKey: "status", header: "Statut", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "last_seen", header: "Dernière activité UTC", cell: ({ getValue }) => <span className="table-mono">{getValue<string>() === "Never" ? "Jamais" : getValue<string>().slice(0, 16).replace("T", " ")}</span> },
    { id: "permissions", header: "Permissions effectives", accessorFn: (row) => rolePermissions[row.role].length, cell: ({ row, getValue }) => <button className="text-button" onClick={() => setActiveTab("matrix")}>{getValue<number>()} permissions · {row.original.role} ↗</button> },
  ], [canAssign, addAudit]);
  return <>
    <PageHeader eyebrow="ADMINISTRATION / IDENTITÉS" title="Users & Roles" description="Permissions effectives par rôle. Le sélecteur de rôle du header ne modifie que la simulation RBAC de cette interface." actions={<PermissionButton permission="user:manage" onClick={() => setInviteOpen(true)}><Users size={14} /> Inviter un utilisateur</PermissionButton>} />
    {message && <div className="page-banner"><Check size={14} />{message}</div>}
    <div className="tabs-bar"><button className={`tab-button ${activeTab === "users" ? "tab-button-active" : ""}`} onClick={() => setActiveTab("users")}>Utilisateurs <span className="tab-count">{users.length}</span></button><button className={`tab-button ${activeTab === "matrix" ? "tab-button-active" : ""}`} onClick={() => setActiveTab("matrix")}>Matrice rôles / permissions</button></div>
    {activeTab === "users" ? <GlassCard className="content-panel"><DataTable data={users} columns={columns} initialPageSize={8} searchPlaceholder="Nom, email, rôle, statut..." /></GlassCard> : <PermissionsMatrix />}
    {!canManage && <div className="page-banner" style={{ marginTop: 14 }}><Shield size={14} /><span>Lecture seule. Permission requise : <code>user:manage</code> pour inviter ou modifier un utilisateur, <code>role:assign</code> pour assigner un rôle.</span></div>}
    <InviteUser open={inviteOpen} onClose={() => setInviteOpen(false)} onCreated={(user) => { setUsers((current) => [user, ...current]); setMessage(`Invitation créée pour ${user.email}. L'authentification n'est pas présumée par le frontend.`); setInviteOpen(false); addAudit({ action: "USER_INVITATION_CREATED", reason_code: "ADMIN_USER_MANAGE", resource: `user/${user.email}` }); }} />
  </>;
}

function PermissionsMatrix() {
  const permissions = Array.from(new Set(roles.flatMap((role) => rolePermissions[role])));
  const data = permissions.map((permission) => ({ permission, ...Object.fromEntries(roles.map((role) => [role, rolePermissions[role].includes(permission)])) }));
  const columns = [{ accessorKey: "permission", header: "Permission", cell: ({ getValue }: { getValue: () => unknown }) => <code className="table-mono">{String(getValue())}</code> }, ...roles.map((role) => ({ accessorKey: role, header: role, cell: ({ getValue }: { getValue: () => unknown }) => getValue() ? <Check className="matrix-check" size={14} /> : <X className="matrix-dash" size={14} /> }))] as ColumnDef<(typeof data)[number], any>[];
  return <GlassCard className="content-panel"><div className="page-banner"><ShieldCheck size={14} /><span>La visibilité et l'activation d'actions utilisent cette matrice de permissions effectives, pas le nom du rôle seul. Auditor est strictement en lecture seule.</span></div><DataTable data={data} columns={columns} initialPageSize={15} searchPlaceholder="Rechercher une permission..." /></GlassCard>;
}

function InviteUser({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (user: (typeof seedUsers)[number]) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Invitation>({ resolver: zodResolver(invitationSchema), defaultValues: { name: "", email: "", role: "Analyst" } });
  const close = () => { reset({ name: "", email: "", role: "Analyst" }); onClose(); };
  const submit = handleSubmit((values) => { onCreated({ id: crypto.randomUUID(), ...values, status: "INVITED", last_seen: "Never" }); close(); });
  return <GlassModal open={open} onClose={close} title="Inviter un utilisateur" description="Création fictive d'une entrée d'utilisateur. Aucun fournisseur d'authentification n'est sélectionné."><form className="form-stack" onSubmit={submit}><div className="form-field"><label htmlFor="user-name">Nom complet</label><input id="user-name" {...register("name")} placeholder="Jamie Laurent" />{errors.name && <small className="field-error">{errors.name.message}</small>}</div><div className="form-field"><label htmlFor="user-email">Adresse e-mail</label><input id="user-email" type="email" {...register("email")} placeholder="j.laurent@northstar.internal" />{errors.email && <small className="field-error">{errors.email.message}</small>}</div><div className="form-field"><label htmlFor="user-role">Rôle</label><select id="user-role" {...register("role")}>{roles.map((role) => <option key={role}>{role}</option>)}</select></div><div className="inline-alert inline-alert-info"><CircleHelp size={14} /><span>Le mode d'authentification (local, LDAP, SSO) n'est pas présumé ; cette invitation reste une donnée de démonstration.</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={close}>Annuler</GlassButton><GlassButton type="submit"><Users size={14} /> Créer l'invitation</GlassButton></div></form></GlassModal>;
}

interface SettingsState { profiles: boolean; deepTls: boolean; warningSpool: number; criticalSpool: number; heartbeat: number; retentionAudit: number; retentionEvidence: number; siem: boolean; siemHost: string; siemPort: number; siemFormat: string; siemTls: boolean }
const initialSettings: SettingsState = { profiles: true, deepTls: true, warningSpool: 75, criticalSpool: 90, heartbeat: 90, retentionAudit: 365, retentionEvidence: 180, siem: true, siemHost: "siem.northstar.internal", siemPort: 6514, siemFormat: "JSON structuré", siemTls: true };

export function SettingsPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [siemResult, setSiemResult] = useState("");
  const [testing, setTesting] = useState(false);
  const addAudit = useAppStore((state) => state.addAudit);
  const canManage = useCan("settings:manage");
  const patch = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => { setSettings((current) => ({ ...current, [key]: value })); setSaved(false); };
  const save = (section: string) => { addAudit({ action: "SETTINGS_UPDATED", reason_code: "ADMIN_SETTINGS_MANAGE", resource: `settings/${section}` }); setSaved(true); };
  const testSiem = async () => { setTesting(true); setSiemResult(""); try { await mockRequest(true, { latency: 700 }); setSiemResult("Connexion TLS simulée réussie. La file d'export reste isolée du moteur de scan."); } catch { setSiemResult("Connexion simulée impossible ; les événements restent en file locale."); } finally { setTesting(false); } };
  const components = [{ name: "ZMap", version: "4.2.0", status: "ACTIVE" }, { name: "ZGrab2", version: "0.1.8", status: "ACTIVE" }, { name: "testssl.sh", version: "3.2rc2", status: "ACTIVE" }, { name: "Collector", version: "2.8.1", status: "ACTIVE" }, { name: "Policy Pack", version: "Northstar v0.1", status: "ACTIVE" }];
  return <>
    <PageHeader eyebrow="ADMINISTRATION / PARAMÈTRES ON-PREMISE" title="Settings" description="Profils contrôlés, rétention, seuils opérationnels et export SIEM. Une panne SIEM n'impacte pas le service de scan." />
    {saved && <div className="page-banner"><Check size={14} /><span>Paramètres enregistrés dans la couche mockée.</span><button className="text-button" onClick={() => setSaved(false)}>Fermer</button></div>}
    <div className="settings-stack">
      <GlassCard className="detail-section"><div className="section-title-row"><div><h2>Profils de scan & limites</h2><p>Aucun scan arbitraire hors politique d'administration</p></div><PermissionButton permission="settings:manage" onClick={() => save("scan-profiles")}><Save size={13} /> Enregistrer</PermissionButton></div><div className="setting-row"><div><strong>Profils prédéfinis</strong><small>Conservateur · Standard · Rapide</small></div><button className="toggle-switch" role="switch" aria-checked={settings.profiles} aria-label="Activer les profils prédéfinis" disabled={!canManage} onClick={() => patch("profiles", !settings.profiles)} /></div><div className="setting-row"><div><strong>Deep TLS après détection</strong><small>testssl.sh est lancé uniquement après détection d'un endpoint TLS.</small></div><button className="toggle-switch" role="switch" aria-checked={settings.deepTls} aria-label="Activer le deep TLS conditionnel" disabled={!canManage} onClick={() => patch("deepTls", !settings.deepTls)} /></div></GlassCard>
      <GlassCard className="detail-section"><div className="section-title-row"><div><h2>Seuils & rétention</h2><p>Valeurs UTC et stockage local</p></div><PermissionButton permission="settings:manage" onClick={() => save("thresholds-retention")}><Save size={13} /> Enregistrer</PermissionButton></div><div className="settings-grid">{[["Alerte spool (%)", "warningSpool"], ["Critique spool (%)", "criticalSpool"], ["Heartbeat timeout (s)", "heartbeat"], ["Rétention Audit (jours)", "retentionAudit"], ["Rétention Evidence (jours)", "retentionEvidence"]].map(([label, key]) => <div className="form-field" key={key}><label htmlFor={key}>{label}</label><input id={key} type="number" disabled={!canManage} min="1" value={settings[key as keyof SettingsState] as number} onChange={(event) => patch(key as keyof SettingsState, Number(event.target.value) as never)} /></div>)}</div><div className="quota-row"><span>Usage stockage</span><div className="progress-line"><span style={{ width: "63%" }} /></div><code>1.26 TB / 2 TB</code></div></GlassCard>
      <GlassCard className="detail-section"><div className="section-title-row"><div><h2>Export SIEM</h2><p>Catégories, sévérités et file de livraison indépendantes</p></div><PermissionButton permission="settings:manage" onClick={() => save("siem") }><Save size={13} /> Enregistrer</PermissionButton></div><div className="setting-row"><div><strong>Export activé</strong><small>Les événements restent audités localement si le transport échoue.</small></div><button className="toggle-switch" role="switch" aria-checked={settings.siem} aria-label="Activer l'export SIEM" disabled={!canManage} onClick={() => patch("siem", !settings.siem)} /></div><div className="settings-grid"><div className="form-field"><label htmlFor="siem-host">Hôte SIEM</label><input id="siem-host" disabled={!canManage} value={settings.siemHost} onChange={(event) => patch("siemHost", event.target.value)} /></div><div className="form-field"><label htmlFor="siem-port">Port TCP/TLS</label><input id="siem-port" type="number" disabled={!canManage} value={settings.siemPort} onChange={(event) => patch("siemPort", Number(event.target.value))} /></div><div className="form-field"><label htmlFor="siem-format">Format</label><select id="siem-format" disabled={!canManage} value={settings.siemFormat} onChange={(event) => patch("siemFormat", event.target.value)}><option>JSON structuré</option><option>Syslog RFC 5424</option><option>CEF</option></select></div><label className="check-line"><input type="checkbox" disabled={!canManage} checked={settings.siemTls} onChange={(event) => patch("siemTls", event.target.checked)} /> Transport chiffré TCP/TLS</label></div><div className="button-group" style={{ marginTop: 13 }}><PermissionButton permission="settings:manage" variant="secondary" onClick={testSiem} disabled={testing}><Wifi size={13} />{testing ? "Test en cours..." : "Tester la connexion"}</PermissionButton><span className="table-muted">Queue : 6 en attente · 0 erreur critique</span></div>{siemResult && <div className="inline-alert inline-alert-info" style={{ marginTop: 12 }}><Activity size={14} />{siemResult}</div>}</GlassCard>
      <GlassCard className="content-panel"><div className="section-title-row"><div><h2>Versions des composants</h2><p>Versions installées dans le réseau local</p></div></div><DataTable data={components} columns={versionColumns} initialPageSize={8} searchPlaceholder="Scanner, Collector, parser..." /></GlassCard>
    </div>
  </>;
}

const versionColumns: ColumnDef<{ name: string; version: string; status: string }, any>[] = [{ accessorKey: "name", header: "Composant" }, { accessorKey: "version", header: "Version", cell: ({ getValue }) => <code className="table-mono">{getValue<string>()}</code> }, { accessorKey: "status", header: "État", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> }];

export function LicensePage() {
  const [license, setLicense] = useState<Omit<typeof seedLicense, "status"> & { status: "VALID" | "EXPIRING" | "GRACE" | "EXPIRED" | "INVALID_SIGNATURE" | "WRONG_INSTALLATION" | "CLOCK_ANOMALY" }>(seedLicense);
  const [fileName, setFileName] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [rehostOpen, setRehostOpen] = useState(false);
  const [rehostId, setRehostId] = useState("");
  const [installing, setInstalling] = useState(false);
  const addAudit = useAppStore((state) => state.addAudit);
  const canManage = useCan("license:manage");
  const installLicense = async (file?: File) => {
    if (!file) return;
    setFileName(file.name); setInstalling(true); setUploadMessage("");
    try {
      await mockRequest(true, { latency: 650 });
      const status = /invalid|bad-signature/i.test(file.name) ? "INVALID_SIGNATURE" : /wrong-installation/i.test(file.name) ? "WRONG_INSTALLATION" : /clock-anomaly/i.test(file.name) ? "CLOCK_ANOMALY" : /expired/i.test(file.name) ? "EXPIRED" : "VALID";
      setLicense((current) => ({ ...current, status, expires_at: status === "VALID" ? new Date(Date.now() + 365 * 86400000).toISOString() : current.expires_at }));
      setUploadMessage(status === "INVALID_SIGNATURE" ? "Signature invalide. La licence précédente et ses entitlements sont conservés." : status === "WRONG_INSTALLATION" ? "Cette licence appartient à une autre installation." : status === "CLOCK_ANOMALY" ? "Anomalie d'horloge détectée ; la validation est refusée." : status === "EXPIRED" ? "La licence installée est expirée." : "Fichier .pqclic installé et signature simulée valide.");
      addAudit({ action: "LICENSE_FILE_INSTALLED", reason_code: status === "INVALID_SIGNATURE" ? "LICENSE_SIGNATURE_INVALID" : "LICENSE_FILE_VALIDATED", severity: status === "INVALID_SIGNATURE" ? "HIGH" : "INFO", result: status === "INVALID_SIGNATURE" ? "DENIED" : "SUCCESS", resource: file.name });
    } catch { setUploadMessage("Impossible de valider le fichier dans la simulation."); }
    finally { setInstalling(false); }
  };
  const createRehost = () => { const id = `rehost-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; setRehostId(id); addAudit({ action: "LICENSE_REHOST_REQUESTED", reason_code: "ADMIN_LICENSE_REHOST", resource: `license/${id}` }); };
  return <>
    <PageHeader eyebrow="ADMINISTRATION / ENTITLEMENTS" title="Licensing" description="Licence on-premise ENTERPRISE, période d'expiration, entitlements et rehost simulé." badge={<StatusBadge status={license.status} />} />
    {(license.status === "EXPIRING" || license.status === "GRACE" || license.status === "EXPIRED") && <div className="page-banner"><AlertTriangle size={14} /><span><strong>Licence {license.status.toLowerCase()}.</strong> Échéance {license.expires_at}. L'état contractuel est affiché sans arrêter le fonctionnement du prototype.</span></div>}
    {uploadMessage && <div className={`page-banner ${uploadMessage.includes("invalide") ? "page-banner-error" : ""}`}><Check size={14} /><span>{uploadMessage}</span></div>}
    <div className="detail-layout"><div className="detail-main"><GlassCard className="detail-section"><div className="section-title-row"><div><h2>Licence installée</h2><p>Informations non sensibles · aucun secret affiché</p></div><StatusBadge status={license.status} /></div><div className="detail-kv"><div className="detail-kv-item"><span>Édition</span><strong>{license.edition}</strong></div><div className="detail-kv-item"><span>Numéro de série</span><CopyChip compact value={license.serial} /></div><div className="detail-kv-item"><span>Expiration UTC</span><code>{license.expires_at}</code></div><div className="detail-kv-item"><span>Mode offline</span><StatusBadge status={license.offline_mode ? "ACTIVE" : "DISABLED"} /></div></div><div className="quota-row"><span>Collectors</span><div className="progress-line"><span style={{ width: `${license.collectors_used / license.collectors_max * 100}%` }} /></div><code>{license.collectors_used} / {license.collectors_max}</code></div><div className="quota-row"><span>Assets</span><div className="progress-line"><span style={{ width: `${license.assets_used / license.assets_max * 100}%` }} /></div><code>{license.assets_used} / {license.assets_max}</code></div></GlassCard>
      <GlassCard className="detail-section"><h2 className="detail-section-title"><FileKey2 size={14} /> Installer / remplacer un fichier .pqclic</h2><label className="drop-zone" htmlFor="license-file"><KeyRound size={20} /><strong>{fileName || "Sélectionner une licence"}</strong><small>{installing ? "Validation de signature..." : "Simulation locale · aucun transfert externe"}</small><input id="license-file" className="hidden-input" type="file" accept=".pqclic" disabled={!canManage || installing} onChange={(event) => installLicense(event.target.files?.[0])} title={canManage ? undefined : "Permission requise : license:manage"} /></label><div className="modal-actions" style={{ justifyContent: "flex-start" }}><PermissionButton permission="license:manage" variant="secondary" onClick={() => document.getElementById("license-file")?.click()} disabled={installing}>Choisir le fichier .pqclic</PermissionButton><PermissionButton permission="license:manage" variant="secondary" onClick={() => setRehostOpen(true)}><KeyRound size={13} /> Demander un rehost</PermissionButton></div></GlassCard></div>
      <aside className="detail-sidebar"><GlassCard className="detail-section"><h3 className="detail-section-title">Entitlements</h3><div className="detail-list"><div className="detail-list-row"><div><strong>Collectors max.</strong><small>{license.collectors_used} utilisés · {license.collectors_max} autorisés</small></div><StatusBadge status="ACTIVE" /></div><div className="detail-list-row"><div><strong>Assets max.</strong><small>{license.assets_used} utilisés · {license.assets_max} autorisés</small></div><StatusBadge status="ACTIVE" /></div><div className="detail-list-row"><div><strong>Mode offline</strong><small>Déploiement local</small></div><StatusBadge status={license.offline_mode ? "ACTIVE" : "DISABLED"} /></div></div></GlassCard><GlassCard className="detail-section"><h3 className="detail-section-title">États gérés</h3><div className="risk-pair">{["VALID", "EXPIRING", "GRACE", "EXPIRED", "INVALID_SIGNATURE", "WRONG_INSTALLATION", "CLOCK_ANOMALY"].map((state) => <StatusBadge status={state} key={state} />)}</div><p className="field-hint" style={{ marginTop: 12 }}>Une anomalie d'horloge n'est pas réinterprétée en licence valide.</p></GlassCard></aside></div>
    <GlassModal open={rehostOpen} onClose={() => { setRehostOpen(false); setRehostId(""); }} title="Workflow de rehost" description="Simulation de demande de déplacement vers une autre installation on-premise."><div className="form-stack"><div className="inline-alert inline-alert-info"><AlertTriangle size={14} /><span>La licence actuelle reste visible pendant l'attente. La console ne contacte pas de service externe.</span></div>{rehostId ? <div><span className="dim-label">Identifiant de demande</span><CopyChip value={rehostId} /></div> : <p className="field-hint">La confirmation crée un identifiant d'audit, sans révoquer automatiquement cette installation.</p>}<div className="modal-actions"><GlassButton variant="secondary" onClick={() => setRehostOpen(false)}>Fermer</GlassButton>{!rehostId && <GlassButton onClick={createRehost}>Créer la demande</GlassButton>}</div></div></GlassModal>
  </>;
}