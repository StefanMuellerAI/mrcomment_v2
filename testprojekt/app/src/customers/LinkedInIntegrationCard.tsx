import React, { useEffect } from 'react';
import { useQuery, useAction } from 'wasp/client/operations';
import {
  getLinkedInConnectionStatusForCustomer,
  initiateLinkedInAuthForCustomer,
  disconnectLinkedInForCustomer
} from 'wasp/client/operations';
import { useLocation, useNavigate } from 'react-router-dom'; // Geändert: useHistory zu useNavigate
import { CgSpinner } from 'react-icons/cg';

interface LinkedInIntegrationCardProps {
  customerId: string;
}

const LinkedInIntegrationCard: React.FC<LinkedInIntegrationCardProps> = ({ customerId }) => {
  const location = useLocation();
  const navigate = useNavigate(); // Geändert: useHistory zu useNavigate

  const {
    data: liStatus,
    isLoading: isLoadingStatus,
    error: statusError,
    refetch: refetchLiStatus
  } = useQuery(
    getLinkedInConnectionStatusForCustomer,
    { customerId: customerId! }, 
    { enabled: !!customerId }
  );

  const initiateAuth = useAction(initiateLinkedInAuthForCustomer);
  const disconnectProfile = useAction(disconnectLinkedInForCustomer);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const linkedinStatusParam = queryParams.get('linkedin_status');
    const messageParam = queryParams.get('message');
    const descParam = queryParams.get('desc');

    if (linkedinStatusParam) {
      if (linkedinStatusParam === 'success') {
        alert('LinkedIn profile connected successfully!');
        refetchLiStatus();
      } else if (linkedinStatusParam === 'error') {
        let alertMessage = `Error: ${messageParam || 'Failed to connect LinkedIn profile.'}`;
        if (descParam) {
          alertMessage += `\nDetails: ${decodeURIComponent(descParam)}`;
        }
        alert(alertMessage);
      }
      // Query-Parameter aus URL entfernen, um bei Reload keine erneute Meldung zu zeigen
      const newPath = location.pathname;
      navigate(newPath, { replace: true }); // Geändert: history.replace zu navigate
    }
  }, [location, navigate, refetchLiStatus]); // Geändert: history zu navigate in Abhängigkeiten

  const handleConnectLinkedIn = async () => {
    if (!customerId) return;
    try {
      const { authUrl } = await initiateAuth({ customerId });
      window.location.href = authUrl; // Weiterleitung zu LinkedIn
    } catch (err: any) {
      alert(`Error initiating LinkedIn auth: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    if (!customerId) return;
    if (window.confirm('Are you sure you want to disconnect this LinkedIn profile?')) {
      try {
        await disconnectProfile({ customerId });
        alert('LinkedIn profile disconnected.');
        refetchLiStatus();
      } catch (err: any) {
        alert(`Error disconnecting LinkedIn: ${err.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md self-start">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">LinkedIn Integration</h2>
      
      {isLoadingStatus && (
        <div className='flex items-center text-gray-600 dark:text-gray-400'>
          <CgSpinner className='animate-spin mr-2 text-blue-500' />
          <span>Loading LinkedIn Status...</span>
        </div>
      )}

      {statusError && (
        <div className='text-red-500'>
          <p>Error loading LinkedIn status: {statusError.message}</p>
        </div>
      )}

      {!isLoadingStatus && !statusError && liStatus && (
        <>
          {liStatus.isConnected ? (
            <div>
              <p className="text-green-600 dark:text-green-400 mb-1">
                <span className="font-semibold">Status:</span> Connected
              </p>
              {liStatus.profileData?.localizedFirstName && (
                <p className="mb-1">
                  <span className="font-semibold">Name:</span> {' '}
                  {liStatus.profileData.localizedFirstName} {liStatus.profileData.localizedLastName}
                </p>
              )}
              {/* Safely access profile picture */}
              {liStatus.profileData?.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier && (
                <img 
                  src={liStatus.profileData.profilePicture['displayImage~'].elements[0].identifiers[0].identifier} 
                  alt="LinkedIn Profile" 
                  className="w-16 h-16 rounded-full my-3 border border-gray-300 dark:border-gray-600"
                />
              )}
              {liStatus.requiresReauth && (
                <p className="text-yellow-600 dark:text-yellow-400 my-2">
                  Attention: The connection may require re-authentication.
                </p>
              )}
              <button 
                onClick={handleDisconnectLinkedIn}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 w-full sm:w-auto"
              >
                Disconnect LinkedIn Profile
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">Connect this customer's LinkedIn profile to enable related features.</p>
              <button 
                onClick={handleConnectLinkedIn}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 w-full sm:w-auto"
              >
                Connect with LinkedIn
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LinkedInIntegrationCard; 