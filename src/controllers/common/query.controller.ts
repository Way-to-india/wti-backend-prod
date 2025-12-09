import type { Request, Response } from 'express';
import queryService from '@/services/query.service';
import { verifyRecaptcha } from '@/utils/captcha';

export class QueryController {
  /**
   * Handle Tour Query Submission
   * POST /api/common/query/tour
   */
  static async submitTourQuery(req: Request, res: Response) {
    try {
      const { recaptchaToken, ...queryData } = req.body;

      if (!recaptchaToken) {
        return res.deliver(400, false, undefined, 'reCAPTCHA token is required');
      }

      const isValidRecaptcha = await verifyRecaptcha(
        recaptchaToken,
        req.ip || req.socket.remoteAddress
      );

      if (!isValidRecaptcha) {
        return res.deliver(
          400,
          false,
          undefined,
          'reCAPTCHA verification failed. Please try again.'
        );
      }

      const result = await queryService.handleTourQuery(queryData);

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
      const { recaptchaToken, ...queryData } = req.body;

      if (!recaptchaToken) {
        return res.deliver(400, false, undefined, 'reCAPTCHA token is required');
      }

      const isValidRecaptcha = await verifyRecaptcha(
        recaptchaToken,
        req.ip || req.socket.remoteAddress
      );

      if (!isValidRecaptcha) {
        return res.deliver(
          400,
          false,
          undefined,
          'reCAPTCHA verification failed. Please try again.'
        );
      }

      const result = await queryService.handleHotelQuery(queryData);

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
      const { recaptchaToken, ...queryData } = req.body;

      if (!recaptchaToken) {
        return res.deliver(400, false, undefined, 'reCAPTCHA token is required');
      }

      const isValidRecaptcha = await verifyRecaptcha(
        recaptchaToken,
        req.ip || req.socket.remoteAddress
      );

      if (!isValidRecaptcha) {
        return res.deliver(
          400,
          false,
          undefined,
          'reCAPTCHA verification failed. Please try again.'
        );
      }

      const result = await queryService.handleTransportQuery(queryData);

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
      const { recaptchaToken, ...queryData } = req.body;

      if (!recaptchaToken) {
        return res.deliver(400, false, undefined, 'reCAPTCHA token is required');
      }

      const isValidRecaptcha = await verifyRecaptcha(
        recaptchaToken,
        req.ip || req.socket.remoteAddress
      );

      if (!isValidRecaptcha) {
        return res.deliver(
          400,
          false,
          undefined,
          'reCAPTCHA verification failed. Please try again.'
        );
      }

      const result = await queryService.handleContactUsQuery(queryData);

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
