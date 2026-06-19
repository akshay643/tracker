// =============================================================================
// lib/hashtags.ts — Feature 5: Smart Hashtagging & Cross-Tagging
// Extracts inline #tags from free text so expenses can be grouped across
// categories without any schema change — tags live as a string[] on the entry.
// =============================================================================

const TAG_RE = /#([a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)/gi;

/** Pull normalized, de-duplicated hashtags out of a note. */
export function extractTags(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}

/** The note with #tags stripped, for a clean display label. */
export function stripTags(text: string): string {
  return text.replace(TAG_RE, "").replace(/\s{2,}/g, " ").trim();
}

/** Highlight tokens for rendering — splits text into plain + tag segments. */
export function tokenizeNote(text: string): { text: string; isTag: boolean }[] {
  const out: { text: string; isTag: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), isTag: false });
    out.push({ text: m[0], isTag: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), isTag: false });
  return out;
}
