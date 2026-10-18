import { useMemo, useState } from "react";
import { AlertTriangle, Check, ShieldAlert, Sparkles } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassButton, GlassCard, GlassModal, GlassSheet, ObservationModeBadge, PageHeader, PermissionButton, ProvenanceChain, StatusBadge } from "../../components/glass";
import { api } from "../../lib/services";
import { useAppStore } from "../../lib/store";
import { cryptoUsages, evidence, findings, observations, policyPacks } from "../../mocks/data";
import type { Finding } from "../../types/domain";

export function FindingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [classification, setClassification] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [evaluateOpen, setEvaluateOpen] = useState(false);
  const selectedId = searchParams.get("selected");
  const selected = findings.find((finding) => finding.id === selectedId);
  const filtered = useMemo(() => findings.filter((finding) => (classification === "all" || finding.classification === classification) && (severity === "all" || finding.severity === severity)), [classification, severity]);
  const columns = useMemo<ColumnDef<Finding, any>[]>(() => [
    { accessorKey: "classification", header: "Classification PQC", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "severity", header: "Sévérité", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "title", header: "Finding", cell: ({ row }) => <button className="table-primary" style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer", padding: 0 }} onClick={() => choose(row.original.id)}>{row.original.title}<span className="table-secondary"><code>{row.original.reason_code}</code></span></button> },
    { accessorKey: "classical_weakness", header: "Faiblesse classique", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "quantum_risk", header: "Risque quantique", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { accessorKey: "target", header: "Cible", cell: ({ row }) => <Link className="table-primary table-ellipsize" to={`/assets/${row.original.asset_id}`}>{row.original.target}</Link> },
    { accessorKey: "evaluated_at", header: "Évalué (UTC)", cell: ({ getValue }) => <span className="table-mono">{getValue<string>().slice(0, 16).replace("T", " ")}</span> },
    { id: "policy", header: "Policy Pack", accessorFn: (row) => `${row.policy_pack} v${row.policy_version}`, cell: ({ getValue }) => <span className="table-muted">{getValue<string>()}</span> },
  ], []);
  function choose(id: string) { const next = new URLSearchParams(searchParams); next.set("selected", id); setSearchParams(next); }
  const closeFinding = () => { const next = new URLSearchParams(searchParams); next.delete("selected"); setSearchParams(next, { replace: true }); };
  return <>
    <PageHeader eyebrow="POLICY OUTPUT / CONSTAT" title="Findings" description="Les classifications sont émises par un Policy Pack versionné. Les faits justificatifs et leur provenance restent inspectables." actions={<PermissionButton permission="policy:evaluate" onClick={() => setEvaluateOpen(true)}><Sparkles size={14} /> Réévaluer</PermissionButton>} />
    <div className="page-banner"><ShieldAlert size={14} /><span><strong>Deux dimensions séparées.</strong> Une faiblesse classique n'est pas un risque quantique : RSA-1024 peut être faible aujourd'hui et vulnérable au quantique ; RSA-2048+ peut être robuste aujourd'hui mais rester quantiquement vulnérable.</span></div>
    <div className="filter-row"><span className="filter-label">Filtrer</span><select className="filter-select" value={classification} onChange={(event) => setClassification(event.target.value)} aria-label="Filtrer par classification"><option value="all">Toutes les classifications</option><option value="QUANTUM_VULNERABLE">Quantum vulnerable</option><option value="LEGACY">Legacy</option><option value="WEAK">Weak</option><option value="MIGRATION_REQUIRED">Migration required</option><option value="PQC_READY">PQC ready</option><option value="UNKNOWN">Unknown / Partial</option></select><select className="filter-select" value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filtrer par sévérité"><option value="all">Toutes les sévérités</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((item) => <option key={item}>{item}</option>)}</select></div>
    <GlassCard className="content-panel"><DataTable data={filtered} columns={columns} initialPageSize={8} onRowClick={(finding) => choose(finding.id)} searchPlaceholder="Finding, raison, asset, classification..." /></GlassCard>
    <FindingDetail finding={selected} onClose={closeFinding} onEvaluate={() => setEvaluateOpen(true)} />
    <EvaluateDialog open={evaluateOpen} onClose={() => setEvaluateOpen(false)} />
  </>;
}

function FindingDetail({ finding, onClose, onEvaluate }: { finding?: Finding; onClose: () => void; onEvaluate: () => void }) {
  const supportingFacts = finding ? finding.observation_ids.map((id) => observations.find((observation) => observation.id === id)).filter((item) => !!item) : [];
  return <GlassSheet open={!!finding} onClose={onClose} title="Détail du Finding" description={finding ? `${finding.reason_code} · ${finding.policy_pack} v${finding.policy_version}` : undefined}>
    {finding && <div className="form-stack"><div className="button-group"><StatusBadge status={finding.severity} /><StatusBadge status={finding.classification} /></div><h3 style={{ margin: "-5px 0 0", fontSize: 17, fontWeight: 600, letterSpacing: "-.03em" }}>{finding.title}</h3><div className="detail-kv"><div className="detail-kv-item"><span>Faiblesse classique</span><StatusBadge status={finding.classical_weakness} /></div><div className="detail-kv-item"><span>Risque quantique</span><StatusBadge status={finding.quantum_risk} /></div><div className="detail-kv-item"><span>Cible</span><Link className="table-primary" to={`/assets/${finding.asset_id}`}>{finding.target} ↗</Link></div><div className="detail-kv-item"><span>Évalué (UTC)</span><code>{finding.evaluated_at}</code></div></div><div><span className="dim-label">Explication de règle · reason_code</span><div className="rule-explanation"><code>{finding.reason_code}</code><br />{finding.explanation}</div></div><div><span className="dim-label">Faits justificatifs · {supportingFacts.length}</span><div className="detail-list">{supportingFacts.map((fact) => { const proof = evidence.find((item) => item.id === fact.evidence_id); const usageIds = finding.crypto_usage_ids.filter((id) => cryptoUsages.find((usage) => usage.id === id)?.observation_id === fact.id); return <div className="detail-list-row" key={fact.id} style={{ alignItems: "flex-start" }}><div><strong>{fact.fact}</strong><small><code>{fact.id}</code> · {fact.observed_at}</small><div className="button-group" style={{ marginTop: 7 }}>{fact.observation_mode ? <ObservationModeBadge mode={fact.observation_mode} /> : <StatusBadge status={fact.state} />}{usageIds.map((id) => <Link className="text-button" key={id} to={`/crypto?selected=${id}`}>CryptoUsage ↗</Link>)}</div></div><Link className="table-primary" to={`/evidence?selected=${fact.evidence_id}`}><span className="table-secondary">SHA-256</span><code>{proof?.hash_sha256.slice(0, 13)}… ↗</code></Link></div>; })}</div></div><div className="provenance-box"><span>Chaîne de provenance cliquable</span>{finding.evidence_ids.map((evidenceId, index) => { const observation = supportingFacts[index]; const proof = evidence.find((item) => item.id === evidenceId); return <div key={evidenceId} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0 9px" }}><ProvenanceChain assetId={finding.asset_id} observationId={observation?.id} evidenceId={evidenceId} /><CopyChip compact value={proof?.hash_sha256 ?? ""} label="SHA-256" /></div>; })}</div><div className="detail-kv"><div className="detail-kv-item"><span>Policy Pack</span><strong>{finding.policy_pack}</strong></div><div className="detail-kv-item"><span>Version</span><StatusBadge status={`v${finding.policy_version}`} /></div></div><PermissionButton permission="policy:evaluate" onClick={onEvaluate}><Sparkles size={14} /> Réévaluer ce pack</PermissionButton></div>}
  </GlassSheet>;
}

function EvaluateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addAudit = useAppStore((state) => state.addAudit);
  const [version, setVersion] = useState("0.1");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const evaluate = async () => {
    setRunning(true); setProgress(6); setResult("");
    const timer = window.setInterval(() => setProgress((current) => Math.min(92, current + 19)), 180);
    try {
      const outcome = await api.evaluatePolicy();
      window.clearInterval(timer); setProgress(100); setResult(`${outcome.updated} Findings modifiés par l'évaluation simulée.`);
      addAudit({ action: "POLICY_EVALUATED", reason_code: `POLICY_PACK_VERSION_${version}`, resource: `policy/Northstar-PQC-Baseline/${version}` });
    } catch { window.clearInterval(timer); setResult("Échec de l'évaluation simulée."); }
    finally { setRunning(false); }
  };
  const handleClose = () => { if (running) return; setProgress(0); setResult(""); onClose(); };
  return <GlassModal open={open} onClose={handleClose} title="Réévaluer les Findings" description="L'évaluation applique un Policy Pack aux faits déjà disponibles.">
    <div className="form-stack"><div className="inline-alert inline-alert-info"><AlertTriangle size={14} /><span><strong>Aucun scan réseau n'a été lancé.</strong> Une réévaluation consomme les faits existants ; elle n'interroge aucun endpoint.</span></div><div className="form-field"><label htmlFor="policy-version">Version du Policy Pack</label><select id="policy-version" value={version} onChange={(event) => setVersion(event.target.value)} disabled={running}>{policyPacks.map((pack) => <option key={pack.id} value={pack.version}>{pack.name} · v{pack.version} · {pack.status}</option>)}</select></div>{(running || result) && <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}><span className="field-hint">{result || "Évaluation des règles et correspondance des faits..."}</span><code>{progress}%</code></div><div className="progress-line"><span style={{ width: `${progress}%` }} /></div></div>}{result && <div className="inline-alert"><Check size={14} /><span>{result} Aucun scan réseau n'a été lancé.</span></div>}<div className="modal-actions"><GlassButton variant="secondary" onClick={handleClose} disabled={running}>{result ? "Fermer" : "Annuler"}</GlassButton><GlassButton onClick={evaluate} disabled={running}>{running ? "Évaluation..." : <><Sparkles size={14} /> Évaluer maintenant</>}</GlassButton></div></div>
  </GlassModal>;
}