/**
 * DB layer for US-806 — the food gate. Kept SEPARATE from the pure food.ts (same doctrine
 * as spine/spineDb and designerMemory/designerMemoryDb).
 *
 * Built by: migrations/US-806-food.sql
 *
 * THE TABLE IS EMPTY TODAY, AND THIS FUNCTION RETURNS AN EMPTY MAP, AND THAT IS CORRECT.
 * food.ts reads an absent row as "WE HAVE NOT CHECKED" and says so out loud. It never reads
 * it as "there is no vegetarian food in Assam", which would be lying with a null.
 */
import prisma from '@/config/db';
import type { FoodFact } from './food';

export async function foodFor(stayNodeIds: string[]): Promise<Map<string, FoodFact>> {
  const out = new Map<string, FoodFact>();
  if (!stayNodeIds.length) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT stay_node_id, pure_veg_kitchen, jain_kitchen, places, source, source_url, verified_at
         FROM food_options
        WHERE stay_node_id = ANY($1::text[])
          AND verified_at IS NOT NULL`,   // nothing unverified ever reaches a traveller
      stayNodeIds);
    for (const r of rows) {
      out.set(String(r.stay_node_id), {
        stayNodeId: String(r.stay_node_id),
        // NULL STAYS NULL. It means we have not looked, and food.ts depends on the difference.
        pureVegKitchen: r.pure_veg_kitchen == null ? null : r.pure_veg_kitchen === true,
        jainKitchen: r.jain_kitchen == null ? null : r.jain_kitchen === true,
        places: Array.isArray(r.places) ? r.places : [],
        source: String(r.source) as FoodFact['source'],
        sourceUrl: r.source_url ?? null,
        verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : null,
      });
    }
  } catch (e) {
    // A missing table is a SILENT gate, never a wrong one: food.ts will answer "unknown"
    // for every town, which is the truth when we cannot read our own records.
    console.error('foodFor failed (non-fatal — the gate will say it has not checked):', e);
  }
  return out;
}
