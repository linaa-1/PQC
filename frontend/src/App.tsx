import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { GlassCard, LoadingState, PageHeader } from "./components/glass";
import { AppShell } from "./app/AppShell";
import { useCan } from "./lib/permissions";
import { mockRequest } from "./lib/services";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ScansPage, ScanDetailPage } from "./features/scans/ScansPage";
import { AssetDetailPage, AssetsPage } from "./features/assets/AssetsPage";
import { CryptoPage } from "./features/crypto/CryptoPage";
import { FindingsPage } from "./features/findings/FindingsPage";
import { EvidencePage } from "./features/evidence/EvidencePage";
import { CollectorsPage } from "./features/collectors/CollectorsPage";
import { ScopesPage } from "./features/scopes/ScopesPage";
import { AuditPage, CbomPage, PoliciesPage } from "./features/governance/GovernancePages";
import { LicensePage, SettingsPage, UsersPage } from "./features/admin/AdminPages";
import { LoginPage } from "./features/login/LoginPage";
import type { Permission } from "./types/domain";

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<AppShell />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Screen permission="asset:read"><DashboardPage /></Screen>} />
      <Route path="scans" element={<Screen permission="scan:read"><ScansPage /></Screen>} />
      <Route path="scans/:id" element={<Screen permission="scan:read"><ScanDetailPage /></Screen>} />
      <Route path="assets" element={<Screen permission="asset:read"><AssetsPage /></Screen>} />
      <Route path="assets/:id" element={<Screen permission="asset:read"><AssetDetailPage /></Screen>} />
      <Route path="crypto" element={<Screen permission="crypto:read"><CryptoPage /></Screen>} />
      <Route path="findings" element={<Screen permission="finding:read"><FindingsPage /></Screen>} />
      <Route path="evidence" element={<Screen permission="evidence:read"><EvidencePage /></Screen>} />
      <Route path="collectors" element={<Screen permission="collector:read"><CollectorsPage /></Screen>} />
      <Route path="scopes" element={<Screen permission="scope:read"><ScopesPage /></Screen>} />
      <Route path="policies" element={<Screen permission="policy:read"><PoliciesPage /></Screen>} />
      <Route path="cbom" element={<Screen permission="cbom:export"><CbomPage /></Screen>} />
      <Route path="audit" element={<Screen permission="audit:read"><AuditPage /></Screen>} />
      <Route path="admin/users" element={<Screen permission="user:read"><UsersPage /></Screen>} />
      <Route path="admin/settings" element={<Screen permission="settings:read"><SettingsPage /></Screen>} />
      <Route path="admin/license" element={<Screen permission="license:read"><LicensePage /></Screen>} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes></BrowserRouter>;
}

function Screen({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const allowed = useCan(permission);
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setStatus("loading");
    const simulateError = new URLSearchParams(window.location.search).get("simulateError") === "1";
    mockRequest({ route: location.pathname, permission }, { latency: 150, failRate: simulateError ? 1 : 0 }).then(() => {
      if (!cancelled) setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [allowed, location.pathname, permission, attempt]);
  if (!allowed) return <div className="access-denied"><div className="page-heading"><div><div className="eyebrow">ACCÈS / RBAC</div><h1>Permission requise</h1><p>Cette entrée est masquée lorsque le rôle courant n'a pas de droit de lecture.</p></div></div><GlassCard className="detail-section"><div className="raw-locked"><LockKeyhole size={22} /><strong>Accès non autorisé</strong><p>Permission requise : <code>{permission}</code></p></div></GlassCard></div>;
  if (status === "loading") return <LoadingState label="Chargement simulé des données on-premise" />;
  if (status === "error") return <GlassCard className="detail-section"><div className="empty-state"><div className="empty-mark"><AlertTriangle size={18} /></div><h3>Lecture temporairement indisponible</h3><p>Le service mocké a retourné une erreur. Aucun scan ni état métier n'a été modifié.</p><button className="glass-button glass-button-secondary" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button></div></GlassCard>;
  return <>{children}</>;
}

function NotFound() {
  return <><PageHeader eyebrow="CONSOLE / ROUTE" title="Écran introuvable" description="Cette route ne correspond à aucun écran de la console PQC-SOFT." /><GlassCard className="detail-section"><div className="empty-state"><div className="empty-mark"><AlertTriangle size={18} /></div><h3>Cette adresse n'existe pas</h3><p>Retournez au Dashboard ou utilisez la recherche globale pour ouvrir un élément.</p></div></GlassCard></>;
}
