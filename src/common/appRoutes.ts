enum Routes {
    TOURS = '/tours',
    TOUR = '/tour',
    AUTH = '/auth',
    CITY = '/city',
    THEME = '/theme',
    QUERY = '/query',
    ZOHO = '/zoho',
    ADMIN = '/admin',
    DASHBOARD = '/dashboard'
}

const AppRoutes = { ...Routes } as const;

type AppRoutes = typeof AppRoutes;

export default AppRoutes;
