// Server component wrapper — lets us export the route segment config
// while keeping all the actual UI logic in layout-client.js (a 'use client' component)
export const dynamic = 'force-dynamic'; // never statically prerender dashboard routes

import DashboardLayoutClient from './layout-client';

export default function DashboardLayout({ children }) {
    return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
