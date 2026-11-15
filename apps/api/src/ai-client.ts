import "./config.js";
import { z } from "zod";

export const resumeResponse = z.object({
  content: z.string().min(1),
  coverLetter: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
  method: z.enum(["ai-selected", "rule-ranked"]),
});
export const interviewResponse = z.object({
  questions: z.array(z.string()),
  coding: z.string(),
  systemDesign: z.string(),
  answerOutline: z.string(),
});
export async function aiRequest<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!process.env.AI_SERVICE_TOKEN)
    throw new Error(
      "AI_SERVICE_TOKEN is missing. Start the stack with npm start.",
    );
  const origin = (
    process.env.AI_SERVICE_URL || "http://localhost:8000"
  ).replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    throw new Error(
      "Python AI service is unavailable. Check npm run status and npm run logs -- ai.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Python AI service returned HTTP ${response.status}. Check its logs; no document was saved.`,
    );
  return schema.parse(await response.json());
}
export async function aiCapabilities(): Promise<{ llmConfigured: boolean }> {
  const response = await fetch(
    `${process.env.AI_SERVICE_URL || "http://localhost:8000"}/health`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new Error("Python AI service is not healthy.");
  return z.object({ llmConfigured: z.boolean() }).parse(await response.json());
}
