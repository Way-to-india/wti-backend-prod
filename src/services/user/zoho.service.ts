import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { BadRequestError, InternalServerError } from '@/middlewares/handlers/errorHandler';

interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  api_domain: string;
  token_type: string;
}

interface ZohoLeadData {
  Company: string;
  Last_Name: string;
  First_Name?: string;
  Email: string;
  Phone?: string;
  Lead_Source: 'Tour Query' | 'Hotel Query' | 'Transport Query' | 'Contact Us';
  Description?: string;
  Reference_Number?: string;
  [key: string]: any;
}

interface CreateLeadPayload {
  data: ZohoLeadData[];
  trigger?: string[];
}

class ZohoService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private axiosInstance: AxiosInstance;
  private readonly ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in/oauth/v2/token';
  private readonly ZOHO_API_URL = 'https://www.zohoapis.in/crm/v2';

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && this.tokenExpiresAt > now) {
      console.log('Using cached Zoho access token');
      return this.accessToken;
    }

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

    console.log('Environment check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
    });

    if (!clientId || !clientSecret || !refreshToken) {
      const missingVars = [];
      if (!clientId) missingVars.push('ZOHO_CLIENT_ID');
      if (!clientSecret) missingVars.push('ZOHO_CLIENT_SECRET');
      if (!refreshToken) missingVars.push('ZOHO_REFRESH_TOKEN');

      throw new InternalServerError(
        `Missing Zoho credentials: ${missingVars.join(', ')}. Please check your .env file.`
      );
    }

    try {
      console.log('Requesting new Zoho access token...');
      console.log('Using Client ID:', clientId?.substring(0, 10) + '...');

      const response = await this.axiosInstance.post<ZohoTokenResponse>(
        this.ZOHO_ACCOUNTS_URL,
        null,
        {
          params: {
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
          },
        }
      );

      console.log('Zoho token response:', JSON.stringify(response.data, null, 2));

      if ('error' in response.data) {
        throw new Error(`Zoho API Error: ${response.data.error}`);
      }

      if (!response.data.access_token) {
        throw new Error(`No access token in response. Response: ${JSON.stringify(response.data)}`);
      }

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = now + (response.data.expires_in - 300) * 1000;

      console.log('Successfully obtained Zoho access token');
      return this.accessToken;
    } catch (error: any) {
      console.error('Zoho token generation failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      if (error.message?.includes('invalid_client')) {
        throw new InternalServerError(
          'Invalid ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET. Please verify: \n' +
            '1. Go to https://api-console.zoho.com/\n' +
            '2. Select your Self Client application\n' +
            '3. Copy the correct Client ID and Client Secret\n' +
            '4. Update your .env file with the correct values'
        );
      }

      if (error.message?.includes('invalid_code')) {
        throw new InternalServerError(
          'Invalid or expired ZOHO_REFRESH_TOKEN. Please generate a new refresh token:\n' +
            '1. Go to https://api-console.zoho.com/\n' +
            '2. Generate a new code with scope: ZohoCRM.modules.ALL,ZohoCRM.settings.ALL\n' +
            '3. Use that code to generate a refresh token\n' +
            '4. Update ZOHO_REFRESH_TOKEN in your .env file'
        );
      }

      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        if (errorData?.error === 'invalid_client') {
          throw new InternalServerError(
            'Invalid ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET. Please verify your credentials in Zoho API Console.'
          );
        }
        if (errorData?.error === 'invalid_code') {
          throw new InternalServerError(
            'Invalid or expired ZOHO_REFRESH_TOKEN. Please generate a new refresh token from Zoho API Console.'
          );
        }
        throw new InternalServerError(
          `Zoho authentication error: ${errorData?.error || 'Invalid credentials'}. Please check your .env file.`
        );
      }

      throw new InternalServerError(
        `Failed to authenticate with Zoho CRM: ${error.response?.data?.error || error.message}`
      );
    }
  }

  /**
   * Check if a reference number already exists in Zoho CRM
   */
  async checkReferenceNumberExists(referenceNumber: string): Promise<boolean> {
    const token = await this.getAccessToken();

    try {
      console.log(`🔍 Checking if reference number exists: ${referenceNumber}`);

      const response = await this.axiosInstance.get(`${this.ZOHO_API_URL}/Leads/search`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
        params: {
          criteria: `(Reference_Number:equals:${referenceNumber})`,
        },
      });

      const exists = response.data.data && response.data.data.length > 0;
      console.log(
        `${exists ? '❌' : '✅'} Reference number ${referenceNumber} ${exists ? 'exists' : 'is unique'}`
      );

      return exists;
    } catch (error: any) {
      // 204 means no records found, which means the reference number is unique
      if (error.response?.status === 204) {
        console.log(`✅ Reference number ${referenceNumber} is unique (204 No Content)`);
        return false;
      }

      console.error('Error checking reference number:', error.response?.data || error.message);
      // If there's an error checking, assume it doesn't exist to avoid blocking lead creation
      return false;
    }
  }

  /**
   * Create a lead in Zoho CRM
   */
  async createLead(leadData: ZohoLeadData): Promise<any> {
    try {
      const token = await this.getAccessToken();

      if (!token) {
        throw new InternalServerError('Failed to obtain Zoho access token');
      }

      const payload: CreateLeadPayload = {
        data: [leadData],
        trigger: ['approval', 'workflow', 'blueprint'],
      };

      console.log('📤 Creating lead in Zoho CRM...');
      console.log('📋 Lead Payload:', JSON.stringify(payload, null, 2));

      const response = await this.axiosInstance.post(`${this.ZOHO_API_URL}/Leads`, payload, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      });

      console.log('📥 Zoho API Response:', JSON.stringify(response.data, null, 2));

      if (response.data.data && response.data.data[0].code === 'SUCCESS') {
        console.log('✅ Lead created successfully with ID:', response.data.data[0].details.id);
        return {
          success: true,
          leadId: response.data.data[0].details.id,
          message: 'Lead created successfully',
        };
      } else {
        console.error('❌ Zoho API returned non-success code:', response.data.data[0]);
        throw new Error(response.data.data[0].message || 'Failed to create lead');
      }
    } catch (error: any) {
      console.error('❌ Zoho lead creation failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      if (error.response?.status === 400) {
        throw new BadRequestError(error.response?.data?.message || 'Invalid lead data provided');
      }

      if (error.response?.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        throw new InternalServerError(
          'Zoho authentication failed. Please verify your credentials.'
        );
      }

      throw new InternalServerError(
        `Failed to create lead in Zoho CRM: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Search for existing leads by email
   */
  async searchLeadByEmail(email: string): Promise<any[]> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get(`${this.ZOHO_API_URL}/Leads/search`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
        params: {
          email: email,
        },
      });

      return response.data.data || [];
    } catch (error: any) {
      if (error.response?.status === 204) {
        return [];
      }
      console.error('Zoho lead search failed:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Update an existing lead
   */
  async updateLead(leadId: string, updateData: Partial<ZohoLeadData>): Promise<any> {
    const token = await this.getAccessToken();

    const payload = {
      data: [{ id: leadId, ...updateData }],
    };

    try {
      const response = await this.axiosInstance.put(`${this.ZOHO_API_URL}/Leads`, payload, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      });

      if (response.data.data && response.data.data[0].code === 'SUCCESS') {
        return {
          success: true,
          message: 'Lead updated successfully',
        };
      } else {
        throw new Error(response.data.data[0].message || 'Failed to update lead');
      }
    } catch (error: any) {
      console.error('Zoho lead update failed:', error.response?.data || error.message);
      throw new InternalServerError('Failed to update lead in Zoho CRM');
    }
  }

  /**
   * Get count of tour queries for a specific email (for rate limiting)
   */
  async getTourQueryCount(email: string): Promise<number> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get(`${this.ZOHO_API_URL}/Leads/search`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
        params: {
          criteria: `(Email:equals:${email})and(Lead_Source:equals:Tour Query)`,
        },
      });

      return response.data.info?.count || 0;
    } catch (error: any) {
      if (error.response?.status === 204) {
        return 0;
      }
      console.error('Failed to get tour query count:', error);
      return 0;
    }
  }
}

export default new ZohoService();
