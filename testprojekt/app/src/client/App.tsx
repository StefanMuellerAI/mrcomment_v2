import './Main.css';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import NavBar from './components/NavBar/NavBar';
import CookieConsentBanner from './components/cookie-consent/Banner';
import { appNavigationItems, landingPageNavigationItems } from './components/NavBar/contentSections';
import { footerNavigation } from '../landing-page/contentSections';
import Footer from '../landing-page/components/Footer';
import { useState, useMemo, useEffect } from 'react';
import { routes } from 'wasp/client/router';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from 'wasp/client/auth';
import { useIsLandingPage } from './hooks/useIsLandingPage';

const APP_SIDEBAR_WIDTH_CLASS = 'md:pl-72';

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export default function App() {
  const location = useLocation();
  const { data: user } = useAuth();
  const isLandingPage = useIsLandingPage();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shouldDisplayLandingAuthStructure = useMemo(() => {
    return isLandingPage || location.pathname === routes.LoginRoute.build() || location.pathname === routes.SignupRoute.build();
  }, [location, isLandingPage]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith('/admin');
  }, [location]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  if (isAdminDashboard) {
    return <Outlet />;
  }

  if (user && !shouldDisplayLandingAuthStructure) {
    return (
      <div className='dark:bg-boxdark-2 dark:text-bodydark'>
        <div className='flex h-screen overflow-hidden'>
          <AppSidebar 
            navigationItems={appNavigationItems} 
            sidebarOpen={sidebarOpen} 
            setSidebarOpen={setSidebarOpen} 
          />
          <div className='relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden'>
            <AppHeader 
              user={user} 
              sidebarOpen={sidebarOpen} 
              setSidebarOpen={setSidebarOpen} 
            />
            <main>
              <div className='mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10'>
                <Outlet />
              </div>
            </main>
          </div>
        </div>
        <CookieConsentBanner />
      </div>
    );
  }

  return (
    <>
      <div className='min-h-screen dark:text-white dark:bg-boxdark-2'>
        {location.pathname !== routes.LoginRoute.build() && location.pathname !== routes.SignupRoute.build() && (
          <NavBar 
            navigationItems={landingPageNavigationItems} 
            isSidebarLayoutActive={false} 
          />
        )}
        <div className='mx-auto max-w-7xl sm:px-6 lg:px-8'>
          <Outlet />
        </div>
      </div>
      <CookieConsentBanner />
    </>
  );
}
