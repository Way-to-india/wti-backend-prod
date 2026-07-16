enum Routes {
  TOURS = '/tours',
  TOUR = '/tour',
  AUTH = '/auth',
  CITY = '/city',
  THEME = '/theme',
  QUERY = '/query',
  ZOHO = '/zoho',
  ADMIN = '/admin',
  DASHBOARD = '/dashboard',
  ROLE = '/role',
  PERMISSION = '/permission',
  MODULE = '/module',
  REVIEW = '/reviews',
  TRAVEL_GUIDE = '/travel-guide',
  POI = '/poi',
  HERO_SLIDES = '/hero-slides',
  BLOGS = '/blogs',
  TOUR_DRAFTS = '/tour-drafts',
  USERS = '/users',
  NOTIFICATIONS = '/notifications',
  CRM = '/crm',
  ROUTE_OPTIMIZER = '/route-optimizer',
  UNESCO = '/unesco',
  SACRED = '/sacred',
}

const AppRoutes = { ...Routes } as const;

type AppRoutes = typeof AppRoutes;

export default AppRoutes;
