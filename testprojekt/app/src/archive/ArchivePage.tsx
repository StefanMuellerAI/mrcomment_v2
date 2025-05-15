import React, { useState, useMemo } from 'react';
import { 
  useQuery, 
  useAction,
  getAllLinkedInPostsForUser, 
  deleteLinkedInPost,
  setPostSchedule,
  getAllCustomersForSelection
} from 'wasp/client/operations';
import type { LinkedInPost, Customer, Schedule } from 'wasp/entities';
import { Link } from 'wasp/client/router';
import { routes } from 'wasp/client/router';
import { CgSpinner } from 'react-icons/cg';
import { IoPencilOutline, IoTrashOutline, IoAddCircleOutline } from 'react-icons/io5';
import { TiDelete } from 'react-icons/ti';
import { FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaRegClock } from 'react-icons/fa';

// Ideally, ScheduleModal is a separate, reusable component imported directly.
// For this exercise, we use a placeholder strategy due to import complexities
// of the non-exported ScheduleModal from SchedulePage.tsx.

interface SimplifiedScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Pick<Customer, 'id' | 'name'>[] | undefined;
  isLoadingCustomers: boolean | undefined; // Adjusted to allow undefined
  selectedPostForScheduling: ArchivedPostClient | null; 
  selectedDateFromCalendar: Date | null;
  globalSelectedCustomerId: string;
  setScheduleMutation: ReturnType<typeof useAction<any, any>>;
  refetchPostsForCustomer: () => void; 
  refetchSchedulesForMonth: () => void; 
}

const ScheduleModalPlaceholder: React.FC<SimplifiedScheduleModalProps> = ({
  isOpen,
  onClose,
  selectedPostForScheduling,
  // ... other props would be used by a real modal
}) => {
  if (!isOpen) return null;
  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm'>
      <div className='bg-white dark:bg-boxdark rounded-lg shadow-xl p-6 w-full max-w-lg space-y-4'>
        <h3 className='text-xl font-semibold text-gray-800 dark:text-white'>Schedule Post (Placeholder)</h3>
        {selectedPostForScheduling && <p className='text-sm text-gray-600 dark:text-gray-400 truncate'>Post: {selectedPostForScheduling.hook}</p>}
        <p className='text-sm text-gray-500 dark:text-gray-300'>Full modal functionality (date/time pickers, reminder options) would be here.</p>
        <div className='flex justify-end space-x-3 pt-4'>
            <button onClick={onClose} className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md shadow-sm'>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export type ArchivedPostClient = LinkedInPost & {
  customer: Pick<Customer, 'id' | 'name'>; 
  schedule: Schedule | null; 
};

const TruncatedText: React.FC<{ text: string; maxLength?: number }> = ({ text, maxLength = 50 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (text.length <= maxLength) {
    return <>{text}</>;
  }
  return (
    <div className="text-sm text-gray-500 dark:text-gray-300">
      {isExpanded ? text : `${text.substring(0, maxLength)}...`}
      <button onClick={() => setIsExpanded(!isExpanded)} className="ml-2 text-blue-500 hover:underline text-xs">
        {isExpanded ? 'Show Less' : 'Show More'}
      </button>
    </div>
  );
};

const ArchivePage: React.FC = () => {
  const { data: archivedPostsData, isLoading, error, refetch: refetchArchivedPosts } = useQuery(getAllLinkedInPostsForUser, {});
  const archivedPosts: ArchivedPostClient[] | undefined = archivedPostsData as ArchivedPostClient[];

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPostForScheduling, setSelectedPostForScheduling] = useState<ArchivedPostClient | null>(null);

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery(getAllCustomersForSelection);
  const customers = customersData as Pick<Customer, 'id' | 'name'>[] | undefined;

  const setScheduleMutation = useAction(setPostSchedule);

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteLinkedInPost({ postId });
        refetchArchivedPosts();
      } catch (err: any) {
        alert('Error deleting post: ' + (err.message || 'Something went wrong.'));
      }
    }
  };

  const handleOpenScheduleModal = (post: ArchivedPostClient) => {
    setSelectedPostForScheduling(post);
    setIsScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
    setSelectedPostForScheduling(null);
    refetchArchivedPosts();
  };
  
  const noOpRefetch = () => {};

  if (isLoading) return <div className='flex justify-center items-center h-screen'><CgSpinner className='animate-spin text-4xl text-yellow-500' /></div>;
  if (error) return <div className='p-4 text-red-500'>Error loading archived posts: {error.message}</div>;

  return (
    <div className="p-4 md:p-8 max-w-full mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Posts Archive</h1>
        <Link
          to={routes.PostsRoute.to}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md transition-colors duration-200 text-sm font-medium"
        >
          <IoAddCircleOutline className="mr-2 h-5 w-5" /> Create New Post
        </Link>
      </div>
      {archivedPosts && archivedPosts.length > 0 ? (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hook</th>
                {/* <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Content</th> */}
                {/* <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CTA</th> */}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created At</th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">RELEASED</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {archivedPosts.map((post) => {
                let releaseIcon;
                let releaseTitle = 'Not Scheduled';
                const now = new Date(); // Get current time once for comparison

                if (post.schedule) {
                  const postingDate = new Date(post.schedule.postingDate);
                  if (postingDate < now) { // Posting date has passed
                    releaseIcon = <FaCheckCircle className="text-green-500 h-5 w-5" />;
                    if (post.schedule.isPosted) {
                      releaseTitle = `Posted on ${postingDate.toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}`;
                    } else {
                      releaseTitle = `Posting date ${postingDate.toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})} passed`;
                    }
                  } else { // Posting date is in the future
                    releaseIcon = <FaHourglassHalf className="text-yellow-500 h-5 w-5" />;
                    releaseTitle = `Scheduled for ${postingDate.toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}`;
                  }
                } else { // Not scheduled
                  releaseIcon = <FaTimesCircle className="text-gray-400 h-5 w-5" />;
                  // releaseTitle remains 'Not Scheduled' from initialization
                }

                const canSchedule = !post.schedule?.isPosted;
                let scheduleButtonTitle = "Schedule Post";
                if (post.schedule && !post.schedule.isPosted) {
                    scheduleButtonTitle = "Edit Schedule";
                } else if (post.schedule?.isPosted) {
                    scheduleButtonTitle = "Already Posted";
                }

                return (
                  <tr key={post.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {post.customer?.name || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 truncate max-w-xs" title={post.hook}>
                      {post.hook}
                    </td>
                    {/* <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-sm">
                      <TruncatedText text={post.content} />
                    </td> */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-center" title={releaseTitle}>
                      {releaseIcon}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium flex items-center space-x-2">
                      <Link 
                        to={routes.PostsRoute.to}
                        search={{ postId: post.id }} 
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="Edit Post"
                      >
                        <IoPencilOutline size={20} />
                      </Link>
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete Post"
                        className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TiDelete size={22} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">No archived posts found.</p>
      )}
      {isScheduleModalOpen && selectedPostForScheduling && (
        <ScheduleModalPlaceholder 
          isOpen={isScheduleModalOpen}
          onClose={handleCloseScheduleModal}
          customers={customers}
          isLoadingCustomers={isLoadingCustomers}
          selectedPostForScheduling={selectedPostForScheduling}
          selectedDateFromCalendar={null} 
          globalSelectedCustomerId={selectedPostForScheduling.customer.id} 
          setScheduleMutation={setScheduleMutation} 
          refetchPostsForCustomer={refetchArchivedPosts} 
          refetchSchedulesForMonth={noOpRefetch} 
        />
      )}
    </div>
  );
};

// The ScheduleModalComponentWrapper is removed as it was a conceptual placeholder.
// The key is that ScheduleModal from SchedulePage.tsx needs to be refactored to be standalone and importable.
// Until then, ScheduleModalPlaceholder is used directly in ArchivePage.

export default ArchivePage; 