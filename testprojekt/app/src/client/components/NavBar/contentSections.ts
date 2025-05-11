import type { NavigationItem } from './NavBar';
import { routes } from 'wasp/client/router';
import { 
  IoPeopleOutline, 
  IoChatbubblesOutline, 
  IoNewspaperOutline, 
  IoArchiveOutline 
} from 'react-icons/io5';
// Removed unused imports
// import { BlogUrl, DocsUrl } from '../../../shared/common';

// Define a new type for sidebar items that includes an optional icon
export interface SidebarNavigationItem extends NavigationItem {
  icon?: React.ElementType;
}

// Navigation items shown when the user is *not* logged in (e.g., on landing page)
export const landingPageNavigationItems: NavigationItem[] = [
  // Example: { name: 'Features', to: '/#features' }, // Link to a section on the landing page
  // Ensure no links to the removed /pricing page remain here
];

// App navigation items for the new sidebar, now with icons
export const appNavigationItems: SidebarNavigationItem[] = [
  { name: 'Customers', to: routes.CustomersRoute.to, icon: IoPeopleOutline },
  { name: 'Comments', to: routes.CommentsRoute.to, icon: IoChatbubblesOutline },
  { name: 'Posts', to: routes.PostsRoute.to, icon: IoNewspaperOutline },
  { name: 'Archive', to: routes.ArchiveRoute.to, icon: IoArchiveOutline },
  // Account and old Pricing links are already removed or were never here for appNavigationItems
];
