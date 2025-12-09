import zohoService from './zoho.service';
import { BadRequestError } from '@/middlewares/handlers/errorHandler';

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
   * Checks against Zoho to ensure uniqueness
   */
  private async generateUniqueReferenceNumber(): Promise<string> {
    let attempts = 0;

    while (attempts < this.MAX_REFERENCE_GENERATION_ATTEMPTS) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const referenceNumber = `CT-${randomNum}`;

      const exists = await zohoService.checkReferenceNumberExists(referenceNumber);

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
   * Handle Tour Query with rate limiting
   */
  async handleTourQuery(
    data: TourQueryData
  ): Promise<{ message: string; referenceNumber: string }> {
    const queryCount = await zohoService.getTourQueryCount(data.email);

    if (queryCount >= this.TOUR_QUERY_LIMIT) {
      throw new BadRequestError(
        `You have reached the maximum limit of ${this.TOUR_QUERY_LIMIT} tour queries. Please contact us directly for additional inquiries.`
      );
    }

    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildTourDescription(data, referenceNumber);

    // Based on your Zoho CRM fields
    const leadData = {
      // Standard fields
      First_Name: data.fullName.split(' ')[0],
      Last_Name: data.fullName.split(' ').slice(1).join(' ') || data.fullName.split(' ')[0],
      Company: 'Tour Enquiry',
      Email: data.email,
      Phone: data.phoneNumber,
      Lead_Source: 'Tour Query' as const,
      Description: description,

      // Custom fields (verified from your screenshots)
      Reference_Number: referenceNumber, // Single Line (Unique) field
      Travel_Theme: data.tourPackage, // Pick List field
      Adults: data.numberOfTravellers, // Number field
      Special_Requests: data.specialRequest || '', // Multi Line (Large) field
    };

    console.log('📤 Sending Tour Lead Data to Zoho:', JSON.stringify(leadData, null, 2));

    await zohoService.createLead(leadData);

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Handle Hotel Query (no rate limiting)
   */
  async handleHotelQuery(
    data: HotelQueryData
  ): Promise<{ message: string; referenceNumber: string }> {
    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildHotelDescription(data, referenceNumber);

    const leadData = {
      First_Name: data.fullName?.split(' ')[0] || 'Hotel',
      Last_Name: data.fullName?.split(' ').slice(1).join(' ') || 'Enquiry',
      Company: 'Hotel Enquiry',
      Email: data.email || `hotel-${Date.now()}@query.com`,
      Phone: data.phoneNumber,
      Lead_Source: 'Hotel Query' as const,
      Description: description,

      // Custom fields
      Reference_Number: referenceNumber,
      Preferred_Hotel_Category: data.priceRange || '', // Pick List field
    };

    console.log('📤 Sending Hotel Lead Data to Zoho:', JSON.stringify(leadData, null, 2));

    await zohoService.createLead(leadData);

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Handle Transport Query (no rate limiting)
   */
  async handleTransportQuery(
    data: TransportQueryData
  ): Promise<{ message: string; referenceNumber: string }> {
    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildTransportDescription(data, referenceNumber);

    const leadData = {
      First_Name: data.fullName?.split(' ')[0] || 'Transport',
      Last_Name: data.fullName?.split(' ').slice(1).join(' ') || 'Enquiry',
      Company: 'Transport Enquiry',
      Email: data.email || `transport-${Date.now()}@query.com`,
      Phone: data.phoneNumber,
      Lead_Source: 'Transport Query' as const,
      Description: description,

      // Custom fields
      Reference_Number: referenceNumber,
    };

    console.log('📤 Sending Transport Lead Data to Zoho:', JSON.stringify(leadData, null, 2));

    await zohoService.createLead(leadData);

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Handle Contact Us Query (no rate limiting)
   */
  async handleContactUsQuery(
    data: ContactUsData
  ): Promise<{ message: string; referenceNumber: string }> {
    const referenceNumber = await this.generateUniqueReferenceNumber();
    const description = this.buildContactUsDescription(data, referenceNumber);

    const leadData = {
      First_Name: data.fullName.split(' ')[0],
      Last_Name: data.fullName.split(' ').slice(1).join(' ') || data.fullName.split(' ')[0],
      Company: 'General Enquiry',
      Email: data.email,
      Phone: data.phoneNumber,
      Lead_Source: 'Contact Us' as const,
      Description: description,

      // Custom fields
      Reference_Number: referenceNumber,
    };

    console.log('📤 Sending Contact Lead Data to Zoho:', JSON.stringify(leadData, null, 2));

    await zohoService.createLead(leadData);

    return {
      message: this.buildSuccessMessage(referenceNumber),
      referenceNumber,
    };
  }

  /**
   * Build formatted description for tour query
   */
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

  /**
   * Build formatted description for hotel query
   */
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

  /**
   * Build formatted description for transport query
   */
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

  /**
   * Build formatted description for contact us query
   */
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
