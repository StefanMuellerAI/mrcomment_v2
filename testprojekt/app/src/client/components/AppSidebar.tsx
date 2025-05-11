import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Link as WaspRouterLink, routes } from 'wasp/client/router'; // For logo link to landing
import Logo from '../static/logo.webp'; // Corrected path assuming Sidebar.tsx is in src/client/components/
import { cn } from '../cn';
import type { SidebarNavigationItem } from './NavBar/contentSections';

interface AppSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
  navigationItems: SidebarNavigationItem[];
}

const AppSidebar = ({ sidebarOpen, setSidebarOpen, navigationItems }: AppSidebarProps) => {
  const location = useLocation();
  const { pathname } = location;

  const trigger = useRef<any>(null); // For click outside (mobile)
  const sidebar = useRef<any>(null);

  // close on click outside
  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!sidebar.current || !trigger.current) return;
      if (!sidebarOpen || sidebar.current.contains(target) || trigger.current.contains(target)) return;
      setSidebarOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, [sidebarOpen, setSidebarOpen]); // Added setSidebarOpen to deps

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }: KeyboardEvent) => {
      if (!sidebarOpen || keyCode !== 27) return;
      setSidebarOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [sidebarOpen, setSidebarOpen]); // Added setSidebarOpen to deps

  return (
    <aside
      ref={sidebar}
      className={cn(
        'absolute left-0 top-0 z-9999 flex h-screen w-72.5 flex-col overflow-y-hidden bg-gray-800 duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0',
        // sidebarOpen controls visibility on mobile/tablet, lg:static makes it always visible on desktop
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* SIDEBAR HEADER */}
      <div className='flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5'>
        <WaspRouterLink to={routes.LandingPageRoute.to} className="flex items-center gap-2">
          <img src={Logo} alt='Mr.Comment Logo' width={32} height={32} /> {/* Adjusted size slightly */}
          <span className="text-xl font-semibold text-white">Mr.Comment</span>
        </WaspRouterLink>

        {/* This button is actually for the Header to control this sidebar on mobile, 
            but the admin sidebar had a trigger ref for click outside. 
            Keeping trigger ref for that, actual button in Header.tsx */}
        <button
          ref={trigger} // This ref is used by the click-outside-to-close effect
          onClick={() => setSidebarOpen(!sidebarOpen)} // This makes this button also a toggle (might be redundant if header has one)
          aria-controls='app-sidebar'
          aria-expanded={sidebarOpen}
          className='block lg:hidden text-white' // Hidden on desktop, button primarily in Header
        >
          <svg className='fill-current' width='20' height='18' viewBox='0 0 20 18' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <path d='M19 8.175H2.98748L9.36248 1.6875C9.69998 1.35 9.69998 0.825 9.36248 0.4875C9.02498 0.15 8.49998 0.15 8.16248 0.4875L0.399976 8.3625C0.0624756 8.7 0.0624756 9.225 0.399976 9.5625L8.16248 17.4375C8.31248 17.5875 8.53748 17.7 8.76248 17.7C8.98748 17.7 9.17498 17.625 9.36248 17.475C9.69998 17.1375 9.69998 16.6125 9.36248 16.275L3.02498 9.8625H19C19.45 9.8625 19.825 9.4875 19.825 9.0375C19.825 8.55 19.45 8.175 19 8.175Z' fill='#DEE4EE'/>
          </svg>
        </button>
      </div>

      <div className='no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear'>
        <nav className='mt-5 py-4 px-4 lg:mt-9 lg:px-6'>
          <div>
            <h3 className='mb-4 ml-4 text-sm font-semibold text-bodydark2'>APP MENU</h3>
            <ul className='mb-6 flex flex-col gap-1.5'>
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                const IconComponent = item.icon;
                return (
                  <li key={item.name}>
                    <NavLink
                      to={item.to}
                      onClick={() => { if (sidebarOpen) setSidebarOpen(false); }} // Close sidebar on mobile nav click
                      className={({ isActive: navLinkIsActive }) => // Use NavLink's isActive
                        cn(
                          'group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-gray-700 dark:hover:bg-meta-4',
                          { 'bg-gray-700 dark:bg-meta-4 text-white': navLinkIsActive || isActive } // Enhanced active check
                        )
                      }
                    >
                      {IconComponent && <IconComponent className='fill-current h-5 w-5' />}
                      {item.name}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar; 