/**
 * Response Time Tracking Utility
 *
 * Handles response time calculations and alert thresholds
 */

export interface ResponseTimeAlert {
  level: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  message: string;
  shouldEscalate: boolean;
  minutesOverdue?: number;
}

export interface ResponseTimeThresholds {
  HOT: number; // minutes
  WARM: number; // minutes
  COLD: number; // minutes
}

// Default thresholds in minutes
export const DEFAULT_THRESHOLDS: ResponseTimeThresholds = {
  HOT: 60, // 1 hour
  WARM: 240, // 4 hours
  COLD: 1440, // 24 hours
};

/**
 * Calculate response time in minutes
 */
export function calculateResponseTime(createdAt: Date, firstResponseAt: Date): number {
  const diffMs = firstResponseAt.getTime() - createdAt.getTime();
  return Math.round(diffMs / (1000 * 60)); // Convert to minutes
}

/**
 * Calculate time elapsed since lead creation (for pending leads)
 */
export function calculateTimeElapsed(createdAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.round(diffMs / (1000 * 60)); // Convert to minutes
}

/**
 * Get response time alert based on priority and elapsed time
 */
export function getResponseTimeAlert(
  priority: 'HOT' | 'WARM' | 'COLD',
  minutesElapsed: number,
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): ResponseTimeAlert {
  const threshold = thresholds[priority];
  const minutesOverdue = minutesElapsed - threshold;

  if (minutesElapsed < threshold * 0.5) {
    // Less than 50% of threshold - all good
    return {
      level: 'GREEN',
      message: 'On track',
      shouldEscalate: false,
    };
  }

  if (minutesElapsed < threshold * 0.75) {
    // 50-75% of threshold - warning
    return {
      level: 'YELLOW',
      message: `Approaching response deadline (${formatMinutes(threshold - minutesElapsed)} remaining)`,
      shouldEscalate: false,
    };
  }

  if (minutesElapsed < threshold) {
    // 75-100% of threshold - urgent
    return {
      level: 'ORANGE',
      message: `Response needed soon (${formatMinutes(threshold - minutesElapsed)} remaining)`,
      shouldEscalate: false,
    };
  }

  // Over threshold - critical
  const escalate = minutesOverdue > threshold * 0.5; // Escalate if 50% over threshold

  return {
    level: 'RED',
    message: `Response overdue by ${formatMinutes(minutesOverdue)}`,
    shouldEscalate: escalate,
    minutesOverdue,
  };
}

/**
 * Format minutes into human-readable string
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${days}d ${remainingHours}h`;
}

/**
 * Format response time for display
 */
export function formatResponseTime(minutes: number): string {
  return formatMinutes(minutes);
}

/**
 * Check if lead is overdue for response
 */
export function isOverdueForResponse(
  priority: 'HOT' | 'WARM' | 'COLD',
  createdAt: Date,
  firstResponseAt: Date | null,
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): boolean {
  if (firstResponseAt) return false; // Already responded

  const minutesElapsed = calculateTimeElapsed(createdAt);
  const threshold = thresholds[priority];

  return minutesElapsed > threshold;
}

/**
 * Get time remaining until response deadline
 */
export function getTimeUntilDeadline(
  priority: 'HOT' | 'WARM' | 'COLD',
  createdAt: Date,
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): number {
  const minutesElapsed = calculateTimeElapsed(createdAt);
  const threshold = thresholds[priority];

  return Math.max(0, threshold - minutesElapsed);
}

/**
 * Calculate response time performance score (0-100)
 */
export function calculateResponsePerformanceScore(
  priority: 'HOT' | 'WARM' | 'COLD',
  responseTimeMinutes: number,
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): number {
  const threshold = thresholds[priority];

  if (responseTimeMinutes <= threshold * 0.25) return 100; // Excellent - within 25%
  if (responseTimeMinutes <= threshold * 0.5) return 90; // Very good - within 50%
  if (responseTimeMinutes <= threshold * 0.75) return 80; // Good - within 75%
  if (responseTimeMinutes <= threshold) return 70; // Acceptable - within threshold
  if (responseTimeMinutes <= threshold * 1.5) return 50; // Below average - 50% over
  if (responseTimeMinutes <= threshold * 2) return 30; // Poor - 2x threshold
  return 10; // Very poor - 2x+ threshold
}

/**
 * Get leads that need escalation
 */
export function shouldEscalateToSuperAdmin(
  priority: 'HOT' | 'WARM' | 'COLD',
  createdAt: Date,
  firstResponseAt: Date | null,
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): boolean {
  if (firstResponseAt) return false; // Already responded

  const minutesElapsed = calculateTimeElapsed(createdAt);
  const threshold = thresholds[priority];

  // Escalate if 150% over threshold
  return minutesElapsed > threshold * 1.5;
}

/**
 * Get response time statistics for an admin
 */
export interface ResponseTimeStats {
  averageResponseTime: number;
  medianResponseTime: number;
  fastestResponse: number;
  slowestResponse: number;
  withinThreshold: number;
  overThreshold: number;
  performanceScore: number;
}

export function calculateResponseTimeStats(
  responseTimes: number[],
  priority: 'HOT' | 'WARM' | 'COLD',
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): ResponseTimeStats {
  if (responseTimes.length === 0) {
    return {
      averageResponseTime: 0,
      medianResponseTime: 0,
      fastestResponse: 0,
      slowestResponse: 0,
      withinThreshold: 0,
      overThreshold: 0,
      performanceScore: 0,
    };
  }

  const sorted = [...responseTimes].sort((a, b) => a - b);
  const threshold = thresholds[priority];

  const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];

  const withinThreshold = responseTimes.filter((time) => time <= threshold).length;
  const overThreshold = responseTimes.length - withinThreshold;

  // Calculate overall performance score
  const individualScores = responseTimes.map((time) =>
    calculateResponsePerformanceScore(priority, time, thresholds)
  );
  const performanceScore = Math.round(
    individualScores.reduce((sum, score) => sum + score, 0) / individualScores.length
  );

  return {
    averageResponseTime: Math.round(average),
    medianResponseTime: median,
    fastestResponse: fastest,
    slowestResponse: slowest,
    withinThreshold,
    overThreshold,
    performanceScore,
  };
}

/**
 * Get response time category
 */
export function getResponseTimeCategory(
  priority: 'HOT' | 'WARM' | 'COLD',
  responseTimeMinutes: number,
  thresholds: ResponseTimeThresholds = DEFAULT_THRESHOLDS
): 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'VERY_POOR' {
  const threshold = thresholds[priority];

  if (responseTimeMinutes <= threshold * 0.5) return 'EXCELLENT';
  if (responseTimeMinutes <= threshold) return 'GOOD';
  if (responseTimeMinutes <= threshold * 1.5) return 'ACCEPTABLE';
  if (responseTimeMinutes <= threshold * 2) return 'POOR';
  return 'VERY_POOR';
}
