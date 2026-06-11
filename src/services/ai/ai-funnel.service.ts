/**
 * AI Sales Funnel Service
 *
 * Uses Claude to power intelligent lead qualification, auto-responses,
 * and smart follow-up recommendations for the WTI CRM.
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/config/db';
import {
  calculateLeadScore,
  determinePriority,
  calculateConversionProbability,
  suggestNextFollowUp,
} from '@/utils/lead-scoring.util';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AI_MODEL = 'claude-sonnet-4-5-20250929';

// ============================================
// TYPES
// ============================================

interface AIQualificationResult {
  estimatedBudgetMin: number | null;
  estimatedBudgetMax: number | null;
  quality: 'A' | 'B' | 'C';
  serviceType: 'TOUR' | 'HOTEL' | 'TRANSPORT' | 'MIXED';
  tripDurationDays: number | null;
  suggestedResponse: string;
  leadInsights: string;
  urgencyLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedTags: string[];
}

interface AIFollowUpSuggestion {
  message: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'CALL';
  urgency: 'IMMEDIATE' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK';
  reasoning: string;
}

interface DailyBriefing {
  summary: string;
  hotLeads: Array<{
    id: string;
    name: string;
    destination: string;
    score: number;
    action: string;
    reasoning: string;
  }>;
  overdueFollowUps: Array<{
    id: string;
    name: string;
    daysSinceLastContact: number;
    suggestedAction: string;
  }>;
  opportunities: string[];
  metrics: {
    totalActive: number;
    newToday: number;
    quotedPending: number;
    conversionRate: number;
    avgResponseTime: number;
  };
}

// ============================================
// CORE AI FUNCTIONS
// ============================================

export class AIFunnelService {

  /**
   * AI-qualify a new lead: estimate budget, quality, and generate auto-response
   */
  static async qualifyLead(leadId: string): Promise<AIQualificationResult> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { tag: true, category: true },
    });

    if (!lead) throw new Error('Lead not found');

    const prompt = `You are a travel sales expert for Way to India, a premium Indian tour operator.

Analyze this lead inquiry and provide qualification data:

**Lead Details:**
- Name: ${lead.fullName}
- Email: ${lead.email}
- Phone: ${lead.phoneNumber || 'Not provided'}
- City: ${lead.city || 'Not provided'}
- Destination: ${lead.destination || 'Not specified'}
- Travel Date: ${lead.travelStartDate ? lead.travelStartDate.toISOString().split('T')[0] : 'Not specified'}
- End Date: ${lead.travelEndDate ? lead.travelEndDate.toISOString().split('T')[0] : 'Not specified'}
- Number of Travelers: ${lead.numberOfTravelers || 'Not specified'}
- Budget: ${lead.budgetMin || lead.budgetMax ? `₹${lead.budgetMin || '?'} - ₹${lead.budgetMax || '?'}` : 'Not specified'}
- Special Requests: ${lead.specialRequests || 'None'}
- Source: ${lead.source}
- Additional Details: ${lead.details ? JSON.stringify(lead.details) : 'None'}

**Your Tasks:**
1. Estimate a realistic budget range in INR based on the destination, duration, and number of travelers (use Way to India market rates for India travel)
2. Rate quality: A (high-value, serious buyer), B (moderate, needs nurturing), C (low priority or unclear intent)
3. Determine service type: TOUR, HOTEL, TRANSPORT, or MIXED
4. Estimate trip duration in days
5. Write a warm, professional initial response message (in English, max 150 words) that:
   - Addresses them by first name
   - Acknowledges their specific destination/interest
   - Mentions 1-2 highlights of the destination
   - Asks 1-2 qualifying questions (budget range, hotel preference, or specific activities)
   - Creates subtle urgency if travel date is approaching
   - Ends with a friendly call-to-action
6. Provide brief insights about this lead (what makes them likely/unlikely to convert)
7. Assess urgency: HIGH (travel < 30 days), MEDIUM (30-90 days), LOW (90+ days or no date)
8. Suggest 1-2 tags that would help categorize this lead (e.g., "Pilgrimage", "Family", "Honeymoon", "Budget", "Luxury", "Group Tour")

Respond in this exact JSON format:
{
  "estimatedBudgetMin": <number in INR or null>,
  "estimatedBudgetMax": <number in INR or null>,
  "quality": "<A|B|C>",
  "serviceType": "<TOUR|HOTEL|TRANSPORT|MIXED>",
  "tripDurationDays": <number or null>,
  "suggestedResponse": "<response message text>",
  "leadInsights": "<brief analysis>",
  "urgencyLevel": "<HIGH|MEDIUM|LOW>",
  "suggestedTags": ["<tag1>", "<tag2>"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid AI response format');

      const result: AIQualificationResult = JSON.parse(jsonMatch[0]);

      // Update lead with AI qualification data
      const updatedData: any = {
        quality: result.quality as any,
        serviceType: result.serviceType as any,
        lastActivityAt: new Date(),
      };

      // Only update budget if not already set and AI estimated it
      if (!lead.budgetMin && result.estimatedBudgetMin) {
        updatedData.budgetMin = result.estimatedBudgetMin;
      }
      if (!lead.budgetMax && result.estimatedBudgetMax) {
        updatedData.budgetMax = result.estimatedBudgetMax;
      }

      // Recalculate lead score with AI-enriched data
      const leadScore = calculateLeadScore({
        budgetMin: updatedData.budgetMin || lead.budgetMin,
        budgetMax: updatedData.budgetMax || lead.budgetMax,
        travelStartDate: lead.travelStartDate,
        source: lead.source,
        numberOfTravelers: lead.numberOfTravelers,
        specialRequests: lead.specialRequests,
        destination: lead.destination,
        phoneNumber: lead.phoneNumber,
        alternatePhone: lead.alternatePhone,
      });

      updatedData.leadScore = leadScore;
      updatedData.priority = determinePriority(leadScore) as any;
      updatedData.conversionProbability = calculateConversionProbability(
        leadScore,
        lead.followUpCount,
        lead.responseTimeMinutes
      );

      // Set estimated value based on AI budget estimate
      if (result.estimatedBudgetMax && !lead.estimatedValue) {
        updatedData.estimatedValue = Math.round(
          ((result.estimatedBudgetMin || 0) + result.estimatedBudgetMax) / 2
        );
      }

      // Set next follow-up based on urgency
      if (!lead.nextFollowUpAt) {
        const followUpDate = suggestNextFollowUp(
          lead.status,
          updatedData.priority || lead.priority,
          new Date()
        );
        updatedData.nextFollowUpAt = followUpDate;
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: updatedData,
      });

      // Log AI qualification activity
      await prisma.leadActivity.create({
        data: {
          leadId,
          activityType: 'AI_QUALIFIED',
          description: `AI qualified lead: Quality ${result.quality}, Score ${leadScore}, Priority ${updatedData.priority}, Est. Value ₹${updatedData.estimatedValue || 'N/A'}`,
          metadata: {
            aiModel: AI_MODEL,
            qualification: result,
          },
        },
      });

      // Auto-create first follow-up reminder
      const existingReminder = await prisma.leadReminder.findFirst({
        where: { leadId, isCompleted: false },
      });

      if (!existingReminder) {
        const reminderDate = updatedData.nextFollowUpAt || new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours default

        // Get a default admin to assign the reminder to
        const defaultAdmin = lead.assignedToId
          ? { id: lead.assignedToId }
          : await prisma.admin.findFirst({ where: { isActive: true }, select: { id: true } });

        if (defaultAdmin) {
          await prisma.leadReminder.create({
            data: {
              leadId,
              scheduledFor: reminderDate,
              reminderType: 'FOLLOW_UP',
              notes: `AI-generated: ${result.leadInsights}. Suggested response ready.`,
              assignedToId: defaultAdmin.id,
              createdById: defaultAdmin.id,
            },
          });
        }
      }

      console.log(`[ai-funnel] Lead ${lead.referenceNumber} qualified: Score ${leadScore}, Quality ${result.quality}, Priority ${updatedData.priority}`);

      return result;
    } catch (error) {
      console.error(`[ai-funnel] Error qualifying lead ${leadId}:`, error);

      // Fallback: still calculate score even if AI fails
      const leadScore = calculateLeadScore({
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        travelStartDate: lead.travelStartDate,
        source: lead.source,
        numberOfTravelers: lead.numberOfTravelers,
        specialRequests: lead.specialRequests,
        destination: lead.destination,
        phoneNumber: lead.phoneNumber,
        alternatePhone: lead.alternatePhone,
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          leadScore,
          priority: determinePriority(leadScore) as any,
          conversionProbability: calculateConversionProbability(leadScore, 0, null),
        },
      });

      throw error;
    }
  }

  /**
   * Generate AI follow-up suggestion for a specific lead
   */
  static async suggestFollowUp(leadId: string): Promise<AIFollowUpSuggestion> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        communications: { orderBy: { createdAt: 'desc' }, take: 5 },
        notes: { orderBy: { createdAt: 'desc' }, take: 3 },
        quotations: { orderBy: { version: 'desc' }, take: 2 },
        reminders: { where: { isCompleted: true }, orderBy: { completedAt: 'desc' }, take: 3 },
      },
    });

    if (!lead) throw new Error('Lead not found');

    const daysSinceCreated = Math.floor(
      (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceLastActivity = Math.floor(
      (Date.now() - lead.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const communicationHistory = lead.communications
      .map(c => `[${c.type} ${c.direction}] ${c.createdAt.toISOString().split('T')[0]}: ${c.content?.substring(0, 100) || 'No content'}`)
      .join('\n');

    const noteHistory = lead.notes
      .map(n => `[Note] ${n.createdAt.toISOString().split('T')[0]}: ${n.content.substring(0, 100)}`)
      .join('\n');

    const prompt = `You are a travel sales follow-up expert for Way to India.

**Lead Info:**
- Name: ${lead.fullName}
- Status: ${lead.status}
- Priority: ${lead.priority}
- Score: ${lead.leadScore}/100
- Destination: ${lead.destination || 'Not specified'}
- Travel Date: ${lead.travelStartDate?.toISOString().split('T')[0] || 'Not set'}
- Travelers: ${lead.numberOfTravelers || '?'}
- Budget: ${lead.estimatedValue ? `₹${lead.estimatedValue}` : 'Unknown'}
- Days since inquiry: ${daysSinceCreated}
- Days since last activity: ${daysSinceLastActivity}
- Follow-ups completed: ${lead.followUpCount}
- Quotations sent: ${lead.quotations.length}

**Communication History:**
${communicationHistory || 'No communications logged'}

**Internal Notes:**
${noteHistory || 'No notes'}

**Task:** Generate the best follow-up approach. Consider:
- If no contact yet: first outreach should be warm and personal
- If quoted but no response: gentle nudge with value-add
- If been silent for days: re-engagement with new angle
- If travel date approaching: create urgency
- Indian market: WhatsApp preferred for quick responses, email for formal quotes

Respond in JSON:
{
  "message": "<ready-to-send follow-up message, max 100 words, conversational tone>",
  "channel": "<WHATSAPP|EMAIL|CALL>",
  "urgency": "<IMMEDIATE|TODAY|TOMORROW|THIS_WEEK>",
  "reasoning": "<why this approach, 1-2 sentences>"
}`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Generate daily AI briefing for sales team
   */
  static async generateDailyBriefing(): Promise<DailyBriefing> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all active leads
    const activeLeads = await prisma.lead.findMany({
      where: {
        status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'] },
      },
      include: {
        communications: { orderBy: { createdAt: 'desc' }, take: 1 },
        reminders: { where: { isCompleted: false }, orderBy: { scheduledFor: 'asc' }, take: 1 },
        quotations: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { leadScore: 'desc' },
    });

    // New leads today
    const newToday = await prisma.lead.count({
      where: { createdAt: { gte: startOfDay } },
    });

    // Overdue reminders
    const overdueReminders = await prisma.leadReminder.findMany({
      where: {
        scheduledFor: { lt: now },
        isCompleted: false,
        isSnoozed: false,
      },
      include: {
        lead: true,
      },
      orderBy: { scheduledFor: 'asc' },
    });

    // Conversion metrics
    const totalLeads = await prisma.lead.count();
    const convertedLeads = await prisma.lead.count({
      where: { status: { in: ['CONFIRMED', 'CLOSED_WON'] } },
    });
    const quotedLeads = await prisma.lead.count({
      where: { status: 'QUOTED' },
    });

    // Avg response time
    const leadsWithResponse = await prisma.lead.findMany({
      where: { responseTimeMinutes: { not: null } },
      select: { responseTimeMinutes: true },
    });
    const avgResponseTime = leadsWithResponse.length > 0
      ? Math.round(leadsWithResponse.reduce((sum, l) => sum + (l.responseTimeMinutes || 0), 0) / leadsWithResponse.length)
      : 0;

    // Top leads for today (highest score, active)
    const hotLeads = activeLeads
      .filter(l => l.leadScore > 0)
      .slice(0, 10);

    // Build AI summary
    const leadsSummary = hotLeads.map(l => ({
      name: l.fullName,
      destination: l.destination,
      score: l.leadScore,
      status: l.status,
      priority: l.priority,
      value: l.estimatedValue,
      daysSinceCreated: Math.floor((Date.now() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      hasQuotation: l.quotations.length > 0,
      lastCommunication: l.communications[0]?.createdAt.toISOString().split('T')[0] || 'Never',
    }));

    const prompt = `You are the AI sales manager for Way to India travel company.

**Today's Numbers:**
- Total active leads: ${activeLeads.length}
- New leads today: ${newToday}
- Quoted (pending response): ${quotedLeads}
- Conversion rate: ${totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0}%
- Avg response time: ${avgResponseTime} minutes
- Overdue follow-ups: ${overdueReminders.length}

**Top Leads by Score:**
${JSON.stringify(leadsSummary, null, 2)}

**Overdue Follow-ups:**
${overdueReminders.map(r => `- ${r.lead.fullName} (${r.lead.destination || 'No dest'}): overdue since ${r.scheduledFor.toISOString().split('T')[0]}`).join('\n') || 'None'}

Write a concise daily briefing (max 200 words) that:
1. Summarizes the day's priorities in 2-3 sentences
2. Identifies the top 3-5 leads to focus on TODAY with specific actions
3. Calls out overdue follow-ups that need immediate attention
4. Spots any opportunities or patterns (e.g., multiple leads for same destination = group deal potential)

Respond in JSON:
{
  "summary": "<concise daily summary, 2-3 sentences>",
  "hotLeads": [{"id": "<leadId>", "name": "<name>", "destination": "<dest>", "score": <score>, "action": "<specific action to take>", "reasoning": "<why>"}],
  "overdueFollowUps": [{"id": "<leadId>", "name": "<name>", "daysSinceLastContact": <days>, "suggestedAction": "<what to do>"}],
  "opportunities": ["<insight1>", "<insight2>"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid AI response');

      const aiResult = JSON.parse(jsonMatch[0]);

      // Map AI lead references back to actual IDs
      const mappedHotLeads = (aiResult.hotLeads || []).map((hl: any, idx: number) => {
        const matchedLead = hotLeads.find(l =>
          l.fullName.toLowerCase().includes(hl.name?.toLowerCase() || '') ||
          (hl.destination && l.destination?.toLowerCase().includes(hl.destination?.toLowerCase() || ''))
        ) || hotLeads[idx];

        return {
          id: matchedLead?.id || '',
          name: hl.name || matchedLead?.fullName || '',
          destination: hl.destination || matchedLead?.destination || '',
          score: matchedLead?.leadScore || 0,
          action: hl.action || '',
          reasoning: hl.reasoning || '',
        };
      });

      const mappedOverdue = (aiResult.overdueFollowUps || []).map((of: any, idx: number) => {
        const matchedReminder = overdueReminders[idx];
        return {
          id: matchedReminder?.lead?.id || '',
          name: of.name || matchedReminder?.lead?.fullName || '',
          daysSinceLastContact: of.daysSinceLastContact || 0,
          suggestedAction: of.suggestedAction || '',
        };
      });

      return {
        summary: aiResult.summary || '',
        hotLeads: mappedHotLeads,
        overdueFollowUps: mappedOverdue,
        opportunities: aiResult.opportunities || [],
        metrics: {
          totalActive: activeLeads.length,
          newToday,
          quotedPending: quotedLeads,
          conversionRate: totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0,
          avgResponseTime,
        },
      };
    } catch (error) {
      console.error('[ai-funnel] Daily briefing generation failed:', error);

      // Return data-only briefing without AI summary
      return {
        summary: `You have ${activeLeads.length} active leads, ${newToday} new today, and ${overdueReminders.length} overdue follow-ups.`,
        hotLeads: hotLeads.slice(0, 5).map(l => ({
          id: l.id,
          name: l.fullName,
          destination: l.destination || '',
          score: l.leadScore,
          action: l.status === 'NEW' ? 'Make first contact' : l.status === 'QUOTED' ? 'Follow up on quotation' : 'Check in',
          reasoning: `Score: ${l.leadScore}, Priority: ${l.priority}`,
        })),
        overdueFollowUps: overdueReminders.slice(0, 5).map(r => ({
          id: r.lead.id,
          name: r.lead.fullName,
          daysSinceLastContact: Math.floor((Date.now() - r.scheduledFor.getTime()) / (1000 * 60 * 60 * 24)),
          suggestedAction: 'Follow up immediately',
        })),
        opportunities: [],
        metrics: {
          totalActive: activeLeads.length,
          newToday,
          quotedPending: quotedLeads,
          conversionRate: totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0,
          avgResponseTime,
        },
      };
    }
  }

  /**
   * Bulk re-score all existing leads (one-time fix)
   */
  static async rescoreAllLeads(): Promise<{ updated: number; errors: number }> {
    const leads = await prisma.lead.findMany({
      select: {
        id: true,
        budgetMin: true,
        budgetMax: true,
        travelStartDate: true,
        source: true,
        numberOfTravelers: true,
        specialRequests: true,
        destination: true,
        phoneNumber: true,
        alternatePhone: true,
        responseTimeMinutes: true,
        followUpCount: true,
        status: true,
      },
    });

    let updated = 0;
    let errors = 0;

    for (const lead of leads) {
      try {
        const leadScore = calculateLeadScore({
          budgetMin: lead.budgetMin,
          budgetMax: lead.budgetMax,
          travelStartDate: lead.travelStartDate,
          source: lead.source,
          numberOfTravelers: lead.numberOfTravelers,
          specialRequests: lead.specialRequests,
          destination: lead.destination,
          phoneNumber: lead.phoneNumber,
          alternatePhone: lead.alternatePhone,
          responseTimeMinutes: lead.responseTimeMinutes,
        });

        const priority = determinePriority(leadScore);
        const conversionProbability = calculateConversionProbability(
          leadScore,
          lead.followUpCount,
          lead.responseTimeMinutes
        );

        // Auto-set next follow-up if not terminal
        let nextFollowUpAt: Date | undefined;
        if (!['CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'].includes(lead.status)) {
          nextFollowUpAt = suggestNextFollowUp(lead.status, priority, new Date());
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            leadScore,
            priority: priority as any,
            conversionProbability,
            ...(nextFollowUpAt ? { nextFollowUpAt } : {}),
          },
        });
        updated++;
      } catch (error) {
        console.error(`[ai-funnel] Error rescoring lead ${lead.id}:`, error);
        errors++;
      }
    }

    console.log(`[ai-funnel] Rescore complete: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  }

  /**
   * AI-qualify all unqualified leads (batch)
   */
  static async qualifyUnqualifiedLeads(): Promise<{ qualified: number; errors: number }> {
    const unqualifiedLeads = await prisma.lead.findMany({
      where: {
        OR: [
          { leadScore: 0 },
          { quality: null },
        ],
        status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'] },
      },
      select: { id: true, referenceNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 20, // Process in batches of 20 to avoid API rate limits
    });

    let qualified = 0;
    let errors = 0;

    for (const lead of unqualifiedLeads) {
      try {
        await this.qualifyLead(lead.id);
        qualified++;
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[ai-funnel] Error qualifying ${lead.referenceNumber}:`, error);
        errors++;
      }
    }

    return { qualified, errors };
  }

  /**
   * Get AI-generated response for a specific lead
   */
  static async getLeadResponse(leadId: string): Promise<{ response: string; channel: string }> {
    const result = await this.qualifyLead(leadId);
    return {
      response: result.suggestedResponse,
      channel: 'WHATSAPP', // Default for Indian market
    };
  }

  /**
   * Bridge to Travel Studio: Generate itinerary request data
   */
  static async generateTravelStudioRequest(leadId: string): Promise<any> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) throw new Error('Lead not found');
    if (!lead.destination) throw new Error('Lead has no destination specified');

    // Build the request payload for Travel Studio
    const studioRequest = {
      customerName: lead.fullName,
      email: lead.email,
      phone: lead.phoneNumber,
      destination: lead.destination,
      startDate: lead.travelStartDate?.toISOString().split('T')[0],
      endDate: lead.travelEndDate?.toISOString().split('T')[0],
      travelers: lead.numberOfTravelers || 2,
      adults: lead.numberOfAdults || lead.numberOfTravelers || 2,
      children: lead.numberOfChildren || 0,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      specialRequests: lead.specialRequests,
      source: 'CRM_AI_FUNNEL',
      crmLeadId: lead.id,
      crmReference: lead.referenceNumber,
    };

    // Log the bridge activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        activityType: 'TRAVEL_STUDIO_REQUEST',
        description: `Itinerary generation requested via Travel Studio for ${lead.destination}`,
        metadata: studioRequest,
      },
    });

    return studioRequest;
  }
}

export default AIFunnelService;
