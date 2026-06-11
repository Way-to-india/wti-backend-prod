export interface CreateTourData {
  title: string;
  slug: string;
  durationDays: number;
  durationNights: number;
  price: number;
  currency: string;
  minGroupSize: number;
  maxGroupSize: number;
  isActive: boolean;
  isFeatured: boolean;
  metatitle?: string;
  metadesc?: string;
  overview?: string;
  description?: string;
  discountPrice?: number;
  bestTime?: string;
  idealFor?: string;
  difficulty?: string;
  cancellationPolicy?: string;
  travelTips?: string;
  travelTipsStructured?: unknown;
  startCityId?: string;
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  themes?: string[];
  cities?: string[];
  images?: string[];
  itinerary?: Array<{
    day: number;
    title: string;
    description: string;
    imageUrl?: string | null;
  }>;
}

export interface UpdateTourData {
  title?: string;
  slug?: string;
  metatitle?: string | null;
  metadesc?: string | null;
  overview?: string | null;
  description?: string | null;
  durationDays?: number;
  durationNights?: number;
  price?: number;
  discountPrice?: number;
  currency?: string;
  minGroupSize?: number;
  maxGroupSize?: number;
  bestTime?: string | null;
  idealFor?: string | null;
  difficulty?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  cancellationPolicy?: string | null;
  travelTips?: string | null;
  travelTipsStructured?: unknown;
  startCityId?: string | null;
  images?: string[];
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
}