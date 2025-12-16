import { BadRequestError } from '@/middlewares/handlers/errorHandler';
import zohoService from './zoho.service';
import prisma from '@/config/db';

export interface TourQueryData {
  fullName: string;
  email: string;
  phoneNumber: string;
  numberOfTravellers: number;
  tourPackage: string;
  departureCity?: string;
  specialRequest?: string;
}

export interface HotelQueryData {
  location: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  priceRange?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
}

export interface TransportQueryData {
  pickupLocation: string;
  dropLocation: string;
  pickupDate: string;
  pickupTime?: string;
  vehicleType?: string;
  passengers?: number;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
}

export interface ContactUsData {
  fullName: string;
  email: string;
  phoneNumber?: string;
  subject: string;
  message: string;
}

class QueryService {
  private readonly TOUR_QUERY_LIMIT = 5;
  private readonly WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;
  private readonly MAX_REFERENCE_GENERATION_ATTEMPTS = 10;

  /**
   * Generate unique reference number with format CT-XXXXX
   * Checks against database to ensure uniqueness
   */
  private async generateUniqueReferenceNumber(): Promise<string> {
    let attempts = 0;

    while (attempts < this.MAX_REFERENCE_GENERATION_ATTEMPTS) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const referenceNumber = `CT-${randomNum}`;

      const exists = await prisma.lead.findUnique({
        where: { referenceNumber },
      });

      if (!exists) {
        console.log(`✅ Generated unique reference number: ${referenceNumber}`);
        return referenceNumber;
      }

      console.log(`⚠️ Reference number ${referenceNumber} already exists, regenerating...`);
      attempts++;
    }

    const timestamp = Date.now();
    const fallbackRef = `CT-${timestamp.toString().slice(-5)}`;
    console.log(`⚠️ Using timestamp-based fallback reference: ${fallbackRef}`);
    return fallbackRef;
  }

  /**
   * Build success message with reference number
   */
  private buildSuccessMessage(referenceNumber: string): string {
    return `Thank you! Your request has been registered (Ref: ${referenceNumber}). Our team will reach out to you within 24 hours. For faster assistance, WhatsApp us at ${this.WHATSAPP_NUMBER}`;
  }

  /**
   * Extract IP and User Agent from request context
   */
  private getRequestMetadata(req?: any): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.get?.('user-agent'),
    };
  }

  /**
   * Handle Tour Query with rate limiting
   */
  async handleTourQuery(
    data: TourQueryData,
    req?: any
  ): Promise<{ message: string; referenceNumber: string }> {
    // Check rate limit from database
    const queryCount = await prisma.lead.count({
      where: {
        email: data.email,
        source: 'TOUR_QUERY',
      },
    });

    if (queryCount >= this.TOUR_QUERY_LIMIT) {
      throw new BadRequestError(
        `You have reached the maximum limit of ${this.TOUR_QUERY_LIMIT} tour queries. Please contact us directly for additional inquiries.`
      );
    }

    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildTourDescription(data, referenceNumber);
    const metadata = this.getRequestMetadata(req);

    // Save to database first
    const lead = await prisma.lead.create({
      data: {
        referenceNumber,
        source: 'TOUR_QUERY',
        status: 'NEW',
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        details: {
          numberOfTravellers: data.numberOfTravellers,
          tourPackage: data.tourPackage,
          departureCity: data.departureCity,
          specialRequest: data.specialRequest,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    // Sync to Zoho (non-blocking)
    const leadData = {
      First_Name: data.fullName.split(' ')[0],
      Last_Name: data.fullName.split(' ').slice(1).join(' ') || data.fullName.split(' ')[0],
      Company: 'Tour Enquiry',
      Email: data.email,
      Phone: data.phoneNumber,
      Lead_Source: 'Tour Query' as const,
      Description: description,
      Reference_Number: referenceNumber,
      Travel_Theme: data.tourPackage,
      Adults: data.numberOfTravellers,
      Special_Requests: data.specialRequest || '',
    };

    // Sync to Zoho in background
    zohoService
      .createLead(leadData)
      .then(async (zohoResponse) => {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            zohoLeadId: zohoResponse.leadId,
            syncedToZoho: true,
            lastSyncedAt: new Date(),
          },
        });
        console.log(`✅ Lead ${referenceNumber} synced to Zoho`);
      })
      .catch((error) => {
        console.error(`❌ Failed to sync lead ${referenceNumber} to Zoho:`, error);
      });

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Handle Hotel Query
   */
  async handleHotelQuery(
    data: HotelQueryData,
    req?: any
  ): Promise<{ message: string; referenceNumber: string }> {
    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildHotelDescription(data, referenceNumber);
    const metadata = this.getRequestMetadata(req);

    const lead = await prisma.lead.create({
      data: {
        referenceNumber,
        source: 'HOTEL_QUERY',
        status: 'NEW',
        fullName: data.fullName || 'Hotel Enquiry',
        email: data.email || `hotel-${Date.now()}@query.com`,
        phoneNumber: data.phoneNumber,
        details: {
          location: data.location,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          rooms: data.rooms,
          guests: data.guests,
          priceRange: data.priceRange,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    const leadData = {
      First_Name: data.fullName?.split(' ')[0] || 'Hotel',
      Last_Name: data.fullName?.split(' ').slice(1).join(' ') || 'Enquiry',
      Company: 'Hotel Enquiry',
      Email: data.email || `hotel-${Date.now()}@query.com`,
      Phone: data.phoneNumber,
      Lead_Source: 'Hotel Query' as const,
      Description: description,
      Reference_Number: referenceNumber,
      Preferred_Hotel_Category: data.priceRange || '',
    };

    zohoService
      .createLead(leadData)
      .then(async (zohoResponse) => {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            zohoLeadId: zohoResponse.leadId,
            syncedToZoho: true,
            lastSyncedAt: new Date(),
          },
        });
      })
      .catch((error) => console.error('Zoho sync failed:', error));

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Handle Transport Query
   */
  async handleTransportQuery(
    data: TransportQueryData,
    req?: any
  ): Promise<{ message: string; referenceNumber: string }> {
    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildTransportDescription(data, referenceNumber);
    const metadata = this.getRequestMetadata(req);

    const lead = await prisma.lead.create({
      data: {
        referenceNumber,
        source: 'TRANSPORT_QUERY',
        status: 'NEW',
        fullName: data.fullName || 'Transport Enquiry',
        email: data.email || `transport-${Date.now()}@query.com`,
        phoneNumber: data.phoneNumber,
        details: {
          pickupLocation: data.pickupLocation,
          dropLocation: data.dropLocation,
          pickupDate: data.pickupDate,
          pickupTime: data.pickupTime,
          vehicleType: data.vehicleType,
          passengers: data.passengers,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    const leadData = {
      First_Name: data.fullName?.split(' ')[0] || 'Transport',
      Last_Name: data.fullName?.split(' ').slice(1).join(' ') || 'Enquiry',
      Company: 'Transport Enquiry',
      Email: data.email || `transport-${Date.now()}@query.com`,
      Phone: data.phoneNumber,
      Lead_Source: 'Transport Query' as const,
      Description: description,
      Reference_Number: referenceNumber,
    };

    zohoService
      .createLead(leadData)
      .then(async (zohoResponse) => {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            zohoLeadId: zohoResponse.leadId,
            syncedToZoho: true,
            lastSyncedAt: new Date(),
          },
        });
      })
      .catch((error) => console.error('Zoho sync failed:', error));

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Handle Contact Us Query
   */
  async handleContactUsQuery(
    data: ContactUsData,
    req?: any
  ): Promise<{ message: string; referenceNumber: string }> {
    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildContactUsDescription(data, referenceNumber);
    const metadata = this.getRequestMetadata(req);

    const lead = await prisma.lead.create({
      data: {
        referenceNumber,
        source: 'CONTACT_US',
        status: 'NEW',
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        details: {
          subject: data.subject,
          message: data.message,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    const leadData = {
      First_Name: data.fullName.split(' ')[0],
      Last_Name: data.fullName.split(' ').slice(1).join(' ') || data.fullName.split(' ')[0],
      Company: 'General Enquiry',
      Email: data.email,
      Phone: data.phoneNumber,
      Lead_Source: 'Contact Us' as const,
      Description: description,
      Reference_Number: referenceNumber,
    };

    zohoService
      .createLead(leadData)
      .then(async (zohoResponse) => {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            zohoLeadId: zohoResponse.leadId,
            syncedToZoho: true,
            lastSyncedAt: new Date(),
          },
        });
      })
      .catch((error) => console.error('Zoho sync failed:', error));

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  // Description builders remain the same
  private buildTourDescription(data: TourQueryData, referenceNumber: string): string {
    return `
      Reference Number: ${referenceNumber}

      Tour Query Details:
      -------------------
      Tour Package: ${data.tourPackage}
      Number of Travellers: ${data.numberOfTravellers}
      ${data.departureCity ? `Departure City: ${data.departureCity}` : ''}
      ${data.specialRequest ? `Special Requests: ${data.specialRequest}` : ''}

      Contact Information:
      Full Name: ${data.fullName}
      Email: ${data.email}
      Phone: ${data.phoneNumber}
    `.trim();
  }

  private buildHotelDescription(data: HotelQueryData, referenceNumber: string): string {
    return `
      Reference Number: ${referenceNumber}

      Hotel Query Details:
      -------------------
      Location: ${data.location}
      Check-In: ${data.checkIn}
      Check-Out: ${data.checkOut}
      Rooms: ${data.rooms}
      Guests: ${data.guests}
      ${data.priceRange ? `Price Range: ${data.priceRange}` : ''}
      ${data.fullName ? `\nContact: ${data.fullName}` : ''}
      ${data.email ? `Email: ${data.email}` : ''}
      ${data.phoneNumber ? `Phone: ${data.phoneNumber}` : ''}
    `.trim();
  }

  private buildTransportDescription(data: TransportQueryData, referenceNumber: string): string {
    return `
      Reference Number: ${referenceNumber}

      Transport Query Details:
      -----------------------
      Pickup Location: ${data.pickupLocation}
      Drop Location: ${data.dropLocation}
      Date: ${data.pickupDate}
      ${data.pickupTime ? `Time: ${data.pickupTime}` : ''}
      ${data.vehicleType ? `Vehicle Type: ${data.vehicleType}` : ''}
      ${data.passengers ? `Passengers: ${data.passengers}` : ''}
      ${data.fullName ? `\nContact: ${data.fullName}` : ''}
      ${data.email ? `Email: ${data.email}` : ''}
      ${data.phoneNumber ? `Phone: ${data.phoneNumber}` : ''}
    `.trim();
  }

  private buildContactUsDescription(data: ContactUsData, referenceNumber: string): string {
    return `
      Reference Number: ${referenceNumber}

      Contact Us Query:
      ----------------
      Subject: ${data.subject}
      Message: ${data.message}

      Contact Information:
      Full Name: ${data.fullName}
      Email: ${data.email}
      ${data.phoneNumber ? `Phone: ${data.phoneNumber}` : ''}
    `.trim();
  }
}

export default new QueryService();
