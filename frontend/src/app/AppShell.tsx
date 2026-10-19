import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Bell, Boxes, ChevronDown, ClipboardList, Command, Cpu, Database, Download, FileSearch, Fingerprint, KeyRound, LayoutDashboard, LogOut, Menu, Moon, Network, PanelLeftClose, PanelLeftOpen, Search, ServerCog, Settings2, Shield, ShieldAlert, SlidersHorizontal, Sun, Users, WifiOff ,ChevronsLeft, ChevronsRight  } from "lucide-react";
import { GlassModal, StatusBadge } from "../components/glass";
import { assets, cryptoUsages, findings, scans, services } from "../mocks/data";
import { can, rolePermissions } from "../lib/permissions";
import { useAppStore } from "../lib/store";
import type { Permission } from "../types/domain";

const navItems: { label: string; path: string; icon: typeof LayoutDashboard; permission: Permission; group: string; exact?: boolean }[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, permission: "asset:read", group: "Vue d'ensemble", exact: true },
  { label: "Scans", path: "/scans", icon: Activity, permission: "scan:read", group: "Découverte" },
  { label: "Assets", path: "/assets", icon: Boxes, permission: "asset:read", group: "Découverte" },
  { label: "Crypto Inventory", path: "/crypto", icon: Fingerprint, permission: "crypto:read", group: "Découverte" },
  { label: "Findings", path: "/findings", icon: ShieldAlert, permission: "finding:read", group: "Risque" },
  { label: "Evidence", path: "/evidence", icon: FileSearch, permission: "evidence:read", group: "Découverte" },
  { label: "Collectors", path: "/collectors", icon: Cpu, permission: "collector:read", group: "Infrastructure" },
  { label: "Network Scopes", path: "/scopes", icon: Network, permission: "scope:read", group: "Infrastructure" },
  { label: "Policies", path: "/policies", icon: SlidersHorizontal, permission: "policy:read", group: "Risque" },
  { label: "CBOM / Exports", path: "/cbom", icon: Download, permission: "cbom:export", group: "Risque" },
  { label: "Audit Logs", path: "/audit", icon: ClipboardList, permission: "audit:read", group: "Gouvernance" },
  { label: "Users & Roles", path: "/admin/users", icon: Users, permission: "user:read", group: "Administration" },
  { label: "Settings", path: "/admin/settings", icon: Settings2, permission: "settings:read", group: "Administration" },
  { label: "Licensing", path: "/admin/license", icon: KeyRound, permission: "license:read", group: "Administration" },
];
const groups = ["Vue d'ensemble", "Découverte", "Risque", "Infrastructure", "Gouvernance", "Administration"];

export function AppShell() {
  const role = useAppStore((state) => state.role);
  const isLight = useAppStore((state) => state.isLight);
  const collapsed = useAppStore((state) => state.collapsed);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setRole = useAppStore((state) => state.setRole);
  const location = useLocation();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = isLight ? "light" : "dark";
  }, [isLight]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setRolesOpen(false); setProfileOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleItems = useMemo(() => navItems.filter((item) => can(role, item.permission)), [role]);
  const doNavigate = (path: string) => { navigate(path); setCommandOpen(false); };

  return <div className={`app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
    <div className="ambient-orbs" aria-hidden="true"><span className="orb orb-violet" /><span className="orb orb-blue" /><span className="orb orb-emerald" /><span className="orb orb-rose" /></div>
    <div className="noise-layer" aria-hidden="true" />
    <aside className="sidebar glass-surface">
      <div className="brand-lockup"><div className="brand-mark"><span className="brand-glyph">P</span><i /></div><div className="brand-copy"><strong>PQC<span>-SOFT</span></strong><small>CRYPTOGRAPHIC INTELLIGENCE</small></div></div>
      <button className="sidebar-toggle icon-button" onClick={toggleSidebar} aria-label={collapsed ? "Déployer la navigation" : "Réduire la navigation"}>{collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}</button>
      <nav className="side-nav" aria-label="Navigation principale">
        {groups.map((group) => {
          const items = visibleItems.filter((item) => item.group === group);
          if (!items.length) return null;
          return <div className="nav-group" key={group}><span className="nav-group-label">{group}</span>{items.map((item) => {
            const Icon = item.icon;
            return <NavLink to={item.path} key={item.path} end={item.exact} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`} title={collapsed ? item.label : undefined}>
              {({ isActive }) => <><span className="nav-active-pill" aria-hidden="true" /><Icon size={17} strokeWidth={1.8} /><span className="nav-link-text">{item.label}</span>{isActive && <motion.span layoutId="nav-active-dot" className="nav-trailing-dot" />}</>}
            </NavLink>;
          })}</div>;
        })}
      </nav>
      <div className="sidebar-bottom"><div className="offline-status"><span className="offline-indicator"><WifiOff size={13} /></span><span><strong>On-premise</strong><small>Réseau isolé · opérationnel</small></span></div><div className="sidebar-version">PQC-SOFT <span>v2.8.1</span></div></div>
    </aside>

    <main className="main-column">
      <header className="topbar glass-surface">
        <div className="mobile-brand"><span className="brand-glyph">P</span><strong>PQC-SOFT</strong></div>
        <button className="global-search" onClick={() => setCommandOpen(true)} aria-label="Ouvrir la recherche globale"><Search size={15} /><span>Rechercher assets, crypto, findings...</span><kbd><Command size={11} /> K</kbd></button>
        <div className="topbar-actions">
          <div className="popover-anchor"><button className={`topbar-select ${rolesOpen ? "topbar-select-open" : ""}`} onClick={() => { setRolesOpen(!rolesOpen); setProfileOpen(false); }} aria-expanded={rolesOpen} aria-label={`Rôle courant : ${role}`}><span className="role-avatar">{role === "Administrator" ? "A" : role.slice(0, 1)}</span><span className="role-label">{role}</span><ChevronDown size={14} /></button>
            <AnimatePresence>{rolesOpen && <motion.div className="glass-elevated role-popover" initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
              <div className="popover-title"><span>Simuler un rôle</span><small>Permissions effectives</small></div>
              {(["Administrator", "Operator", "Analyst", "Auditor"] as const).map((candidate) => <button key={candidate} className={`role-option ${candidate === role ? "role-option-active" : ""}`} onClick={() => { setRole(candidate); setRolesOpen(false); }}><span>{candidate === role && <span className="role-check">✓</span>}{candidate}</span><small>{rolePermissions[candidate].length} permissions</small></button>)}
              <div className="permission-preview"><div className="permission-preview-head"><Shield size={12} /><span>Accès effectifs</span></div><div>{rolePermissions[role].slice(0, 6).map((permission) => <code key={permission}>{permission}</code>)}{rolePermissions[role].length > 6 && <small>+ {rolePermissions[role].length - 6} permissions</small>}</div></div>
            </motion.div>}</AnimatePresence>
          </div>
          <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={isLight ? "Activer le thème sombre" : "Activer le thème clair"}>{isLight ? <Moon size={17} /> : <Sun size={17} />}</button>
          <div className="popover-anchor notification-anchor"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></button>
            <AnimatePresence>{notificationsOpen && <motion.div className="glass-elevated notification-popover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><div className="popover-title"><span>À surveiller</span><small>2 événements</small></div><div className="notification-item"><span className="alert-mark"><Database size={14} /></span><div><strong>Spool collector-dmz à 88 %</strong><small>Back-pressure · il y a 4 min</small></div></div><div className="notification-item"><span className="alert-mark alert-mark-amber"><KeyRound size={14} /></span><div><strong>Certificat mTLS bientôt expiré</strong><small>Échéance dans 14 jours</small></div></div></motion.div>}</AnimatePresence>
          </div>
          <div className="topbar-divider" />
          <div className="popover-anchor profile-anchor"><button className="profile-trigger" onClick={() => { setProfileOpen(!profileOpen); setRolesOpen(false); }} aria-label="Menu utilisateur"><span className="user-avatar">AM</span><span className="profile-copy"><strong>Alex Martin</strong><small>Console on-premise</small></span><ChevronDown size={14} /></button>
            <AnimatePresence>{profileOpen && <motion.div className="glass-elevated profile-popover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><div className="profile-info"><strong>Alex Martin</strong><small>a.martin@northstar.internal</small><StatusBadge status="ACTIVE" /></div><button onClick={() => { setProfileOpen(false); navigate("/login"); }}><LogOut size={14} />Déconnexion</button></motion.div>}</AnimatePresence>
          </div>
          <button className="mobile-menu icon-button" onClick={toggleSidebar} aria-label="Ouvrir la navigation"><Menu size={18} /></button>
        </div>
      </header>
      <div className="route-meta"><span className="breadcrumb-root">Console</span><span>/</span><span>{navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))?.label ?? "Vue détaillée"}</span><span className="route-utc">UTC · {new Date().toISOString().replace("T", " ").slice(0, 19)}</span></div>
      <div className="route-stage"><AnimatePresence mode="wait"><motion.div key={location.pathname} className="route-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}><Outlet /></motion.div></AnimatePresence></div>
      <footer className="app-footer"><span>© 2026 Northstar · Données fictives</span><span><span className="footer-live-dot" /> Réseau local sécurisé</span><span className="footer-correlation">CORRELATION-ID <code>corr-console-48DE12</code></span></footer>
    </main>

    <GlobalSearch open={commandOpen} onClose={() => setCommandOpen(false)} onNavigate={doNavigate} />
  </div>;
}

function GlobalSearch({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entityResults = [
      ...assets.map((asset) => ({ label: asset.canonical_name, detail: `${asset.ips.join(", ")} · Asset`, icon: Boxes, path: `/assets/${asset.id}`, terms: `${asset.canonical_name} ${asset.ips.join(" ")} ${asset.hostnames.join(" ")}` })),
      ...services.map((service) => ({ label: `${service.protocol} :${service.port}`, detail: `${assets.find((asset) => asset.id === service.asset_id)?.canonical_name ?? "Asset"} · Service`, icon: ServerCog, path: `/assets/${service.asset_id}?tab=services`, terms: `${service.protocol} ${service.port} ${service.version}` })),
      ...findings.map((finding) => ({ label: finding.title, detail: `${finding.reason_code} · Finding`, icon: ShieldAlert, path: `/findings?selected=${finding.id}`, terms: `${finding.title} ${finding.reason_code} ${finding.target}` })),
      ...cryptoUsages.map((usage) => ({ label: usage.algorithm, detail: `${usage.target} · Crypto`, icon: Fingerprint, path: `/crypto?selected=${usage.id}`, terms: `${usage.algorithm} ${usage.target} ${usage.protocol}` })),
      ...scans.slice(0, 4).map((scan) => ({ label: scan.target_cidr, detail: `${scan.status} · Scan`, icon: Activity, path: `/scans/${scan.id}`, terms: `${scan.target_cidr} ${scan.correlation_id} ${scan.status}` })),
    ];
    return entityResults.filter((item) => !q || `${item.label} ${item.detail} ${item.terms}`.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);
  useEffect(() => { if (!open) { setQuery(""); setActiveIndex(0); } }, [open]);
  useEffect(() => { setActiveIndex(0); }, [query]);
  return <GlassModal open={open} onClose={onClose} title="Recherche globale" description="Retrouvez un actif, un service, une empreinte ou un finding." size="lg">
    <div className="command-search-input"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (!results.length) return; if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % results.length); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + results.length) % results.length); } else if (event.key === "Enter") { event.preventDefault(); onNavigate(results[activeIndex]?.path ?? results[0].path); } }} placeholder="Nom, IP, hostname, algorithme, correlation ID..." aria-label="Recherche globale" /><kbd>ESC</kbd></div>
    <div className="command-results">{results.length ? results.map((result, index) => { const Icon = result.icon; return <button key={`${result.path}-${index}`} onMouseEnter={() => setActiveIndex(index)} className={activeIndex === index ? "command-result-active" : ""} onClick={() => onNavigate(result.path)}><span className="command-result-icon"><Icon size={16} /></span><span className="command-result-copy"><strong>{result.label}</strong><small>{result.detail}</small></span><span className="command-open">Ouvrir ↗</span></button>; }) : <div className="command-empty"><Search size={20} /><span>Aucun résultat local ne correspond à « {query} »</span></div>}</div>
    <div className="command-footer"><span>Résultats depuis l'inventaire local</span><span><kbd>↑</kbd> <kbd>↓</kbd> naviguer <kbd>↵</kbd> ouvrir</span></div>
  </GlassModal>;
}