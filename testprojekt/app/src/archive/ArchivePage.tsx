import React, { useState } from 'react';
import { useQuery, getAllLinkedInPostsForUser, deleteLinkedInPost } from 'wasp/client/operations';
import type { LinkedInPost, Customer } from 'wasp/entities'; // For constructing ArchivedPost type if needed here
import { Link } from 'wasp/client/router';
import { routes } from 'wasp/client/router';
import { CgSpinner } from 'react-icons/cg';
import { IoPencilOutline, IoTrashOutline, IoAddCircleOutline } from 'react-icons/io5';
import { TiDelete } from 'react-icons/ti';

// Define the ArchivedPost type directly in the frontend file or a shared client types file
export type ArchivedPostClient = Omit<LinkedInPost, 'user' | 'customer'> & {
  // Omit server-only resolved relations if they are not part of the query output type directly
  // The query output type `ArchivedPost` from operations.ts is what matters for `data` type.
  // For safety, we can redefine or ensure it matches.
  customer?: { name?: string | null }; // Match the structure returned by getAllLinkedInPostsForUser query
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
  // The `data` will be typed based on the Output type of the Wasp Query generic.
  // The `ArchivedPost` type from `../archive/operations.ts` is what Wasp uses for the query definition.
  // So, `data` should implicitly be `ArchivedPost[] | undefined`.
  const { data: archivedPosts, isLoading, error, refetch: refetchArchivedPosts } = useQuery(getAllLinkedInPostsForUser, {});

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteLinkedInPost({ postId });
        refetchArchivedPosts(); // Refetch the list after deletion
      } catch (err: any) {
        alert('Error deleting post: ' + (err.message || 'Something went wrong.'));
      }
    }
  };

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
      {/* Ensure archivedPosts is correctly typed here for mapping. 
          The type of post in map should be inferred from archivedPosts. 
          Explicitly casting to `any` or a client-side `ArchivedPostClient` if TS struggles. */}
      {archivedPosts && archivedPosts.length > 0 ? (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hook</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Content</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CTA</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created At</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {(archivedPosts as ArchivedPostClient[])?.map((post) => ( // Cast if needed, or let TS infer
                <tr key={post.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {post.customer?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 truncate max-w-xs" title={post.hook}>
                    {post.hook}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-sm">
                    <TruncatedText text={post.content} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 truncate max-w-xs" title={post.cta}>
                    {post.cta}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center space-x-2">
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">No archived posts found.</p>
      )}
    </div>
  );
};

export default ArchivePage; 