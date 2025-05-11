import React, { useState, useEffect } from 'react';
import { useQuery, getSystemSettings, updateSystemSettings } from 'wasp/client/operations';
import { type AuthUser } from 'wasp/auth';
import DefaultLayout from '../../layout/DefaultLayout';
import Breadcrumb from '../../layout/Breadcrumb';
import { useRedirectHomeUnlessUserIsAdmin } from '../../useRedirectHomeUnlessUserIsAdmin';
import { CgSpinner } from 'react-icons/cg';

const AdminPromptsPage = ({ user }: { user: AuthUser }) => {
  useRedirectHomeUnlessUserIsAdmin({ user });

  const { data: settings, isLoading: isLoadingSettings, error: settingsError, refetch } = 
    useQuery(getSystemSettings);

  const [stylePrompt, setStylePrompt] = useState('');
  const [commentPrompt, setCommentPrompt] = useState('');
  const [linkedInPostGenPrompt, setLinkedInPostGenPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setStylePrompt(settings.styleAnalysisSystemPrompt || '');
      setCommentPrompt(settings.commentGenerationSystemPrompt || '');
      setLinkedInPostGenPrompt(settings.linkedInPostGenerationSystemPrompt || '');
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await updateSystemSettings({ 
        styleAnalysisSystemPrompt: stylePrompt,
        commentGenerationSystemPrompt: commentPrompt,
        linkedInPostGenerationSystemPrompt: linkedInPostGenPrompt,
      });
      setSaveSuccess('Prompts saved successfully!');
      refetch();
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save prompts.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const getErrorMessage = (e: any): string => {
      return e?.message || 'An unknown error occurred';
  }

  return (
    <DefaultLayout user={user}>
      <Breadcrumb pageName='System Prompts' />

      {isLoadingSettings && (
        <div className='flex justify-center items-center h-40'>
          <CgSpinner className='animate-spin text-3xl text-gray-500' />
        </div>
      )}
      {settingsError && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
          Error loading system settings: {getErrorMessage(settingsError)}
        </div>
      )}
      
      {settings && !isLoadingSettings && (
        <div className="space-y-8">
           {saveError && (
              <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
                Save Error: {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className='bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative' role='alert'>
                {saveSuccess}
              </div>
            )}
            
          {/* Style Analysis Prompt */}
          <div className="p-6 border border-stroke rounded-md bg-white dark:bg-boxdark dark:border-strokedark">
            <h3 className="text-lg font-medium mb-4 text-black dark:text-white">Style Analysis Prompt</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">This prompt is used to generate the style analysis for customers. Use <code>{'{{EXAMPLES}}'}</code> as a placeholder for the list of LinkedIn examples.</p>
             <textarea
                rows={10}
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                className='w-full rounded-md border border-stroke bg-gray-100 p-4 font-mono text-sm dark:border-strokedark dark:bg-boxdark-2 dark:text-gray-300 focus:border-primary focus:ring-primary'
                placeholder='Enter the system prompt for style analysis...'
              />
          </div>

          {/* Comment Generation Prompt */}
          <div className="p-6 border border-stroke rounded-md bg-white dark:bg-boxdark dark:border-strokedark">
             <h3 className="text-lg font-medium mb-4 text-black dark:text-white">Comment Generation Prompt</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">This prompt generates LinkedIn comments. Use <code>{'{{LINKEDIN_POST}}'}</code> for the original post text. You MUST define the complete JSON structure for the OpenAI output directly in this prompt. For example: '... respond ONLY with a JSON object like: <code>{`{"positive_long": [{"comment": "..."}], "neutral_short": [{"comment": "..."}]}`}</code>'.</p>
             <textarea
                rows={15}
                value={commentPrompt}
                onChange={(e) => setCommentPrompt(e.target.value)}
                className='w-full rounded-md border border-stroke bg-gray-100 p-4 font-mono text-sm dark:border-strokedark dark:bg-boxdark-2 dark:text-gray-300 focus:border-primary focus:ring-primary'
                placeholder='Enter the system prompt for comment generation...'
              />
          </div>

          {/* LinkedIn Post Generation Prompt */}
          <div className="p-6 border border-stroke rounded-md bg-white dark:bg-boxdark dark:border-strokedark">
             <h3 className="text-lg font-medium mb-4 text-black dark:text-white">LinkedIn Post Generation Prompt</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">This prompt is used by the Magic Wand to generate a LinkedIn post (Hook, Content, CTA). Use <code>{'((Topic))'}</code> for the user-provided topic and <code>{'((Style_Analysis))'}</code> for the customer's style analysis. The AI is instructed to return a JSON object with keys: "hook", "content", and "cta". Ensure your prompt guides the AI to produce this structure.</p>
             <textarea
                rows={20}
                value={linkedInPostGenPrompt}
                onChange={(e) => setLinkedInPostGenPrompt(e.target.value)}
                className='w-full rounded-md border border-stroke bg-gray-100 p-4 font-mono text-sm dark:border-strokedark dark:bg-boxdark-2 dark:text-gray-300 focus:border-primary focus:ring-primary'
                placeholder='Enter the system prompt for LinkedIn post generation...'
              />
          </div>
          
          <div className="flex justify-end">
             <button
               onClick={handleSave}
               disabled={isSaving}
               className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md transition-colors duration-200 disabled:opacity-50'
             >
               {isSaving ? (
                 <>
                   <CgSpinner className='animate-spin mr-2' /> Saving...
                 </>
               ) : (
                 'Save Prompts'
               )}
             </button>
          </div>

        </div>
      )}

    </DefaultLayout>
  );
};

export default AdminPromptsPage; 