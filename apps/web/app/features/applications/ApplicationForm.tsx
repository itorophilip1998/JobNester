"use client";
import React, { useState } from "react";
import {
  ExternalLink,
  Link2,
  TriangleAlert,
  Mail,
  Check,
  Sparkles,
  Send,
} from "lucide-react";
import {
  type Application,
  type Job,
  type Resume,
  stages,
} from "@jobnester/core";
import { Button, Badge, Empty, Field } from "../../ui/primitives";

function ApplicationForm({
  app,
  job,
  gmailConnected,
  resumes,
  onSave,
  onCompose,
  onSend,
  onOpen,
  onGenerate,
  onReapply,
  busy,
}: {
  app?: Application;
  job: Job;
  gmailConnected: boolean;
  resumes: Resume[];
  onSave: (data: any) => void;
  onCompose: () => void;
  onSend: (applicationId: string, resumeId?: string) => void;
  onOpen: () => void;
  onGenerate: () => void;
  onReapply: () => void;
  busy: boolean;
}) {
  const [reapply, setReapply] = useState(false);
  const [stage, setStage] = useState(app?.stage || "Saved");
  const [resumeId, setResumeId] = useState(app?.resumeId || "");
  const [followUp, setFollowUp] = useState(app?.followUp?.slice(0, 10) || "");
  const [contactEmail, setContactEmail] = useState(
    app?.contactEmail || job.contactEmail || "",
  );
  const [draft, setDraft] = useState(
    app?.emailDraft || { subject: "", body: "", coverLetter: "" },
  );
  if (!app) {
    return (
      <div className="form-stack">
        <Empty
          title="Save this role first"
          description="Save the job to track it, then generate an application email."
        />
        <Button secondary onClick={onOpen}>
          Open job link <ExternalLink size={14} />
        </Button>
      </div>
    );
  }
  const canSend = !!(contactEmail && draft.subject && draft.body && draft.coverLetter && resumeId);
  return (
    <>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: app.id,
            stage,
            resumeId: resumeId || null,
            followUp,
            contactEmail,
            emailDraft:
              draft.subject && draft.body && draft.coverLetter ? draft : undefined,
          });
        }}
      >
        <div className="form-grid">
          <Field label="Application stage">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Application["stage"])}
            >
              {stages.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Follow-up date">
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Recipient email"
          hint="Left blank when the posting has no published email. Paste one to send from Gmail, or open the job link."
        >
          <input
            type="email"
            placeholder="No company email on posting"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </Field>
        <div className="panel-callout">
          <Link2 size={16} />
          <div>
            <strong>Job link</strong>
            <p>
              <a href={job.url} target="_blank" rel="noreferrer">
                {job.url}
              </a>
            </p>
          </div>
        </div>
        <Field
          label="CV version"
          hint="Attached as PDF when you send via Gmail."
        >
          <select
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            required={stage === "Applied"}
          >
            <option value="">Select a reviewed CV</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {new Date(r.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </Field>
        <div className="section-heading">
          <h3>Application email</h3>
          <Badge tone={app.sendStatus === "sent" ? "green" : "purple"}>
            {app.sendStatus || "none"}
          </Badge>
        </div>
        <Field label="Subject">
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder="Generate an email draft to fill this"
          />
        </Field>
        <Field label="Message body">
          <textarea
            rows={5}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </Field>
        <Field label="Cover letter (attached as PDF)">
          <textarea
            rows={6}
            value={draft.coverLetter}
            onChange={(e) =>
              setDraft({ ...draft, coverLetter: e.target.value })
            }
          />
        </Field>
        {!contactEmail && (
          <div className="panel-callout">
            <TriangleAlert size={16} />
            No company email on this posting. Use the job link, or paste a
            recipient email to send from your Gmail.
          </div>
        )}
        {!gmailConnected && (
          <div className="panel-callout">
            <Mail size={16} />
            Connect Gmail in Settings (with send permission) to email
            applications from the platform.
          </div>
        )}
        <div className="modal-actions">
          <Button type="submit" disabled={busy}>
            Save draft <Check size={15} />
          </Button>
          <Button secondary onClick={onCompose} disabled={busy}>
            <Sparkles size={14} />
            Generate email
          </Button>
          <Button
            secondary
            disabled={
              busy ||
              !canSend ||
              app.sendStatus === "sending" ||
              app.sendStatus === "sent"
            }
            onClick={() => onSend(app.id, resumeId || undefined)}
          >
            <Send size={14} />
            Send via Gmail
          </Button>
          <Button secondary onClick={onOpen}>
            Open job link <ExternalLink size={14} />
          </Button>
          {!resumes.length && (
            <Button secondary onClick={onGenerate}>
              Create a CV
            </Button>
          )}
        </div>
      </form>
      {app.appliedAt && (
        <div className="reapply-box">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={reapply}
              onChange={(e) => setReapply(e.target.checked)}
            />
            I intend to reapply; preserve my previous submission in the
            timeline.
          </label>
          {reapply && (
            <Button secondary small onClick={onReapply}>
              Start deliberate reapplication
            </Button>
          )}
        </div>
      )}
      <div className="section-heading">
        <h3>Activity timeline</h3>
      </div>
      <div className="timeline">
        {[...(app.events || [])].reverse().map((e) => (
          <div key={e.id}>
            <span />
            <div>
              <strong>{e.note}</strong>
              <small>{new Date(e.at).toLocaleString()}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
export { ApplicationForm };
