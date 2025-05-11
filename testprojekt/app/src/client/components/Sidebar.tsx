import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../cn'; // Corrected path
import type { SidebarNavigationItem } from './NavBar/contentSections'; // Use the new type from contentSections
import logo from '../static/logo.webp'; // Corrected path to logo
import { routes } from 'wasp/client/router'; // For logo link if used

interface SidebarProps {
  navigationItems: SidebarNavigationItem[];
  // isOpen prop is removed as sidebar is now fixed width
}

const SIDEBAR_WIDTH_CLASS = 'w-72'; // Define fixed width, e.g., 288px

const Sidebar: React.FC<SidebarProps> = ({ navigationItems }) => {
  const location = useLocation();

  // Basic styling for now, can be greatly improved
  // Hidden on small screens (mobile menu will handle it), visible and fixed on medium+
  // Width transition for open/close effect (requires isOpen to be managed by parent)
  return (
    <aside 
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex h-screen flex-col overflow-y-hidden bg-boxdark shadow-lg dark:bg-boxdark-2 lg:translate-x-0',
        'hidden md:flex', // Hidden on small, flex on medium and up
        SIDEBAR_WIDTH_CLASS // Apply fixed width
      )}
    >
      {/* SIDEBAR HEADER */} 
      <div className="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5 border-b border-stroke dark:border-strokedark">
        <Link to={routes.LandingPageRoute.to} className='flex items-center'>
          <img src={logo} alt="Logo" className="h-8 w-auto" />
          <span className="ml-3 text-xl font-semibold text-white">Mr.Comment</span>
        </Link>
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mt-5 py-4 px-4 lg:mt-6 lg:px-6">
          {/* Menu Group Example (Optional, if you have subheadings like "MENU" in admin) */} 
          {/* 
          <div>
            <h3 className="mb-4 ml-4 text-sm font-semibold text-bodydark2">MENU</h3>
            <ul className="mb-6 flex flex-col gap-1.5">
              // map items here
            </ul>
          </div> 
          */} 
          {/* For a single list of items: */}
          <ul className="flex flex-col gap-1.5">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    to={item.to}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4',
                      { 'bg-graydark dark:bg-meta-4 text-white': isActive } // Active state: bg and white text
                    )}
                  >
                    {Icon && <Icon className={cn('h-5 w-5')} />}
                    <span className="truncate">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar; 