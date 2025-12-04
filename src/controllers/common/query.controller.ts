import type { Request, Response } from 'express';
import queryService from '@/services/query.service';

export class QueryController {
  /**
   * Handle Tour Query Submission
   * POST /api/common/query/tour
   */
  static async submitTourQuery(req: Request, res: Response) {
    try {
      const result = await queryService.handleTourQuery(req.body);

      return res.deliver(200, true, result, 'Tour query submitted successfully');
    } catch (error) {
      console.error('Error submitting tour query:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to submit tour query'
      );
    }
  }

  /**
   * Handle Hotel Query Submission
   * POST /api/common/query/hotel
   */
  static async submitHotelQuery(req: Request, res: Response) {
    try {
      const result = await queryService.handleHotelQuery(req.body);

      return res.deliver(200, true, result, 'Hotel query submitted successfully');
    } catch (error) {
      console.error('Error submitting hotel query:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to submit hotel query'
      );
    }
  }

  /**
   * Handle Transport Query Submission
   * POST /api/common/query/transport
   */
  static async submitTransportQuery(req: Request, res: Response) {
    try {
      const result = await queryService.handleTransportQuery(req.body);

      return res.deliver(200, true, result, 'Transport query submitted successfully');
    } catch (error) {
      console.error('Error submitting transport query:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to submit transport query'
      );
    }
  }

  /**
   * Handle Contact Us Query Submission
   * POST /api/common/query/contact-us
   */
  static async submitContactUsQuery(req: Request, res: Response) {
    try {
      const result = await queryService.handleContactUsQuery(req.body);

      return res.deliver(200, true, result, 'Contact query submitted successfully');
    } catch (error) {
      console.error('Error submitting contact query:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to submit contact query'
      );
    }
  }
}
