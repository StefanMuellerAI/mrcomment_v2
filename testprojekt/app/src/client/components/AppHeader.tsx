import React from 'react';
import { type AuthUser } from 'wasp/auth';
import DropdownUser from '../../user/DropdownUser';
import { cn } from '../cn';
import DarkModeSwitcher from '../components/DarkModeSwitcher';

interface AppHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
  user: AuthUser;
}

const AppHeader: React.FC<AppHeaderProps> = ({ sidebarOpen, setSidebarOpen, user }) => {
  return (
    <header className='sticky top-0 z-999 flex w-full bg-white shadow-sm dark:bg-boxdark dark:drop-shadow-none'>
      <div className='flex flex-grow items-center justify-between px-4 py-4 md:px-6 2xl:px-11'>
        <div className='flex items-center gap-2 sm:gap-4 lg:hidden'>
          <button
            aria-controls='app-sidebar'
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
            className='z-99999 block rounded-sm border border-stroke bg-white p-1.5 shadow-sm dark:border-strokedark dark:bg-boxdark lg:hidden'
          >
            <span className='relative block h-5.5 w-5.5 cursor-pointer'>
              <span className='du-block absolute right-0 h-full w-full'>
                <span className={cn('relative top-0 left-0 my-1 block h-0.5 w-0 rounded-sm bg-black delay-[0] duration-200 ease-in-out dark:bg-white', { '!w-full delay-300': !sidebarOpen } )}></span>
                <span className={cn('relative top-0 left-0 my-1 block h-0.5 w-0 rounded-sm bg-black delay-150 duration-200 ease-in-out dark:bg-white', { 'delay-400 !w-full': !sidebarOpen } )}></span>
                <span className={cn('relative top-0 left-0 my-1 block h-0.5 w-0 rounded-sm bg-black delay-200 duration-200 ease-in-out dark:bg-white', { '!w-full delay-500': !sidebarOpen } )}></span>
              </span>
              <span className='absolute right-0 h-full w-full rotate-45'>
                <span className={cn('absolute left-2.5 top-0 block h-full w-0.5 rounded-sm bg-black delay-300 duration-200 ease-in-out dark:bg-white', { '!h-0 !delay-[0]': !sidebarOpen } )}></span>
                <span className={cn('delay-400 absolute left-0 top-2.5 block h-0.5 w-full rounded-sm bg-black duration-200 ease-in-out dark:bg-white', { '!h-0 !delay-200': !sidebarOpen } )}></span>
              </span>
            </span>
          </button>
        </div>

        <div className="hidden sm:block">
        </div>

        <div className='flex items-center gap-3 2xsm:gap-7'>
          <ul className='flex items-center gap-2 2xsm:gap-4'>
            <DarkModeSwitcher />
          </ul>
          <DropdownUser user={user} />
        </div>
      </div>
    </header>
  );
};

export default AppHeader; 