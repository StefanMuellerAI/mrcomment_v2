import type { User } from 'wasp/entities';
// Removed imports related to payment plans as they are no longer used here
// import { SubscriptionStatus, prettyPaymentPlanName, parsePaymentPlanId } from '../payment/plans';
// import { getCustomerPortalUrl, useQuery } from 'wasp/client/operations';
import { Link as WaspRouterLink, routes } from 'wasp/client/router'; // Keep for potential future use or other links
import { logout } from 'wasp/client/auth';
import { updateEmail, updateUsername, updatePassword } from 'wasp/client/operations';
import React, { useState } from 'react';
import { CgSpinner } from 'react-icons/cg';

export default function AccountPage({ user }: { user: User }) {
  return (
    <div className='mt-10 px-6 lg:px-8 space-y-10 mb-10'>
      <AccountInfo user={user} />
      <UpdateEmailForm user={user} />
      <UpdateUsernameForm user={user} />
      <UpdatePasswordForm />
      <LogoutButton />
    </div>
  );
}

// --- Sub-Components --- //

function AccountInfo({ user }: { user: User }) {
  return (
    <div className='overflow-hidden border border-gray-900/10 shadow-lg sm:rounded-lg dark:border-gray-100/10'>
      <div className='px-4 py-5 sm:px-6 lg:px-8'>
        <h3 className='text-base font-semibold leading-6 text-gray-900 dark:text-white'>
          Account Information
        </h3>
      </div>
      <div className='border-t border-gray-900/10 dark:border-gray-100/10 px-4 py-5 sm:p-0'>
        <dl className='sm:divide-y sm:divide-gray-900/10 sm:dark:divide-gray-100/10'>
          {!!user.email && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500 dark:text-white'>Email address</dt>
              <dd className='mt-1 text-sm text-gray-900 dark:text-gray-400 sm:col-span-2 sm:mt-0'>
                {user.email}
              </dd>
            </div>
          )}
          {!!user.username && (
            <div className='py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6'>
              <dt className='text-sm font-medium text-gray-500 dark:text-white'>Username</dt>
              <dd className='mt-1 text-sm text-gray-900 dark:text-gray-400 sm:col-span-2 sm:mt-0'>
                {user.username}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

function UpdateEmailForm({ user }: { user: User }) {
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateEmail({ newEmail });
      setSuccess('Email updated successfully!');
      // Note: You might need to manually trigger a user data refresh 
      // if Wasp doesn't automatically update the `user` prop passed to the page.
    } catch (err: any) {
      setError(err.message || 'Failed to update email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='p-6 border border-gray-900/10 shadow-lg sm:rounded-lg dark:border-gray-100/10 space-y-4'>
      <h4 className='text-base font-semibold leading-6 text-gray-900 dark:text-white'>Change Email</h4>
      {error && <div className='text-red-600 text-sm'>{error}</div>}
      {success && <div className='text-green-600 text-sm'>{success}</div>}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Email Address</label>
        <input 
          type="email"
          id="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
        />
      </div>
      <button 
        type="submit" 
        disabled={isLoading || newEmail === user.email}
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
      >
        {isLoading ? <CgSpinner className='animate-spin' /> : 'Update Email'}
      </button>
    </form>
  );
}

function UpdateUsernameForm({ user }: { user: User }) {
  const [newUsername, setNewUsername] = useState(user.username || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateUsername({ newUsername });
      setSuccess('Username updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update username.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='p-6 border border-gray-900/10 shadow-lg sm:rounded-lg dark:border-gray-100/10 space-y-4'>
      <h4 className='text-base font-semibold leading-6 text-gray-900 dark:text-white'>Change Username</h4>
      {error && <div className='text-red-600 text-sm'>{error}</div>}
      {success && <div className='text-green-600 text-sm'>{success}</div>}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Username</label>
        <input 
          type="text"
          id="username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          required
          minLength={3}
          className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
        />
      </div>
      <button 
        type="submit" 
        disabled={isLoading || newUsername === user.username}
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
      >
        {isLoading ? <CgSpinner className='animate-spin' /> : 'Update Username'}
      </button>
    </form>
  );
}

function UpdatePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // SECURITY NOTE: The backend action currently doesn't implement secure verification.
      await updatePassword({ currentPassword, newPassword });
      setSuccess('Password update initiated (Backend logic pending). Please check backend TODOs for secure implementation.');
      // Clear fields after attempt
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      // Display the specific error from the backend if available (like the 501 Not Implemented)
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='p-6 border border-gray-900/10 shadow-lg sm:rounded-lg dark:border-gray-100/10 space-y-4'>
      <h4 className='text-base font-semibold leading-6 text-gray-900 dark:text-white'>Change Password</h4>
      {error && <div className='text-red-600 text-sm'>{error}</div>}
      {success && <div className='text-green-600 text-sm'>{success}</div>}
      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
        <input 
          type="password"
          id="currentPassword"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
        />
      </div>
       <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
        <input 
          type="password"
          id="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
        />
      </div>
       <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
        <input 
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white'
        />
      </div>
      <button 
        type="submit" 
        disabled={isLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
      >
        {isLoading ? <CgSpinner className='animate-spin' /> : 'Update Password'}
      </button>
       <p className='text-xs text-gray-500 dark:text-gray-400'>Note: Secure password update requires backend implementation (see TODOs in code).</p>
    </form>
  );
}

function LogoutButton() {
  return (
     <div className='inline-flex w-full justify-end'>
        <button
          onClick={logout}
          className='inline-flex justify-center py-2 px-4 border border-transparent shadow-md text-sm font-medium rounded-md text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500' // Changed color to red
        >
          logout
        </button>
      </div>
  );
}

// Removed UserCurrentPaymentPlan, getUserSubscriptionStatusDescription, prettyPrintStatus,
// prettyPrintEndOfBillingPeriod, BuyMoreButton, and CustomerPortalButton components 
// as they were only used in the removed 'Your Plan' section.
