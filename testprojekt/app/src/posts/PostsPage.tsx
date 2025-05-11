import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applyFormatToSelection, convertToNormalFormat, convertToAsciiFormat, categorizedSpecialCharacters } from './formattingUtils';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme, Categories as EmojiCategories } from 'emoji-picker-react';
import { useQuery, getAllCustomersForSelection, createLinkedInPost, getLinkedInPostsByCustomer, updateLinkedInPost, getLinkedInPostById, getCustomerDetails, generateLinkedInPostWithAI } from 'wasp/client/operations';
import type { Customer, LinkedInPost } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { IoCopyOutline, IoTrashOutline, IoPencilOutline, IoAddCircleOutline, IoSparklesOutline } from 'react-icons/io5';
import { customerPlans, getPlanById, CustomerPlan } from '../customers/plans';

// Define types for the active editor and selection
type ActiveEditor = 'hook' | 'content' | 'cta' | null;
interface Selection {
  start: number;
  end: number;
}

const PostsPage: React.FC = () => {
  // All useState, useRef, useQuery hooks must be declared at the top level
  const [searchParams, setSearchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('postId');
  
  const [hookText, setHookText] = useState('');
  const [contentText, setContentText] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor>(null);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSpecialCharsPicker, setShowSpecialCharsPicker] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { data: customers, isLoading: isLoadingCustomers, error: customersError } = useQuery(getAllCustomersForSelection);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [savePostError, setSavePostError] = useState<string | null>(null);
  const [savePostSuccess, setSavePostSuccess] = useState<string | null>(null);
  const successMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [totalCharCount, setTotalCharCount] = useState(0);
  const [currentEditingPost, setCurrentEditingPost] = useState<LinkedInPost | null>(null);
  const { data: customerPosts, isLoading: isLoadingCustomerPosts, error: customerPostsError, refetch: refetchCustomerPosts } = useQuery(
    getLinkedInPostsByCustomer, { customerId: selectedCustomerId }, { enabled: !!selectedCustomerId }
  );
  const { 
    data: postFromUrl, 
    isLoading: originalIsLoadingPostFromUrl,
    error: postFromUrlError 
  } = useQuery(
    getLinkedInPostById, 
    { postId: postIdFromUrl || '' },
    { enabled: !!postIdFromUrl }
  );

  // Fetch details of the selected customer to get their plan and thus the post limit
  const { data: selectedCustomerDetails, isLoading: isLoadingSelectedCustomerDetails } = useQuery(
    getCustomerDetails, 
    { customerId: selectedCustomerId! }, 
    { enabled: !!selectedCustomerId }
  );

  // Determine post limit based on selected customer's plan
  const [maxPostsLimit, setMaxPostsLimit] = useState<number | null>(null);
  const [currentPlanName, setCurrentPlanName] = useState<string>('N/A');

  useEffect(() => {
    if (selectedCustomerDetails) {
      const plan = getPlanById(selectedCustomerDetails.subscriptionPlan);
      setMaxPostsLimit(plan?.maxPostsPerCustomer ?? 0);
      setCurrentPlanName(plan?.name || 'Unknown Plan');
    } else {
      setMaxPostsLimit(null); // No customer selected or details not loaded
      setCurrentPlanName('N/A');
    }
  }, [selectedCustomerDetails]);

  const hookTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const ctaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const specialCharsButtonRef = useRef<HTMLButtonElement>(null);

  const [showMagicModal, setShowMagicModal] = useState(false);
  const [magicModalText, setMagicModalText] = useState('');
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [magicModalError, setMagicModalError] = useState<string | null>(null);

  // Derived state: are we *actively* trying to load a post from URL and it hasn't finished?
  const activelyLoadingPostFromUrl = !!postIdFromUrl && originalIsLoadingPostFromUrl;

  useEffect(() => {
    setTotalCharCount(hookText.length + contentText.length + ctaText.length);
  }, [hookText, contentText, ctaText]);

  const handleLoadPostForEditing = useCallback((post: LinkedInPost) => {
    setHookText(post.hook);
    setContentText(post.content);
    setCtaText(post.cta);
    setCurrentEditingPost(post);
    setSelectedCustomerId(post.customerId);
    setSavePostError(null);
  }, []);

  const prepareNewPostEditor = useCallback(() => {
    setHookText('');
    setContentText('');
    setCtaText('');
    setCurrentEditingPost(null);
    setSavePostError(null);
    if (successMessageTimeoutRef.current) {
      clearTimeout(successMessageTimeoutRef.current);
      successMessageTimeoutRef.current = null;
    }
    setSavePostSuccess(null);
    if (searchParams.get('postId')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  useEffect(() => {
    if (postFromUrl) {
      if (!currentEditingPost || postFromUrl.id !== currentEditingPost.id) {
        handleLoadPostForEditing(postFromUrl);
      }
    }
  }, [postFromUrl, handleLoadPostForEditing, currentEditingPost]);

  useEffect(() => {
    if (!selectedCustomerId && !postIdFromUrl) {
        prepareNewPostEditor();
        return;
    }
    if (selectedCustomerId && currentEditingPost && currentEditingPost.customerId !== selectedCustomerId && !postIdFromUrl) {
        prepareNewPostEditor();
        return;
    }
  }, [selectedCustomerId, currentEditingPost, postIdFromUrl, prepareNewPostEditor, postFromUrl]);

  const handleTextChange = (
    editor: ActiveEditor,
    value: string
  ) => {
    if (editor === 'hook') setHookText(value);
    else if (editor === 'content') setContentText(value);
    else if (editor === 'cta') setCtaText(value);
  };

  const handleFocus = (editor: ActiveEditor) => {
    setActiveEditor(editor);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement, Event>) => {
    setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd });
  };
  
  const insertText = (textToInsert: string) => {
    let currentTextareaRef: React.RefObject<HTMLTextAreaElement> | null = null;
    let currentValue = '';
    let setter: ((value: string) => void) | null = null;

    if (activeEditor === 'hook') {
      currentTextareaRef = hookTextareaRef;
      currentValue = hookText;
      setter = setHookText;
    } else if (activeEditor === 'content') {
      currentTextareaRef = contentTextareaRef;
      currentValue = contentText;
      setter = setContentText;
    } else if (activeEditor === 'cta') {
      currentTextareaRef = ctaTextareaRef;
      currentValue = ctaText;
      setter = setCtaText;
    }

    if (currentTextareaRef?.current && setter) {
      const ta = currentTextareaRef.current;
      const selStart = ta.selectionStart;
      const selEnd = ta.selectionEnd;
      
      const newValue = `${currentValue.substring(0, selStart)}${textToInsert}${currentValue.substring(selEnd)}`;
      setter(newValue);

      setTimeout(() => {
        if (currentTextareaRef?.current) {
            currentTextareaRef.current.focus();
            const newCursorPos = selStart + textToInsert.length;
            currentTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const handleFormat = useCallback((formatType: 'bold' | 'italic' | 'normal') => {
    let currentTextareaRef: React.RefObject<HTMLTextAreaElement> | null = null;
    let currentValue = '';
    let setter: ((value: string) => void) | null = null;

    if (activeEditor === 'hook') {
      currentTextareaRef = hookTextareaRef; currentValue = hookText; setter = setHookText;
    } else if (activeEditor === 'content') {
      currentTextareaRef = contentTextareaRef; currentValue = contentText; setter = setContentText;
    } else if (activeEditor === 'cta') {
      currentTextareaRef = ctaTextareaRef; currentValue = ctaText; setter = setCtaText;
    }

    if (currentTextareaRef?.current && setter) {
      const ta = currentTextareaRef.current;
      const selStart = selection.start;
      const selEnd = selection.end;

      if (selStart === selEnd) {
        ta.focus();
        return;
      }

      const originalSelectedText = currentValue.substring(selStart, selEnd);

      let processedSelectedPart;
      if (formatType === 'normal') {
        processedSelectedPart = convertToNormalFormat(originalSelectedText);
      } else {
        const normalizedForNewFormat = convertToNormalFormat(originalSelectedText);
        processedSelectedPart = convertToAsciiFormat(normalizedForNewFormat, formatType);
      }
      
      const newFullText = currentValue.substring(0, selStart) + processedSelectedPart + currentValue.substring(selEnd);
      setter(newFullText);

      setTimeout(() => {
        ta.focus();
        const newCursorPos = selStart + processedSelectedPart.length;
        ta.setSelectionRange(selStart, newCursorPos);
      }, 0);
    }
  }, [activeEditor, hookText, contentText, ctaText, selection]);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    insertText(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const onSpecialCharClick = (char: string) => {
    insertText(char);
    setShowSpecialCharsPicker(false);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(combinedText)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const handleSaveOrUpdatePost = async () => {
    if (!selectedCustomerId) { setSavePostError('Please select a customer.'); return; }
    if (!hookText.trim() || !contentText.trim() || !ctaText.trim()) {
      setSavePostError('Hook, Content, and CTA cannot be empty.'); return;
    }
    setIsSavingPost(true); 
    setSavePostError(null);
    
    if (successMessageTimeoutRef.current) {
      clearTimeout(successMessageTimeoutRef.current);
      successMessageTimeoutRef.current = null;
    }
    setSavePostSuccess(null);

    try {
      let message = '';
      let newlySetPost: LinkedInPost | null = null;
      if (currentEditingPost) {
        newlySetPost = await updateLinkedInPost({ postId: currentEditingPost.id, hook: hookText, content: contentText, cta: ctaText });
        message = 'Post updated successfully!';
      } else {
        newlySetPost = await createLinkedInPost({ customerId: selectedCustomerId, hook: hookText, content: contentText, cta: ctaText });
        message = 'Post saved successfully!';
      }
      
      if(newlySetPost) setCurrentEditingPost(newlySetPost);
      
      setSavePostSuccess(message);
      
      if (selectedCustomerId) {
        refetchCustomerPosts(); 
      }
      
      successMessageTimeoutRef.current = setTimeout(() => {
        setSavePostSuccess(null);
        successMessageTimeoutRef.current = null; 
      }, 3500);

    } catch (err: any) {
      setSavePostError(err.message || 'Failed to save/update post.');
      if (successMessageTimeoutRef.current) {
        clearTimeout(successMessageTimeoutRef.current);
        successMessageTimeoutRef.current = null;
      }
      setSavePostSuccess(null);
    } finally {
      setIsSavingPost(false);
    }
  };

  useEffect(() => {
  }, [savePostSuccess]);

  // Toolbar button styling
  const toolbarButtonClass = "px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const actionButtonClass = "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50";
  const copyButtonNormalClass = "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500";
  const copyButtonCopiedClass = "bg-green-600 hover:bg-green-700 focus:ring-green-500";
  const saveButtonClass = "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500";
  const updateButtonClass = "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500";

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker) {
        const isEmojiButtonClick = emojiButtonRef.current && emojiButtonRef.current.contains(event.target as HTMLElement);
        const isClickInsideEmojiPicker = !!(event.target as HTMLElement).closest('.EmojiPickerReact');
        
        if (!isEmojiButtonClick && !isClickInsideEmojiPicker) {
          setShowEmojiPicker(false);
        }
      }

      if (showSpecialCharsPicker) {
        const isSpecialCharsButtonClick = specialCharsButtonRef.current && specialCharsButtonRef.current.contains(event.target as HTMLElement);
        const isClickInsideSpecialCharsPicker = !!(event.target as HTMLElement).closest('.special-chars-picker');
        
        if (!isSpecialCharsButtonClick && !isClickInsideSpecialCharsPicker) {
          setShowSpecialCharsPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showSpecialCharsPicker]);

  const combinedText = `${hookText}\n\n${contentText}\n\n${ctaText}`;

  // Re-add the "Create New Post" button if it was meant to stay (from your screenshot it was present)
  // This button was removed in a previous step by user request, re-adding it for context if needed by the modal flow.
  const createNewPostButton = (
    <button 
      onClick={prepareNewPostEditor} 
      className="mb-6 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex items-center">
      <IoAddCircleOutline className="mr-1 h-4 w-4" /> Create New Post
    </button>
  );

  const currentPostCount = customerPosts?.length ?? 0;
  const canCreateNewPost = maxPostsLimit !== null && currentPostCount < maxPostsLimit;
  const saveButtonDisabled = isSavingPost || 
                             !selectedCustomerId || 
                             !hookText.trim() || 
                             !contentText.trim() || 
                             !ctaText.trim() || 
                             (!currentEditingPost && !canCreateNewPost); // Disable save for new post if limit reached

  const handleGeneratePostWithAI = async () => {
    if (!magicModalText.trim()) {
      setMagicModalError('Please enter a topic for the post.');
      return;
    }
    if (!selectedCustomerId) {
      setMagicModalError('No customer selected to associate with this AI generation.'); // Should not happen if button is disabled
      return;
    }

    setIsGeneratingWithAI(true);
    setMagicModalError(null);
    try {
      const result = await generateLinkedInPostWithAI({ 
        customerId: selectedCustomerId, 
        topic: magicModalText 
      });
      // Populate editor fields with AI response
      setHookText(result.hook || '');
      setContentText(result.content || '');
      setCtaText(result.cta || '');
      
      setShowMagicModal(false); // Close modal on success
      setMagicModalText('');     // Clear modal textarea
      setCurrentEditingPost(null); // AI content is for a new post or replaces current unsaved content
      // Optionally, clear postId from URL if user was editing and now generated new content
      // if (searchParams.get('postId')) { setSearchParams({}, { replace: true }); }

    } catch (err: any) {
      setMagicModalError(err.message || 'Failed to generate post with AI.');
    } finally {
      setIsGeneratingWithAI(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">LinkedIn Post Editor</h1>
      {/* createNewPostButton can be placed here if desired, or removed if not */}
      
      {/* Minimal error display for diagnostics */}
      {customersError && <div className='bg-red-100 text-red-700 p-2 mb-2'>Error loading customers</div>}
      {postFromUrlError && <div className='bg-red-100 text-red-700 p-2 mb-2'>Error loading post from URL</div>}
      {(activelyLoadingPostFromUrl) && (
          <div className="flex justify-center items-center p-8 min-h-[300px]">
              <CgSpinner className="animate-spin text-4xl text-yellow-500" /> 
              <p className="ml-3 text-gray-600 dark:text-gray-400">Loading editor data...</p>
          </div>
      )}

      {savePostError && <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4' role='alert'>{savePostError}</div>}
      {savePostSuccess && <div className='bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4' role='alert'>{savePostSuccess}</div>}

      {/* Conditionally render loading state for the entire editor if a post is being loaded from URL and customers not yet loaded */}
      {(activelyLoadingPostFromUrl) || (isLoadingCustomers && !customers && !postIdFromUrl) ? (
          <div className="flex justify-center items-center p-8 min-h-[300px]">
              <CgSpinner className="animate-spin text-4xl text-yellow-500" /> 
              <p className="ml-3 text-gray-600 dark:text-gray-400">Loading editor data...</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Selection and Magic Wand Button (already removed wand) */}
            <div className="mb-4">
              <label htmlFor='customer-select-post' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Associate Post with Customer (Required)</label>
              <select 
                id='customer-select-post' 
                value={selectedCustomerId} 
                onChange={(e) => setSelectedCustomerId(e.target.value)} 
                disabled={isLoadingCustomers || activelyLoadingPostFromUrl} 
                className='mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50'
              >
                <option value="">-- Select a Customer --</option>
                {isLoadingCustomers ? (
                  <option disabled>Loading customers...</option>
                ) : (
                  customers?.map((c: Pick<Customer, 'id' | 'name'>) => (<option key={c.id} value={c.id}>{c.name}</option>))
                )}
              </select>
            </div>
            
            {/* Display post count and limit if a customer is selected */}
            {selectedCustomerId && !isLoadingSelectedCustomerDetails && maxPostsLimit !== null && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                Posts for {customers?.find(c => c.id === selectedCustomerId)?.name || 'selected customer'}: {currentPostCount} / {maxPostsLimit} (Plan: {currentPlanName})
                {!canCreateNewPost && !currentEditingPost && (
                  <p className="text-red-500 text-xs">Post limit reached for this plan. Upgrade or delete posts.</p>
                )}
              </div>
            )}
            
            {/* Toolbar */}
            <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center space-x-2 relative">
              <button onClick={() => handleFormat('bold')} className={toolbarButtonClass} title="Bold">𝐁</button>
              <button onClick={() => handleFormat('italic')} className={toolbarButtonClass} title="Italic">𝐼</button>
              <button ref={emojiButtonRef} onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowSpecialCharsPicker(false); }} className={toolbarButtonClass} title="Emoji">😀</button>
              <button onClick={() => handleFormat('normal')} className={toolbarButtonClass} title="Eraser">✐</button>
              <button ref={specialCharsButtonRef} onClick={() => { setShowSpecialCharsPicker(!showSpecialCharsPicker); setShowEmojiPicker(false); }} className={toolbarButtonClass} title="Special Characters">T+</button>
              <button 
                title="AI Text Generation"
                disabled={!selectedCustomerId || isLoadingCustomers || activelyLoadingPostFromUrl}
                className={`${toolbarButtonClass}`}
                onClick={() => setShowMagicModal(true)}
              >
                <IoSparklesOutline size={18} />
              </button>
              {showEmojiPicker && ( <div className="absolute z-10 top-full mt-2 left-0 emoji-picker-container"><EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} theme={EmojiTheme.AUTO} categories={[{ name: "Recently Used", category: EmojiCategories.SUGGESTED },{ name: "Smileys & People", category: EmojiCategories.SMILEYS_PEOPLE }]}/></div>)}
              {showSpecialCharsPicker && ( <div className="absolute z-10 top-full mt-2 left-0 bg-white dark:bg-gray-800 border rounded-md shadow-lg p-2 special-chars-picker" style={{width: '300px'}}>{categorizedSpecialCharacters.map(cat => (<div key={cat.category} className="mb-1"><h4 className="text-xs font-semibold text-gray-400 mb-0.5">{cat.category}</h4><div className="grid grid-cols-8 gap-0.5">{cat.symbols.map((s, i) => (<button key={`${cat.category}-${i}`} onClick={() => onSpecialCharClick(s)} className="p-1 text-lg hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex items-center justify-center" title={`Insert ${s}`}>{s}</button>))}</div></div>))}</div>)}
            </div>

            {/* Hook Textarea */}
            <div><label htmlFor="hook" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hook</label><textarea id="hook" ref={hookTextareaRef} rows={3} value={hookText} onChange={(e) => handleTextChange('hook', e.target.value)} onFocus={() => handleFocus('hook')} onSelect={handleSelect} placeholder="Engaging hook..." className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white"/></div>

            {/* Content Textarea */}
            <div><label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label><textarea id="content" ref={contentTextareaRef} rows={8} value={contentText} onChange={(e) => handleTextChange('content', e.target.value)} onFocus={() => handleFocus('content')} onSelect={handleSelect} placeholder="Main post content..." className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white"/></div>

            {/* CTA Textarea and Character Counter */}
            <div><label htmlFor="cta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CTA (Call to Action)</label><textarea id="cta" ref={ctaTextareaRef} rows={3} value={ctaText} onChange={(e) => handleTextChange('cta', e.target.value)} onFocus={() => handleFocus('cta')} onSelect={handleSelect} placeholder="Call to action..." className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white"/>{totalCharCount > 3000 ? (<p className="mt-2 text-xs text-red-600 dark:text-red-400 text-right">Warning: Post exceeds 3000 characters, which is typically the LinkedIn limit.</p>) : (<p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">Total Characters (Hook + Content + CTA): {totalCharCount} / 3000</p>)}</div>
          </div>

          {/* Column 2: Preview & Actions */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Post Preview</h2>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800 min-h-[300px]">
              <div className="flex items-start space-x-3 mb-3"><div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">SM</div><div><p className="font-semibold text-sm text-gray-900 dark:text-white">StefanAI</p><p className="text-xs text-gray-500 dark:text-gray-400">I help you generate and edit plain simple posts for LinkedIn.</p><p className="text-xs text-gray-500 dark:text-gray-400">2h • 🌍</p></div></div>
              <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{combinedText}</div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between"><span className="text-xs text-gray-500 dark:text-gray-400">🔵 47</span><span className="text-xs text-gray-500 dark:text-gray-400">12 comments &nbsp; 3 reposts</span></div>
            </div>
            <button onClick={handleCopyToClipboard} className={`${actionButtonClass} ${isCopied ? copyButtonCopiedClass : copyButtonNormalClass}`} disabled={isCopied || totalCharCount > 3000}>{isCopied ? 'Copied!' : 'Copy to Clipboard'}</button>
            <button 
              onClick={handleSaveOrUpdatePost}
              disabled={saveButtonDisabled}
              className={`${actionButtonClass} ${currentEditingPost ? updateButtonClass : saveButtonClass} ${(!currentEditingPost && !canCreateNewPost) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSavingPost ? <><CgSpinner className="animate-spin mr-2" />{currentEditingPost ? 'Updating...' : 'Saving...'}</> : (currentEditingPost ? 'Update Post' : 'Save Post')}
            </button>
            {(!currentEditingPost && !canCreateNewPost && selectedCustomerId) && (
                 <p className="text-xs text-red-500 dark:text-red-400 text-center mt-1">Post limit reached for plan: {currentPlanName}.</p>
            )}
          </div>
        </div>
      )}

      {/* Magic Wand Modal - Updated */}
      {showMagicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Post Generation</h3>
                <button onClick={() => setShowMagicModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            {magicModalError && <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm' role='alert'>{magicModalError}</div>}
            <textarea 
              value={magicModalText} 
              onChange={(e) => setMagicModalText(e.target.value)}
              rows={5}
              placeholder="Enter the main topic or idea for your LinkedIn post..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-yellow-500 focus:border-yellow-500 disabled:opacity-70"
              disabled={isGeneratingWithAI}
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => { setShowMagicModal(false); setMagicModalText(''); setMagicModalError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md shadow-sm disabled:opacity-50"
                disabled={isGeneratingWithAI}
              >
                Cancel
              </button>
              <button 
                onClick={handleGeneratePostWithAI}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 flex items-center justify-center"
                disabled={isGeneratingWithAI || !magicModalText.trim()}
              >
                {isGeneratingWithAI ? <CgSpinner className="animate-spin h-5 w-5 mr-2" /> : null}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsPage; 