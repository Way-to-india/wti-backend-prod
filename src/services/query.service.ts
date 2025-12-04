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

  /**
   * Handle Tour Query with rate limiting
   */
  async handleTourQuery(data: TourQueryData): Promise<any> {
    const queryCount = await zohoService.getTourQueryCount(data.email);

    if (queryCount >= this.TOUR_QUERY_LIMIT) {
      throw new BadRequestError(
        `You have reached the maximum limit of ${this.TOUR_QUERY_LIMIT} tour queries. Please contact us directly for additional inquiries.`
      );
    }

    const leadData = {
      First_Name: data.fullName.split(' ')[0],
      Last_Name: data.fullName.split(' ').slice(1).join(' ') || data.fullName.split(' ')[0],
      Company: 'Tour Enquiry',
      Email: data.email,
      Phone: data.phoneNumber,
      Lead_Source: 'Tour Query' as const,
      Description: this.buildTourDescription(data),
      Tour_Package: data.tourPackage,
      Number_of_Travellers: data.numberOfTravellers,
      Departure_City: data.departureCity || '',
      Special_Request: data.specialRequest || '',
    };

    return await zohoService.createLead(leadData);
  }

  /**
   * Handle Hotel Query (no rate limiting)
   */
  async handleHotelQuery(data: HotelQueryData): Promise<any> {
    const leadData = {
      First_Name: data.fullName?.split(' ')[0] || 'Hotel',
      Last_Name: data.fullName?.split(' ').slice(1).join(' ') || 'Enquiry',
      Company: 'Hotel Enquiry',
      Email: data.email || `hotel-${Date.now()}@query.com`,
      Phone: data.phoneNumber,
      Lead_Source: 'Hotel Query' as const,
      Description: this.buildHotelDescription(data),
      Hotel_Location: data.location,
      Check_In: data.checkIn,
      Check_Out: data.checkOut,
      Rooms: data.rooms,
      Guests: data.guests,
      Price_Range: data.priceRange || '',
    };

    return await zohoService.createLead(leadData);
  }

  /**
   * Handle Transport Query (no rate limiting)
   */
  async handleTransportQuery(data: TransportQueryData): Promise<any> {
    const leadData = {
      First_Name: data.fullName?.split(' ')[0] || 'Transport',
      Last_Name: data.fullName?.split(' ').slice(1).join(' ') || 'Enquiry',
      Company: 'Transport Enquiry',
      Email: data.email || `transport-${Date.now()}@query.com`,
      Phone: data.phoneNumber,
      Lead_Source: 'Transport Query' as const,
      Description: this.buildTransportDescription(data),
      Pickup_Location: data.pickupLocation,
      Drop_Location: data.dropLocation,
      Pickup_Date: data.pickupDate,
      Pickup_Time: data.pickupTime || '',
      Vehicle_Type: data.vehicleType || '',
      Passengers: data.passengers || 0,
    };

    return await zohoService.createLead(leadData);
  }

  /**
   * Handle Contact Us Query (no rate limiting)
   */
  async handleContactUsQuery(data: ContactUsData): Promise<any> {
    const leadData = {
      First_Name: data.fullName.split(' ')[0],
      Last_Name: data.fullName.split(' ').slice(1).join(' ') || data.fullName.split(' ')[0],
      Company: 'General Enquiry',
      Email: data.email,
      Phone: data.phoneNumber,
      Lead_Source: 'Contact Us' as const,
      Description: this.buildContactUsDescription(data),
      Subject: data.subject,
      Message: data.message,
    };

    return await zohoService.createLead(leadData);
  }

  /**
   * Build formatted description for tour query
   */
  private buildTourDescription(data: TourQueryData): string {
    return `
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
  private buildHotelDescription(data: HotelQueryData): string {
    return `
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
  private buildTransportDescription(data: TransportQueryData): string {
    return `
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
  private buildContactUsDescription(data: ContactUsData): string {
    return `
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
