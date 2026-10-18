import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardList, Download, FileUp, History, Shield, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassButton, GlassCard, GlassModal, PageHeader, PermissionButton, StatusBadge } from "../../components/glass";
import { cidrContains } from "../../lib/cidr";
import { api } from "../../lib/services";
import { useAppStore } from "../../lib/store";
import { assets, cryptoUsages, policyPacks as seedPacks } from "../../mocks/data";
import type { AuditEvent } from "../../types/domain";

const policyRules = [
  { id: "RSA-CLASSIC-1024", title: "Clé RSA inférieure à 2048 bits", severity: "CRITICAL", trigger: "RSA key size < 2048", dimension: "Classique + quantique" },
  { id: "ASYM-QUANTUM-RISK", title: "Signature asymétrique vulnérable au quantique", severity: "HIGH", trigger: "RSA / ECDSA / EdDSA in key role", dimension: "Risque quantique" },
  { id: "TLS-LEGACY", title: "Version TLS legacy supportée", severity: "HIGH", trigger: "TLS 1.0 or TLS 1.1 supported", dimension: "Faiblesse classique" },
  { id: "HYBRID-SIGNATURE", title: "Échange PQC hybride avec signature classique", severity: "MEDIUM", trigger: "Hybrid KEX + classical certificate", dimension: "Migration" },
  { id: "OBS-INCOMPLETE", title: "Posture incomplète ou indéterminée", severity: "MEDIUM", trigger: "TIMEOUT / PARTIAL / UNKNOWN", dimension: "Unknown (non-safe)" },
  { id: "SYMMETRIC-KEY-SIZE", title: "Taille symétrique conforme au baseline", severity: "INFO", trigger: "AES-XTS >= 512 total bits", dimension: "PQC readiness" },
];

export function PoliciesPage() {
  const addAudit = useAppStore((state) => state.addAudit);
  const [packs, setPacks] = useState(seedPacks);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const activate = (id: string) => {
    const nextPacks = packs.map((pack) => ({ ...pack, status: pack.id === id ? "ACTIVE" : pack.status === "ACTIVE" ? "ARCHIVED" : pack.status }));
    setPacks(nextPacks); const active = nextPacks.find((pack) => pack.id === id);
    addAudit({ action: "POLICY_PACK_ACTIVATED", reason_code: `PACK_${active?.version}_ACTIVATED`, resource: `policy/${active?.name}/${active?.version}` });
    setMessage(`${active?.name} v${active?.version} est maintenant le Policy Pack actif.`);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setError(""); setSelectedFile(file.name);
    try {
      const parsed = JSON.parse(await file.text()) as { name?: string; version?: string; rules?: unknown[] };
      if (!parsed.name || !parsed.version || !Array.isArray(parsed.rules)) throw new Error("Schéma Policy Pack attendu : name, version et rules[].");
      const imported = { id: crypto.randomUUID(), name: parsed.name, version: parsed.version, status: "DRAFT", rules: parsed.rules.length, updated_at: new Date().toISOString(), description: "Policy Pack importé localement, en attente d'activation." };
      setPacks((current) => [imported, ...current]); addAudit({ action: "POLICY_PACK_IMPORTED", reason_code: "POLICY_PACK_SCHEMA_VALIDATED", resource: `policy/${parsed.name}/${parsed.version}` }); setMessage(`Pack ${parsed.name} v${parsed.version} importé en brouillon. Aucune évaluation n'a été lancée.`); setImportOpen(false);
    } catch (parseError) { setError(parseError instanceof Error ? parseError.message : "Import invalide."); addAudit({ action: "POLICY_PACK_IMPORT_REJECTED", reason_code: "INVALID_POLICY_PACK_SCHEMA", result: "DENIED", resource: file.name }); }
  };
  return <>
    <PageHeader eyebrow="GOUVERNANCE / MOTEUR D'INTERPRÉTATION" title="Policies & Policy Packs" description="Les scanners émettent des faits. Seule une version active de Policy Pack interprète ces faits et génère des Findings." actions={<PermissionButton permission="policy:manage" onClick={() => { setError(""); setImportOpen(true); }}><FileUp size={14} /> Importer un pack</PermissionButton>} />
    {message && <div className="page-banner"><Check size={14} /><span>{message}</span><button className="text-button" onClick={() => setMessage("")}>Fermer</button></div>}
    <div className="policy-pack-list">{packs.map((pack) => <GlassCard className="policy-pack-row" key={pack.id}><div className="policy-pack-icon"><SlidersHorizontal size={18} /></div><div className="policy-pack-copy"><div className="button-group"><h2>{pack.name}</h2><StatusBadge status={pack.status} /></div><p>{pack.description}</p><div className="policy-pack-meta"><span>Version <code>{pack.version}</code></span><span>{pack.rules} règles</span><span>Modifié <code>{pack.updated_at.slice(0, 10)}</code></span></div></div><div className="policy-pack-action">{pack.status !== "ACTIVE" && pack.status !== "REFERENCE" && <PermissionButton permission="policy:manage" variant="secondary" onClick={() => activate(pack.id)}><Check size={13} /> Activer</PermissionButton>}{pack.status === "ACTIVE" && <span className="active-pack-label"><i /> Version active</span>}</div></GlassCard>)}</div>
    <GlassCard className="content-panel" style={{ marginTop: 15 }}><div className="section-title-row"><div><h2>Règles du pack actif</h2><p>Northstar PQC Baseline · v0.1 · raisons vérifiables</p></div><Link to="/findings" className="section-action">Findings produits ↗</Link></div><DataTable data={policyRules} columns={ruleColumns} initialPageSize={8} searchPlaceholder="Rule ID, déclencheur, dimension..." /></GlassCard>
    <GlassModal open={importOpen} onClose={() => setImportOpen(false)} title="Importer un Policy Pack" description="Le document est validé puis ajouté comme brouillon. L'import ne lance pas d'évaluation réseau."><div className="form-stack"><label className="drop-zone" htmlFor="policy-import"><FileUp size={21} /><strong>{selectedFile || "Sélectionner un fichier policy JSON"}</strong><small>name · version · rules[] requis</small><input id="policy-import" className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => importFile(event.target.files?.[0])} /></label>{error && <div className="inline-alert inline-alert-danger"><AlertTriangle size={14} />{error}</div>}<div className="inline-alert inline-alert-info"><Shield size={14} /><span>Les changements d'activation sont journalisés. L'application ne calcule jamais une classification PQC côté client.</span></div></div></GlassModal>
  </>;
}

const ruleColumns: ColumnDef<(typeof policyRules)[number], any>[] = [
  { accessorKey: "id", header: "Rule ID", cell: ({ getValue }) => <code className="table-mono">{getValue<string>()}</code> },
  { accessorKey: "title", header: "Règle", cell: ({ getValue }) => <strong>{getValue<string>()}</strong> },
  { accessorKey: "trigger", header: "Déclencheur (conceptuel)", cell: ({ getValue }) => <code className="table-muted">{getValue<string>()}</code> },
  { accessorKey: "dimension", header: "Dimension", cell: ({ getValue }) => <span>{getValue<string>()}</span> },
  { accessorKey: "severity", header: "Sévérité", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
];

interface ExportRecord { id: string; created_at: string; scope: string; format: string; status: string; components: number; json: string; xml: string }
export function CbomPage() {
  const addAudit = useAppStore((state) => state.addAudit);
  const scopes = useAppStore((state) => state.scopes);
  const [scopeId, setScopeId] = useState("all");
  const [format, setFormat] = useState<"JSON" | "XML">("JSON");
  const [record, setRecord] = useState<ExportRecord | null>(null);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<ExportRecord | null>(null);
  const filteredAssets = useMemo(() => scopeId === "all" ? assets : assets.filter((asset) => { const scope = scopes.find((item) => item.id === scopeId); return !!scope && asset.ips.some((ip) => cidrContains(scope.cidr, ip)); }), [scopeId, scopes]);
  const usageForScope = cryptoUsages.filter((usage) => filteredAssets.some((asset) => asset.id === usage.asset_id));
  const generate = async () => {
    setLoading(true); setError("");
    try {
      const outcome = await api.exportCbom();
      const now = new Date().toISOString();
      const components = usageForScope.map((usage) => ({ type: "cryptographic-asset", name: usage.algorithm, version: usage.size_curve, scope: usage.target, role: usage.role, protocol: usage.protocol, observationMode: usage.observation_mode, evidenceRef: usage.evidence_id }));
      const payload = { bomFormat: "CycloneDX", specVersion: "1.6", serialNumber: `urn:uuid:${crypto.randomUUID()}`, version: 1, metadata: { timestamp: now, tools: [{ name: "PQC-SOFT", version: "2.8.1" }], properties: [{ name: "pqc-soft:scope", value: scopeId === "all" ? "All assets" : scopes.find((item) => item.id === scopeId)?.cidr ?? "" }] }, components };
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<bom xmlns="http://cyclonedx.org/schema/bom/1.6" version="1">\n  <metadata><timestamp>${now}</timestamp><tools><tool><name>PQC-SOFT</name><version>2.8.1</version></tool></tools></metadata>\n  <components>\n${components.map((component, index) => `    <component type="cryptographic-asset" bom-ref="crypto-${index + 1}"><name>${component.name}</name><version>${component.version}</version><properties><property name="observationMode">${component.observationMode}</property><property name="protocol">${component.protocol}</property><property name="evidenceRef">${component.evidenceRef}</property></properties></component>`).join("\n")}\n  </components>\n</bom>`;
      const next: ExportRecord = { id: crypto.randomUUID(), created_at: now, scope: scopeId === "all" ? "Tous les Assets" : scopes.find((item) => item.id === scopeId)?.name ?? "NetworkScope", format: `${format} · CycloneDX 1.6`, status: outcome.status, components: components.length, json: JSON.stringify(payload, null, 2), xml };
      setRecord(next); setHistory((current) => [next, ...current]); addAudit({ action: "CBOM_EXPORT_CREATED", reason_code: "CYCLONEDX_SCHEMA_VALIDATED", resource: `cbom/${next.id}` });
    } catch (serviceError) { setError(serviceError instanceof Error ? serviceError.message : "Export indisponible."); }
    finally { setLoading(false); }
  };
  const preview = record ? (format === "JSON" ? record.json : record.xml) : "";
  const download = () => { if (!record) return; const blob = new Blob([preview], { type: format === "JSON" ? "application/json" : "application/xml" }); const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `pqc-soft-cbom-${new Date(record.created_at).toISOString().slice(0, 10)}.${format.toLowerCase()}`; anchor.click(); URL.revokeObjectURL(href); };
  return <>
    <PageHeader eyebrow="EXPORT / CYCLONEDX" title="CBOM & Exports" description="Générez une vue d'export CycloneDX depuis les faits connus, avec modes d'observation et références d'Evidence conservés." />
    <div className="page-banner"><AlertTriangle size={14} /><span><strong>Le CBOM est un export dérivé.</strong> Il ne remplace pas le modèle interne Asset → Service / Volume → Evidence → Observation → Crypto → Finding.</span></div>
    <div className="detail-layout"><div className="detail-main"><GlassCard className="detail-section"><h2 className="detail-section-title">Générateur CycloneDX <small>Schema 1.6</small></h2><div className="settings-grid"><div className="form-field"><label htmlFor="cbom-scope">Périmètre</label><select id="cbom-scope" className="filter-select" style={{ maxWidth: "100%", minHeight: 39 }} value={scopeId} onChange={(event) => setScopeId(event.target.value)}><option value="all">Tous les Assets · {assets.length}</option>{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name} · {scope.cidr}</option>)}</select></div><div className="form-field"><label htmlFor="cbom-format">Format</label><select id="cbom-format" className="filter-select" style={{ maxWidth: "100%", minHeight: 39 }} value={format} onChange={(event) => setFormat(event.target.value as "JSON" | "XML")}><option value="JSON">JSON · CycloneDX 1.6</option><option value="XML">XML · CycloneDX 1.6</option></select></div></div><div className="page-banner" style={{ margin: "15px 0" }}><Check size={14} /><span>{filteredAssets.length} Assets · {usageForScope.length} usages crypto · provenance Evidence référencée lorsque disponible.</span></div><PermissionButton permission="cbom:export" onClick={generate} disabled={loading}><Download size={14} />{loading ? "Génération..." : "Générer et valider"}</PermissionButton>{error && <div className="inline-alert inline-alert-danger" style={{ marginTop: 12 }}>{error}</div>}</GlassCard>
      {record && <GlassCard className="detail-section"><div className="section-title-row"><div><h2>Prévisualisation du fichier</h2><p>{record.created_at} · {record.components} composants · {record.scope}</p></div><div className="button-group"><StatusBadge status={record.status} /><GlassButton variant="secondary" onClick={download}><Download size={13} /> Télécharger</GlassButton></div></div><pre className="download-preview">{preview}</pre></GlassCard>}</div>
      <aside className="detail-sidebar"><GlassCard className="detail-section"><h3 className="detail-section-title">Validation schema</h3>{record ? <div className="detail-list"><div className="detail-list-row"><span>Document</span><StatusBadge status={record.status} /></div><div className="detail-list-row"><span>Version affichée</span><code>CycloneDX 1.6</code></div><div className="detail-list-row"><span>Provenance</span><strong>Evidence refs conservées</strong></div></div> : <div className="raw-locked"><Check size={18} /><strong>En attente d'une génération</strong><p>Le statut de validation est retourné par la couche de service mockée.</p></div>}</GlassCard><GlassCard className="detail-section"><h3 className="detail-section-title"><History size={13} /> Historique des exports <small>{history.length}</small></h3>{history.length ? history.map((item) => <button key={item.id} className="export-history-row" onClick={() => { setRecord(item); setSelectedHistory(item); }}><span><strong>{item.scope}</strong><small>{item.created_at.slice(0, 16).replace("T", " ")} UTC · {item.components} composants</small></span><StatusBadge status={item.status} /></button>) : <small className="field-hint">Aucun export généré dans cette session.</small>}</GlassCard></aside></div>
    <GlassModal open={!!selectedHistory} onClose={() => setSelectedHistory(null)} title="Export CBOM" description={selectedHistory?.id}><div className="inline-alert"><Check size={14} /><span>{selectedHistory?.format} · {selectedHistory?.components} composants · {selectedHistory?.created_at}</span></div><div className="modal-actions"><GlassButton variant="secondary" onClick={() => setSelectedHistory(null)}>Fermer</GlassButton></div></GlassModal>
  </>;
}

export function AuditPage() {
  const events = useAppStore((state) => state.auditEvents);
  const [tab, setTab] = useState<AuditEvent["category"] | "ALL">("ALL");
  const [severity, setSeverity] = useState("all");
  const [actor, setActor] = useState("all");
  const [days, setDays] = useState("30");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const filtered = useMemo(() => events.filter((event) => (tab === "ALL" || event.category === tab) && (severity === "all" || event.severity === severity) && (actor === "all" || event.actor === actor) && (days === "all" || Date.now() - new Date(event.timestamp).getTime() <= Number(days) * 86400000)), [events, tab, severity, actor, days]);
  const columns = useMemo<ColumnDef<AuditEvent, any>[]>(() => [
    { accessorKey: "timestamp", header: "Horodatage UTC", cell: ({ getValue }) => <span className="table-mono">{getValue<string>()}</span> },
    { accessorKey: "severity", header: "Sévérité", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "category", header: "Catégorie", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "action", header: "Action", cell: ({ row }) => <button style={{ border: 0, padding: 0, background: "none", cursor: "pointer" }} className="audit-action" onClick={() => setSelected(row.original)}><i className={`audit-dot ${row.original.severity === "HIGH" || row.original.result === "DENIED" ? "audit-dot-danger" : row.original.severity === "MEDIUM" ? "audit-dot-warning" : ""}`} />{row.original.action}</button> },
    { accessorKey: "actor", header: "Acteur" },
    { accessorKey: "source", header: "Source", cell: ({ getValue }) => <span className="table-mono">{getValue<string>()}</span> },
    { accessorKey: "result", header: "Résultat", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "reason_code", header: "Reason code", cell: ({ getValue }) => <code className="table-muted">{getValue<string>()}</code> },
    { accessorKey: "resource", header: "Ressource", cell: ({ getValue }) => <span className="table-mono">{getValue<string>()}</span> },
    { accessorKey: "correlation_id", header: "Correlation-ID", cell: ({ getValue }) => <CopyChip compact value={getValue<string>()} /> },
  ], []);
  return <>
    <PageHeader eyebrow="GOUVERNANCE / TRAÇABILITÉ" title="Audit Logs" description="Événements structurés avec acteur, raison, résultat et correlation ID. Les journaux de sécurité et d'exploitation sont séparés." />
    <div className="page-banner"><ClipboardList size={14} /><span><strong>Accès en lecture contrôlé par audit:read.</strong> L'Operator n'a pas accès à cet écran ; ses diagnostics se trouvent dans Scans et Collectors.</span></div>
    <div className="tabs-bar" role="tablist">{[{ id: "ALL", label: "Tous" }, { id: "AUDIT", label: "Audit" }, { id: "SECURITY", label: "Security events" }, { id: "OPERATIONAL", label: "Operational logs" }].map((item) => <button role="tab" aria-selected={tab === item.id} className={`tab-button ${tab === item.id ? "tab-button-active" : ""}`} key={item.id} onClick={() => setTab(item.id as AuditEvent["category"] | "ALL")}>{item.label}<span className="tab-count">{item.id === "ALL" ? events.length : events.filter((event) => event.category === item.id).length}</span></button>)}</div>
    <div className="filter-row"><span className="filter-label">Filtres</span><select className="filter-select" value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filtrer par sévérité"><option value="all">Toutes sévérités</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((value) => <option key={value}>{value}</option>)}</select><select className="filter-select" value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Filtrer par acteur"><option value="all">Tous les acteurs</option>{Array.from(new Set(events.map((event) => event.actor))).map((value) => <option key={value}>{value}</option>)}</select><select className="filter-select" value={days} onChange={(event) => setDays(event.target.value)} aria-label="Filtrer par période"><option value="1">Dernières 24 h</option><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="all">Toutes périodes</option></select></div>
    <GlassCard className="content-panel"><DataTable data={filtered} columns={columns} initialPageSize={15} searchPlaceholder="Action, reason_code, actor, correlation ID..." /></GlassCard>
    <GlassModal open={!!selected} onClose={() => setSelected(null)} title="Événement d'audit" description={selected?.timestamp}><div className="form-stack">{selected && <><div className="button-group"><StatusBadge status={selected.category} /><StatusBadge status={selected.severity} /><StatusBadge status={selected.result} /></div><div className="detail-kv"><KV label="Action" value={selected.action} /><KV label="Acteur" value={selected.actor} /><KV label="Source" value={selected.source} /><KV label="Reason code" value={selected.reason_code} /><KV label="Ressource" value={selected.resource} /><KV label="Correlation-ID" value={selected.correlation_id} /></div><div><span className="dim-label">Correlation-ID copiable</span><CopyChip value={selected.correlation_id} /></div></>}</div></GlassModal>
  </>;
}

function KV({ label, value }: { label: string; value: string }) { return <div className="detail-kv-item"><span>{label}</span><strong>{value}</strong></div>; }