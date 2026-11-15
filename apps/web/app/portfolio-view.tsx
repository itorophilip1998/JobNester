"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ArrowDown,
  Download,
  FileText,
  Code2,
  Cloud,
  Sparkles,
  Layers,
  Mail,
  Globe,
  X,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import {
  portfolioDefaults,
  productLink,
  type Portfolio,
  type PortfolioSection,
} from "@jobnester/core";
import { apiFetch } from "./api-client";
import { useAppAuth, LoginControl } from "./auth-provider";
import { demoState } from "./demo";
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
const DEMO = !API;
function PortfolioImage({
  src,
  alt,
  preview,
}: {
  src: string;
  alt: string;
  preview: boolean;
}) {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    let objectUrl: string | undefined,
      active = true;
    if (preview && src.startsWith(`${API}/api/public/assets/`) && API) {
      apiFetch(src.replace("/api/public/assets/", "/api/assets/"))
        .then(async (r) => {
          if (!r.ok) return;
          objectUrl = URL.createObjectURL(await r.blob());
          if (active) setUrl(objectUrl);
        })
        .catch(() => {});
    } else setUrl(src);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, preview]);
  return <img src={url} alt={alt} loading="lazy" />;
}
function PortfolioVideo({ src, preview }: { src: string; preview: boolean }) {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    let objectUrl: string | undefined,
      active = true;
    if (preview && API && src.startsWith(`${API}/api/public/assets/`)) {
      apiFetch(src.replace("/api/public/assets/", "/api/assets/"))
        .then(async (r) => {
          if (!r.ok) return;
          objectUrl = URL.createObjectURL(await r.blob());
          if (active) setUrl(objectUrl);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, preview]);
  return (
    <video className="project-video" src={url} controls preload="metadata" />
  );
}
function ProjectDialog({
  project,
  onClose,
  preview,
}: {
  project: Portfolio["projects"][number];
  onClose: () => void;
  preview: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="portfolio-project-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="modal-head">
        <div>
          <h2>{project.title}</h2>
          <p>{project.tags.join(" · ")}</p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close project"
          onClick={() => ref.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      {project.image && (
        <PortfolioImage
          preview={preview}
          src={project.image}
          alt={project.title}
        />
      )}
      <p className="case-study">{project.description}</p>
      {project.video && (
        <PortfolioVideo src={project.video} preview={preview} />
      )}
      {productLink(project) && (
        <a
          className="btn"
          href={productLink(project)}
          target="_blank"
          rel="noreferrer"
        >
          {project.url ? "Visit product" : "View repository"}
          <ArrowUpRight size={15} />
        </a>
      )}
    </dialog>
  );
}
export function PublicPortfolio({ preview = false }: { preview?: boolean }) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [project, setProject] = useState<Portfolio["projects"][number] | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null);
  const auth = useAppAuth();
  useEffect(() => {
    if (preview && !DEMO && !auth.ready) return;
    let alive = true;
    async function load() {
      try {
        if (DEMO) {
          const raw = localStorage.getItem(
            preview ? "jobnester-demo-v1" : "jobnester-published-demo",
          );
          if (!preview && localStorage.getItem("jobnester-unpublished-demo")) {
            if (alive) setPortfolio(null);
            return;
          }
          const data = raw ? JSON.parse(raw) : null;
          const p = preview ? data?.portfolio : data;
          if (alive)
            setPortfolio(portfolioDefaults(p || demoState().portfolio));
        } else {
          const r = await apiFetch(
            `${API}/api/${preview ? "portfolio/draft" : "public/portfolio"}`,
          );
          if (alive)
            setPortfolio(r.ok ? portfolioDefaults(await r.json()) : null);
        }
      } catch {
        if (alive) setPortfolio(null);
      } finally {
        if (alive) setReady(true);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [preview, auth.ready, auth.signedIn]);
  useEffect(() => {
    if (
      !portfolio ||
      portfolio.motion === "none" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    root.current
      ?.querySelectorAll(".portfolio-section")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [portfolio]);
  if (!ready) return <div className="loading">Preparing your portfolio…</div>;
  if (!portfolio)
    return (
      <div className="loading">
        <Globe />
        <h1>
          {preview
            ? "Sign in to preview your draft."
            : "Portfolio coming soon."}
        </h1>
        <p>
          {preview
            ? "Only the owner can access draft content."
            : "This portfolio has not been published."}
        </p>
        {preview && <LoginControl />}
        <a className="btn secondary" href="/portfolio/edit">
          Go to editor
        </a>
      </div>
    );
  const p = portfolio;
  const visible = (section: PortfolioSection) =>
    p.sections?.[section] !== false;
  const order = (section: PortfolioSection) => ({
    order: 2 + (p.sectionOrder?.indexOf(section) ?? 0),
  });
  async function downloadResume(e: React.MouseEvent) {
    if (!preview || DEMO) return;
    e.preventDefault();
    const url = p.resume?.url
      ? p.resume.url.replace("/api/public/assets/", "/api/assets/")
      : `${API}/api/resumes/${p.publicResumeId}/download?format=pdf`;
    if (!url.startsWith(API)) {
      window.open(url, "_blank", "noopener");
      return;
    }
    const r = await apiFetch(url);
    if (!r.ok) {
      setMessage("Could not download this draft résumé.");
      return;
    }
    const blob = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = blob;
    a.download = p.resume?.name || "resume.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(blob), 1000);
  }
  return (
    <div
      ref={root}
      className={`portfolio-page portfolio-${p.layout} motion-${p.motion}`}
      style={{ "--portfolio-accent": p.accentColor } as React.CSSProperties}
    >
      {(DEMO || preview) && (
        <div className="portfolio-demo">
          {preview ? (
            <>
              <ShieldCheck size={13} />
              Private draft preview — unpublished changes
            </>
          ) : (
            "Portfolio demo · replace sample content before sharing professionally"
          )}
          <a href="/portfolio/edit">
            Back to editor <ArrowUpRight size={12} />
          </a>
        </div>
      )}
      <header className="portfolio-nav">
        <a className="portfolio-brand" href="#">
          {p.name || "Your name"}
          <span>®</span>
        </a>
        <nav>
          {visible("work") && <a href="#work">Selected work</a>}
          {visible("about") && <a href="#about">About</a>}
          {visible("contact") && (
            <a href="#contact">
              Let’s talk <ArrowUpRight size={13} />
            </a>
          )}
          <a href="/portfolio/edit" className="portfolio-edit-link">
            Sign in to edit
          </a>
        </nav>
      </header>
      <main className="portfolio-main">
        <section className="portfolio-hero">
          <div>
            <div className="eyebrow">
              <span className="status-dot" />
              {p.location || "OPEN TO NEW OPPORTUNITIES"}
            </div>
            <h1>
              {(p.heroHeading || p.headline || p.name)
                .split("\n")
                .map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {i % 2 ? <span>{line}</span> : line}
                  </React.Fragment>
                ))}
            </h1>
            <p>{p.headline}</p>
            <div className="portfolio-intro">{p.bio}</div>
            <div className="portfolio-hero-actions">
              {visible("work") && (
                <a href="#work" className="btn">
                  Explore my work <ArrowDown size={15} />
                </a>
              )}
              {visible("contact") && (
                <a className="text-button" href="#contact">
                  Let’s build something <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          </div>
          {p.avatar ? (
            <div className="portfolio-portrait">
              <PortfolioImage src={p.avatar} preview={preview} alt={p.name} />
            </div>
          ) : (
            <div className="portfolio-art">
              <div className="art-grid" />
              <span className="art-orbit a" />
              <span className="art-orbit b" />
              <span className="art-orbit c" />
              <div className="art-core">
                <Code2 size={54} />
              </div>
              <span className="art-chip chip-a">
                <Cloud size={16} />
                Cloud architecture
              </span>
              <span className="art-chip chip-b">
                <Sparkles size={16} />
                Practical AI
              </span>
              <span className="art-chip chip-c">
                <Layers size={16} />
                Full-stack engineering
              </span>
              <span className="art-label">ENGINEERED WITH INTENTION</span>
            </div>
          )}
        </section>
        <section className="portfolio-skills">
          {p.skills.map((skill) => (
            <span key={skill}>
              {skill}
              <span>✦</span>
            </span>
          ))}
        </section>
        {visible("work") && (
          <section
            id="work"
            className="portfolio-section"
            style={order("work")}
          >
            <div className="section-label">SELECTED WORK</div>
            <h2>Ideas brought to life.</h2>
            <p className="portfolio-section-copy">
              The products, systems, and decisions behind my work.
            </p>
            <div className="portfolio-projects">
              {p.projects.map((item, i) => (
                <button
                  key={item.id}
                  className="portfolio-project"
                  onClick={() => setProject(item)}
                >
                  <div className={`project-visual visual-${i % 3}`}>
                    {item.image ? (
                      <PortfolioImage
                        src={item.image}
                        preview={preview}
                        alt={item.title}
                      />
                    ) : (
                      <>
                        <span className="project-no">0{i + 1}</span>
                        <div className="project-art">
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <span className="project-visual-label">
                          {item.tags[0] || "PROJECT"}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="project-caption">
                    <h3>{item.title}</h3>
                    <ArrowUpRight size={20} />
                  </div>
                  <p>{item.description.slice(0, 160)}</p>
                  <div className="job-tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  {!item.url && item.repositoryUrl && (
                    <span className="repository-hint">
                      View GitHub repository ↗
                    </span>
                  )}
                </button>
              ))}
            </div>
            {!p.projects.length && (
              <p className="portfolio-section-copy">
                Project case studies will be added here.
              </p>
            )}
          </section>
        )}
        {visible("about") && (
          <section
            id="about"
            className="portfolio-section about-section"
            style={order("about")}
          >
            <div>
              <div className="section-label">ABOUT & EXPERIENCE</div>
              <h2>
                From the big picture
                <br />
                to the last detail.
              </h2>
              <p>{p.bio}</p>
              {p.github && (
                <a
                  className="text-button"
                  href={p.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  Find me on GitHub <ArrowUpRight size={15} />
                </a>
              )}
            </div>
            <div className="portfolio-experience">
              {p.experience.map((item) => (
                <article key={item.id}>
                  <span>
                    {[item.start, item.end].filter(Boolean).join(" — ")}
                  </span>
                  <h3>{item.role}</h3>
                  <h4>{item.company}</h4>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        {visible("resume") && (
          <section
            id="resume"
            className="portfolio-section public-resume-section"
            style={order("resume")}
          >
            <div>
              <div className="section-label">RÉSUMÉ</div>
              <h2>The full picture.</h2>
              <p className="portfolio-section-copy">
                Explore my experience, background, and skills in one document.
              </p>
            </div>
            {p.resume?.url || p.publicResumeId ? (
              <a
                className="btn"
                href={p.resume?.url || `${API}/api/public/resume`}
                onClick={downloadResume}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                Download résumé
              </a>
            ) : (
              <p className="portfolio-section-copy">
                Résumé available on request.
              </p>
            )}
          </section>
        )}
        {visible("certifications") && (
          <section
            id="certifications"
            className="portfolio-section"
            style={order("certifications")}
          >
            <div className="section-label">CONTINUED LEARNING</div>
            <h2>Credentials & certifications.</h2>
            <div className="public-certifications">
              {p.certifications?.map((cert) => (
                <article className="public-certification" key={cert.id}>
                  {cert.image && (
                    <a
                      href={cert.image}
                      target="_blank"
                      rel="noreferrer"
                      className="certificate-media"
                    >
                      {/\.pdf(?:\?|$)/i.test(cert.image) ||
                      cert.documentType === "pdf" ? (
                        <FileText size={35} />
                      ) : (
                        <PortfolioImage
                          src={cert.image}
                          preview={preview}
                          alt={`${cert.name} certificate`}
                        />
                      )}
                    </a>
                  )}
                  <GraduationCap size={23} />
                  <h3>{cert.name}</h3>
                  <p>
                    {cert.issuer}
                    {cert.issuedAt && ` · ${cert.issuedAt}`}
                  </p>
                  {cert.description && <p>{cert.description}</p>}
                  {cert.credentialUrl && (
                    <a
                      className="text-button"
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Verify credential <ArrowUpRight size={14} />
                    </a>
                  )}
                </article>
              ))}
            </div>
            {!p.certifications?.length && (
              <p className="portfolio-section-copy">
                Certifications will be added here.
              </p>
            )}
          </section>
        )}
        {visible("contact") && (
          <section
            id="contact"
            className="portfolio-section portfolio-contact"
            style={order("contact")}
          >
            <div>
              <div className="section-label">WHAT’S NEXT</div>
              <h2>
                Have something
                <br />
                <span>in mind?</span>
              </h2>
              <p>
                I’d love to hear about your team, your challenge, or what you’re
                building.
              </p>
              {p.email && (
                <a href={`mailto:${p.email}`}>
                  {p.email}
                  <ArrowUpRight size={16} />
                </a>
              )}
            </div>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (sending) return;
                const form = e.currentTarget;
                if (DEMO || preview) {
                  setMessage(
                    preview
                      ? "Draft preview — no message was sent."
                      : "Demo only — no message was sent. Connect the live API to receive inquiries.",
                  );
                  return;
                }
                setSending(true);
                setMessage("");
                try {
                  const r = await fetch(`${API}/api/public/contact`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                      Object.fromEntries(new FormData(form)),
                    ),
                  });
                  const result = await r.json();
                  if (!r.ok)
                    throw Error(
                      result.message ||
                        "Could not send your message. Please try again.",
                    );
                  setMessage(
                    "Thank you. Your inquiry is received and queued for email delivery.",
                  );
                  form.reset();
                } catch (error) {
                  setMessage((error as Error).message);
                } finally {
                  setSending(false);
                }
              }}
            >
              <div className="form-grid">
                <label className="field">
                  <span>Your name</span>
                  <input name="name" required maxLength={120} />
                </label>
                <label className="field">
                  <span>Email address</span>
                  <input type="email" name="email" required maxLength={200} />
                </label>
              </div>
              <label className="field">
                <span>What would you like to talk about?</span>
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                />
              </label>
              <input
                className="honeypot"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <button className="btn" type="submit" disabled={sending}>
                {sending ? "Sending…" : "Send message"}
                <ArrowUpRight size={16} />
              </button>
              {message && <p role="status">{message}</p>}
            </form>
          </section>
        )}
      </main>
      <footer className="portfolio-footer">
        <span>
          © {new Date().getFullYear()} {p.name}
        </span>
        <span>Thoughtfully built. Always evolving.</span>
        <a href="#">Back to top ↑</a>
      </footer>
      {project && (
        <ProjectDialog
          project={project}
          preview={preview}
          onClose={() => setProject(null)}
        />
      )}
    </div>
  );
}
