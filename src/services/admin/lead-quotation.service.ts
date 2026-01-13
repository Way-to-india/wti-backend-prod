import prisma from '@/config/db';

interface UploadQuotationInput {
  leadId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  description?: string | null;
  amount?: number | null;
  uploadedById: string;
}

export class LeadQuotationService {
  /**
   * Upload quotation
   */
  static async uploadQuotation(data: UploadQuotationInput) {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Get next version number
    const lastQuotation = await prisma.leadQuotation.findFirst({
      where: { leadId: data.leadId },
      orderBy: { version: 'desc' },
    });

    const version = (lastQuotation?.version || 0) + 1;

    const quotation = await prisma.leadQuotation.create({
      data: {
        leadId: data.leadId,
        version,
        fileName: data.fileName,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        fileType: data.fileType,
        description: data.description,
        amount: data.amount,
        uploadedById: data.uploadedById,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's last activity and estimated value
    await prisma.lead.update({
      where: { id: data.leadId },
      data: {
        lastActivityAt: new Date(),
        estimatedValue: data.amount || undefined,
      },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        activityType: 'QUOTATION_UPLOADED',
        description: `Quotation v${version} uploaded: ${data.fileName}${data.amount ? ` (₹${data.amount})` : ''}`,
        performedById: data.uploadedById,
      },
    });

    return quotation;
  }

  /**
   * Get all quotations for a lead
   */
  static async getQuotationsByLeadId(leadId: string) {
    const quotations = await prisma.leadQuotation.findMany({
      where: { leadId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    return quotations;
  }

  /**
   * Get quotation by ID
   */
  static async getQuotationById(quotationId: string) {
    const quotation = await prisma.leadQuotation.findUnique({
      where: { id: quotationId },
      include: {
        lead: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new Error('Quotation not found');
    }

    return quotation;
  }

  /**
   * Mark quotation as accepted
   */
  static async markQuotationAccepted(quotationId: string, acceptedById: string) {
    const quotation = await prisma.leadQuotation.findUnique({
      where: { id: quotationId },
    });

    if (!quotation) {
      throw new Error('Quotation not found');
    }

    // Mark all other quotations as not accepted
    await prisma.leadQuotation.updateMany({
      where: {
        leadId: quotation.leadId,
        id: { not: quotationId },
      },
      data: {
        isAccepted: false,
        acceptedAt: null,
      },
    });

    // Mark this quotation as accepted
    const acceptedQuotation = await prisma.leadQuotation.update({
      where: { id: quotationId },
      data: {
        isAccepted: true,
        acceptedAt: new Date(),
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's actual value
    await prisma.lead.update({
      where: { id: quotation.leadId },
      data: {
        actualValue: quotation.amount,
        lastActivityAt: new Date(),
      },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: quotation.leadId,
        activityType: 'QUOTATION_ACCEPTED',
        description: `Quotation v${quotation.version} accepted${quotation.amount ? ` (₹${quotation.amount})` : ''}`,
        performedById: acceptedById,
      },
    });

    return acceptedQuotation;
  }

  /**
   * Track quotation email open
   */
  static async trackQuotationEmailOpen(quotationId: string) {
    const quotation = await prisma.leadQuotation.findUnique({
      where: { id: quotationId },
    });

    if (!quotation) {
      throw new Error('Quotation not found');
    }

    // Only update if not already opened
    if (!quotation.emailOpenedAt) {
      await prisma.leadQuotation.update({
        where: { id: quotationId },
        data: {
          emailOpenedAt: new Date(),
        },
      });

      // Create activity log
      await prisma.leadActivity.create({
        data: {
          leadId: quotation.leadId,
          activityType: 'QUOTATION_OPENED',
          description: `Quotation v${quotation.version} opened via email`,
          performedById: quotation.uploadedById,
        },
      });
    }

    return { success: true };
  }

  /**
   * Delete quotation
   */
  static async deleteQuotation(quotationId: string) {
    const quotation = await prisma.leadQuotation.findUnique({
      where: { id: quotationId },
    });

    if (!quotation) {
      throw new Error('Quotation not found');
    }

    await prisma.leadQuotation.delete({
      where: { id: quotationId },
    });

    return {
      success: true,
      fileKey: quotation.fileKey,
      version: quotation.version,
    };
  }

  /**
   * Get latest quotation for a lead
   */
  static async getLatestQuotation(leadId: string) {
    const quotation = await prisma.leadQuotation.findFirst({
      where: { leadId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    return quotation;
  }

  /**
   * Get accepted quotation for a lead
   */
  static async getAcceptedQuotation(leadId: string) {
    const quotation = await prisma.leadQuotation.findFirst({
      where: {
        leadId,
        isAccepted: true,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return quotation;
  }
}
