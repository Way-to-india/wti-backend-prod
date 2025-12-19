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
    MODULE = '/module'
}

const AppRoutes = { ...Routes } as const;

type AppRoutes = typeof AppRoutes;

export default AppRoutes;
