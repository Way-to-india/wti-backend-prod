/**
 * Lead Scoring Utility
 *
 * Calculates lead score (0-100) based on multiple factors:
 * - Budget (higher budget = higher score)
 * - Travel dates (sooner = higher score)
 * - Response speed (faster = higher score)
 * - Source quality (referrals > organic > ads)
 * - Form completeness (more details = higher score)
 */

interface LeadScoringInput {
  budgetMin?: number | null;
  budgetMax?: number | null;
  travelStartDate?: Date | null;
  source: string;
  numberOfTravelers?: number | null;
  specialRequests?: string | null;
  destination?: string | null;
  phoneNumber?: string | null;
  alternatePhone?: string | null;
  responseTimeMinutes?: number | null;
}

interface ScoringWeights {
  budget: number;
  urgency: number;
  source: number;
  completeness: number;
  responseSpeed: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  budget: 0.3, // 30% weight
  urgency: 0.25, // 25% weight
  source: 0.2, // 20% weight
  completeness: 0.15, // 15% weight
  responseSpeed: 0.1, // 10% weight
};

const SOURCE_SCORES: Record<string, number> = {
  REFERRAL: 100,
  WALK_IN: 90,
  WEBSITE_FORM: 80,
  PHONE_CALL: 85,
  EMAIL: 75,
  WHATSAPP: 80,
  FACEBOOK: 60,
  INSTAGRAM: 60,
  GOOGLE_ADS: 50,
  TOUR_QUERY: 80,
  HOTEL_QUERY: 75,
  TRANSPORT_QUERY: 70,
  CONTACT_US: 70,
  OTHER: 50,
};

/**
 * Calculate budget score (0-100)
 */
function calculateBudgetScore(budgetMin?: number | null, budgetMax?: number | null): number {
  if (!budgetMin && !budgetMax) return 50; // Neutral score if no budget provided

  const avgBudget = budgetMax ? (budgetMin || 0 + budgetMax) / 2 : budgetMin || 0;

  // Score based on budget ranges (in INR)
  if (avgBudget >= 500000) return 100; // 5L+ = Premium
  if (avgBudget >= 300000) return 90; // 3L-5L = High value
  if (avgBudget >= 150000) return 80; // 1.5L-3L = Good value
  if (avgBudget >= 75000) return 70; // 75K-1.5L = Medium value
  if (avgBudget >= 50000) return 60; // 50K-75K = Standard
  if (avgBudget >= 25000) return 50; // 25K-50K = Budget
  return 40; // <25K = Low budget
}

/**
 * Calculate urgency score based on travel dates (0-100)
 */
function calculateUrgencyScore(travelStartDate?: Date | null): number {
  if (!travelStartDate) return 50; // Neutral if no date provided

  const now = new Date();
  const daysUntilTravel = Math.ceil(
    (travelStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilTravel < 0) return 0; // Past date
  if (daysUntilTravel <= 7) return 100; // Within a week = Very urgent
  if (daysUntilTravel <= 14) return 90; // Within 2 weeks = Urgent
  if (daysUntilTravel <= 30) return 80; // Within a month = High priority
  if (daysUntilTravel <= 60) return 70; // Within 2 months = Medium priority
  if (daysUntilTravel <= 90) return 60; // Within 3 months = Planning phase
  if (daysUntilTravel <= 180) return 50; // 3-6 months = Early planning
  return 40; // 6+ months = Very early
}

/**
 * Calculate source quality score (0-100)
 */
function calculateSourceScore(source: string): number {
  return SOURCE_SCORES[source] || 50;
}

/**
 * Calculate form completeness score (0-100)
 */
function calculateCompletenessScore(input: LeadScoringInput): number {
  let score = 0;
  let maxScore = 0;

  // Essential fields (higher weight)
  maxScore += 20;
  if (input.phoneNumber) score += 20;

  maxScore += 20;
  if (input.destination) score += 20;

  maxScore += 15;
  if (input.numberOfTravelers) score += 15;

  // Important fields (medium weight)
  maxScore += 15;
  if (input.budgetMin || input.budgetMax) score += 15;

  maxScore += 10;
  if (input.travelStartDate) score += 10;

  // Nice to have fields (lower weight)
  maxScore += 10;
  if (input.specialRequests) score += 10;

  maxScore += 5;
  if (input.alternatePhone) score += 5;

  maxScore += 5;
  // Check if special requests are detailed (more than 50 chars)
  if (input.specialRequests && input.specialRequests.length > 50) score += 5;

  return maxScore > 0 ? (score / maxScore) * 100 : 50;
}

/**
 * Calculate response speed score (0-100)
 */
function calculateResponseSpeedScore(responseTimeMinutes?: number | null): number {
  if (responseTimeMinutes === null || responseTimeMinutes === undefined) {
    return 50; // Neutral if not yet responded
  }

  // Faster response = higher score
  if (responseTimeMinutes <= 15) return 100; // Within 15 min = Excellent
  if (responseTimeMinutes <= 30) return 90; // Within 30 min = Very good
  if (responseTimeMinutes <= 60) return 80; // Within 1 hour = Good
  if (responseTimeMinutes <= 120) return 70; // Within 2 hours = Acceptable
  if (responseTimeMinutes <= 240) return 60; // Within 4 hours = Average
  if (responseTimeMinutes <= 480) return 50; // Within 8 hours = Below average
  if (responseTimeMinutes <= 1440) return 40; // Within 24 hours = Poor
  return 30; // 24+ hours = Very poor
}

/**
 * Main function to calculate lead score
 */
export function calculateLeadScore(
  input: LeadScoringInput,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const budgetScore = calculateBudgetScore(input.budgetMin, input.budgetMax);
  const urgencyScore = calculateUrgencyScore(input.travelStartDate);
  const sourceScore = calculateSourceScore(input.source);
  const completenessScore = calculateCompletenessScore(input);
  const responseSpeedScore = calculateResponseSpeedScore(input.responseTimeMinutes);

  const totalScore =
    budgetScore * weights.budget +
    urgencyScore * weights.urgency +
    sourceScore * weights.source +
    completenessScore * weights.completeness +
    responseSpeedScore * weights.responseSpeed;

  return Math.round(Math.min(100, Math.max(0, totalScore)));
}

/**
 * Auto-determine priority based on lead score
 */
export function determinePriority(leadScore: number): 'HOT' | 'WARM' | 'COLD' {
  if (leadScore >= 75) return 'HOT';
  if (leadScore >= 50) return 'WARM';
  return 'COLD';
}

/**
 * Calculate conversion probability (0-1)
 */
export function calculateConversionProbability(
  leadScore: number,
  followUpCount: number,
  responseTimeMinutes?: number | null
): number {
  let probability = leadScore / 100; // Base probability from score

  // Adjust based on follow-up count (more follow-ups = higher probability, up to a point)
  if (followUpCount > 0) {
    const followUpBonus = Math.min(followUpCount * 0.05, 0.2); // Max 20% bonus
    probability += followUpBonus;
  }

  // Adjust based on response time (faster response = higher probability)
  if (responseTimeMinutes !== null && responseTimeMinutes !== undefined) {
    if (responseTimeMinutes <= 60) {
      probability += 0.1; // 10% bonus for responding within 1 hour
    } else if (responseTimeMinutes <= 240) {
      probability += 0.05; // 5% bonus for responding within 4 hours
    }
  }

  // Cap at 0.95 (95%) - never 100% certain
  return Math.min(0.95, Math.max(0.05, probability));
}

/**
 * Suggest next follow-up time based on lead stage and priority
 */
export function suggestNextFollowUp(
  status: string,
  priority: 'HOT' | 'WARM' | 'COLD',
  lastContactDate: Date
): Date {
  const now = new Date();
  const hoursToAdd: Record<string, Record<string, number>> = {
    NEW: { HOT: 1, WARM: 4, COLD: 24 },
    CONTACTED: { HOT: 12, WARM: 24, COLD: 48 },
    INTERESTED: { HOT: 6, WARM: 12, COLD: 24 },
    QUOTED: { HOT: 4, WARM: 8, COLD: 24 },
    NEGOTIATING: { HOT: 2, WARM: 6, COLD: 12 },
    FOLLOW_UP_SCHEDULED: { HOT: 24, WARM: 48, COLD: 72 },
  };

  const hours = hoursToAdd[status]?.[priority] || 24;
  const followUpDate = new Date(lastContactDate);
  followUpDate.setHours(followUpDate.getHours() + hours);

  return followUpDate;
}
