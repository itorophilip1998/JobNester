"use client";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Layout,
  Palette,
  Sparkles,
} from "lucide-react";
import {
  portfolioDefaults,
  portfolioSections,
  type Portfolio,
} from "@jobnester/core";
export function PortfolioDesigner({
  value,
  onChange,
}: {
  value: Portfolio;
  onChange: (p: Portfolio) => void;
}) {
  const p = portfolioDefaults(value);
  return (
    <section className="panel settings-section portfolio-designer">
      <div className="panel-header">
        <div>
          <h2>Make it yours</h2>
          <p>One portfolio. Two layouts. Your own look and feel.</p>
        </div>
        <Palette size={19} />
      </div>
      <div className="portfolio-layout-options">
        {(["studio", "editorial"] as const).map((layout) => (
          <button
            type="button"
            className={`layout-option ${p.layout === layout ? "selected" : ""}`}
            key={layout}
            onClick={() => onChange({ ...p, layout })}
            aria-pressed={p.layout === layout}
          >
            <div className={`layout-thumbnail ${layout}`}>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <span>
              {layout === "studio"
                ? "Studio — dark & technical"
                : "Editorial — light & expressive"}
              {p.layout === layout && <Check size={14} />}
            </span>
            <small>
              {layout === "studio"
                ? "A focused introduction and project grid."
                : "A bold personal introduction and wide case studies."}
            </small>
          </button>
        ))}
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Accent color</span>
          <div className="color-picker">
            <input
              aria-label="Accent color"
              type="color"
              value={p.accentColor}
              onChange={(e) => onChange({ ...p, accentColor: e.target.value })}
            />
            <span>{p.accentColor}</span>
          </div>
        </label>
        <label className="field">
          <span>Animation style</span>
          <select
            value={p.motion}
            onChange={(e) =>
              onChange({ ...p, motion: e.target.value as Portfolio["motion"] })
            }
          >
            <option value="none">None — keep it still</option>
            <option value="subtle">Subtle — gentle reveals</option>
            <option value="expressive">
              Expressive — reveals & floating artwork
            </option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Hero heading</span>
        <textarea
          rows={2}
          maxLength={200}
          value={p.heroHeading}
          onChange={(e) => onChange({ ...p, heroHeading: e.target.value })}
        />
        <small>Use a line break to shape the introduction.</small>
      </label>
      <div className="section-heading">
        <h3>Sections & order</h3>
        <span className="muted">Hide, show, or move a section</span>
      </div>
      <div className="section-order-list">
        {p.sectionOrder!.map((section, i) => (
          <div key={section}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={p.sections?.[section] !== false}
                onChange={(e) =>
                  onChange({
                    ...p,
                    sections: { ...p.sections, [section]: e.target.checked },
                  })
                }
              />
              {
                {
                  work: "Selected work",
                  about: "About & experience",
                  resume: "Résumé",
                  certifications: "Certifications",
                  contact: "Contact",
                }[section]
              }
            </label>
            <div>
              {[-1, 1].map((delta) => (
                <button
                  type="button"
                  className="icon-btn"
                  disabled={
                    i + delta < 0 || i + delta >= portfolioSections.length
                  }
                  aria-label={`Move ${section} ${delta < 0 ? "up" : "down"}`}
                  key={delta}
                  onClick={() => {
                    const order = [...p.sectionOrder!];
                    [order[i], order[i + delta]] = [order[i + delta], order[i]];
                    onChange({ ...p, sectionOrder: order });
                  }}
                >
                  {delta < 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="fine-print">
        <Sparkles size={12} /> Motion respects visitors’ reduced-motion
        preferences.
      </p>
    </section>
  );
}
