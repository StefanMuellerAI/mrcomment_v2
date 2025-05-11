import { routes } from 'wasp/client/router';

// Define the type for the `to` prop based on the keys of the routes object
// This assumes the `to` value is always a string path
type AppRoutePaths = typeof routes[keyof typeof routes]['to'];

interface FooterNavigationItem {
  name: string;
  to: AppRoutePaths; // Use the derived union type
}

export const footerNavigation: {
  app: FooterNavigationItem[];
  company: FooterNavigationItem[];
} = {
  app: [], 
  company: [
    { name: 'Impressum', to: routes.ImpressumRoute.to }, 
    { name: 'Datenschutz', to: routes.DatenschutzRoute.to }, 
  ],
};
