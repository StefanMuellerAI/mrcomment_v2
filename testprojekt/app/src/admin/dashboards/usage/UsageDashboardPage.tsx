import React from 'react';
import { useQuery, getGlobalUsageStats } from 'wasp/client/operations';
import { type AuthUser } from 'wasp/auth';
import DefaultLayout from '../../layout/DefaultLayout'; 
import Breadcrumb from '../../layout/Breadcrumb';
import { useRedirectHomeUnlessUserIsAdmin } from '../../useRedirectHomeUnlessUserIsAdmin';
import { CgSpinner } from 'react-icons/cg';
import { FiUsers, FiMessageSquare } from 'react-icons/fi'; // Example icons

const UsageDashboardPage = ({ user }: { user: AuthUser }) => {
  useRedirectHomeUnlessUserIsAdmin({ user });

  const { data: usageStats, isLoading, error } = useQuery(getGlobalUsageStats);

  const StatCard = ({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) => (
    <div className='rounded-sm border border-stroke bg-white py-6 px-7.5 shadow-default dark:border-strokedark dark:bg-boxdark'>
      <div className='flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4'>
        {icon}
      </div>
      <div className='mt-4 flex items-end justify-between'>
        <div>
          <h4 className='text-title-md font-bold text-black dark:text-white'>
            {value}
          </h4>
          <span className='text-sm font-medium'>{title}</span>
        </div>
      </div>
    </div>
  );

  return (
    <DefaultLayout user={user}>
      <Breadcrumb pageName='Usage Statistics' />

      {isLoading && (
        <div className='flex justify-center items-center h-40'>
          <CgSpinner className='animate-spin text-3xl text-gray-500' />
        </div>
      )}
      {error && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
          Error loading usage stats: {error.message}
        </div>
      )}
      {usageStats && !isLoading && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5'>
          <StatCard 
            title="Total Customers" 
            value={usageStats.totalCustomers} 
            icon={<FiUsers size={22} className="text-primary dark:text-white"/>} 
          />
          <StatCard 
            title="Total Comment Requests" 
            value={usageStats.totalCommentRequests} 
            icon={<FiMessageSquare size={22} className="text-primary dark:text-white"/>} 
          />
        </div>
      )}
    </DefaultLayout>
  );
};

export default UsageDashboardPage; 