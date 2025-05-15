import React, { useState } from 'react';
import { useQuery, generateComments, getAllCustomersForSelection } from 'wasp/client/operations';
import type { Customer } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { IoCopyOutline } from 'react-icons/io5';
import { cn } from '../client/cn';
import { FaTrash } from 'react-icons/fa';

// Updated interface for individual comments from the new API response
interface GeneratedComment {
    type: string; // e.g., "positive", "neutral", "negative"
    content: string;
}

// Updated interface for the overall payload from the API
interface GeneratedCommentsPayload {
    comments: GeneratedComment[];
}

// --- Helper Component: Comment Card ---
interface CommentCardProps {
  content: string; // Changed from 'comment' to 'content'
  mood: 'positive' | 'neutral' | 'negative';
}

const CommentCard: React.FC<CommentCardProps> = ({ content, mood }) => {
  const [copied, setCopied] = useState(false);

  const moodStyles = {
    positive: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700',
    neutral: 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700',
    negative: 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700',
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content).then(() => { // Use 'content' here
      setCopied(true);
      setTimeout(() => setCopied(false), 1500); // Reset after 1.5s
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy text.');
    });
  };

  return (
    <div className={cn(
      'p-4 border rounded-lg shadow-sm flex justify-between items-start space-x-3',
      moodStyles[mood]
    )}>
      <p className="text-sm text-gray-700 dark:text-gray-300 flex-grow">{content}</p> {/* Use 'content' here */}
      <button 
        onClick={copyToClipboard}
        title="Copy comment"
        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
      >
        {copied ? <span className="text-xs text-green-600">Copied!</span> : <IoCopyOutline size="16" />}
      </button>
    </div>
  );
};

const CommentsPage: React.FC = () => {
  const { data: customers, isLoading: isLoadingCustomers, error: customersError } = 
    useQuery(getAllCustomersForSelection);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [linkedInPost, setLinkedInPost] = useState<string>('');
  const [generatedComments, setGeneratedComments] = useState<GeneratedCommentsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateClick = async () => {
    if (!linkedInPost.trim() || linkedInPost.length < 50) {
      setError('Please paste a LinkedIn post (minimum 50 characters).');
      return;
    }
    if (!selectedCustomerId) {
      setError('Please select a customer.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedComments(null);
    try {
      const result = await generateComments({ linkedInPostText: linkedInPost, customerId: selectedCustomerId });
      setGeneratedComments(result);
    } catch (err: any) {
      setError(err.message || 'Failed to generate comments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='p-4 md:p-8 max-w-full mx-auto'>
      <h1 className='text-3xl font-bold text-gray-800 dark:text-white mb-8 text-center md:text-left'>Generate LinkedIn Comments</h1>

      {customersError && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 col-span-full' role='alert'>
          Error loading customers: {customersError.message}
        </div>
      )}
      {error && (
        <div className='text-red-600 text-sm mt-2 mb-4 text-center col-span-full'>{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Column 1: Inputs */}
        <div className="space-y-6">
          <div>
            <label htmlFor='customer' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Select Customer (Required)
            </label>
            <select
              id='customer'
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              disabled={isLoadingCustomers}
              className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50'
            >
              <option value="">-- Select a Customer --</option>
              {isLoadingCustomers ? (
                 <option disabled>Loading...</option>
              ) : (
                 customers?.map((customer: Pick<Customer, 'id' | 'name'>) => (
                   <option key={customer.id} value={customer.id}>{customer.name}</option>
                 ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor='linkedInPost' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Paste LinkedIn Post Here (min. 50 chars)
            </label>
            <div className="relative">
              <textarea
                id='linkedInPost'
                rows={12}
                value={linkedInPost}
                onChange={(e) => setLinkedInPost(e.target.value)}
                placeholder='Paste the full text of the LinkedIn post...'
                required
                minLength={50}
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white pr-10'
              />
            </div>
          </div>
          
          {/* ADD TRASH BUTTON HERE */}
          {linkedInPost && (
            <div className="flex justify-end mb-2"> {/* Container for right alignment and margin */}
              <button
                type="button"
                aria-label="Clear LinkedIn Post"
                className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setLinkedInPost('')}
              >
                <FaTrash size={16} />
              </button>
            </div>
          )}

          <button
            onClick={handleGenerateClick}
            disabled={isLoading || linkedInPost.length < 50 || !selectedCustomerId}
            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isLoading ? (
              <><CgSpinner className='animate-spin mr-2 text-xl' /> Generating...</>
            ) : (
              'Generate Comments'
            )}
          </button>
        </div>

        {/* Column 2: Generated Comments Display */}
        <div className="space-y-6">
          {generatedComments && generatedComments.comments && generatedComments.comments.length > 0 && (
            <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>Generated Comments</h2>
          )}
          {generatedComments && generatedComments.comments && (
            <>
              {/* Positive Comments */}
              {generatedComments.comments.filter(c => c.type === 'positive').length > 0 && (
                <div className='space-y-3'>
                  <h3 className='text-lg font-medium text-green-700 dark:text-green-400'>Positive</h3>
                  {generatedComments.comments.filter(c => c.type === 'positive').map((c, idx) => (
                    <CommentCard key={`pos-${idx}`} content={c.content} mood="positive" />
                  ))}
                </div>
              )}
              {/* Neutral Comments */}
              {generatedComments.comments.filter(c => c.type === 'neutral').length > 0 && (
                <div className='space-y-3 mt-4'> {/* Added mt-4 for spacing between types */}
                  <h3 className='text-lg font-medium text-blue-700 dark:text-blue-400'>Neutral</h3>
                  {generatedComments.comments.filter(c => c.type === 'neutral').map((c, idx) => (
                    <CommentCard key={`neu-${idx}`} content={c.content} mood="neutral" />
                  ))}
                </div>
              )}
              {/* Negative Comments */}
              {generatedComments.comments.filter(c => c.type === 'negative').length > 0 && (
                <div className='space-y-3 mt-4'> {/* Added mt-4 for spacing between types */}
                  <h3 className='text-lg font-medium text-red-700 dark:text-red-400'>Negative</h3>
                  {generatedComments.comments.filter(c => c.type === 'negative').map((c, idx) => (
                    <CommentCard key={`neg-${idx}`} content={c.content} mood="negative" />
                  ))}
                </div>
              )}
              {generatedComments.comments.length === 0 && !isLoading && (
                <p className='text-sm text-gray-500 dark:text-gray-400'>No comments were generated, or the AI did not return them in the expected format.</p>
              )}
            </>
          )}
          {isLoading && !generatedComments && (
             <div className='flex justify-center items-center h-40'>
                <CgSpinner className='animate-spin text-3xl text-gray-500' />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentsPage; 