/**
 * HERITAGE GOLD CONTENT LOADER (deterministic, idempotent, NO model call).
 *
 * Reads a reviewed JSON file and upserts the `content` column on unesco_sites,
 * sacred_sites and sacred_circuit_content. The writing happens in a Cowork session
 * under the founder's eye; this script only persists the reviewed JSON.
 *
 * JSON shape (one file, three optional keys):
 * {
 *   "unesco":   { "<exact site name>":   { metaTitle, metaDescription, heroIntro, sections, quickFacts, faqs, sources } },
 *   "sacred":   { "<exact temple name>": { ...same shape... } },
 *   "circuits": { "<circuit name>":      { overview: "...", sources: [...] } }
 * }
 *
 * Rules enforced here (hard gates, the load REFUSES a bad entry):
 *   - no em dash or en dash anywhere in any string
 *   - minimum 3 sources per site entry
 *   - heroIntro + at least 3 sections + at least 4 faqs per site entry
 * A refused entry is reported and skipped; the rest still load.
 *
 * Also sets blurb from heroIntro when blurb is empty, stamps content_updated_at,
 * and always leaves content_reviewed = false so the founder can tick each page.
 *
 * Run:  bun run scripts/heritage-content-load.ts <path-to-reviewed.json>
 */
import { readFileSync } from 'fs';
import prisma from '@/config/db';

const BAD_CHARS = /[—–“”‘’]/; // em dash, en dash, curly quotes

function walkStrings(v: any, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => walkStrings(x, out));
  return out;
}

function gate(name: string, c: any, kind: 'site' | 'circuit'): string | null {
  for (const s of walkStrings(c)) {
    const m = s.match(BAD_CHARS);
    if (m) return `banned character "${m[0]}" in: ${s.slice(0, 80)}`;
  }
  if (!Array.isArray(c.sources) || c.sources.length < 3) {
    if (kind === 'site') return `needs 3+ sources, has ${(c.sources ?? []).length}`;
  }
  if (kind === 'site') {
    if (!c.heroIntro) return 'missing heroIntro';
    if (!Array.isArray(c.sections) || c.sections.length < 3) return 'needs 3+ sections';
    if (!Array.isArray(c.faqs) || c.faqs.length < 4) return 'needs 4+ faqs';
  } else if (!c.overview) return 'missing overview';
  return null;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: bun run scripts/heritage-content-load.ts <reviewed.json>');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let ok = 0, refused = 0, missing = 0;

  for (const [table, entries] of [
    ['unesco_sites', data.unesco ?? {}],
    ['sacred_sites', data.sacred ?? {}],
  ] as const) {
    for (const [name, content] of Object.entries<any>(entries)) {
      const why = gate(name, content, 'site');
      if (why) { console.error(`REFUSED ${table} :: ${name} :: ${why}`); refused++; continue; }
      const rows: any[] = await prisma.$queryRawUnsafe(
        `UPDATE ${table}
            SET content = $2::jsonb,
                content_updated_at = now(),
                content_reviewed = false,
                blurb = COALESCE(NULLIF(blurb, ''), $3)
          WHERE name = $1
          RETURNING id`,
        name, JSON.stringify(content), String(content.heroIntro ?? '').slice(0, 300));
      if (!rows.length) { console.error(`NO ROW in ${table} named "${name}"`); missing++; }
      else { console.log(`loaded ${table} :: ${name}`); ok++; }
    }
  }

  for (const [circuit, content] of Object.entries<any>(data.circuits ?? {})) {
    const why = gate(circuit, content, 'circuit');
    if (why) { console.error(`REFUSED circuit :: ${circuit} :: ${why}`); refused++; continue; }
    await prisma.$executeRawUnsafe(
      `INSERT INTO sacred_circuit_content (circuit, content, content_reviewed, content_updated_at)
       VALUES ($1, $2::jsonb, false, now())
       ON CONFLICT (circuit) DO UPDATE
          SET content = EXCLUDED.content, content_reviewed = false, content_updated_at = now()`,
      circuit, JSON.stringify(content));
    console.log(`loaded circuit :: ${circuit}`);
    ok++;
  }

  console.log(`\ndone: ${ok} loaded, ${refused} refused, ${missing} name misses`);
  if (refused || missing) process.exit(2);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
