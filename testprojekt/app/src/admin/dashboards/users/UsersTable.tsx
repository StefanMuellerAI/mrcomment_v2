import React, { useState } from 'react';
import { useQuery, updateIsUserAdminById, getUsersForAdminDashboard } from 'wasp/client/operations';
import { type User } from 'wasp/entities';
import { SubscriptionStatus } from '../../../payment/plans';
// import Checkbox from '../../../client/components/Checkbox'; // Commented out - Check path or component existence
// import UserStatus from './UserStatus'; // Commented out - Check path or component existence
import { CgSpinner } from 'react-icons/cg';

// Type for users coming from the new query
type AdminUserData = Pick<
    User, 
    'id' | 'email' | 'username' | 'isAdmin' | 'subscriptionStatus' | 'commentRequestCount'
> & {
    _count: { customers: number };
};

const UsersTable = () => {
  // Removed pagination and filter state

  // Use the new query, handle potential undefined data initially
  const { data: users, isLoading, error } = useQuery(getUsersForAdminDashboard) as { data?: AdminUserData[], isLoading: boolean, error: any };

  const handleAdminToggle = async (id: string, isAdmin: boolean) => {
    try {
      await updateIsUserAdminById({ id, isAdmin });
      // Optionally add refetch() here if the table doesn't update automatically
    } catch (err: any) {
      const errorMsg = err.message || 'Something went wrong.';      
      alert('Error updating user admin status: ' + errorMsg);
    }
  };

  // Helper function to get error message
  const getErrorMessage = (e: any): string => {
    return e?.message || 'An unknown error occurred';
  }

  return (
    <div className='rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1'>
      {/* Search and Filter UI removed */}

      <div className='max-w-full overflow-x-auto'>
        <table className='w-full table-auto'>
          <thead>
            <tr className='bg-gray-2 text-left dark:bg-meta-4'>
              <th className='min-w-[220px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11'>Username</th>
              <th className='min-w-[150px] py-4 px-4 font-medium text-black dark:text-white'>Email</th>
              <th className='min-w-[120px] py-4 px-4 font-medium text-black dark:text-white'>Subscription</th>
              <th className='py-4 px-4 font-medium text-black dark:text-white text-center'>Customers</th> {/* Centered */} 
              <th className='py-4 px-4 font-medium text-black dark:text-white text-center'>Comments</th> {/* Centered */} 
              <th className='py-4 px-4 font-medium text-black dark:text-white text-center'>Is Admin?</th> {/* Centered */} 
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className='text-center py-10'> {/* Increased padding */} 
                  <CgSpinner className='animate-spin text-3xl mx-auto text-gray-500' />
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={6} className='text-center py-4 text-red-600'>
                  Error loading users: {getErrorMessage(error)}
                </td>
              </tr>
            )}
            {/* Ensure users is an array before mapping */} 
            {!isLoading && users && users.length === 0 && (
              <tr>
                <td colSpan={6} className='text-center py-10 text-gray-500'>
                  No users found.
                </td>
              </tr>
            )}
            {/* Use optional chaining and ensure users is an array */} 
            {users?.map((user: AdminUserData) => (
              <tr key={user.id}>
                <td className='border-b border-[#eee] py-5 px-4 pl-9 dark:border-strokedark xl:pl-11'>
                  <h5 className='font-medium text-black dark:text-white'>{user.username || '-'}</h5>
                </td>
                <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                  <p className='text-black dark:text-white'>{user.email || '-'}</p>
                </td>
                <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                  {/* <UserStatus status={user.subscriptionStatus} /> */}
                  <span className="text-xs px-2 py-1 font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    {user.subscriptionStatus || 'N/A'} {/* Fallback display */} 
                  </span>
                </td>
                <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center'>
                  <p className='text-black dark:text-white'>{user._count.customers}</p>
                </td>
                <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center'>
                  <p className='text-black dark:text-white'>{user.commentRequestCount}</p>
                </td>
                <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center'> 
                  <div className="flex justify-center"> 
                    {/* <Checkbox isChecked={user.isAdmin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAdminToggle(user.id, e.target.checked)} /> */}
                    {/* Placeholder for Checkbox */} 
                    <input type="checkbox" checked={user.isAdmin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAdminToggle(user.id, e.target.checked)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination removed */}
    </div>
  );
};

export default UsersTable;
