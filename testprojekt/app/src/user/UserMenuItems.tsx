import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { type User } from 'wasp/entities';
import { logout } from 'wasp/client/auth';
import { MdOutlineWorkspaces, MdOutlineSettings } from 'react-icons/md';
import { TfiDashboard } from 'react-icons/tfi';
import { cn } from '../client/cn';
import { IoLogOutOutline } from 'react-icons/io5';

export const UserMenuItems = ({ user, setMobileMenuOpen }: { user?: Partial<User>; setMobileMenuOpen?: any }) => {
  const path = window.location.pathname;
  const adminDashboardPath = routes.AdminRoute.to;

  const handleMobileMenuClick = () => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  const linkClassName = 'flex items-center gap-3.5 text-sm font-medium duration-300 ease-in-out hover:text-yellow-500';
  const ulPaddingClassName = cn({
    'sm:px-6': path !== adminDashboardPath,
    'px-6': path === adminDashboardPath,
  });
  const ulBaseStyles = 'flex flex-col gap-1.5 py-4';

  return (
    <>
      <ul className={`${ulBaseStyles} ${ulPaddingClassName} border-b border-stroke dark:border-strokedark`}>
        <li>
          <WaspRouterLink
            to={routes.CustomersRoute.to}
            onClick={handleMobileMenuClick}
            className={linkClassName}
          >
            <MdOutlineWorkspaces size='1.2rem' />
            LinkedIn Tools
          </WaspRouterLink>
        </li>
      </ul>
      <ul className={`${ulBaseStyles} ${ulPaddingClassName} border-b border-stroke dark:border-strokedark`}>
        <li>
          <WaspRouterLink
            to={routes.AccountRoute.to}
            onClick={handleMobileMenuClick}
            className={linkClassName}
          >
            <MdOutlineSettings size='1.2rem' />
            Account Settings
          </WaspRouterLink>
        </li>
      </ul>
      {!!user && user.isAdmin && (
        <ul className={`${ulBaseStyles} ${ulPaddingClassName} border-b border-stroke dark:border-strokedark`}>
          <li>
            <WaspRouterLink
              to={routes.AdminRoute.to}
              onClick={handleMobileMenuClick}
              className={linkClassName}
            >
              <TfiDashboard size='1.1rem' />
              Admin Dashboard
            </WaspRouterLink>
          </li>
        </ul>
      )}
      <div className={`${ulPaddingClassName} py-4`}>
        <button
          onClick={() => logout()}
          className={`${linkClassName} w-full text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500`}
        >
          <IoLogOutOutline size='1.2rem' />
          Log Out
        </button>
      </div>
    </>
  );
};
