import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Copy, FileWarning, Info, LockKeyhole, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../../lib/store";
import { useCan } from "../../lib/permissions";
import type { ObservationMode, Permission, Severity } from "../../types/domain";

export function GlassCard({ children, className = "", hover = false, style, ...props }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void; style?: CSSProperties }) {
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  return <section
    className={`glass-card ${hover ? "glass-card-hover" : ""} ${className}`}
    style={{ "--spot-x": `${spot.x}%`, "--spot-y": `${spot.y}%`, ...style } as CSSProperties}
    onMouseMove={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setSpot({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
    }}
    {...props}
  >{children}</section>;
}

export function GlassButton({ children, onClick, variant = "primary", className = "", disabled = false, title, type = "button" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; disabled?: boolean; title?: string; type?: "button" | "submit";
}) {
  return <button type={type} disabled={disabled} title={title} onClick={onClick} className={`glass-button glass-button-${variant} ${className}`}>{children}</button>;
}

export function PermissionButton({ permission, children, disabled = false, title, ...props }: { permission: Permission; children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; disabled?: boolean; title?: string }) {
  const allowed = useCan(permission);
  return <GlassButton {...props} disabled={!allowed || disabled} title={allowed ? title : `Permission requise : ${permission}`}>{children}</GlassButton>;
}

const incompleteStatuses = new Set(["UNKNOWN", "PARTIAL", "TIMEOUT", "PROCESSING_FAILED", "FAILED", "UNREACHABLE", "ERROR", "REJECTED", "FILTERED"]);
const statusIcons: Record<string, ReactNode> = {
  ONLINE: <Check size={12} />, ACTIVE: <Check size={12} />, COMPLETED: <Check size={12} />, PROCESSED: <Check size={12} />, VALID: <Check size={12} />, SUCCESS: <Check size={12} />, PQC_READY: <Check size={12} />,
  DEGRADED: <AlertTriangle size={12} />, EXPIRING: <Clock3 size={12} />, HIGH: <AlertTriangle size={12} />, CRITICAL: <AlertTriangle size={12} />, MEDIUM: <AlertTriangle size={12} />, LOW: <Info size={12} />,
  OFFLINE: <X size={12} />, FAILED: <X size={12} />, DENIED: <LockKeyhole size={12} />, TIMEOUT: <Clock3 size={12} />, UNKNOWN: <CircleHelp size={12} />, PARTIAL: <FileWarning size={12} />,
};

const statusCopy: Record<string, string> = {
  QUANTUM_VULNERABLE: "Risque quantique", MIGRATION_REQUIRED: "Migration requise", PQC_READY: "PQC ready", NO_KNOWN_WEAKNESS: "Aucune faiblesse connue", VULNERABLE: "Vulnérable au quantique", UNKNOWN: "Inconnu", HEARTBEAT_MISSED: "Heartbeat manqué", CANCEL_REQUESTED: "Annulation demandée", PROCESSING_FAILED: "Échec de traitement", MANUAL_UPLOAD: "Import manuel", COLLECTOR: "Collector",
};

function displayStatus(status: string) {
  return statusCopy[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const state = status.toUpperCase();
  let tone = "neutral";
  if (["UNKNOWN", "PARTIAL", "TIMEOUT", "PROCESSING_FAILED"].includes(state)) tone = "incomplete";
  else if (["QUANTUM_VULNERABLE", "VULNERABLE"].includes(state)) tone = "quantum";
  else if (state === "LEGACY") tone = "legacy";
  else if (["ONLINE", "COMPLETED", "PROCESSED", "SUCCESS", "VALID", "ACTIVE", "PQC_READY", "ENCRYPTED", "CONNECTED"].includes(state)) tone = "success";
  else if (["DEGRADED", "EXPIRING", "HIGH", "MEDIUM", "MIGRATION_REQUIRED", "CANCEL_REQUESTED", "RUNNING", "PROCESSING"].includes(state)) tone = "warning";
  else if (["OFFLINE", "FAILED", "CRITICAL", "DENIED", "REJECTED", "EXPIRED", "INVALID_SIGNATURE", "WRONG_INSTALLATION", "CLOCK_ANOMALY", "REVOKED", "WEAK", "ERROR"].includes(state)) tone = "danger";
  else if (["SUPPORTED"].includes(state)) tone = "cyan";
  else if (["NEGOTIATED"].includes(state)) tone = "blue";
  else if (["DECLARED"].includes(state)) tone = "violet";
  else if (incompleteStatuses.has(state) || ["PROCESSING_FAILED", "UNKNOWN", "PARTIAL"].includes(state)) tone = "incomplete";
  else if (["PENDING", "DISABLED", "QUEUED", "CANCELLED", "PAUSED", "RECEIVED", "VALIDATED", "UNSUPPORTED", "INFO"].includes(state)) tone = "neutral";
  const icon = state === "CRITICAL" || state === "HIGH" || state === "MEDIUM" ? <AlertTriangle size={12} /> : statusIcons[state] ?? <Info size={12} />;
  return <span className={`status-badge status-${tone} ${state === "PENDING" || state === "DISABLED" ? "status-lifecycle" : ""} ${className}`}><span aria-hidden="true">{icon}</span>{displayStatus(state)}</span>;
}

export function ObservationModeBadge({ mode }: { mode: ObservationMode }) {
  const icon = mode === "NEGOTIATED" ? <span className="mode-dot" /> : mode === "SUPPORTED" ? <span className="mode-ring" /> : <span className="mode-dash" />;
  return <span className={`mode-badge mode-${mode.toLowerCase()}`}><span aria-hidden="true">{icon}</span>{mode === "NEGOTIATED" ? "Négocié" : mode === "SUPPORTED" ? "Supporté" : "Déclaré"}</span>;
}

export function LifecycleBadge({ value }: { value: "PENDING" | "ACTIVE" | "DISABLED" }) {
  const label = value === "PENDING" ? "En attente" : value === "ACTIVE" ? "Actif" : "Désactivé";
  return <span className="lifecycle-badge"><i aria-hidden="true" />{label}</span>;
}

export function CopyChip({ value, label, compact = false }: { value: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* Clipboard may be unavailable in an insecure local context. */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };
  return <button className={`copy-chip ${compact ? "copy-chip-compact" : ""}`} onClick={onCopy} title={`Copier ${label ?? value}`} aria-label={`Copier ${label ?? value}`}>
    {label && <span>{label}</span>}<code>{compact ? `${value.slice(0, 9)}…${value.slice(-5)}` : value}</code>{copied ? <Check size={12} /> : <Copy size={12} />}
  </button>;
}

export function GlassModal({ open, onClose, title, description, children, size = "md" }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; size?: "md" | "lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  return <AnimatePresence>
    {open && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.div role="dialog" aria-modal="true" aria-label={title} className={`glass-elevated modal-panel ${size === "lg" ? "modal-large" : ""}`} initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98, y: 12 }} transition={{ type: "spring", stiffness: 310, damping: 28 }}>
        <div className="modal-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button onClick={onClose} className="icon-button" aria-label="Fermer la fenêtre"><X size={18} /></button></div>
        <div className="modal-content">{children}</div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}

export function GlassSheet({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  return <AnimatePresence>
    {open && <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.aside role="dialog" aria-modal="true" aria-label={title} className="glass-elevated glass-sheet" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
        <div className="modal-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button onClick={onClose} className="icon-button" aria-label="Fermer le panneau"><X size={18} /></button></div>
        <div className="sheet-content">{children}</div>
      </motion.aside>
    </motion.div>}
  </AnimatePresence>;
}

export function DataTable<T>({ data, columns, emptyText = "Aucun résultat", initialPageSize = 8, initialFilter = "", onRowClick, searchPlaceholder = "Rechercher dans les résultats" }: {
  data: T[]; columns: ColumnDef<T, any>[]; emptyText?: string; initialPageSize?: number; initialFilter?: string; onRowClick?: (item: T) => void; searchPlaceholder?: string;
}) {
  const [globalFilter, setGlobalFilter] = useState(initialFilter);
  const table = useReactTable({
    data, columns, state: { globalFilter }, onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filter) => JSON.stringify([row.original, ...row.getAllCells().map((cell) => cell.getValue())]).toLowerCase().includes(String(filter).toLowerCase()),
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });
  const visibleCount = table.getFilteredRowModel().rows.length;
  return <div className="table-shell">
    <div className="table-toolbar"><div className="table-search"><SearchIcon /> <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div><span className="table-count">{visibleCount} résultat{visibleCount > 1 ? "s" : ""}</span></div>
    <div className="table-scroll"><table className="data-table"><thead><tr>{table.getHeaderGroups().map((group) => group.headers.map((header) => <th key={header.id} colSpan={header.colSpan}>
      {header.isPlaceholder ? null : <button className={`sort-trigger ${header.column.getCanSort() ? "" : "not-sortable"}`} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanSort() && (header.column.getIsSorted() === "asc" ? <ArrowUp size={12} /> : header.column.getIsSorted() === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />)}</button>}
    </th>))}</tr></thead><tbody>
      {table.getRowModel().rows.map((row) => <tr key={row.id} onClick={() => onRowClick?.(row.original)} className={onRowClick ? "table-row-clickable" : ""}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
      {visibleCount === 0 && <tr><td colSpan={columns.length}><div className="table-empty"><div className="empty-mark"><CircleHelp size={20} /></div><strong>{emptyText}</strong><span>Modifiez les filtres ou la recherche.</span></div></td></tr>}
    </tbody></table></div>
    <div className="table-footer"><span>Page <strong>{table.getState().pagination.pageIndex + 1}</strong> sur <strong>{Math.max(table.getPageCount(), 1)}</strong></span><div className="table-pagination"><select value={table.getState().pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))} aria-label="Résultats par page"><option value={5}>5 / page</option><option value={8}>8 / page</option><option value={15}>15 / page</option><option value={25}>25 / page</option></select><button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Page précédente"><ChevronLeft size={15} /></button><button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Page suivante"><ChevronRight size={15} /></button></div></div>
  </div>;
}

function SearchIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }

export function PageHeader({ eyebrow, title, description, actions, badge }: { eyebrow: string; title: string; description: string; actions?: ReactNode; badge?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><div className="heading-line"><h1>{title}</h1>{badge}</div><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><CircleHelp size={21} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function LoadingState({ label = "Chargement des données locales" }: { label?: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><div className="loading-heading"><span className="skeleton-bar skeleton-eyebrow" /><span className="skeleton-bar skeleton-title" /><span className="skeleton-bar skeleton-copy" /></div><GlassCard className="content-panel loading-panel"><div className="skeleton-toolbar"><span className="skeleton-bar" /><span className="skeleton-bar" /></div>{Array.from({ length: 5 }, (_, index) => <div className="skeleton-row" key={index}><span className="skeleton-bar" /><span className="skeleton-bar" /><span className="skeleton-bar" /><span className="skeleton-bar" /></div>)}<span className="loading-label"><span className="loading-dot" />{label}</span></GlassCard></div>;
}

export function ProvenanceChain({ evidenceId, observationId, assetId }: { evidenceId: string; observationId?: string; assetId?: string }) {
  const links = [assetId && { label: "Asset", href: `/assets/${assetId}` }, observationId && { label: "Observation", href: `/crypto?observation=${observationId}` }, { label: "Evidence", href: `/evidence?selected=${evidenceId}` }].filter(Boolean) as { label: string; href: string }[];
  return <div className="provenance-chain">{links.map((link, index) => <span key={link.label}><a href={link.href}>{link.label}</a>{index < links.length - 1 && <span className="chain-arrow">›</span>}</span>)}</div>;
}

export function useRolePermissions() {
  const role = useAppStore((state) => state.role);
  return useMemo(() => role, [role]);
}

export function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "CRITICAL" || severity === "HIGH") return <AlertTriangle size={14} />;
  if (severity === "MEDIUM") return <Clock3 size={14} />;
  if (severity === "LOW") return <Info size={14} />;
  return <Check size={14} />;
}