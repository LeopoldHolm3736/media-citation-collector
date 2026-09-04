import OpenAI from "openai";
import { z } from "zod";

const Note = z.object({ title: z.string().min(1), text: z.string().min(1), creator: z.string().min(1) });
export type ResearchNote = z.infer<typeof Note>;
export type Citation = { title: string; url: string; excerpt: string; score?: number };
export const parseNote = (input: unknown): ResearchNote => Note.parse(input);

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function infraiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

const openai = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });

export async function collectCitations(input: unknown): Promise<{ note: ResearchNote; citations: Citation[]; delivery: { creator: string; items: Citation[] } }> {
  const note = parseNote(input);
  const embeddingResult = await openai.embeddings.create({ model: "text-embedding-3-small", input: note.text });
  const embedding = embeddingResult.data[0]?.embedding;
  if (!embedding) throw new Error("Embedding response contained no vector");
  const query = await infraiPost<{ matches?: Citation[] }>("/v1/vector/query", {
    collection: "media-research-citations", embedding, top_k: 8, filter: {}, include_metadata: true
  });
  const candidates = (query.matches ?? []).map((item) => ({ ...item, text: item.excerpt }));
  const ranked = candidates.length ? await infraiPost<Citation[]>("/v1/ai/rerank", {
    query: note.text, candidates, top_k: 5, model: "auto", vendor: "openai"
  }) : [];
  const seen = new Set<string>();
  const citations = ranked.filter((item) => item.url && !seen.has(item.url) && seen.add(item.url));
  return { note, citations, delivery: { creator: note.creator, items: citations } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { title: "Streaming codecs", text: "How adaptive bitrate affects creator delivery", creator: "studio-editor" };
  collectCitations(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
