import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassCard, GlassModal, ObservationModeBadge, PageHeader, StatusBadge } from "../../components/glass";
import { cryptoObjects, cryptoUsages, evidence, observations, services } from "../../mocks/data";
import type { CryptoObject, CryptoUsage, ObservationMode } from "../../types/domain";

type View = "objects" | "usages";

export function CryptoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>("usages");
  const [mode, setMode] = useState("all");
  const [role, setRole] = useState("all");
  const [protocol, setProtocol] = useState("all");
  const [algorithm, setAlgorithm] = useState("all");
  const selectedId = searchParams.get("selected");
  const selectedObject = cryptoObjects.find((item) => item.id === selectedId);
  const selectedUsage = cryptoUsages.find((item) => item.id === selectedId);
  const filteredUsages = useMemo(() => cryptoUsages.filter((usage) => (mode === "all" || usage.observation_mode === mode) && (role === "all" || usage.role === role) && (protocol === "all" || usage.protocol.includes(protocol)) && (algorithm === "all" || usage.algorithm === algorithm)), [mode, role, protocol, algorithm]);
  const filteredObjects = useMemo(() => cryptoObjects.filter((object) => (mode === "all" || object.observation_mode === mode) && (algorithm === "all" || object.algorithm === algorithm)), [mode, algorithm]);
  const objectColumns = useMemo<ColumnDef<CryptoObject, any>[]>(() => [
    { accessorKey: "subject", header: "CryptoObject", cell: ({ row }) => <span><strong className="table-primary">{row.original.subject}</strong><span className="table-secondary">{row.original.object_type} · {row.original.issuer}</span></span> },
    { accessorKey: "algorithm", header: "Algorithme / taille", cell: ({ row }) => <><span>{row.original.algorithm}</span><span className="table-secondary">{row.original.key_size}</span></> },
    { accessorKey: "signature_algorithm", header: "Signature", cell: ({ getValue }) => <span className="table-mono">{getValue<string>() ?? "—"}</span> },
    { accessorKey: "observation_mode", header: "Mode", cell: ({ getValue }) => <ObservationModeBadge mode={getValue<ObservationMode>()} /> },
    { accessorKey: "valid_to", header: "Expiration (UTC)", cell: ({ getValue }) => <span className="table-mono">{getValue<string>()?.slice(0, 10) ?? "—"}</span> },
    { accessorKey: "fingerprint_sha256", header: "SHA-256", cell: ({ getValue }) => <CopyChip compact value={getValue<string>()} /> },
    { id: "source", header: "Provenance", accessorFn: (row) => evidence.find((item) => item.id === row.evidence_id)?.tool ?? "—", cell: ({ row, getValue }) => <Link to={`/evidence?selected=${row.original.evidence_id}`} className="table-primary">{getValue<string>()} ↗</Link> },
  ], []);
  const usageColumns = useMemo<ColumnDef<CryptoUsage, any>[]>(() => [
    { accessorKey: "algorithm", header: "Algorithme", cell: ({ row }) => <><strong className="table-primary">{row.original.algorithm}</strong><span className="table-secondary">{row.original.size_curve}</span></> },
    { accessorKey: "role", header: "Rôle", cell: ({ getValue }) => <span>{String(getValue()).replace("/", " / ").replace(/_/g, " ")}</span> },
    { accessorKey: "protocol", header: "Protocole", cell: ({ getValue }) => <span>{getValue<string>()}</span> },
    { accessorKey: "target", header: "Cible", cell: ({ row }) => <Link to={`/assets/${row.original.asset_id}?tab=services`} className="table-primary table-ellipsize">{row.original.target}</Link> },
    { accessorKey: "observation_mode", header: "Observation", cell: ({ getValue }) => <ObservationModeBadge mode={getValue<ObservationMode>()} /> },
    { id: "classical", header: "Faiblesse classique", accessorFn: (row) => row.classical_weakness, cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "quantum", header: "Risque quantique", accessorFn: (row) => row.quantum_risk, cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "source", header: "Preuve", accessorFn: (row) => evidence.find((item) => item.id === row.evidence_id)?.tool ?? "—", cell: ({ row, getValue }) => <Link to={`/evidence?selected=${row.original.evidence_id}`} className="table-primary">{getValue<string>()} ↗</Link> },
  ], []);
  const closeModal = () => { const next = new URLSearchParams(searchParams); next.delete("selected"); setSearchParams(next, { replace: true }); };
  return <>
    <PageHeader eyebrow="INVENTAIRE / FAITS CRYPTOGRAPHIQUES" title="Crypto Inventory" description="Capacités observées, valeurs négociées et déclarations sont distinctes. Faiblesse classique et risque quantique sont deux dimensions séparées." />
    <div className="tabs-bar" role="tablist"><button role="tab" aria-selected={view === "usages"} onClick={() => setView("usages")} className={`tab-button ${view === "usages" ? "tab-button-active" : ""}`}>CryptoUsages <span className="tab-count">{cryptoUsages.length}</span></button><button role="tab" aria-selected={view === "objects"} onClick={() => setView("objects")} className={`tab-button ${view === "objects" ? "tab-button-active" : ""}`}>CryptoObjects <span className="tab-count">{cryptoObjects.length}</span></button></div>
    <div className="filter-row"><span className="filter-label">Filtrer</span><select className="filter-select" value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Filtrer par mode d'observation"><option value="all">Tous les modes</option><option value="NEGOTIATED">Négocié uniquement</option><option value="SUPPORTED">Supporté uniquement</option><option value="DECLARED">Déclaré uniquement</option></select>{view === "usages" && <select className="filter-select" value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filtrer par rôle"><option value="all">Tous les rôles</option><option value="KEY_ESTABLISHMENT">KEY_ESTABLISHMENT</option><option value="DATA_ENCRYPTION">DATA_ENCRYPTION</option><option value="SIGNATURE/AUTH">SIGNATURE / AUTH</option></select>}<select className="filter-select" value={protocol} onChange={(event) => setProtocol(event.target.value)} aria-label="Filtrer par protocole"><option value="all">Tous les protocoles</option>{Array.from(new Set(cryptoUsages.map((item) => item.protocol))).map((item) => <option key={item}>{item}</option>)}</select><select className="filter-select" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} aria-label="Filtrer par algorithme"><option value="all">Tous les algorithmes</option>{Array.from(new Set([...cryptoUsages.map((item) => item.algorithm), ...cryptoObjects.map((item) => item.algorithm)])).map((item) => <option key={item}>{item}</option>)}</select></div>
    <GlassCard className="content-panel">{view === "usages" ? <DataTable data={filteredUsages} columns={usageColumns} initialPageSize={8} onRowClick={(usage) => { const next = new URLSearchParams(searchParams); next.set("selected", usage.id); setSearchParams(next); }} searchPlaceholder="Algorithme, rôle, protocole, cible, Evidence..." /> : <DataTable data={filteredObjects} columns={objectColumns} initialPageSize={8} onRowClick={(object) => { const next = new URLSearchParams(searchParams); next.set("selected", object.id); setSearchParams(next); }} searchPlaceholder="Sujet, issuer, algorithme, empreinte..." />}</GlassCard>
    <GlassModal open={!!(selectedObject || selectedUsage)} onClose={closeModal} title={selectedObject ? "Détail CryptoObject" : "Détail CryptoUsage"} description="Objet et usage proviennent d'une observation liée à une Evidence immuable." size="lg">
      {selectedObject && <ObjectDetails item={selectedObject} />}{selectedUsage && <UsageDetails item={selectedUsage} />}
    </GlassModal>
  </>;
}

function ObjectDetails({ item }: { item: CryptoObject }) {
  const source = evidence.find((candidate) => candidate.id === item.evidence_id);
  return <div className="form-stack"><div className="detail-kv"><Detail label="Sujet" value={item.subject} /><Detail label="Émetteur" value={item.issuer} /><Detail label="Type" value={item.object_type} /><Detail label="Clé" value={`${item.algorithm} · ${item.key_size ?? "taille non déclarée"}`} /><Detail label="Signature" value={item.signature_algorithm ?? "Non précisée"} /><Detail label="Valide du" value={item.valid_from ?? "—"} /><Detail label="Valide jusqu'au" value={item.valid_to ?? "—"} /><div className="detail-kv-item"><span>Observation</span><ObservationModeBadge mode={item.observation_mode} /></div></div><div><span className="dim-label">Fingerprint SHA-256</span><CopyChip value={item.fingerprint_sha256} /></div><div className="rule-explanation"><strong>Extensions observées</strong><br />keyUsage: digitalSignature, keyEncipherment<br />extendedKeyUsage: serverAuth<br />subjectAltName: DNS:*.northstar.internal</div><div className="provenance-box"><span>Provenance</span><Link className="table-primary" to={`/evidence?selected=${item.evidence_id}`}>{source?.tool} · {source?.processing_status} ↗</Link><p className="field-hint">Le détail brut reste consultable dans Evidence selon la permission evidence:raw:read.</p></div></div>;
}

function UsageDetails({ item }: { item: CryptoUsage }) {
  const observation = observations.find((candidate) => candidate.id === item.observation_id);
  const source = evidence.find((candidate) => candidate.id === item.evidence_id);
  const service = services.find((candidate) => candidate.id === item.service_id);
  return <div className="form-stack"><div className="detail-kv"><Detail label="Algorithme" value={item.algorithm} /><Detail label="Taille / courbe" value={item.size_curve} /><Detail label="Rôle" value={item.role} /><Detail label="Protocole" value={item.protocol} /><Detail label="Cible" value={item.target} /><Detail label="Service" value={service ? `${service.transport}/${service.port} · ${service.protocol}` : "Storage / déclaration"} /><Detail label="Première vue" value={item.first_seen} /><Detail label="Dernière vue" value={item.last_seen} /></div><div className="button-group"><span><small className="dim-label">Faiblesse classique</small><StatusBadge status={item.classical_weakness} /></span><span><small className="dim-label">Risque quantique</small><StatusBadge status={item.quantum_risk} /></span><span><small className="dim-label">Observation</small><ObservationModeBadge mode={item.observation_mode} /></span></div><div className="rule-explanation"><strong>Fait observé</strong><br />{observation?.fact ?? "Fait lié à une preuve importée."}<p className="field-hint">Cette vue ne calcule pas de classification. Les dimensions affichées sont les résultats du Policy Pack mocké.</p></div><div className="provenance-box"><span>Chaîne de provenance</span><div className="provenance-chain"><Link to={`/assets/${item.asset_id}`}>Asset</Link><span className="chain-arrow">›</span><Link to={`/evidence?selected=${item.evidence_id}`}>Evidence <code>{source?.hash_sha256.slice(0, 12)}…</code></Link></div></div></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-kv-item"><span>{label}</span><strong>{value}</strong></div>; }