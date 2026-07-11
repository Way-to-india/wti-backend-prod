// =============================================================================
// US-701 — THE PLAN STORE. The plan stops being a page view and becomes a thing
// the traveller owns, keeps, and passes on.
//
// Four rules, and they are the whole file:
//
// 1. WRITING IS NEVER FATAL. A plan that could not be saved is still a plan. Every
//    write here is try/catch'd and swallowed with a log, exactly like the existing
//    optimizer_runs insert. The traveller must NEVER see a 500 because our audit
//    table hiccupped.
// 2. WE STORE THE SCRUBBED PAYLOAD, NEVER THE ADMIN ONE. What we save is precisely
//    what the public API already returned — toPublicPayload() output. No guide
//    phone number, no cost split, no price. The store cannot leak what it was never
//    given.
// 3. THE TOKEN IS A uuid. Never a sequential id. See the migration for why.
// 4. DEMAND IS FIREWALLED. route_demand feeds the BUSINESS (which package to build,
//    where our supply is missing). It must never be read by learn.ts and must never
//    write to route_coeffs. A popular road is not a faster road.
// =============================================================================
import prisma from '@/config/db';

export interface SavePlanArgs {
  input: unknown;           // the sanitised inner body we actually solved
  payload: unknown;         // the PUBLIC payload (toPublicPayload output) — nothing else
  understanding: unknown;   // what we understood, and who told us
  runId?: number | null;
}

/** The one row the traveller can come back to. Returns the share token, or null if
 *  the write failed — in which case the plan still renders, it just cannot be kept. */
export async function savePlan(args: SavePlanArgs): Promise<string | null> {
  try {
    // Prisma binds a JS object as a parameter, NOT as jsonb. It must be serialised
    // first, or Postgres is handed a query it cannot type — which is precisely the
    // silent failure that produced a plan with no token. (Non-fatal by design, so it
    // failed QUIETLY. Hence the smoke test asserts the token, not just the 200.)
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO saved_plans (input, payload, understanding, run_id, status, auto_saved)
      VALUES (${JSON.stringify(args.input)}::jsonb, ${JSON.stringify(args.payload)}::jsonb,
              ${JSON.stringify(args.understanding ?? null)}::jsonb, ${args.runId ?? null}, 'draft', true)
      RETURNING id::text AS id`;
    return rows[0]?.id ?? null;
  } catch (e) {
    console.error('[planStore] savePlan failed (non-fatal):', e);
    return null;
  }
}

export interface StoredPlan {
  id: string;
  payload: unknown;
  understanding: unknown;
  title: string | null;
  createdAt: Date;
}

/** Re-open a shared plan. A cheap DB read — never a re-solve. That is what makes a
 *  plan travelling round a WhatsApp group free instead of a cost centre. */
export async function getPlan(token: string): Promise<StoredPlan | null> {
  if (!isUuid(token)) return null; // never let a junk string reach the database
  try {
    const rows = await prisma.$queryRaw<
      { id: string; payload: unknown; understanding: unknown; title: string | null; created_at: Date }[]
    >`
      SELECT id::text AS id, payload, understanding, title, created_at
        FROM saved_plans
       WHERE id = ${token}::uuid
         AND plan_visibility = 'link'
       LIMIT 1`;
    const r = rows[0];
    if (!r || !r.payload) return null;

    // fire-and-forget: how often was this link actually opened? (this is how we learn
    // whether sharing works at all — see the note in the handoff)
    void prisma.$executeRaw`
      UPDATE saved_plans SET opened_count = opened_count + 1, last_opened_at = now()
       WHERE id = ${token}::uuid`.catch(() => {});

    return { id: r.id, payload: r.payload, understanding: r.understanding, title: r.title, createdAt: r.created_at };
  } catch (e) {
    console.error('[planStore] getPlan failed:', e);
    return null;
  }
}

/** He copied the link. That is the moment the plan stopped being a browser tab. */
export async function markShared(token: string): Promise<void> {
  if (!isUuid(token)) return;
  try {
    await prisma.$executeRaw`
      UPDATE saved_plans
         SET shared_at = coalesce(shared_at, now()),
             status = CASE WHEN status = 'draft' THEN 'shared' ELSE status END,
             auto_saved = false,
             updated_at = now()
       WHERE id = ${token}::uuid`;
  } catch (e) {
    console.error('[planStore] markShared failed (non-fatal):', e);
  }
}

/** THE POINT OF THE WHOLE STORY: the operator opens the plan the traveller saw.
 *  Called from the enquiry path once the CRM lead exists. */
export async function attachLead(token: string, leadId: string): Promise<boolean> {
  if (!isUuid(token) || !leadId) return false;
  try {
    const n = await prisma.$executeRaw`
      UPDATE saved_plans
         SET lead_id = ${leadId}, status = 'enquired', auto_saved = false, updated_at = now()
       WHERE id = ${token}::uuid`;
    if (n > 0) {
      void prisma.$executeRaw`
        UPDATE route_demand SET outcome = 'enquired' WHERE plan_id = ${token}::uuid`.catch(() => {});
    }
    return n > 0;
  } catch (e) {
    console.error('[planStore] attachLead failed (non-fatal):', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// US-506 — DEMAND. Written on EVERY solve, whether he tells us who he is or not.
//
// This is the honest answer to "why store anything for a stranger?". Even a visitor
// who gives nothing and never returns has told us — for free — where Indians want to
// go, with whom, in which month, and WHAT WE COULD NOT GIVE HIM. That last column is
// the most valuable one in the database: every `outcome='infeasible'` row is a
// customer telling us exactly where our supply is missing.
//
// FIREWALL: business only. Never physics. Never a body gate.
// ---------------------------------------------------------------------------
export interface DemandRow {
  planId: string | null;
  requestText: string | null;
  cities: string[];
  startCity: string | null;
  endCity: string | null;
  month: number | null;
  nights: number | null;
  pax: number | null;
  profile: string | null;
  outcome: 'solved' | 'infeasible' | 'abandoned' | 'enquired';
  droppedCities: string[];
}

/** PURE — builds the row. Separated so it can be unit-tested without a database. */
export function buildDemandRow(args: {
  planId: string | null;
  request: string | null;
  cities: { name: string; nights: number }[];
  start: string | null;
  end: string | null;
  month?: number;
  pax: number;
  profile: string;
  solved: boolean;
  dropped?: string[];
}): DemandRow {
  const stops = args.cities.filter((c) => c.nights > 0).map((c) => c.name);
  return {
    planId: args.planId,
    requestText: args.request,
    cities: stops,
    startCity: args.start,
    endCity: args.end,
    month: args.month ?? null,
    nights: args.cities.reduce((s, c) => s + c.nights, 0),
    pax: args.pax,
    profile: args.profile,
    outcome: args.solved ? 'solved' : 'infeasible',
    droppedCities: args.dropped ?? [],
  };
}

export async function recordDemand(row: DemandRow): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO route_demand
        (plan_id, request_text, cities, start_city, end_city, month, nights, pax, profile, outcome, dropped_cities)
      VALUES (${row.planId ? row.planId : null}::uuid, ${row.requestText},
              ${row.cities}::text[], ${row.startCity}, ${row.endCity},
              ${row.month}, ${row.nights}, ${row.pax}, ${row.profile},
              ${row.outcome}, ${row.droppedCities}::text[])`;
  } catch (e) {
    console.error('[planStore] recordDemand failed (non-fatal):', e);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
