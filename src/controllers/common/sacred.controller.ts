/**
 * SACRED TEMPLE CIRCUITS — public controller (S1). Fails closed (empty 200, never 500).
 *   GET /api/common/sacred/circuits            → circuits + member/tour counts
 *   GET /api/common/sacred/tours?circuit=&page= → active tours reaching a temple (paged)
 */
import type { Request, Response } from 'express';
import { listSacredCircuits, toursCoveringSacred } from '@/services/common/sacred.service';

export class SacredController {
  static async getCircuits(_req: Request, res: Response) {
    try {
      const circuits = await listSacredCircuits();
      return res.deliver(200, true, { circuits });
    } catch (error) {
      console.error('Sacred getCircuits error:', error);
      return res.deliver(200, true, { circuits: [] });
    }
  }

  static async getTours(req: Request, res: Response) {
    try {
      const circuit = req.query.circuit ? String(req.query.circuit) : null;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(48, Math.max(1, parseInt(String(req.query.limit ?? '12'), 10) || 12));
      const { tours, total } = await toursCoveringSacred(circuit, page, limit);
      return res.deliver(200, true, {
        circuit,
        tours,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error('Sacred getTours error:', error);
      return res.deliver(200, true, { tours: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
    }
  }
}
