import { Activity, AlertTriangle, Boxes, Database, HardDrive, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard, LifecycleBadge, StatusBadge } from "../../components/glass";
import { assets, findings, services, volumes } from "../../mocks/data";
import { useAppStore } from "../../lib/store";

export function DashboardPage() {
  const scans = useAppStore((state) => state.scans);
  const collectors = useAppStore((state) => state.collectors);
  const evidence = useAppStore((state) => state.evidence);
  const processingCount = evidence.filter((item) => ["RECEIVED", "VALIDATED", "PROCESSING", "PROCESSING_FAILED", "FAILED"].includes(item.processing_status)).length;
  const metrics = [
    { title: "Assets", value: assets.length, note: "8 identités suivies", icon: Boxes, href: "/assets" },
    { title: "Services", value: services.length, note: "TLS · SSH · PostgreSQL", icon: Activity, href: "/assets?tab=services" },
    { title: "Storage volumes", value: volumes.length, note: "2 technologies · 1 inconnu", icon: HardDrive, href: "/assets?tab=volumes" },
    { title: "Evidence à traiter", value: processingCount, note: "réception ≠ normalisation", icon: Database, href: "/evidence?status=PROCESSING" },
    { title: "Findings", value: findings.length, note: "1 critique · 2 élevés", icon: ShieldAlert, href: "/findings" },
  ];
  const posture = [
    { key: "QUANTUM_VULNERABLE", label: "Quantum vulnerable", color: "#a78bfa" },
    { key: "LEGACY", label: "Legacy", color: "#fb923c" },
    { key: "WEAK", label: "Weak", color: "#fb7185" },
    { key: "MIGRATION_REQUIRED", label: "Migration required", color: "#fbbf24" },
    { key: "PQC_READY", label: "PQC ready", color: "#34d399" },
    { key: "UNKNOWN", label: "Unknown / Partial", color: "#82879a", unknown: true },
  ].map((item) => ({ ...item, value: findings.filter((finding) => finding.classification === item.key).length }));
  const totalPosture = posture.reduce((sum, item) => sum + item.value, 0);
  let chartCursor = 0;
  const postureGradient = `conic-gradient(${posture.map((item) => { const from = chartCursor; chartCursor += totalPosture ? item.value / totalPosture * 100 : 0; return `${item.color} ${from}% ${chartCursor}%`; }).join(", ")})`;
  return <>
    <div className="page-heading dashboard-heading"><div><div className="eyebrow">POST-QUANTUM READINESS · APERÇU</div><span className="env-indicator"><i /> On-premise</span></div><div><h1>Bonjour, Alex</h1><p>Vue consolidée de la découverte cryptographique Northstar. Les faits observés et les interprétations de politique restent distincts.</p></div></div>
    <div className="metric-grid">{metrics.map((metric) => { const Icon = metric.icon; return <Link to={metric.href} key={metric.title} className="glass-card glass-card-hover metric-card"><div className="metric-top"><span>{metric.title}</span><span className="metric-icon"><Icon size={14} /></span></div><div className="metric-value">{metric.value}<small>{metric.title === "Assets" ? "inventoriés" : metric.title === "Services" ? "identifiés" : ""}</small></div><div className="metric-caption">{metric.note}</div></Link>; })}</div>
    <div className="dashboard-grid">
      <GlassCard className="dash-panel" hover><div className="section-title-row"><div><h2>Posture cryptographique</h2><p>Classification issue du Policy Pack actif · inconnus visibles</p></div><Link to="/findings" className="section-action">Voir les findings ↗</Link></div>
        <div className="posture-layout"><div className="donut-chart" style={{ background: postureGradient }} aria-label={`Répartition de ${totalPosture} Findings, Unknown et Partial distincts`}><div className="donut-center"><strong>{totalPosture}</strong><span>findings évalués</span></div></div><div className="posture-legend">{posture.map((item) => <div className="legend-item" key={item.label}><i className={item.unknown ? "legend-unknown" : ""} style={item.unknown ? undefined : { background: item.color }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>
      </GlassCard>
      <GlassCard className="dash-panel" hover><div className="section-title-row"><div><h2>Santé des Collectors</h2><p>Cycle de vie et santé du dernier heartbeat séparés</p></div><Link to="/collectors" className="section-action">Tous les Collectors ↗</Link></div>
        <div className="collector-overview">{collectors.map((collector) => <div className="collector-overview-row" key={collector.id}><div className="collector-name-cell"><span className={`collector-health-dot ${collector.health === "ONLINE" ? "health-online" : collector.health === "DEGRADED" ? "health-degraded" : collector.health === "OFFLINE" ? "health-offline" : "health-missed"}`} /><Link to={`/collectors?selected=${collector.id}`}>{collector.name}</Link><StatusBadge status={collector.health} /></div><div className="spool-cell">{collector.spool_percent}%<div className={`spool-bar ${collector.spool_percent >= 85 ? "spool-bar-warning" : ""}`}><span style={{ width: `${collector.spool_percent}%` }} /></div></div><div className="collector-life"><LifecycleBadge value={collector.lifecycle} /></div></div>)}</div>
        <div className="spool-alert"><AlertTriangle size={13} /><span><strong>collector-dmz · spool à 88 %</strong> — back-pressure actif, nouveaux jobs en attente.</span></div>
      </GlassCard>
    </div>
    <GlassCard className="recent-scans-panel"><div className="section-title-row"><div><h2>Scans récents</h2><p>Dernières missions · résultats partiels conservés</p></div><Link to="/scans" className="section-action">Ouvrir les scans ↗</Link></div>
      {scans.slice(0, 4).map((scan) => { const collector = collectors.find((item) => item.id === scan.collector_id); return <div className="scan-row" key={scan.id}><Link to={`/scans/${scan.id}`}>{scan.target_cidr}</Link><StatusBadge status={scan.status} /><span>{collector?.name}</span><div className="scan-row-progress"><div className="progress-line"><span style={{ width: `${scan.progress}%` }} /></div><code>{scan.progress}%</code></div><span className="scan-row-time">{scan.created_at.slice(11, 16)} UTC</span><Link className="scan-row-cta" to={`/scans/${scan.id}`} aria-label={`Détails du scan ${scan.target_cidr}`}>Détails ↗</Link></div>; })}
    </GlassCard>
    <div className="page-banner" style={{ marginTop: 13, marginBottom: 0 }}><ShieldCheck size={15} /><span><strong>Interprétation gouvernée par politique.</strong> La présence d'une preuve ne produit pas seule une classification PQC. Les observations inconnues ou incomplètes ne sont jamais interprétées comme sûres.</span><Link to="/policies" className="section-action" style={{ marginLeft: "auto" }}>Policy Packs ↗</Link></div>
  </>;
}