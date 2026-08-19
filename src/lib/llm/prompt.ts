export const LLM_DUMP_TRUNCATE = 40_000;

export interface LlmPrompt {
  system: string;
  user: string;
}

export function truncateDump(dump: string, maxChars: number = LLM_DUMP_TRUNCATE): string {
  if (dump.length <= maxChars) return dump;
  return dump.slice(0, Math.max(0, maxChars - 1)) + "…";
}

const SYSTEM_PROMPT = `You are a media-cataloging assistant. Extract the recommended media titles mentioned in the user's unstructured text dump so they can be added to a shared club list or personal shelf.

Rules:
- Extract only named media one can catalog: books, movies, TV shows, music albums/artists, podcasts.
- Output JSON only — no prose, no markdown, no code fences.
- Use exactly this shape:
{"titles":[{"title":"The Great Title","mediaType":"book","creator":"Optional author/artist/director","reason":"One short line explaining why it was recommended","rating":4}]}
- "mediaType" must be exactly one of: book, movie, tv, music, podcast.
- "title" is required. "creator", "reason", and "rating" (integer 1-5) are optional.
- Do not invent or infer titles that are not present in the dump.
- If the dump contains no media at all, return {"titles":[]}.`;

export function buildExtractPrompt(dump: string): LlmPrompt {
  return {
    system: SYSTEM_PROMPT,
    user: truncateDump(dump),
  };
}