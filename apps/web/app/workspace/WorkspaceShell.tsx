"use client";
import { PortfolioDesigner } from "../portfolio-designer";
import { apiFetch, connectIntegration } from "../api-client";
import {
  useAppAuth,
  LoginControl,
  LogoutControl,
  AccountControl,
} from "../auth-provider";
import {
  portfolioDefaults,
  portfolioSections,
  productLink,
  type PortfolioSection,
} from "@jobnester/core";
import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Compass,
  BriefcaseBusiness,
  FileText,
  Mail,
  Users,
  GraduationCap,
  Globe,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Plus,
  Bookmark,
  MapPin,
  Clock,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  SlidersHorizontal,
  Sparkles,
  ScanLine,
  RefreshCw,
  Download,
  Trash2,
  Menu,
  Sun,
  Monitor,
  Link2,
  ShieldCheck,
  TriangleAlert,
  CheckCircle2,
  LogOut,
  Eye,
  Send,
  Copy,
  Upload,
  Activity,
  Code2,
  Layers,
  Cloud,
  BrainCircuit,
  Command,
  ChevronLeft,
  PanelTop,
  CalendarDays,
  MoreHorizontal,
  Building2,
  type LucideIcon,
} from "lucide-react";
import {
  type AppState,
  type Job,
  type Application,
  type Resume,
  type Profile,
  type Portfolio,
  type CareerMode,
  emptyState,
  matchAll,
  composeResume,
  applyTransition,
  stages,
  canonicalUrl,
} from "@jobnester/core";
import { demoState } from "../demo";
import { demoAction } from "./demoActions";
import { ApplicationForm } from "../features/applications/ApplicationForm";
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
const DEMO = !API;
const storageKey = "jobnester-demo-v1";
const pageRoutes: Record<string, string> = {
  "Discover Jobs": "/jobs",
  Applications: "/applications",
  Settings: "/settings",
  Portfolio: "/portfolio/edit",
  Overview: "/",
};
const navGroups = [
  {
    label: "MAIN",
    items: [
      ["Discover Jobs", Compass],
      ["Applications", BriefcaseBusiness],
      ["Portfolio", Globe],
      ["Resume Studio", FileText],
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      ["Overview", LayoutDashboard],
      ["Recruitment Inbox", Mail],
      ["Recruiters", Users],
      ["Interview Prep", GraduationCap],
      ["Analytics", ChartNoAxesCombined],
    ],
  },
] as { label: string; items: [string, LucideIcon][] }[];
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const ago = (date: string) => {
  const h = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 3600000),
  );
  return h < 1
    ? "Just now"
    : h < 24
      ? `${h}h ago`
      : `${Math.floor(h / 24)}d ago`;
};
function Button({
  children,
  onClick,
  secondary = false,
  small = false,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`btn ${secondary ? "secondary" : ""} ${small ? "small" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  icon: Icon = Compass,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [onClose]);
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prior?.focus();
  }, []);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const els = ref.current?.querySelectorAll<HTMLElement>(
              "button,input,textarea,select,a[href]",
            );
            if (!els?.length) return;
            const first = els[0],
              last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            aria-label="Close dialog"
            className="icon-btn"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function Workspace({
  initialPage = "Discover Jobs",
}: {
  initialPage?: string;
}) {
  const auth = useAppAuth();
  const [s, setS] = useState<AppState>(emptyState());
  const stateRef = React.useRef(s);
  stateRef.current = s;
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(DEMO);
  const [page, setPage] = useState(initialPage);
  const [mode, setMode] = useState("fullstack");
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [selectedRecruiter, setSelectedRecruiter] = useState<
    AppState["recruiters"][number] | null
  >(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [filter, setFilter] = useState("Unapplied");
  const [eligibility, setEligibility] = useState("All eligibility");
  const [minScore, setMinScore] = useState(50);
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [company, setCompany] = useState("");
  const [salaryMin, setSalaryMin] = useState(0);
  const [employment, setEmployment] = useState("All types");
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState("Board");
  const notify = useCallback((text: string) => {
    setToast(text);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const load = useCallback(async () => {
    if (DEMO) {
      try {
        const saved = localStorage.getItem(storageKey);
        setS(saved ? JSON.parse(saved) : demoState());
      } catch {
        setS(demoState());
      }
      setLoaded(true);
      return;
    }
    if (!auth.ready) return;
    if (!auth.signedIn) {
      setAuthenticated(false);
      setLoaded(true);
      return;
    }
    try {
      const r = await apiFetch(`${API}/api/state`, { credentials: "include" });
      if (r.status === 401) {
        setAuthenticated(false);
        setLoaded(true);
        return;
      }
      if (!r.ok)
        throw Error(
          "Could not load your workspace. Check that the API and database are running.",
        );
      setS(await r.json());
      setAuthenticated(true);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [notify, auth.ready, auth.signedIn]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (DEMO && loaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(s));
      } catch {
        notify(
          "Browser storage is full or unavailable. Your changes may not persist.",
        );
      }
    }
  }, [s, loaded]);
  useEffect(() => {
    if (DEMO || !authenticated) return;
    const t = setInterval(() => {
      load();
    }, 15000);
    return () => clearInterval(t);
  }, [authenticated, load]);
  async function act(
    action: string,
    data: any = {},
    success?: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      if (DEMO) {
        const next = demoAction(stateRef.current, action, data);
        stateRef.current = next;
        localStorage.setItem(storageKey, JSON.stringify(next));
        setS(next);
      } else {
        const r = await apiFetch(`${API}/api/actions/${action}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const body = await r.json();
        if (!r.ok) throw Error(body.message || "Request failed");
        await load();
      }
      if (success) notify(success);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const go = (p: string) => {
    setPage(p);
    setQuery("");
    setMobile(false);
    const route = pageRoutes[p];
    if (route && typeof window !== "undefined" && window.location.pathname !== route)
      window.history.replaceState(null, "", route);
  };
  const activeMode = s.modes.find((m) => m.id === mode) || s.modes[0];
  const matches = (j: Job) =>
    j.matches[mode] || {
      score: 0,
      eligibility: "Needs verification",
      reasons: [],
      gaps: [],
    };
  const jobs = s.jobs
    .filter(
      (j) => (filter === "Hidden jobs" ? j.hidden : !j.hidden) && j.active,
    )
    .filter((j) =>
      `${j.title} ${j.company} ${j.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (j) =>
        filter !== "Saved jobs" ||
        s.applications.some((a) => a.jobId === j.id && a.stage === "Saved"),
    )
    .filter(
      (j) =>
        filter !== "Unapplied" ||
        !s.applications.some((a) => a.jobId === j.id && a.appliedAt),
    )
    .filter(
      (j) =>
        eligibility === "All eligibility" ||
        matches(j).eligibility === eligibility,
    )
    .filter((j) => matches(j).score >= minScore)
    .filter((j) => !remoteOnly || j.remote)
    .filter(
      (j) =>
        !company || j.company.toLowerCase().includes(company.toLowerCase()),
    )
    .filter((j) => !salaryMin || (!!j.salaryMin && j.salaryMin >= salaryMin))
    .filter((j) => employment === "All types" || j.employment === employment)
    .sort((a, b) => matches(b).score - matches(a).score);
  const submitted = s.applications.filter((a) => a.appliedAt);
  const interviews = s.applications.filter((a) =>
    ["Interviewing", "Assessment"].includes(a.stage),
  );
  const offers = s.applications.filter((a) => a.stage === "Offer");
  const save = (j: Job) =>
    act("job.save", { id: j.id }, "Job saved to your applications");
  const open = (j: Job) => {
    window.open(j.url, "_blank", "noopener,noreferrer");
    void act("job.view", { id: j.id });
  };
  const generate = (j: Job) => {
    setSelected(j);
    setModal("generate");
  };
  const jobCard = (j: Job, compact = false) => {
    const m = matches(j);
    const a = s.applications.find((a) => a.jobId === j.id);
    return (
      <article className={`job-card ${compact ? "compact" : ""}`} key={j.id}>
        {!compact && (
          <input
            className="job-select"
            type="checkbox"
            aria-label={`Select ${j.company} ${j.title}`}
            checked={selectedJobs.includes(j.id)}
            onChange={(e) =>
              setSelectedJobs(
                e.target.checked
                  ? [...selectedJobs, j.id].slice(0, 20)
                  : selectedJobs.filter((id) => id !== j.id),
              )
            }
          />
        )}
        <button
          className={`company-logo logo-${j.company.toLowerCase().replace(/\s/g, "")}`}
          onClick={() => {
            setSelected(j);
            setModal("job");
          }}
          aria-label={`View ${j.company} job`}
        >
          {j.company === "Vercel" ? (
            <span className="vercel-triangle" />
          ) : j.company === "Linear" ? (
            <span className="linear-orb" />
          ) : j.company === "Supabase" ? (
            <span className="supabase-bolt">ϟ</span>
          ) : (
            initials(j.company)
          )}
        </button>
        <div className="job-main">
          <div className="job-heading">
            <button
              className="text-button job-title"
              onClick={() => {
                setSelected(j);
                setModal("job");
              }}
            >
              {j.title}
            </button>
            {!compact && (
              <Badge tone="purple">
                {m.score >= 80 ? "Strong match" : "Review fit"}
              </Badge>
            )}
          </div>
          <div className="job-meta">
            <span className="company-name">{j.company}</span>
            <span>·</span>
            <span>
              <MapPin size={12} />
              {j.location}
            </span>
            <span className="desktop-meta">·</span>
            <span className="desktop-meta">{j.employment}</span>
          </div>
          <div className="job-tags">
            {j.technologies.slice(0, compact ? 3 : 5).map((t) => (
              <span key={t}>{t}</span>
            ))}
            {!compact && <span className="salary-tag">{j.salary}</span>}
          </div>
          <div className="job-bottom">
            <span
              className={`eligibility-dot ${m.eligibility === "Eligible" ? "green" : m.eligibility === "Ineligible" ? "red" : "amber"}`}
            />
            <span>{m.eligibility}</span>
            <span>·</span>
            <span>{ago(j.discoveredAt)}</span>
            {a && <Badge tone="purple">{a.stage}</Badge>}
          </div>
        </div>
        <div className="job-right">
          <div className="match-score">
            <span>
              {m.score}
              <small>%</small>
            </span>
            <small>skill match</small>
          </div>
          <button
            className={`icon-btn save-btn ${a ? "saved" : ""}`}
            aria-label={a ? "Job saved" : "Save job"}
            onClick={() => save(j)}
            disabled={!!a}
          >
            <Bookmark size={17} fill={a ? "currentColor" : "none"} />
          </button>
          {!compact && (
            <Button secondary small onClick={() => generate(j)}>
              <Sparkles size={14} />
              Tailor CV
            </Button>
          )}
        </div>
      </article>
    );
  };
  if (!loaded)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Layers />
        </div>
        <span>Preparing your workspace…</span>
      </div>
    );
  if (!authenticated)
    return (
      <main className="auth-page">
        <div className="auth-box">
          <div className="brand">
            <span className="brand-mark">
              <Layers size={23} />
            </span>
            JobNester<span className="ai-tag">AI</span>
          </div>
          <Badge tone="purple">YOUR NEXT CHAPTER</Badge>
          <h1>
            A more intentional
            <br />
            way to find your next role.
          </h1>
          <p>
            One private workspace for opportunities, tailored CVs, and every
            step toward your next offer.
          </p>
          <LoginControl />
          <AccountControl />
          <small>
            <ShieldCheck size={14} />
            Private access · Owner account only
          </small>
          <button className="text-button" onClick={load}>
            Retry connection
          </button>
        </div>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">
            <Layers size={22} />
          </span>
          JobNester<span className="ai-tag">AI</span>
        </a>
        <button
          className="workspace-switch"
          onClick={() => {
            setModal("profile");
            setMobile(false);
          }}
        >
          <span className="workspace-avatar">
            {initials(s.profile.name) || "ME"}
          </span>
          <span>
            Personal workspace<small>Just for you</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([label, Icon]) => (
                <button
                  key={label}
                  className={`nav-item ${page === label ? "active" : ""}`}
                  onClick={() => go(label)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {label === "Discover Jobs" && s.jobs.length > 0 && (
                    <small>{s.jobs.filter((j) => !j.hidden).length}</small>
                  )}
                  {label === "Recruitment Inbox" && s.threads.length > 0 && (
                    <i />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="career-card">
            <span className="career-spark">
              <Sparkles size={17} />
            </span>
            <h4>Your next chapter awaits.</h4>
            <p>
              A little progress, every day.
              <br />
              You&apos;ve got this.
            </p>
            <button
              onClick={() => {
                go("Discover Jobs");
              }}
              className="text-button"
            >
              Find your next role <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => go("Settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <button className="user-profile" onClick={() => setModal("profile")}>
            <span className="avatar">{initials(s.profile.name) || "ME"}</span>
            <span>
              {s.profile.name || "Your profile"}
              <small>Personal account</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            <span className="private-indicator">
              <span />
              Private workspace
            </span>
            <button
              aria-label="View notifications"
              className="icon-btn notification-btn"
              onClick={() => setModal("notifications")}
            >
              <Bell size={18} />
              {s.tasks.length > 0 && <i />}
            </button>
            <button
              className="avatar small-avatar"
              onClick={() => setModal("profile")}
            >
              {initials(s.profile.name) || "ME"}
            </button>
          </div>
        </header>
        <main className="content">
          <div className="demo-banner">
            <span>
              {DEMO ? (
                <>
                  <Monitor size={13} />
                  <b>Interactive demo</b>
                  <span className="banner-extra">
                    Illustrative jobs and experience · changes stay in this
                    browser
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck size={13} />
                  <b>Live workspace</b>
                  <span className="banner-extra">
                    Your private career workspace
                  </span>
                </>
              )}
            </span>
            {DEMO ? (
              <button
                onClick={() => {
                  setS(demoState());
                  localStorage.removeItem("jobnester-published-demo");
                  notify("Demo workspace reset");
                }}
              >
                Reset demo <RefreshCw size={11} />
              </button>
            ) : (
              <button onClick={() => setModal("profile")}>
                Edit profile <ArrowUpRight size={12} />
              </button>
            )}
          </div>
          {page === "Overview" && (
            <>
              <div className="page-title">
                <div className="eyebrow">
                  <span className="status-dot" />
                  YOUR CAREER, IN MOTION
                </div>
                <h1>
                  Your next chapter starts here
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  Welcome back, {s.profile.name.split(" ")[0] || "there"}.
                  Let&apos;s turn the right opportunities into your next big
                  move.
                </p>
                <div className="title-actions">
                  <Button secondary onClick={() => setModal("import")}>
                    <Plus size={16} />
                    Add job
                  </Button>
                  <Button
                    onClick={() =>
                      act(
                        "scan",
                        {},
                        "Scan queued. We’ll update your workspace as jobs arrive.",
                      )
                    }
                    disabled={busy}
                  >
                    <ScanLine size={16} />
                    Scan for jobs
                  </Button>
                </div>
              </div>
              <section className="daily-banner">
                <div className="banner-art">
                  <ScanLine size={30} />
                  <span className="orbit one" />
                  <span className="orbit two" />
                </div>
                <div>
                  <div className="banner-kicker">
                    <span />
                    YOUR SEARCH, WORKING FOR YOU
                  </div>
                  <h2>Great opportunities. Less searching.</h2>
                  <p>
                    Four career modes. One focused search. Find roles that fit
                    where you want to go.
                  </p>
                  <div className="banner-tags">
                    <span>
                      <Check size={12} />
                      Smarter matching
                    </span>
                    <span>
                      <Check size={12} />
                      No duplicate applications
                    </span>
                    <span>
                      <Check size={12} />
                      Your experience, tailored
                    </span>
                  </div>
                </div>
                <button onClick={() => go("Discover Jobs")}>
                  Explore matches <ArrowRight size={16} />
                </button>
                <div className="banner-grid" />
              </section>
              <div className="stats-grid">
                {[
                  [
                    Compass,
                    "Jobs discovered",
                    s.jobs.length,
                    "Across your career modes",
                    "purple",
                  ],
                  [
                    Send,
                    "Applications sent",
                    submitted.length,
                    "Confirmed submissions",
                    "blue",
                  ],
                  [
                    Users,
                    "In the interview loop",
                    interviews.length,
                    "Conversations moving forward",
                    "amber",
                  ],
                  [
                    CheckCircle2,
                    "Offers received",
                    offers.length,
                    "Your next chapter, closer",
                    "green",
                  ],
                ].map(([Icon, label, value, caption, color]) => {
                  const I = Icon as LucideIcon;
                  return (
                    <div className="stat-card" key={label as string}>
                      <div className="stat-top">
                        <span>{label as string}</span>
                        <span className={`stat-icon ${color}`}>
                          <I size={17} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {value as number}
                        <span className="stat-mini-line">
                          {Array.from({ length: 9 }, (_, i) => (
                            <i
                              key={i}
                              style={{
                                height: `${[5, 10, 8, 15, 12, 18, 15, 23, 27][i]}px`,
                              }}
                            />
                          ))}
                        </span>
                      </div>
                      <p>{caption as string}</p>
                    </div>
                  );
                })}
              </div>
              <div className="overview-columns">
                <section className="panel recommendations">
                  <div className="panel-header">
                    <div>
                      <h2>
                        Picked for your next move <Sparkles size={16} />
                      </h2>
                      <p>
                        Ranked against your experience. Ready for a closer look.
                      </p>
                    </div>
                    <button
                      className="text-button muted-link"
                      onClick={() => go("Discover Jobs")}
                    >
                      View all jobs <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="mode-tabs">
                    {s.modes.map((m) => (
                      <button
                        key={m.id}
                        className={mode === m.id ? "selected" : ""}
                        onClick={() => setMode(m.id)}
                      >
                        {m.short}
                      </button>
                    ))}
                  </div>
                  {!s.profile.country && (
                    <button
                      className="eligibility-notice"
                      onClick={() => setModal("profile")}
                    >
                      <MapPin size={13} />
                      <span>
                        Set your work country to verify job eligibility
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                  {jobs.length ? (
                    jobs.slice(0, 4).map((j) => jobCard(j, true))
                  ) : (
                    <Empty
                      title="Your next opportunity is out there"
                      description="Add an employer source in Settings and run your first scan."
                      action={
                        <Button small onClick={() => go("Settings")}>
                          Set up discovery
                        </Button>
                      }
                    />
                  )}
                  <button
                    className="panel-footer"
                    onClick={() => go("Discover Jobs")}
                  >
                    Explore all opportunities <ArrowRight size={14} />
                  </button>
                </section>
                <div className="right-column">
                  <section className="panel pipeline-panel">
                    <div className="panel-header">
                      <h2>Application pipeline</h2>
                      <button
                        className="icon-btn"
                        aria-label="View applications"
                        onClick={() => go("Applications")}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="donut-wrap">
                      <div
                        className="donut"
                        style={{ background: pipelineGradient(s.applications) }}
                      >
                        <div>
                          <strong>{s.applications.length}</strong>
                          <span>Total applications</span>
                        </div>
                      </div>
                    </div>
                    <div className="pipeline-legend">
                      {[
                        ["Saved", "#a78bfa"],
                        ["Applied", "#6688ed"],
                        ["Interviewing", "#edb35a"],
                        ["Assessment", "#e48cb6"],
                        ["Offer", "#57bca0"],
                      ].map(([stage, color]) => (
                        <button key={stage} onClick={() => go("Applications")}>
                          <span>
                            <i style={{ background: color }} />
                            {stage}
                          </span>
                          <b>
                            {
                              s.applications.filter((a) => a.stage === stage)
                                .length
                            }
                          </b>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="focus-card">
                    <span className="focus-icon">
                      <Sparkles size={19} />
                    </span>
                    <span className="eyebrow">
                      A LITTLE FOCUS GOES A LONG WAY
                    </span>
                    <h3>Quality beats quantity.</h3>
                    <p>
                      Start with a few strong matches. Tailor your story, then
                      make your move.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => go("Resume Studio")}
                    >
                      Open Resume Studio <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
              </div>
              <div className="workspace-foot">
                <span>
                  <ShieldCheck size={13} />
                  Your career data stays private.
                </span>
                <span>
                  Built for your next big move{" "}
                  <span className="purple-text">✦</span>
                </span>
              </div>
            </>
          )}
          {page === "Discover Jobs" && (
            <>
              <PageTitle
                eyebrow="FIND YOUR FIT"
                title="An opportunity worth your time."
                description="A focused shortlist, ranked against your real experience."
                action={
                  <>
                    <Button secondary onClick={() => setModal("import")}>
                      <Plus size={15} />
                      Import job
                    </Button>
                    <Button
                      secondary
                      disabled={busy || !selectedJobs.length}
                      onClick={() =>
                        act(
                          "application.compose",
                          {
                            jobIds: selectedJobs.slice(0, 20),
                            modeId: mode,
                          },
                          `Composing emails for ${Math.min(selectedJobs.length, 20)} jobs`,
                        )
                      }
                    >
                      <Send size={15} />
                      Generate emails ({Math.min(selectedJobs.length, 20)})
                    </Button>
                    <Button
                      onClick={() => act("scan", {}, "Pulling up to 20 jobs")}
                      disabled={busy}
                    >
                      <ScanLine size={16} />
                      Pull 20 jobs
                    </Button>
                  </>
                }
              />
              <div className="mode-selector">
                {s.modes.map((m, i) => {
                  const I = [Code2, Cloud, BrainCircuit, Layers][i];
                  return (
                    <button
                      key={m.id}
                      className={mode === m.id ? "selected" : ""}
                      onClick={() => setMode(m.id)}
                    >
                      <I size={18} />
                      <span>{m.name}</span>
                      {mode === m.id && <CheckCircle2 size={15} />}
                    </button>
                  );
                })}
              </div>
              <div className="toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Search jobs"
                    placeholder="Search by role, company, or technology…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-btn"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Job list"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All jobs</option>
                  <option>Saved jobs</option>
                  <option>Unapplied</option>
                  <option>Hidden jobs</option>
                </select>
                <Button secondary onClick={() => setShowFilters(!showFilters)}>
                  <SlidersHorizontal size={15} />
                  Filters
                </Button>
              </div>
              {showFilters && (
                <div className="filter-panel">
                  <Field label="Eligibility">
                    <select
                      value={eligibility}
                      onChange={(e) => setEligibility(e.target.value)}
                    >
                      {[
                        "All eligibility",
                        "Eligible",
                        "Needs verification",
                        "Ineligible",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Minimum skill match: ${minScore}%`}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={minScore}
                      onChange={(e) => setMinScore(+e.target.value)}
                    />
                  </Field>
                  <Field label="Company">
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Any employer"
                    />
                  </Field>
                  <Field label="Minimum annual salary (USD)">
                    <input
                      type="number"
                      min="0"
                      value={salaryMin || ""}
                      onChange={(e) => setSalaryMin(+e.target.value)}
                    />
                  </Field>
                  <Field label="Employment">
                    <select
                      value={employment}
                      onChange={(e) => setEmployment(e.target.value)}
                    >
                      {[
                        "All types",
                        "Full-time",
                        "Contract",
                        "Part-time",
                        "Not specified",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={remoteOnly}
                      onChange={(e) => setRemoteOnly(e.target.checked)}
                    />
                    Remote only
                  </label>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEligibility("All eligibility");
                      setMinScore(0);
                      setRemoteOnly(false);
                      setCompany("");
                      setSalaryMin(0);
                      setEmployment("All types");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="results-heading">
                <span>
                  <b>{jobs.length}</b> opportunities{" "}
                  <span className="muted">· {activeMode?.short}</span>
                </span>
                <span>
                  <ArrowDownIcon />
                  Best skill match first
                </span>
              </div>
              {selectedJobs.length > 0 && (
                <div className="bulk-bar">
                  <span>{selectedJobs.length} selected</span>
                  <Button
                    small
                    onClick={async () => {
                      if (
                        await act(
                          "resume.batch",
                          { jobIds: selectedJobs, modeId: mode },
                          DEMO
                            ? "Selected CVs generated — review in Resume Studio"
                            : "Selected CVs queued",
                        )
                      ) {
                        setSelectedJobs([]);
                        go("Resume Studio");
                      }
                    }}
                    disabled={busy}
                  >
                    <Sparkles size={14} />
                    Tailor selected CVs
                  </Button>
                  <button
                    className="text-button"
                    onClick={() => setSelectedJobs([])}
                  >
                    Clear
                  </button>
                </div>
              )}
              <section className="panel job-list">
                {jobs.length ? (
                  jobs.map((j) => jobCard(j))
                ) : (
                  <Empty
                    title="No jobs match these filters"
                    description="Try fewer filters, import a job, or add more employer sources."
                  />
                )}
              </section>
            </>
          )}
          {page === "Applications" && (
            <>
              <PageTitle
                eyebrow="EVERY STEP, IN ONE PLACE"
                title="From first click to offer."
                description="Your applications, conversations, and next steps — all connected."
                action={
                  <Button secondary onClick={() => go("Discover Jobs")}>
                    <Plus size={15} />
                    Find a job
                  </Button>
                }
              />
              <div className="toolbar">
                <div className="search-input">
                  <Search size={16} />
                  <input
                    placeholder="Search your applications…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search applications"
                  />
                </div>
                <div className="segmented">
                  {["Board", "Table"].map((t) => (
                    <button
                      className={tab === t ? "selected" : ""}
                      onClick={() => setTab(t)}
                      key={t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {tab === "Board" ? (
                <div className="kanban">
                  {stages.map((stage) => (
                    <section className="kanban-col" key={stage}>
                      <div className="kanban-head">
                        <span className={`stage-dot ${stage.toLowerCase()}`} />
                        <h3>{stage}</h3>
                        <span>
                          {
                            s.applications.filter((a) => a.stage === stage)
                              .length
                          }
                        </span>
                      </div>
                      {s.applications
                        .filter((a) => a.stage === stage)
                        .map((a) => {
                          const j = s.jobs.find((j) => j.id === a.jobId);
                          if (
                            !j ||
                            !`${j.title} ${j.company}`
                              .toLowerCase()
                              .includes(query.toLowerCase())
                          )
                            return null;
                          return (
                            <button
                              className="kanban-card"
                              key={a.id}
                              onClick={() => {
                                setSelected(j);
                                setModal("application");
                              }}
                            >
                              <span className="mini-company">
                                {initials(j.company)}
                              </span>
                              <span className="company-label">{j.company}</span>
                              <h4>{j.title}</h4>
                              <div>
                                <span>
                                  <MapPin size={11} />
                                  {j.location}
                                </span>
                                <ArrowUpRight size={14} />
                              </div>
                              {a.followUp && (
                                <small>
                                  Follow up{" "}
                                  {new Date(a.followUp).toLocaleDateString()}
                                </small>
                              )}
                            </button>
                          );
                        })}
                      <div className="kanban-hint">
                        {stage === "Saved"
                          ? "Save a role to start here"
                          : "Move applications here as they progress"}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="panel table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Role / Company</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>CV version</th>
                        <th>Next step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.applications.map((a) => {
                        const j = s.jobs.find((j) => j.id === a.jobId);
                        if (
                          !j ||
                          !`${j.title} ${j.company}`
                            .toLowerCase()
                            .includes(query.toLowerCase())
                        )
                          return null;
                        return (
                          <tr
                            key={a.id}
                            onClick={() => {
                              setSelected(j);
                              setModal("application");
                            }}
                          >
                            <td>
                              <button className="text-button">{j.title}</button>
                              <small>{j.company}</small>
                            </td>
                            <td>
                              <Badge tone="purple">{a.stage}</Badge>
                            </td>
                            <td>
                              {a.appliedAt
                                ? new Date(a.appliedAt).toLocaleDateString()
                                : "Not submitted"}
                            </td>
                            <td>
                              {s.resumes.find((r) => r.id === a.resumeId)
                                ?.name || "Not recorded"}
                            </td>
                            <td>
                              {a.followUp
                                ? new Date(a.followUp).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!s.applications.length && (
                    <Empty
                      title="Your pipeline starts with one role"
                      description="Save a job from Discover to begin tracking it."
                    />
                  )}
                </div>
              )}
            </>
          )}
          {page === "Resume Studio" && (
            <>
              <PageTitle
                eyebrow="YOUR EXPERIENCE. YOUR STORY."
                title="The right words. All true."
                description="Build tailored, ATS-friendly documents from experience you’ve reviewed."
                action={
                  <Button onClick={() => setModal("profile")}>
                    <Upload size={15} />
                    Manage master CV
                  </Button>
                }
              />
              <div className="studio-banner panel">
                <div className="studio-icon">
                  <FileText size={26} />
                </div>
                <div>
                  <h3>
                    {s.profile.name
                      ? s.profile.name + " — Master profile"
                      : "Start with your professional history"}
                  </h3>
                  <p>
                    {s.profile.evidence.length} verified experience records ·{" "}
                    {s.profile.skills.length} skills ·{" "}
                    {s.profile.confirmed
                      ? "Reviewed and confirmed"
                      : "Review required"}
                  </p>
                </div>
                <Button secondary onClick={() => setModal("profile")}>
                  Review experience <ArrowUpRight size={14} />
                </Button>
              </div>
              <div className="section-heading">
                <h2>Your tailored documents</h2>
                <Badge>{s.resumes.length} versions</Badge>
              </div>
              {s.resumes.length ? (
                <div className="resume-grid">
                  {s.resumes.map((r) => {
                    const j = s.jobs.find((j) => j.id === r.jobId);
                    return (
                      <button
                        className="resume-card panel"
                        key={r.id}
                        onClick={() => {
                          setSelectedResume(r);
                          setModal("resume");
                        }}
                      >
                        <div className="resume-paper">
                          <div />
                          <div />
                          <div />
                          <div />
                          <div />
                          <div />
                        </div>
                        <div className="resume-card-body">
                          <Badge tone={r.ready ? "green" : "amber"}>
                            {r.ready ? "Reviewed" : "Needs review"}
                          </Badge>
                          <h3>{r.name}</h3>
                          <p>{j?.title}</p>
                          <small>
                            {new Date(r.createdAt).toLocaleDateString()} · CV +
                            Cover letter
                          </small>
                        </div>
                        <ArrowUpRight size={17} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={FileText}
                  title="Make your experience relevant."
                  description="Choose an opportunity, then tailor a CV and cover letter using your verified background."
                  action={
                    <Button onClick={() => go("Discover Jobs")}>
                      <Sparkles size={15} />
                      Find a job to tailor for
                    </Button>
                  }
                />
              )}
              <div className="trust-note">
                <ShieldCheck size={18} />
                <div>
                  <strong>A stronger story. Never an invented one.</strong>
                  <p>
                    CVs reorder your reviewed skills and experience. They do not
                    invent employers, metrics, dates, or qualifications.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "Recruitment Inbox" && (
            <>
              <PageTitle
                eyebrow="KEEP THE CONVERSATION MOVING"
                title="Your career conversations."
                description="Recruitment messages, connected to the opportunities behind them."
                action={
                  <Button
                    secondary
                    onClick={() => act("gmail.sync", {}, "Gmail sync queued")}
                    disabled={!s.gmailConnected || busy}
                  >
                    <RefreshCw size={15} />
                    Sync inbox
                  </Button>
                }
              />
              {!s.gmailConnected ? (
                <section className="panel">
                  <Empty
                    icon={Mail}
                    title="A little less inbox archaeology."
                    description="Connect Gmail to sync recruitment replies and send applications with résumé and cover letter attachments."
                    action={
                      <Button
                        onClick={() =>
                          DEMO
                            ? notify(
                                "Gmail OAuth is available in live mode after configuring Google credentials.",
                              )
                            : void connectIntegration("gmail").catch((e) =>
                                notify(e.message),
                              )
                        }
                      >
                        <Link2 size={15} />
                        Connect Gmail
                      </Button>
                    }
                  />
                  <div className="panel-callout">
                    <ShieldCheck size={16} />
                    Messages are read-only. Replies and application changes
                    remain yours to approve.
                  </div>
                </section>
              ) : (
                <section className="panel">
                  {s.threads.length ? (
                    s.threads.map((t) => (
                      <div className="mail-row" key={t.id}>
                        <span className="avatar">{initials(t.sender)}</span>
                        <div>
                          <h3>{t.subject}</h3>
                          <p>{t.sender}</p>
                          <p>{t.snippet}</p>
                          <div className="inline-fields">
                            <select
                              aria-label="Associate email with application"
                              value={t.jobId || ""}
                              onChange={(e) =>
                                act(
                                  "gmail.link",
                                  { id: t.id, jobId: e.target.value || null },
                                  "Conversation association updated",
                                )
                              }
                            >
                              <option value="">
                                Unlinked — choose application
                              </option>
                              {s.applications.map((a) => {
                                const j = s.jobs.find((j) => j.id === a.jobId);
                                return (
                                  j && (
                                    <option key={j.id} value={j.id}>
                                      {j.company}: {j.title}
                                    </option>
                                  )
                                );
                              })}
                            </select>
                            <button
                              className="text-button"
                              onClick={() =>
                                notify(
                                  "Suggested reply: Thank you for getting in touch. I’m interested in learning more about the role. Could you share the next steps and available times?",
                                )
                              }
                            >
                              Suggest reply <Sparkles size={13} />
                            </button>
                          </div>
                        </div>
                        <Badge tone="purple">{t.category}</Badge>
                        <small>{ago(t.date)}</small>
                      </div>
                    ))
                  ) : (
                    <Empty
                      icon={Mail}
                      title="Your recruitment inbox is ready"
                      description="Sync Gmail to import recent recruiting conversations."
                    />
                  )}
                </section>
              )}
            </>
          )}
          {page === "Recruiters" && (
            <>
              <PageTitle
                eyebrow="GOOD RELATIONSHIPS OPEN DOORS"
                title="People behind the possibilities."
                description="Keep contacts, context, and follow-ups together."
                action={
                  <Button
                    onClick={() => {
                      setSelectedRecruiter(null);
                      setModal("recruiter");
                    }}
                  >
                    <Plus size={15} />
                    Add contact
                  </Button>
                }
              />
              {s.recruiters.length ? (
                <div className="contact-grid">
                  {s.recruiters.map((r) => (
                    <article className="panel contact-card" key={r.id}>
                      <div className="contact-top">
                        <span className="avatar">{initials(r.name)}</span>
                        <button
                          className="icon-btn"
                          aria-label={`Delete ${r.name}`}
                          onClick={() =>
                            act(
                              "recruiter.delete",
                              { id: r.id },
                              "Contact removed",
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <h3>{r.name}</h3>
                      <p>{r.company}</p>
                      <a href={`mailto:${r.email}`}>{r.email}</a>
                      <p className="contact-notes">
                        {r.notes || "No notes yet"}
                      </p>
                      {r.followUp && (
                        <Badge tone="amber">Follow up: {r.followUp}</Badge>
                      )}
                      <button
                        className="text-button purple-text recruiter-edit"
                        onClick={() => {
                          setSelectedRecruiter(r);
                          setModal("recruiter");
                        }}
                      >
                        Edit contact <ArrowUpRight size={12} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={Users}
                    title="Every connection starts somewhere."
                    description="Add recruiters, hiring managers, and people you want to follow up with."
                    action={
                      <Button
                        onClick={() => {
                          setSelectedRecruiter(null);
                          setModal("recruiter");
                        }}
                      >
                        <Plus size={15} />
                        Add your first contact
                      </Button>
                    }
                  />
                </section>
              )}
            </>
          )}
          {page === "Interview Prep" && (
            <>
              <PageTitle
                eyebrow="WALK IN PREPARED"
                title="Practice with a purpose."
                description="Prepare for the role, grounded in your own experience."
              />
              <InterviewPanel s={s} notify={notify} />
            </>
          )}
          {page === "Portfolio" && (
            <>
              <PageTitle
                eyebrow="LET YOUR WORK DO THE TALKING"
                title="Your work. Out in the world."
                description="A professional home for your skills, experience, and next opportunity."
                action={
                  <>
                    <a
                      className="btn secondary"
                      href="/portfolio/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye size={15} />
                      View portfolio
                    </a>
                  </>
                }
              />
              <PortfolioEditor
                portfolio={s.portfolio}
                resumes={s.resumes}
                contactRecipient={s.contactRecipient || ""}
                deliveryConfigured={s.emailDeliveryConfigured || false}
                onContactSave={(email) =>
                  act("portfolio.contact-settings", { email })
                }
                onPublish={() =>
                  act(
                    "portfolio.publish",
                    {},
                    DEMO
                      ? "Portfolio published in this browser"
                      : "Portfolio published",
                  )
                }
                onUnpublish={() =>
                  act("portfolio.unpublish", {}, "Portfolio is now private")
                }
                onSave={(p) =>
                  act("portfolio.save", p, "Portfolio draft saved")
                }
              />
              <section className="panel inquiries">
                <div className="panel-header">
                  <h2>Employer inquiries</h2>
                  <Badge>{s.inquiries.length}</Badge>
                </div>
                {s.inquiries.length ? (
                  s.inquiries.map((i) => (
                    <div className="mail-row" key={i.id}>
                      <span className="avatar">{initials(i.name)}</span>
                      <div>
                        <h3>
                          {i.name} · {i.email}
                        </h3>
                        <p>{i.message}</p>
                        <small>{new Date(i.createdAt).toLocaleString()}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={Mail}
                    title="Open to the right conversation."
                    description="Inquiries submitted through your published portfolio will appear here."
                  />
                )}
              </section>
            </>
          )}
          {page === "Analytics" && (
            <>
              <PageTitle
                eyebrow="PROGRESS YOU CAN SEE"
                title="A clearer view of your search."
                description="Use real outcomes to decide where to focus next."
              />
              <div className="stats-grid">
                {[
                  ["Discovered", s.jobs.length],
                  ["Submitted", submitted.length],
                  [
                    "Interview rate",
                    `${submitted.length ? Math.round((interviews.length / submitted.length) * 100) : 0}%`,
                  ],
                  ["Offers", offers.length],
                ].map(([l, v]) => (
                  <div className="stat-card" key={l}>
                    <span className="muted">{l}</span>
                    <div className="stat-value">{v}</div>
                  </div>
                ))}
              </div>
              <div className="analytics-grid">
                <section className="panel">
                  <div className="panel-header">
                    <h2>Applications by stage</h2>
                  </div>
                  <div className="bar-chart">
                    {stages.map((stage) => (
                      <div key={stage}>
                        <span>{stage}</span>
                        <div>
                          <i
                            style={{
                              width: `${s.applications.length ? (s.applications.filter((a) => a.stage === stage).length / s.applications.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <b>
                          {
                            s.applications.filter((a) => a.stage === stage)
                              .length
                          }
                        </b>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h2>Career advisor</h2>
                    <Sparkles size={18} />
                  </div>
                  <div className="advisor-copy">
                    <h3>
                      {!s.profile.country
                        ? "Start with eligibility."
                        : submitted.length < 10
                          ? "Build a meaningful sample."
                          : "Review your conversion."}
                    </h3>
                    <p>
                      {!s.profile.country
                        ? "Set your work country before prioritizing applications. A strong technical match is useful only when the company can hire you."
                        : submitted.length < 10
                          ? "Focus on a small group of eligible, strong-fit roles. Tailor your CV, record submissions, and follow up thoughtfully."
                          : "Compare interview outcomes with your targeting and CV evidence. Improve your positioning before increasing volume."}
                    </p>
                    <Button
                      secondary
                      onClick={() =>
                        !s.profile.country
                          ? setModal("profile")
                          : go("Discover Jobs")
                      }
                    >
                      Take the next step <ArrowRight size={14} />
                    </Button>
                  </div>
                </section>
              </div>
              <div className="trust-note">
                <Activity size={18} />
                <p>
                  Rates use confirmed submissions. Current stage counts are a
                  snapshot, not historical conversion rates.
                </p>
              </div>
            </>
          )}
          {page === "Settings" && (
            <>
              <PageTitle
                eyebrow="MAKE IT WORK FOR YOU"
                title="Your workspace, your way."
                description="Manage your sources, search preferences, and connected accounts."
              />
              <SettingsPanel
                s={s}
                act={act}
                busy={busy}
                notify={notify}
                onProfile={() => setModal("profile")}
              />
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          <span>{toast}</span>
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "profile" && (
        <Modal
          wide
          title="Your professional profile"
          description="Only reviewed facts are used to build your documents."
          onClose={() => setModal(null)}
        >
          <ProfileForm
            profile={s.profile}
            onSave={async (p) => {
              if (
                await act(
                  "profile.save",
                  p,
                  "Profile saved and matches refreshed",
                )
              )
                setModal(null);
            }}
            notify={notify}
          />
        </Modal>
      )}
      {modal === "import" && (
        <Modal
          title="Bring an opportunity in"
          description="Paste the employer link and the job description. We’ll check for duplicates."
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act("job.import", Object.fromEntries(f), "Job imported")
              ) {
                setModal(null);
                go("Discover Jobs");
              }
            }}
          >
            <Field label="Application URL">
              <input
                name="url"
                type="url"
                placeholder="https://company.com/careers/role"
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Company">
                <input name="company" required maxLength={150} />
              </Field>
              <Field label="Job title">
                <input name="title" required maxLength={200} />
              </Field>
            </div>
            <Field label="Location">
              <input name="location" placeholder="As stated in the listing" />
            </Field>
            <Field label="Full job description">
              <textarea
                name="description"
                rows={7}
                required
                maxLength={50000}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              <Plus size={15} />
              Import job
            </Button>
          </form>
        </Modal>
      )}
      {modal === "job" && selected && (
        <Modal
          wide
          title={selected.title}
          description={`${selected.company} · ${selected.location}`}
          onClose={() => setModal(null)}
        >
          <div className="job-detail-metrics">
            <div className="detail-score">
              {matches(selected).score}
              <small>% skill fit</small>
            </div>
            <Badge
              tone={
                matches(selected).eligibility === "Eligible" ? "green" : "amber"
              }
            >
              {matches(selected).eligibility}
            </Badge>
            <Badge>{selected.salary}</Badge>
          </div>
          <div className="match-explanation">
            <h3>Why this match?</h3>
            {matches(selected).reasons.map((r) => (
              <p key={r}>
                <Check size={14} />
                {r}
              </p>
            ))}
            {matches(selected).gaps.length > 0 && (
              <p>
                <TriangleAlert size={14} />
                Skills to review: {matches(selected).gaps.join(", ")}
              </p>
            )}
          </div>
          <pre className="job-description">{selected.description}</pre>
          <div className="modal-actions">
            <Button secondary onClick={() => save(selected)}>
              <Bookmark size={15} />
              Save job
            </Button>
            <Button
              secondary
              onClick={() => {
                setModal("generate");
              }}
            >
              <Sparkles size={15} />
              Tailor CV
            </Button>
            <Button onClick={() => open(selected)}>
              Open application <ExternalLink size={15} />
            </Button>
            <button
              className="icon-btn"
              aria-label={
                selected.hidden ? "Restore this job" : "Hide this job"
              }
              onClick={() => {
                act(
                  "job.hide",
                  { id: selected.id },
                  selected.hidden ? "Job restored" : "Job hidden",
                );
                setModal(null);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <p className="fine-print">
            Opening the employer page does not mark this job as applied.
          </p>
        </Modal>
      )}
      {modal === "generate" && selected && (
        <Modal
          title="Your experience, tailored"
          description={`${selected.company} · ${selected.title}`}
          onClose={() => setModal(null)}
        >
          <div className="generation-summary">
            <Sparkles size={26} />
            <h3>Make the relevant experience stand out.</h3>
            <p>
              We’ll prioritize your verified skills and experience for this role
              and create a CV plus cover letter.
            </p>
            <Badge tone="green">No invented achievements</Badge>
          </div>
          <Field label="Career mode">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {s.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="modal-actions">
            <Button
              disabled={busy || !s.profile.confirmed}
              onClick={async () => {
                if (
                  await act(
                    "resume.generate",
                    { jobId: selected.id, modeId: mode },
                    DEMO
                      ? "CV generated — review it in Resume Studio"
                      : "Generation queued. Your documents will appear in Resume Studio.",
                  )
                ) {
                  setModal(null);
                  go("Resume Studio");
                }
              }}
            >
              <Sparkles size={15} />
              {busy ? "Preparing…" : "Generate CV & cover letter"}
            </Button>
            {!s.profile.confirmed && (
              <Button secondary onClick={() => setModal("profile")}>
                Review your experience first
              </Button>
            )}
          </div>
        </Modal>
      )}
      {modal === "resume" && selectedResume && (
        <Modal
          wide
          title={selectedResume.name}
          description="Review against your master profile before using this version."
          onClose={() => setModal(null)}
        >
          <ResumePreview
            resume={
              s.resumes.find((r) => r.id === selectedResume.id) ||
              selectedResume
            }
            profile={s.profile}
            onApprove={() =>
              act(
                "resume.ready",
                { id: selectedResume.id },
                "CV approved for use",
              )
            }
            notify={notify}
          />
        </Modal>
      )}
      {modal === "application" && selected && (
        <Modal
          wide
          title="Application details"
          description={`${selected.company} · ${selected.title}`}
          onClose={() => setModal(null)}
        >
          <ApplicationForm
            app={s.applications.find((a) => a.jobId === selected.id)}
            job={selected}
            gmailConnected={!!s.gmailConnected}
            resumes={s.resumes.filter(
              (r) => r.jobId === selected.id && r.ready,
            )}
            onSave={async (d) => {
              if (await act("application.update", d, "Application updated"))
                setModal(null);
            }}
            onCompose={async () => {
              await act(
                "application.compose",
                { jobIds: [selected.id], modeId: mode },
                "Application email queued",
              );
            }}
            onSend={async (applicationId, resumeId) => {
              await act(
                "application.send",
                { id: applicationId, resumeId },
                "Sending via Gmail…",
              );
            }}
            onOpen={() => open(selected)}
            onGenerate={() => setModal("generate")}
            onReapply={async () => {
              const a = s.applications.find((a) => a.jobId === selected.id);
              if (
                a &&
                (await act(
                  "application.reapply",
                  { id: a.id },
                  "Reapplication started; previous submission retained in the timeline",
                ))
              )
                setModal(null);
            }}
            busy={busy}
          />
        </Modal>
      )}
      {modal === "recruiter" && (
        <Modal
          title={selectedRecruiter ? "Update connection" : "A new connection"}
          description="Keep the context that makes following up easier."
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(
                  "recruiter.save",
                  {
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                    ...(selectedRecruiter ? { id: selectedRecruiter.id } : {}),
                  },
                  selectedRecruiter ? "Contact updated" : "Contact added",
                )
              )
                setModal(null);
            }}
          >
            <Field label="Full name">
              <input
                name="name"
                required
                defaultValue={selectedRecruiter?.name}
              />
            </Field>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                required
                defaultValue={selectedRecruiter?.email}
              />
            </Field>
            <Field label="Company">
              <input
                name="company"
                required
                defaultValue={selectedRecruiter?.company}
              />
            </Field>
            <Field label="Notes">
              <textarea
                name="notes"
                rows={3}
                defaultValue={selectedRecruiter?.notes}
              />
            </Field>
            <Field label="Follow-up date">
              <input
                name="followUp"
                type="date"
                defaultValue={selectedRecruiter?.followUp}
              />
            </Field>
            <Button type="submit">
              Save contact <Check size={15} />
            </Button>
          </form>
        </Modal>
      )}
      {modal === "notifications" && (
        <Modal title="Your workspace updates" onClose={() => setModal(null)}>
          {s.tasks.length ? (
            s.tasks.map((t) => (
              <div className="task-row" key={t.id}>
                <Badge
                  tone={
                    t.status === "failed"
                      ? "red"
                      : t.status === "completed"
                        ? "green"
                        : "purple"
                  }
                >
                  {t.status}
                </Badge>
                <div>
                  <h4>{t.type}</h4>
                  <p>{t.message}</p>
                  <small>{ago(t.createdAt)}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              icon={Bell}
              title="You’re all caught up."
              description="Scan progress, document generation, and reminders appear here."
            />
          )}
          {s.recruiters
            .filter(
              (r) =>
                r.followUp &&
                r.followUp <= new Date().toISOString().slice(0, 10),
            )
            .map((r) => (
              <div className="task-row" key={r.id}>
                <Clock size={18} />
                <p>
                  Follow up with {r.name} at {r.company}
                </p>
              </div>
            ))}
        </Modal>
      )}
    </div>
  );
}
function ArrowDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M3 2v8m0 0L1 8m2 2 2-2M7 3h4M7 6h3M7 9h2"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}
function pipelineGradient(apps: Application[]) {
  const colors = [
    "#a78bfa",
    "#6688ed",
    "#edb35a",
    "#e48cb6",
    "#57bca0",
    "#a66370",
    "#617084",
  ];
  if (!apps.length) return "#252633";
  let offset = 0;
  return `conic-gradient(${stages
    .map((stage, i) => {
      const start = offset;
      offset +=
        (apps.filter((a) => a.stage === stage).length / apps.length) * 100;
      return `${colors[i]} ${start}% ${offset}%`;
    })
    .join(",")})`;
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title inner-page-title">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {action && <div className="title-actions">{action}</div>}
    </div>
  );
}
function ProfileForm({
  profile,
  onSave,
  notify,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  notify: (s: string) => void;
}) {
  const [p, setP] = useState(structuredClone(profile));
  const [raw, setRaw] = useState("");
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    if (DEMO) {
      notify(
        "In demo mode, paste experience below. PDF/DOCX import is available with the live API.",
      );
      return;
    }
    setUploading(true);
    try {
      const f = new FormData();
      f.append("file", file);
      const r = await apiFetch(`${API}/api/resume/import`, {
        method: "POST",
        credentials: "include",
        body: f,
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.message);
      setRaw(body.text);
      notify(
        "Document text extracted. Review it and add verified experience records below.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!p.country.trim()) {
          notify("Enter your actual work country.");
          return;
        }
        if (
          p.confirmed &&
          (!p.evidence.length ||
            p.evidence.some(
              (x) => !x.text.trim() || !x.company.trim() || !x.role.trim(),
            ))
        ) {
          notify(
            "Add complete experience records before confirming your profile.",
          );
          return;
        }
        try {
          new Intl.DateTimeFormat("en", { timeZone: p.timezone });
        } catch {
          notify("Enter a valid timezone such as Europe/London.");
          return;
        }
        onSave(p);
      }}
    >
      <div className="form-grid">
        <Field label="Full name">
          <input
            required
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </Field>
        <Field label="Professional headline">
          <input
            required
            value={p.headline}
            onChange={(e) => setP({ ...p, headline: e.target.value })}
          />
        </Field>
        <Field label="CV contact email">
          <input
            type="email"
            value={p.contactEmail || ""}
            onChange={(e) => setP({ ...p, contactEmail: e.target.value })}
          />
        </Field>
        <Field label="CV phone (optional)">
          <input
            type="tel"
            value={p.phone || ""}
            onChange={(e) => setP({ ...p, phone: e.target.value })}
          />
        </Field>
        <Field label="Portfolio URL (optional)">
          <input
            type="url"
            value={p.portfolioUrl || ""}
            onChange={(e) => setP({ ...p, portfolioUrl: e.target.value })}
          />
        </Field>
        <Field
          label="Actual work country"
          hint="Use your country of residence, not the employer’s country."
        >
          <input
            required
            placeholder="e.g. Canada"
            value={p.country}
            onChange={(e) => setP({ ...p, country: e.target.value })}
          />
        </Field>
        <Field label="Timezone">
          <input
            required
            value={p.timezone}
            placeholder="Europe/London"
            onChange={(e) => setP({ ...p, timezone: e.target.value })}
          />
        </Field>
        <Field label="Annual salary preference (USD)">
          <input
            type="number"
            min="0"
            value={p.salaryMin || ""}
            onChange={(e) => setP({ ...p, salaryMin: +e.target.value })}
          />
        </Field>
        <Field label="Employment preference">
          <select
            value={p.employment}
            onChange={(e) => setP({ ...p, employment: e.target.value })}
          >
            <option>Full-time or contract</option>
            <option>Full-time</option>
            <option>Contract</option>
          </select>
        </Field>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={p.usWorkAuthorized || false}
          onChange={(e) => setP({ ...p, usWorkAuthorized: e.target.checked })}
        />
        I have current US work authorization
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={p.needsSponsorship || false}
          onChange={(e) => setP({ ...p, needsSponsorship: e.target.checked })}
        />
        I need visa sponsorship for relocation
      </label>
      <Field
        label="Your skills"
        hint="Comma separated. Include only skills you can substantiate."
      >
        <textarea
          rows={2}
          value={p.skills.join(", ")}
          onChange={(e) =>
            setP({
              ...p,
              skills: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              confirmed: false,
            })
          }
        />
      </Field>
      <div className="upload-zone">
        <Upload size={21} />
        <div>
          <strong>Import your existing CV</strong>
          <p>
            {uploading
              ? "Extracting text…"
              : "PDF, DOCX, or TXT · maximum 5 MB · review before use"}
          </p>
        </div>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          aria-label="Import master resume"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>
      {raw && (
        <Field label="Extracted CV text — review and copy relevant facts below">
          <textarea
            rows={7}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </Field>
      )}
      <div className="section-heading">
        <h3>Experience library</h3>
        <button
          className="text-button purple-text"
          type="button"
          onClick={() =>
            setP({
              ...p,
              confirmed: false,
              evidence: [
                ...p.evidence,
                {
                  id: crypto.randomUUID(),
                  company: "",
                  role: "",
                  start: "",
                  end: "",
                  text: "",
                },
              ],
            })
          }
        >
          <Plus size={14} />
          Add experience
        </button>
      </div>
      {p.evidence.map((record, i) => (
        <div className="evidence-card" key={record.id}>
          <div className="evidence-top">
            <span>EXPERIENCE {i + 1}</span>
            <button
              className="icon-btn"
              aria-label="Remove experience"
              onClick={() =>
                setP({
                  ...p,
                  confirmed: false,
                  evidence: p.evidence.filter((e) => e.id !== record.id),
                })
              }
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="form-grid">
            {(["company", "role", "start", "end"] as const).map((key) => (
              <Field
                key={key}
                label={
                  key === "start"
                    ? "Start date"
                    : key === "end"
                      ? "End date / Present"
                      : key === "role"
                        ? "Job title"
                        : "Company"
                }
              >
                <input
                  required
                  value={record[key]}
                  onChange={(e) =>
                    setP({
                      ...p,
                      confirmed: false,
                      evidence: p.evidence.map((x) =>
                        x.id === record.id
                          ? { ...x, [key]: e.target.value }
                          : x,
                      ),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Verified achievement or responsibility">
            <textarea
              required
              rows={3}
              value={record.text}
              onChange={(e) =>
                setP({
                  ...p,
                  confirmed: false,
                  evidence: p.evidence.map((x) =>
                    x.id === record.id ? { ...x, text: e.target.value } : x,
                  ),
                })
              }
            />
          </Field>
        </div>
      ))}
      <label className="checkbox confirmation">
        <input
          type="checkbox"
          checked={p.confirmed}
          onChange={(e) => setP({ ...p, confirmed: e.target.checked })}
        />
        I have reviewed these facts. They accurately represent my professional
        experience.
      </label>
      <Button type="submit">
        <Check size={15} />
        Save profile & refresh matches
      </Button>
    </form>
  );
}
function ResumePreview({
  resume,
  profile,
  onApprove,
  notify,
}: {
  resume: Resume;
  profile: Profile;
  onApprove: () => void;
  notify: (s: string) => void;
}) {
  const [view, setView] = useState("CV");
  function download() {
    const blob = new Blob(
      [view === "CV" ? resume.content : resume.coverLetter],
      { type: "text/plain" },
    );
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${resume.name}-${view}.txt`;
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <>
      <div className="resume-preview-toolbar">
        <div className="segmented">
          {["CV", "Cover letter", "Compare"].map((x) => (
            <button
              className={view === x ? "selected" : ""}
              key={x}
              onClick={() => setView(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <Badge tone={resume.ready ? "green" : "amber"}>
          {resume.ready ? "Approved" : "Review required"}
        </Badge>
      </div>
      {view === "Compare" ? (
        <div className="comparison">
          <div>
            <h4>Master evidence</h4>
            {profile.evidence.map((e) => (
              <p key={e.id}>{e.text}</p>
            ))}
          </div>
          <div>
            <h4>Included in this version</h4>
            {resume.evidenceIds.map((id) => (
              <p key={id}>
                <Check size={13} />
                {profile.evidence.find((e) => e.id === id)?.text ||
                  "Original evidence retained in document"}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <pre className="document-preview">
          {view === "CV" ? resume.content : resume.coverLetter}
        </pre>
      )}
      <div className="modal-actions">
        {!resume.ready && (
          <Button onClick={onApprove}>
            <CheckCheck size={15} />I reviewed this CV
          </Button>
        )}
        {DEMO ? (
          <Button secondary onClick={download}>
            <Download size={15} />
            Download TXT
          </Button>
        ) : (
          <>
            <a
              className="btn secondary"
              href={`${API}/api/resumes/${resume.id}/download?format=pdf&kind=${view === "Cover letter" ? "cover" : "cv"}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={15} />
              PDF
            </a>
            <a
              className="btn secondary"
              href={`${API}/api/resumes/${resume.id}/download?format=docx&kind=${view === "Cover letter" ? "cover" : "cv"}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={15} />
              DOCX
            </a>
          </>
        )}
        <Button
          secondary
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                view === "Cover letter" ? resume.coverLetter : resume.content,
              );
              notify("Copied to clipboard");
            } catch {
              notify(
                "Clipboard unavailable. Select and copy the document text.",
              );
            }
          }}
        >
          <Copy size={14} />
          Copy
        </Button>
      </div>
      {DEMO && (
        <p className="fine-print">
          Demo exports plain text. Live mode provides formatted PDF and DOCX
          files.
        </p>
      )}
    </>
  );
}
function PortfolioEditor({
  portfolio,
  resumes,
  onSave,
  onPublish,
  onUnpublish,
  contactRecipient,
  deliveryConfigured,
  onContactSave,
}: {
  portfolio: Portfolio;
  contactRecipient: string;
  deliveryConfigured: boolean;
  onContactSave: (email: string) => Promise<boolean>;
  onPublish: () => Promise<boolean>;
  onUnpublish: () => Promise<boolean>;
  resumes: Resume[];
  onSave: (p: Portfolio) => Promise<boolean>;
}) {
  const [p, setP] = useState(portfolioDefaults(structuredClone(portfolio)));
  const [recipient, setRecipient] = useState(contactRecipient);
  const [importStatus, setImportStatus] = useState("");
  const [extracted, setExtracted] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      if (!(await onContactSave(recipient))) return false;
      return await onSave(p);
    } finally {
      setSaving(false);
    }
  }
  async function importCv(file: File) {
    setImportStatus("Reading your CV and preparing an editable draft…");
    try {
      if (DEMO) {
        if (!/\.txt$/i.test(file.name))
          throw Error(
            "Use a TXT CV in demo mode. PDF and DOCX import are available in the live app.",
          );
        const text = await file.text();
        const fileUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const lines = text
          .split(/\n/)
          .map((x) => x.trim())
          .filter(Boolean);
        setP((prev) => ({
          ...prev,
          name: lines[0] || prev.name,
          headline: lines[1] || prev.headline,
          bio: text.slice(0, 1000),
          resume: { url: fileUrl, name: file.name },
        }));
        setExtracted(text);
      } else {
        const form = new FormData();
        form.append("file", file);
        const response = await apiFetch(`${API}/api/portfolio/from-cv`, {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(result.message || "Could not import this CV.");
        const { reviewRequired, extractedText, ...fields } = result;
        setExtracted(extractedText);
        setP((prev) => ({ ...prev, ...fields }));
      }
      setImportStatus(
        "Draft created. Review extracted details and complete missing fields before saving. Your public portfolio has not changed.",
      );
    } catch (error) {
      setImportStatus((error as Error).message);
    }
  }

  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="panel settings-section cv-portfolio-start">
        <div className="panel-header">
          <div>
            <h2>Start with your CV</h2>
            <p>
              Generate one editable portfolio draft from your existing
              experience.
            </p>
          </div>
          <FileText size={22} />
        </div>
        <label className="upload-zone">
          <Upload size={23} />
          <div>
            <strong>Upload CV & create portfolio</strong>
            <p>PDF, DOCX, or TXT · up to 5 MB · always starts as a draft</p>
          </div>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            aria-label="Create portfolio from CV"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCv(file);
            }}
          />
        </label>
        {importStatus && (
          <p className="fine-print" role="status">
            {importStatus}
          </p>
        )}
        {extracted && (
          <details>
            <summary>Review extracted CV text</summary>
            <pre className="cv-extracted">{extracted}</pre>
          </details>
        )}
      </section>
      <PortfolioDesigner value={p} onChange={setP} />
      <section className="panel settings-section">
        <div className="panel-header">
          <div>
            <h2>The introduction</h2>
            <p>Make it clear what you do, and why it matters.</p>
          </div>
          <Badge tone={portfolio.published ? "green" : "amber"}>
            {portfolio.published ? "Published · editing draft" : "Draft"}
          </Badge>
        </div>
        <div className="form-grid">
          <Field label="Display name">
            <input
              required
              value={p.name}
              onChange={(e) => setP({ ...p, name: e.target.value })}
            />
          </Field>
          <Field label="Profile image URL">
            <input
              type="url"
              value={p.avatar || ""}
              onChange={(e) => setP({ ...p, avatar: e.target.value })}
            />
          </Field>
          <MediaUpload
            label="Upload profile image"
            accept="image/png,image/jpeg,image/webp"
            onUploaded={(url) => setP((prev) => ({ ...prev, avatar: url }))}
          />
          <Field label="Headline">
            <input
              required
              value={p.headline}
              onChange={(e) => setP({ ...p, headline: e.target.value })}
            />
          </Field>
          <Field label="Public location / availability">
            <input
              value={p.location}
              onChange={(e) => setP({ ...p, location: e.target.value })}
            />
          </Field>
          <Field label="Public contact email (optional)">
            <input
              type="email"
              value={p.email}
              onChange={(e) => setP({ ...p, email: e.target.value })}
            />
          </Field>
          <Field label="GitHub URL">
            <input
              type="url"
              value={p.github}
              onChange={(e) => setP({ ...p, github: e.target.value })}
            />
          </Field>
          <Field label="Public CV">
            <select
              value={p.publicResumeId || ""}
              onChange={(e) =>
                setP({ ...p, publicResumeId: e.target.value || null })
              }
            >
              <option value="">No public download</option>
              {resumes
                .filter((r) => r.ready)
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label="About you">
          <textarea
            rows={4}
            value={p.bio}
            onChange={(e) => setP({ ...p, bio: e.target.value })}
          />
        </Field>
        <Field label="Public skills">
          <input
            value={p.skills.join(", ")}
            onChange={(e) =>
              setP({
                ...p,
                skills: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      </section>
      <section className="panel settings-section">
        <div className="panel-header">
          <div>
            <h2>Selected work</h2>
            <p>Show the problem, your decisions, and the outcome.</p>
          </div>
          <Button
            secondary
            small
            onClick={() =>
              setP({
                ...p,
                projects: [
                  ...p.projects,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    description: "",
                    tags: [],
                    url: "",
                    image: "",
                  },
                ],
              })
            }
          >
            <Plus size={14} />
            Add project
          </Button>
        </div>
        {p.projects.map((project, i) => (
          <div className="evidence-card" key={project.id}>
            <div className="evidence-top">
              <span>PROJECT {i + 1}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove project"
                onClick={() =>
                  setP({
                    ...p,
                    projects: p.projects.filter((x) => x.id !== project.id),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              {(
                ["title", "url", "repositoryUrl", "image", "video"] as const
              ).map((k) => (
                <Field
                  label={
                    k === "title"
                      ? "Project name"
                      : k === "url"
                        ? "Live product URL"
                        : k === "repositoryUrl"
                          ? "GitHub / repository URL (fallback)"
                          : k === "image"
                            ? "Screenshot URL"
                            : "Video URL (MP4)"
                  }
                  key={k}
                >
                  <input
                    type={k === "title" ? "text" : "url"}
                    required={k === "title"}
                    value={project[k] || ""}
                    onChange={(e) =>
                      setP({
                        ...p,
                        projects: p.projects.map((x) =>
                          x.id === project.id
                            ? { ...x, [k]: e.target.value }
                            : x,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Technologies">
                <input
                  value={project.tags.join(", ")}
                  onChange={(e) =>
                    setP({
                      ...p,
                      projects: p.projects.map((x) =>
                        x.id === project.id
                          ? {
                              ...x,
                              tags: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : x,
                      ),
                    })
                  }
                />
              </Field>
            </div>
            <div className="media-upload-row">
              <MediaUpload
                label="Upload screenshot"
                accept="image/png,image/jpeg,image/webp"
                onUploaded={(url) =>
                  setP({
                    ...p,
                    projects: p.projects.map((x) =>
                      x.id === project.id ? { ...x, image: url } : x,
                    ),
                  })
                }
              />
              <MediaUpload
                label="Upload video"
                accept="video/mp4"
                onUploaded={(url) =>
                  setP({
                    ...p,
                    projects: p.projects.map((x) =>
                      x.id === project.id ? { ...x, video: url } : x,
                    ),
                  })
                }
              />
            </div>
            <Field label="Case study">
              <textarea
                rows={4}
                value={project.description}
                onChange={(e) =>
                  setP({
                    ...p,
                    projects: p.projects.map((x) =>
                      x.id === project.id
                        ? { ...x, description: e.target.value }
                        : x,
                    ),
                  })
                }
              />
            </Field>
          </div>
        ))}
      </section>
      <section className="panel settings-section">
        <div className="panel-header">
          <h2>Public experience</h2>
          <Button
            small
            secondary
            onClick={() =>
              setP({
                ...p,
                experience: [
                  ...p.experience,
                  {
                    id: crypto.randomUUID(),
                    company: "",
                    role: "",
                    start: "",
                    end: "",
                    text: "",
                  },
                ],
              })
            }
          >
            <Plus size={14} />
            Add experience
          </Button>
        </div>
        {p.experience.map((x) => (
          <div key={x.id} className="evidence-card">
            <div className="form-grid">
              {(["company", "role", "start", "end"] as const).map((k) => (
                <Field key={k} label={k}>
                  <input
                    required
                    value={x[k]}
                    onChange={(e) =>
                      setP({
                        ...p,
                        experience: p.experience.map((y) =>
                          y.id === x.id ? { ...y, [k]: e.target.value } : y,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Description">
              <textarea
                value={x.text}
                onChange={(e) =>
                  setP({
                    ...p,
                    experience: p.experience.map((y) =>
                      y.id === x.id ? { ...y, text: e.target.value } : y,
                    ),
                  })
                }
              />
            </Field>
            <Button
              small
              secondary
              onClick={() =>
                setP({
                  ...p,
                  experience: p.experience.filter((y) => y.id !== x.id),
                })
              }
            >
              <Trash2 size={13} />
              Remove
            </Button>
          </div>
        ))}
      </section>
      <section className="panel settings-section">
        <div className="panel-header">
          <div>
            <h2>Your résumé</h2>
            <p>Include the CV that employers should download.</p>
          </div>
          <Download size={20} />
        </div>
        <Field label="Résumé URL">
          <input
            type="url"
            value={p.resume?.url || ""}
            onChange={(e) =>
              setP({
                ...p,
                resume: {
                  url: e.target.value,
                  name: p.resume?.name || "Résumé",
                },
              })
            }
          />
        </Field>
        <MediaUpload
          label="Upload résumé"
          accept=".pdf,.docx,.txt"
          onUploaded={(url) =>
            setP((prev) => ({
              ...prev,
              resume: { url, name: "Professional résumé" },
            }))
          }
        />
        {p.resume?.url && (
          <p className="fine-print">
            Your résumé will be public only after publication. Remove the URL to
            hide it.
          </p>
        )}
      </section>
      <section className="panel settings-section">
        <div className="panel-header">
          <div>
            <h2>Certifications</h2>
            <p>Credentials, certificates, and professional learning.</p>
          </div>
          <Button
            secondary
            small
            onClick={() =>
              setP({
                ...p,
                certifications: [
                  ...(p.certifications || []),
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    issuer: "",
                    issuedAt: "",
                    credentialUrl: "",
                    image: "",
                    description: "",
                  },
                ],
              })
            }
          >
            <Plus size={14} />
            Add certification
          </Button>
        </div>
        {(p.certifications || []).map((cert) => (
          <div className="evidence-card" key={cert.id}>
            <div className="evidence-top">
              <span>CERTIFICATION</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove certification"
                onClick={() =>
                  setP({
                    ...p,
                    certifications: p.certifications?.filter(
                      (x) => x.id !== cert.id,
                    ),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="form-grid">
              {(
                [
                  "name",
                  "issuer",
                  "issuedAt",
                  "credentialUrl",
                  "image",
                ] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      name: "Certification name",
                      issuer: "Issued by",
                      issuedAt: "Date awarded",
                      credentialUrl: "Credential URL",
                      image: "Certificate image / PDF URL",
                    }[key]
                  }
                >
                  <input
                    required={key === "name"}
                    type={
                      key === "credentialUrl" || key === "image"
                        ? "url"
                        : "text"
                    }
                    value={cert[key]}
                    onChange={(e) =>
                      setP({
                        ...p,
                        certifications: p.certifications?.map((x) =>
                          x.id === cert.id
                            ? { ...x, [key]: e.target.value }
                            : x,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                value={cert.description}
                onChange={(e) =>
                  setP({
                    ...p,
                    certifications: p.certifications?.map((x) =>
                      x.id === cert.id
                        ? { ...x, description: e.target.value }
                        : x,
                    ),
                  })
                }
              />
            </Field>
            <MediaUpload
              label="Upload certificate"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onUploaded={(url, mime) =>
                setP((prev) => ({
                  ...prev,
                  certifications: prev.certifications?.map((x) =>
                    x.id === cert.id
                      ? {
                          ...x,
                          image: url,
                          documentType:
                            mime === "application/pdf" ? "pdf" : "image",
                        }
                      : x,
                  ),
                }))
              }
            />
          </div>
        ))}
      </section>
      <section className="panel settings-section">
        <div className="panel-header">
          <div>
            <h2>Contact delivery</h2>
            <p>Receive the complete inquiry directly in your personal inbox.</p>
          </div>
          <Mail size={20} />
        </div>
        <Field
          label="Personal email — private destination"
          hint="This destination is not exposed on the public portfolio."
        >
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <p className="fine-print">
          {deliveryConfigured
            ? "Email delivery is configured. Visitors can send inquiries through your public contact form."
            : "Configure SMTP or Resend and a verified sender in Settings/environment to activate email delivery. In demo mode no email is sent."}
        </p>
      </section>
      <div className="save-bar">
        <span>
          {portfolio.published
            ? "Your published version stays live while you edit this draft."
            : "Your portfolio is private until you publish."}
        </span>
        <div className="portfolio-save-actions">
          <Button type="submit" disabled={saving}>
            <Check size={15} />
            Save portfolio draft
          </Button>
          <Button
            secondary
            disabled={saving}
            onClick={async () => {
              const tab = window.open("about:blank", "_blank");
              if (await save()) {
                if (tab) tab.location.href = "/portfolio/preview";
              } else tab?.close();
            }}
          >
            <Eye size={15} />
            Preview draft
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (await save()) await onPublish();
            }}
          >
            <Globe size={15} />
            Publish portfolio
          </Button>
          {portfolio.published && (
            <Button secondary onClick={onUnpublish}>
              Unpublish
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
function SettingsPanel({
  s,
  act,
  busy,
  notify,
  onProfile,
}: {
  s: AppState;
  act: (a: string, d?: any, message?: string) => Promise<boolean>;
  busy: boolean;
  notify: (s: string) => void;
  onProfile: () => void;
}) {
  const [settings, setSettings] = useState(s.settings);
  const [modeId, setModeId] = useState(s.modes[0]?.id || "fullstack");
  const m = s.modes.find((x) => x.id === modeId);
  const [editingMode, setEditingMode] = useState<CareerMode | null>(null);
  return (
    <div className="settings-grid">
      <div>
        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>Daily discovery</h2>
              <p>A collection target, across all four career modes.</p>
            </div>
            <ScanLine size={19} />
          </div>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              act("settings.save", settings, "Discovery preferences saved");
            }}
          >
            <div className="form-grid">
              <Field label="Daily collection target">
                <select
                  value={settings.dailyTarget}
                  onChange={(e) =>
                    setSettings({ ...settings, dailyTarget: +e.target.value })
                  }
                >
                  {[100, 200, 250, 300, 400, 500].map((n) => (
                    <option key={n} value={n}>
                      {n} listings
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Scan time (${s.profile.timezone})`}>
                <input
                  type="time"
                  value={settings.scanTime}
                  onChange={(e) =>
                    setSettings({ ...settings, scanTime: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field
              label="Monthly AI spending ceiling (USD)"
              hint="Workers reserve budget before external AI requests. Deterministic generation remains available."
            >
              <input
                type="number"
                min="0"
                max="1000"
                value={settings.aiBudget}
                onChange={(e) =>
                  setSettings({ ...settings, aiBudget: +e.target.value })
                }
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.scanEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, scanEnabled: e.target.checked })
                }
              />
              Enable daily scheduled scans
            </label>
            <Button type="submit" small disabled={busy}>
              Save preferences
            </Button>
          </form>
        </section>
        <section className="panel settings-section">
          <div className="panel-header">
            <div>
              <h2>Employer sources</h2>
              <p>Add known employer boards to grow your discovery coverage.</p>
            </div>
            <Building2 size={19} />
          </div>
          {s.sources.map((source) => (
            <div className="source-row" key={source.id}>
              <span className="mini-company">{initials(source.company)}</span>
              <div>
                <h4>{source.company}</h4>
                <small>
                  {source.provider} · {source.board}
                </small>
                {source.lastError && (
                  <p className="error-text">{source.lastError}</p>
                )}
                {source.lastRun && (
                  <small>Last scan {ago(source.lastRun)}</small>
                )}
              </div>
              <button
                className={`toggle ${source.enabled ? "on" : ""}`}
                aria-label={`${source.enabled ? "Disable" : "Enable"} ${source.company}`}
                aria-pressed={source.enabled}
                onClick={() => act("source.toggle", { id: source.id })}
              >
                <span />
              </button>
            </div>
          ))}
          <form
            className="form-stack source-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (
                await act(
                  "source.add",
                  Object.fromEntries(new FormData(form)),
                  "Employer source added",
                )
              )
                form.reset();
            }}
          >
            <div className="form-grid">
              <Field label="Company">
                <input name="company" placeholder="Acme" required />
              </Field>
              <Field label="Provider">
                <select name="provider">
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                </select>
              </Field>
            </div>
            <Field
              label="Board identifier"
              hint="The company’s board token/slug from its ATS careers URL."
            >
              <input
                name="board"
                required
                pattern="[a-zA-Z0-9_-]+"
                placeholder="acme"
              />
            </Field>
            <Button secondary type="submit" small>
              <Plus size={14} />
              Add source
            </Button>
          </form>
        </section>
        <section className="panel settings-section">
          <div className="panel-header">
            <h2>Career modes</h2>
            <Layers size={18} />
          </div>
          <select
            aria-label="Edit career mode"
            value={modeId}
            onChange={(e) => {
              setModeId(e.target.value);
              setEditingMode(null);
            }}
          >
            {s.modes.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {m && (
            <form
              className="form-stack source-form"
              onSubmit={(e) => {
                e.preventDefault();
                act(
                  "mode.save",
                  editingMode || m,
                  "Career mode saved and matches refreshed",
                );
              }}
            >
              <Field label="Target titles">
                <input
                  value={(editingMode || m).titles.join(", ")}
                  onChange={(e) =>
                    setEditingMode({
                      ...(editingMode || m),
                      titles: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="Matching skills">
                <input
                  value={(editingMode || m).keywords.join(", ")}
                  onChange={(e) =>
                    setEditingMode({
                      ...(editingMode || m),
                      keywords: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <div className="form-grid">
                {(["skills", "title", "evidence"] as const).map((k) => (
                  <Field key={k} label={`${k} weight (%)`}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        (editingMode || m).weights?.[k] ??
                        { skills: 60, title: 25, evidence: 15 }[k]
                      }
                      onChange={(e) =>
                        setEditingMode({
                          ...(editingMode || m),
                          weights: {
                            ...((editingMode || m).weights || {
                              skills: 60,
                              title: 25,
                              evidence: 15,
                            }),
                            [k]: +e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="fine-print">
                Weights must total 100. These affect fit scores, not
                eligibility.
              </p>
              <Button secondary type="submit" small>
                Save career mode
              </Button>
            </form>
          )}
        </section>
      </div>
      <div>
        <section className="panel settings-section">
          <div className="panel-header">
            <h2>Connected accounts</h2>
            <Link2 size={18} />
          </div>
          {[
            ["Gmail", "Read-only recruitment inbox", s.gmailConnected],
            [
              "LinkedIn",
              "Basic identity & manual job imports",
              !!s.linkedinConnected,
            ],
            ["Indeed", "Job links & manual imports", false],
          ].map(([name, desc, connected]) => (
            <div className="integration-card" key={String(name)}>
              <div className={`integration-logo ${String(name).toLowerCase()}`}>
                {name === "Gmail" ? (
                  <Mail size={20} />
                ) : name === "LinkedIn" ? (
                  "in"
                ) : (
                  "i"
                )}
              </div>
              <div>
                <h4>{String(name)}</h4>
                <small>{String(desc)}</small>
              </div>
              {name === "Gmail" ? (
                <button
                  className="text-button purple-text"
                  onClick={() => {
                    if (DEMO)
                      notify("Connect Gmail after configuring the live API.");
                    else if (connected)
                      act("gmail.disconnect", {}, "Gmail disconnected");
                    else
                      void connectIntegration("gmail").catch((e) =>
                        notify(e.message),
                      );
                  }}
                >
                  {connected ? "Disconnect" : "Connect"}
                </button>
              ) : name === "LinkedIn" ? (
                <div className="linkedin-actions">
                  <button
                    className="text-button purple-text"
                    onClick={() => {
                      if (DEMO)
                        notify(
                          "Basic LinkedIn OAuth is available after configuring approved OpenID Connect credentials.",
                        );
                      else if (connected)
                        act("linkedin.disconnect", {}, "LinkedIn disconnected");
                      else
                        void connectIntegration("linkedin").catch((e) =>
                          notify(e.message),
                        );
                    }}
                  >
                    {connected ? "Disconnect" : "Connect"}
                  </button>
                  {connected && (
                    <button
                      className="text-button purple-text"
                      onClick={() =>
                        act(
                          "linkedin.import",
                          {},
                          "LinkedIn name and verified email imported. Work history remains reviewed separately.",
                        )
                      }
                    >
                      Import identity
                    </button>
                  )}
                </div>
              ) : (
                <Badge>Import</Badge>
              )}
            </div>
          ))}
          <p className="fine-print">
            Full LinkedIn and Indeed account sync depends on approved access.
            Import links without connecting an account.
          </p>
        </section>
        <section className="panel settings-section">
          <div className="panel-header">
            <h2>Your profile</h2>
            <ShieldCheck size={18} />
          </div>
          <p className="muted">{s.profile.country || "Work country not set"}</p>
          <p className="muted">{s.profile.timezone}</p>
          <Button secondary small onClick={onProfile}>
            Edit profile <ArrowUpRight size={13} />
          </Button>
        </section>
        <section className="panel settings-section">
          <div className="panel-header">
            <h2>Domains & email</h2>
            <Globe size={18} />
          </div>
          <p className="muted">
            Connect your portfolio domain and an app subdomain through your
            hosting provider. Professional inboxes require a separate email
            provider.
          </p>
          <div className="domain-example">
            <span>
              yourdomain.com <Globe size={13} />
            </span>
            <span>
              app.yourdomain.com <Monitor size={13} />
            </span>
          </div>
        </section>
        {!DEMO && <LogoutControl />}
      </div>
    </div>
  );
}
function InterviewPanel({
  s,
  notify,
}: {
  s: AppState;
  notify: (s: string) => void;
}) {
  const [jobId, setJobId] = useState(
    s.applications[0]?.jobId || s.jobs[0]?.id || "",
  );
  const [answer, setAnswer] = useState("");
  const [generated, setGenerated] = useState<{
    questions: string[];
    coding: string;
    systemDesign: string;
    answerOutline: string;
  } | null>(null);
  const j = s.jobs.find((x) => x.id === jobId);
  return (
    <>
      <div className="panel settings-section">
        <Field label="Prepare for a specific opportunity">
          <select
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              setGenerated(null);
            }}
          >
            <option value="">Choose a role</option>
            {s.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.company} — {j.title}
              </option>
            ))}
          </select>
        </Field>
        <Button
          onClick={async () => {
            if (!j) {
              notify("Select a role first");
              return;
            }
            if (DEMO) {
              setGenerated({
                questions: [
                  `Walk through a project that relates to ${j.title}.`,
                  `How have you used ${j.technologies[0] || "your core stack"} in production?`,
                  "Describe a difficult engineering tradeoff and how you evaluated it.",
                  "How do you work across timezones and communicate technical decisions?",
                ],
                coding: `Build a paginated API with input validation, clear error handling, and tests using ${j.technologies[0] || "your preferred language"}.`,
                systemDesign: `Design a reliable job ingestion pipeline. Discuss deduplication, retries, storage, and monitoring. Relate your choices to the requirements at ${j.company}.`,
                answerOutline:
                  s.profile.evidence[0]?.text ||
                  "Add verified experience to build an evidence-based answer outline.",
              });
            } else {
              try {
                const r = await apiFetch(`${API}/api/interview/${j.id}`, {
                  credentials: "include",
                });
                if (!r.ok) throw Error("Could not prepare questions");
                setGenerated(await r.json());
              } catch (e) {
                notify((e as Error).message);
              }
            }
          }}
        >
          <Sparkles size={15} />
          Prepare practice kit
        </Button>
      </div>
      {generated && (
        <div className="analytics-grid">
          <section className="panel settings-section">
            <h2>Conversation starters</h2>
            {generated.questions.map((q, i) => (
              <div className="practice-question" key={q}>
                <span>0{i + 1}</span>
                <p>{q}</p>
              </div>
            ))}
            <h3>Evidence for your answer</h3>
            <p className="muted">{generated.answerOutline}</p>
          </section>
          <section className="panel settings-section">
            <h2>Technical practice</h2>
            <Badge tone="purple">Coding</Badge>
            <p className="practice-text">{generated.coding}</p>
            <Badge tone="blue">System design</Badge>
            <p className="practice-text">{generated.systemDesign}</p>
            <Field label="Your practice notes">
              <textarea
                rows={6}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Situation → Task → Action → Result"
              />
            </Field>
            <p className="fine-print">
              Practice notes stay in this view. Copy them before leaving.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
export { PublicPortfolio } from "../portfolio-view";

function MediaUpload({
  label,
  accept,
  onUploaded,
}: {
  label: string;
  accept: string;
  onUploaded: (url: string, mime?: string) => void;
}) {
  const [status, setStatus] = useState("");
  return (
    <div className="media-upload">
      <label className="btn secondary small">
        <Upload size={13} />
        {label}
        <input
          type="file"
          accept={accept}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (DEMO) {
              setStatus(
                "Uploads require live API + S3. You can use a hosted media URL in demo.",
              );
              return;
            }
            if (file.size > 20 * 1024 * 1024) {
              setStatus("Maximum upload size is 20 MB.");
              return;
            }
            setStatus("Uploading…");
            try {
              const f = new FormData();
              f.append("file", file);
              const r = await apiFetch(`${API}/api/assets/upload`, {
                method: "POST",
                credentials: "include",
                body: f,
              });
              const body = await r.json();
              if (!r.ok) throw Error(body.message || "Upload failed");
              onUploaded(body.url, body.mime);
              setStatus(
                "Uploaded. Save the draft, then publish to make this media public.",
              );
            } catch (error) {
              setStatus((error as Error).message);
            }
          }}
        />
      </label>
      {status && <small role="status">{status}</small>}
    </div>
  );
}
