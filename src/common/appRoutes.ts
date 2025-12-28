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
}

const AppRoutes = { ...Routes } as const;

type AppRoutes = typeof AppRoutes;

export default AppRoutes;
