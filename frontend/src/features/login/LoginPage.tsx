import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Fingerprint, LockKeyhole, ShieldCheck, WifiOff } from "lucide-react";
import { GlassButton } from "../../components/glass";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "invalid">("idle");
  const expired = searchParams.get("session") === "expired";
  const signIn = (event: FormEvent) => {
    event.preventDefault();
    if (!identity.trim() || !password) { setState("invalid"); return; }
    setState("loading");
    window.setTimeout(() => navigate("/dashboard"), 650);
  };
  return <div className="login-frame">
    <div className="ambient-orbs" aria-hidden="true"><span className="orb orb-violet" /><span className="orb orb-blue" /><span className="orb orb-emerald" /><span className="orb orb-rose" /></div><div className="noise-layer" aria-hidden="true" />
    <div className="login-topline"><div className="brand-lockup"><div className="brand-mark"><span className="brand-glyph">P</span><i /></div><div className="brand-copy"><strong>PQC<span>-SOFT</span></strong><small>CRYPTOGRAPHIC INTELLIGENCE</small></div></div><div className="login-offline"><WifiOff size={13} /> On-premise · Offline</div></div>
    <main className="login-center"><div className="login-context"><div className="login-orbit"><div className="login-orbit-inner"><Fingerprint size={37} strokeWidth={1.3} /></div><i className="orbit-point" /><i className="orbit-point orbit-point-two" /></div><div className="eyebrow">POST-QUANTUM CRYPTOGRAPHIC READINESS</div><h1>Comprendre aujourd'hui.<br /><span>Préparer l'après-quantique.</span></h1><p>Console privée de découverte cryptographique et d'orchestration des Collectors. Vos données restent dans votre réseau.</p><div className="login-trust"><span><ShieldCheck size={14} /> Déploiement local</span><span><LockKeyhole size={13} /> Accès contrôlé par rôle</span></div></div>
      <section className="glass-elevated login-panel"><div className="login-panel-header"><div><div className="login-panel-icon"><LockKeyhole size={16} /></div><h2>Connexion</h2><p>Authentifiez-vous pour accéder à votre console.</p></div><span className="login-signal"><i /> Système disponible</span></div>{expired && <div className="inline-alert"><AlertTriangle size={14} /><span>Votre session a expiré. Veuillez vous reconnecter.</span></div>}{state === "invalid" && <div className="inline-alert inline-alert-danger"><AlertTriangle size={14} /><span>Identifiants manquants ou invalides. Vérifiez les champs puis réessayez.</span></div>}
        <form className="form-stack" onSubmit={signIn}><div className="form-field"><label htmlFor="login-identity">Identifiant</label><input id="login-identity" autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Nom d'utilisateur ou adresse e-mail" /></div><div className="form-field"><label htmlFor="login-password">Mot de passe</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Saisissez votre mot de passe" /></div><div className="login-auth-hint"><ShieldCheck size={13} /><span>Méthode d'authentification définie par la configuration de votre instance.</span></div><GlassButton type="submit" className="login-submit" disabled={state === "loading"}>{state === "loading" ? "Vérification de la session..." : <>Se connecter <ArrowRight size={15} /></>}</GlassButton></form>
        <div className="login-panel-footer"><span>Cette interface est une simulation locale.</span><span>Aucune authentification externe n'est contactée.</span></div>
      </section>
    </main>
    <footer className="login-footer"><span>PQC-SOFT <code>v2.8.1</code></span><span>Console on-premise · Données fictives</span><span>UTC · Network isolated</span></footer>
  </div>;
}