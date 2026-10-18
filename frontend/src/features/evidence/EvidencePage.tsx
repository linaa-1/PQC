import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, FileUp, LockKeyhole, UploadCloud } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyChip, DataTable, GlassButton, GlassCard, GlassModal, GlassSheet, PageHeader, PermissionButton, StatusBadge } from "../../components/glass";
import { useCan } from "../../lib/permissions";
import { useAppStore } from "../../lib/store";
import { assets, observations } from "../../mocks/data";
import type { Evidence } from "../../types/domain";

const uploadSchema = z.object({ asset_id: z.string().min(1, "Sélectionnez l'Asset concerné."), source: z.enum(["Offline inventory", "PKI catalog", "Manual evidence", "Scanner export"]) });
type UploadForm = z.infer<typeof uploadSchema>;

export function EvidencePage() {
  const storeEvidence = useAppStore((state) => state.evidence);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const selectedId = searchParams.get("selected");
  const selected = storeEvidence.find((item) => item.id === selectedId);
  const filtered = useMemo(() => storeEvidence.filter((item) => (sourceFilter === "all" || item.source_kind === sourceFilter) && (statusFilter === "all" || item.processing_status === statusFilter)), [storeEvidence, sourceFilter, statusFilter]);
  const columns = useMemo<ColumnDef<Evidence, any>[]>(() => [
    { accessorKey: "source_kind", header: "Provenance", cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: "tool", header: "Outil source", accessorFn: (row) => `${row.tool} ${row.tool_version}`, cell: ({ row }) => <><strong>{row.original.tool}</strong><span className="table-secondary">v{row.original.tool_version}</span></> },
    { accessorKey: "hash_sha256", header: "Hash SHA-256", cell: ({ getValue }) => <CopyChip compact value={getValue<string>()} /> },
    { accessorKey: "collected_at", header: "Collectée (UTC)", cell: ({ getValue }) => <span className="table-mono">{getValue<string>().slice(0, 16).replace("T", " ")}</span> },
    { accessorKey: "processing_status", header: "Traitement", cell: ({ row }) => <span title={["FAILED", "PROCESSING_FAILED"].includes(row.original.processing_status) ? "Reçue mais non normalisée" : undefined}><StatusBadge status={row.original.processing_status} />{["FAILED", "PROCESSING_FAILED"].includes(row.original.processing_status) && <span className="table-secondary">Reçue mais non normalisée</span>}</span> },
    { id: "asset", header: "Asset", accessorFn: (row) => assets.find((asset) => asset.id === row.asset_id)?.canonical_name ?? "—", cell: ({ row, getValue }) => <Link className="table-primary" to={`/assets/${row.original.asset_id}`}>{getValue<string>()}</Link> },
    { accessorKey: "id", header: "Evidence ID", cell: ({ getValue }) => <CopyChip compact value={getValue<string>()} /> },
  ], []);
  const choose = (item: Evidence) => { const next = new URLSearchParams(searchParams); next.set("selected", item.id); setSearchParams(next); };
  const closeDetail = () => { const next = new URLSearchParams(searchParams); next.delete("selected"); setSearchParams(next, { replace: true }); };
  return <>
    <PageHeader eyebrow="EVIDENCE / PROVENANCE" title="Evidence" description="Preuves brutes immuables avec empreinte SHA-256. La réception, la validation et la normalisation sont des états indépendants." actions={<PermissionButton permission="evidence:upload" onClick={() => setUploadOpen(true)}><FileUp size={15} /> Importer une Evidence</PermissionButton>} />
    <div className="page-banner"><AlertTriangle size={14} /><span><strong>Échec de traitement ≠ absence de réception.</strong> Une Evidence FAILED ou PROCESSING_FAILED reste stockée avec son hash ; elle est affichée comme « reçue mais non normalisée ».</span></div>
    <div className="filter-row"><span className="filter-label">Filtrer</span><select className="filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filtrer par provenance"><option value="all">Toutes les provenances</option><option value="COLLECTOR">Collector</option><option value="MANUAL_UPLOAD">Import manuel</option></select><select className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrer par état de traitement"><option value="all">Tous les états</option>{["RECEIVED", "VALIDATED", "PROCESSING", "PROCESSED", "UNSUPPORTED", "REJECTED", "FAILED", "PROCESSING_FAILED"].map((status) => <option key={status}>{status}</option>)}</select></div>
    <GlassCard className="content-panel"><DataTable data={filtered} columns={columns} initialPageSize={8} onRowClick={choose} searchPlaceholder="Hash, outil, version, Asset, uploaded_by..." /></GlassCard>
    <EvidenceDetail item={selected} onClose={closeDetail} />
    <UploadEvidence open={uploadOpen} onClose={() => setUploadOpen(false)} />
  </>;
}

function EvidenceDetail({ item, onClose }: { item?: Evidence; onClose: () => void }) {
  const canRaw = useCan("evidence:raw:read");
  const relatedObservations = item ? observations.filter((observation) => observation.evidence_id === item.id) : [];
  return <GlassSheet open={!!item} onClose={onClose} title="Evidence brute" description={item ? `${item.tool} v${item.tool_version} · ${item.source_kind}` : undefined}>
    {item && <div className="form-stack"><div><span className="dim-label">Hash SHA-256 · contenu immuable</span><CopyChip value={item.hash_sha256} /></div><div className="detail-kv"><div className="detail-kv-item"><span>Evidence UUID</span><CopyChip compact value={item.id} /></div><div className="detail-kv-item"><span>Traitement</span><StatusBadge status={item.processing_status} /></div><div className="detail-kv-item"><span>Collectée (UTC)</span><code>{item.collected_at}</code></div><div className="detail-kv-item"><span>Réception / upload</span><code>{item.uploaded_at ?? item.collected_at}</code></div><div className="detail-kv-item"><span>Asset</span><Link className="table-primary" to={`/assets/${item.asset_id}`}>{assets.find((asset) => asset.id === item.asset_id)?.canonical_name ?? item.asset_id} ↗</Link></div><div className="detail-kv-item"><span>Uploaded by</span><strong>{item.uploaded_by ?? item.collector_id ?? "Collector"}</strong></div></div>{["FAILED", "PROCESSING_FAILED"].includes(item.processing_status) && <div className="inline-alert inline-alert-danger"><AlertTriangle size={14} /><span>Evidence reçue mais non normalisée. L'original est conservé ; aucun Finding n'est créé automatiquement.</span></div>}
      <div><span className="dim-label">Visualiseur RAW JSON · evidence:raw:read</span>{canRaw ? <JsonCode data={item.payload} /> : <div className="raw-locked"><LockKeyhole size={20} /><strong>Contenu RAW verrouillé</strong><p>Permission requise : <code>evidence:raw:read</code>. Les métadonnées et le hash restent visibles, le payload brut n'est pas exposé à ce rôle.</p></div>}</div>
      <div className="provenance-box"><span>Observations et Findings dérivés</span>{relatedObservations.length ? relatedObservations.map((observation) => <div key={observation.id} className="detail-list-row"><div><strong>{observation.fact}</strong><small><code>{observation.id}</code> · {observation.state}</small></div><Link className="table-primary" to={`/crypto?observation=${observation.id}`}>Observation ↗</Link></div>) : <small className="field-hint">Aucune Observation normalisée. Un upload seul ne crée jamais de Finding.</small>}</div>
    </div>}
  </GlassSheet>;
}

function JsonCode({ data }: { data: Record<string, unknown> }) {
  const text = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const tokens = useMemo(() => {
    const matcher = /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[{}\[\],:])/g;
    const parts: { text: string; type: string }[] = [];
    let lastIndex = 0; let match: RegExpExecArray | null;
    while ((match = matcher.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), type: "plain" });
      const token = match[0];
      const type = token.startsWith("\"") ? text.slice(match.index + token.length).match(/^\s*:/) ? "key" : "string" : /^(true|false|null)$/.test(token) ? "bool" : /^-?\d/.test(token) ? "number" : "punctuation";
      parts.push({ text: token, type }); lastIndex = matcher.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), type: "plain" });
    return parts;
  }, [text]);
  return <pre className="json-viewer" aria-label="JSON brut coloré"><code>{tokens.map((token, index) => <span className={`json-${token.type}`} key={`${index}-${token.text.slice(0, 5)}`}>{token.text}</span>)}</code></pre>;
}

function UploadEvidence({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addEvidence = useAppStore((state) => state.addEvidence);
  const addAudit = useAppStore((state) => state.addAudit);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UploadForm>({ resolver: zodResolver(uploadSchema), defaultValues: { asset_id: assets[0].id, source: "Offline inventory" } });
  const close = () => { setFile(null); setRawText(""); setError(""); setSuccess(""); reset({ asset_id: assets[0].id, source: "Offline inventory" }); onClose(); };
  const acceptFile = async (candidate?: File) => {
    if (!candidate) return;
    setError(""); setSuccess("");
    if (!candidate.name.toLowerCase().endsWith(".json")) {
      setFile(null); setError("Format refusé : seuls les fichiers JSON sont acceptés par cet import simulé.");
      addAudit({ action: "EVIDENCE_UPLOAD_REJECTED", reason_code: "UNSUPPORTED_FILE_FORMAT", category: "AUDIT", result: "DENIED", resource: candidate.name });
      return;
    }
    const content = await candidate.text();
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Le JSON racine doit être un objet.");
      setFile(candidate); setRawText(content);
    } catch (parseError) {
      setFile(null); setError(`Import invalide : ${parseError instanceof Error ? parseError.message : "JSON illisible"}`);
      addAudit({ action: "EVIDENCE_UPLOAD_REJECTED", reason_code: "INVALID_JSON_PAYLOAD", category: "AUDIT", result: "DENIED", resource: candidate.name });
    }
  };
  const submit = handleSubmit(async (values) => {
    if (!file || !rawText) { setError("Déposez un fichier JSON valide avant l'import."); return; }
    setSubmitting(true); setError("");
    try {
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      const hash = await digest(rawText);
      const now = new Date().toISOString();
      const newItem: Evidence = { id: crypto.randomUUID(), asset_id: values.asset_id, source_kind: "MANUAL_UPLOAD", tool: `${values.source} · ${file.name}`, tool_version: "1.0", hash_sha256: hash, collected_at: now, uploaded_at: now, processing_status: "RECEIVED", uploaded_by: "a.martin", payload: parsed };
      addEvidence(newItem);
      addAudit({ action: "EVIDENCE_RECEIVED", reason_code: "MANUAL_UPLOAD_ACCEPTED", resource: `evidence/${newItem.id}` });
      setSuccess("Evidence reçue. La normalisation sera un traitement indépendant ; aucun Finding n'a été créé.");
      window.setTimeout(close, 1100);
    } catch { setError("Impossible de calculer l'empreinte ou lire le fichier."); }
    finally { setSubmitting(false); }
  });
  return <GlassModal open={open} onClose={close} title="Importer une Evidence" description="Le fichier est ajouté comme preuve brute. L'import ne crée jamais directement de Finding.">
    <form className="form-stack" onSubmit={submit}><label className="drop-zone" htmlFor="evidence-upload"><UploadCloud size={22} /><strong>{file ? file.name : "Déposer un export JSON ici"}</strong><small>{file ? `${(file.size / 1024).toFixed(1)} KB · format validé` : "JSON objet uniquement · le contenu reste immuable"}</small><input ref={inputRef} id="evidence-upload" className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => acceptFile(event.target.files?.[0])} /></label>
      {error && <div className="inline-alert inline-alert-danger"><AlertTriangle size={14} /><span>{error}</span></div>}{success && <div className="inline-alert"><Check size={14} /><span>{success}</span></div>}
      <div className="form-field"><label htmlFor="upload-source">Type de source</label><select id="upload-source" {...register("source")}><option value="Offline inventory">Inventaire offline</option><option value="PKI catalog">Catalogue PKI</option><option value="Manual evidence">Evidence manuelle</option><option value="Scanner export">Export scanner</option></select></div>
      <div className="form-field"><label htmlFor="upload-asset">Asset associé</label><select id="upload-asset" {...register("asset_id")}>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.canonical_name} · {asset.ips[0]}</option>)}</select>{errors.asset_id && <small className="field-error">{errors.asset_id.message}</small>}</div>
      <div className="modal-actions"><GlassButton variant="secondary" onClick={close}>Fermer</GlassButton><GlassButton type="submit" disabled={submitting || !file}><FileUp size={14} />{submitting ? "Validation..." : "Recevoir l'Evidence"}</GlassButton></div>
    </form>
  </GlassModal>;
}

async function digest(text: string) {
  try {
    const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(data)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}