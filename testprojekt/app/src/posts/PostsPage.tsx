import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applyFormatToSelection, convertToNormalFormat, convertToAsciiFormat, categorizedSpecialCharacters } from './formattingUtils';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme, Categories as EmojiCategories } from 'emoji-picker-react';
import { useQuery, getAllCustomersForSelection, createLinkedInPost, getLinkedInPostsByCustomer, updateLinkedInPost, getLinkedInPostById, getCustomerDetails, generateLinkedInPostWithAI, saveAndPublishLinkedInPost, getPresignedUrlForPostImage, getPostImageDownloadUrl } from 'wasp/client/operations';
import type { Customer, LinkedInPost } from 'wasp/entities';
import { CgSpinner } from 'react-icons/cg';
import { 
  IoCopyOutline, IoTrashOutline, IoPencilOutline, IoAddCircleOutline, IoSparklesOutline, IoImageOutline, 
  IoThumbsUpOutline, IoChatbubbleOutline, IoShareSocialOutline, IoSendOutline // Added new icons for preview
} from 'react-icons/io5';
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
  
  // States for the new "Save & Publish Immediately" button - ENSURE THESE ARE PRESENT
  const [isSavingAndPublishing, setIsSavingAndPublishing] = useState(false);
  const [saveAndPublishError, setSaveAndPublishError] = useState<string | null>(null);
  const [saveAndPublishSuccess, setSaveAndPublishSuccess] = useState<string | null>(null);

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
  const [isPremiumCustomer, setIsPremiumCustomer] = useState<boolean>(false);

  useEffect(() => {
    if (selectedCustomerDetails) {
      const plan = getPlanById(selectedCustomerDetails.subscriptionPlan);
      setMaxPostsLimit(plan?.maxPostsPerCustomer ?? 0);
      setCurrentPlanName(plan?.name || 'Unknown Plan');
      setIsPremiumCustomer(plan?.id === 'premium_tier');
    } else {
      setMaxPostsLimit(null); // No customer selected or details not loaded
      setCurrentPlanName('N/A');
      setIsPremiumCustomer(false);
    }
  }, [selectedCustomerDetails]);

  const hookTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const ctaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const specialCharsButtonRef = useRef<HTMLButtonElement>(null);

  // State for AI Post Generation Modal
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [magicModalText, setMagicModalText] = useState('');
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [magicModalError, setMagicModalError] = useState<string | null>(null);
  const [aiInputType, setAiInputType] = useState<'text' | 'pdf' | 'url'>('text'); // New state for input type
  const [aiPdfFile, setAiPdfFile] = useState<File | null>(null); // New state for PDF file (mockup)
  const [aiUrlInput, setAiUrlInput] = useState(''); // New state for URL input

  // State for Post Image Upload
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImageError, setPostImageError] = useState<string | null>(null);
  const postImageInputRef = useRef<HTMLInputElement>(null);
  const [postImagePreviewUrl, setPostImagePreviewUrl] = useState<string | null>(null); // New state for image preview URL
  const [s3FileKey, setS3FileKey] = useState<string | null>(null);
  const [imageContentType, setImageContentType] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Derived state: are we *actively* trying to load a post from URL and it hasn't finished?
  const activelyLoadingPostFromUrl = !!postIdFromUrl && originalIsLoadingPostFromUrl;

  useEffect(() => {
    setTotalCharCount(hookText.length + contentText.length + ctaText.length);
  }, [hookText, contentText, ctaText]);

  const handleLoadPostForEditing = useCallback(async (post: LinkedInPost) => {
    setHookText(post.hook);
    setContentText(post.content);
    setCtaText(post.cta);
    setCurrentEditingPost(post);
    setSelectedCustomerId(post.customerId);
    setSavePostError(null);
    setSaveAndPublishError(null);
    
    setPostImageFile(null);
    setPostImagePreviewUrl(null); 
    setPostImageError(null);
    setS3FileKey(null);
    setImageContentType(null); 
    setIsUploadingImage(false);
    setImageUploadError(null);

    if (post.imageS3Key) {
      setS3FileKey(post.imageS3Key);
      if (post.imageContentType) {
        setImageContentType(post.imageContentType);
      }
      try {
        const downloadUrl = await getPostImageDownloadUrl({ s3Key: post.imageS3Key });
        setPostImagePreviewUrl(downloadUrl);
      } catch (error: any) {
        console.error("Failed to get image download URL for preview:", error);
        setPostImageError("Could not load image preview. " + (error.message || ''));
      }
    }
  }, []);

  const prepareNewPostEditor = useCallback(() => {
    setHookText('');
    setContentText('');
    setCtaText('');
    setCurrentEditingPost(null);
    setSavePostError(null);
    setSaveAndPublishError(null);
    if (successMessageTimeoutRef.current) {
      clearTimeout(successMessageTimeoutRef.current);
      successMessageTimeoutRef.current = null;
    }
    setSavePostSuccess(null);
    setSaveAndPublishSuccess(null);
    if (searchParams.get('postId')) {
      setSearchParams({}, { replace: true });
    }
    setPostImageFile(null);
    setPostImagePreviewUrl(null);
    setPostImageError(null);
    setS3FileKey(null);
    setImageContentType(null);
    setIsUploadingImage(false);
    setImageUploadError(null);
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
    if (!selectedCustomerId) {
      setSavePostError('Please select a customer first.');
      return;
    }

    // Check for post limit before saving
    if (!currentEditingPost && maxPostsLimit !== null && customerPosts && customerPosts.length >= maxPostsLimit) {
        setSavePostError(`Post limit of ${maxPostsLimit} for plan \"${currentPlanName}\" reached. Please upgrade or delete posts.`)
        return;
    }

    setIsSavingPost(true);
    setSavePostError(null);
    setSavePostSuccess(null);

    const postData = {
      customerId: selectedCustomerId,
      hook: hookText,
      content: contentText,
      cta: ctaText,
      imageS3Key: s3FileKey, 
      imageContentType: imageContentType,
    };

    // ADDED CONSOLE LOG HERE
    console.log("[PostsPage] handleSaveOrUpdatePost - Data being sent:", postData);

    try {
      let savedPost;
      if (currentEditingPost) {
        // Update existing post
        savedPost = await updateLinkedInPost({
          postId: currentEditingPost.id,
          ...postData
        });
        setSavePostSuccess('Post updated successfully!');
      } else {
        // Create new post
        savedPost = await createLinkedInPost({
          ...postData
        });
        setSavePostSuccess('Post created successfully!');
        // If it was a new post, set it for further editing
        setCurrentEditingPost(savedPost);
        // Optional: Update URL if you want to reflect the new post ID
        // setSearchParams({ postId: savedPost.id }, { replace: true });
      }
      
      // Refetch customer posts to update the list
      if (selectedCustomerId) {
        refetchCustomerPosts();
      }
      
      // Set a timeout to clear the success message
      successMessageTimeoutRef.current = setTimeout(() => {
        setSavePostSuccess(null);
      }, 5000);

    } catch (err: any) {
      console.error('Error saving post:', err);
      setSavePostError(err.message || 'An error occurred while saving the post.');
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleSaveAndPublishImmediately = async () => {
    if (!selectedCustomerId) {
      setSaveAndPublishError("Please select a customer first.");
      return;
    }
    if (!isPremiumCustomer) {
        setSaveAndPublishError("This feature is only available for premium customers.");
        return;
    }
    if (isUploadingImage) {
      setSaveAndPublishError("Please wait for the image to finish uploading.");
      return;
    }

    setIsSavingAndPublishing(true);
    setSaveAndPublishError(null);
    setSaveAndPublishSuccess(null);

    try {
      const postDetailsToPublish: any = { // Use any for now, will be typed by Zod on backend
        customerId: selectedCustomerId,
        hook: hookText,
        content: contentText,
        cta: ctaText,
        imageS3Key: s3FileKey,
        imageContentType: imageContentType, // Use the state variable imageContentType here
      };

      // If currentEditingPost exists, pass its ID to update it before publishing
      if (currentEditingPost && currentEditingPost.id) {
        postDetailsToPublish.postId = currentEditingPost.id;
      }
      
      console.log("[PostsPage] handleSaveAndPublishImmediately - Data being sent:", postDetailsToPublish);

      const publishedPost = await saveAndPublishLinkedInPost(postDetailsToPublish);
      
      setSaveAndPublishSuccess('Post processed and published successfully! LinkedIn Post ID: ' + (publishedPost.linkedInPostUgcId || 'N/A'));
      prepareNewPostEditor(); // Clear editor for new post
      refetchCustomerPosts(); // Refresh post list

    } catch (error: any) {
      console.error("[PostsPage] Error in saveAndPublishImmediately:", error);
      setSaveAndPublishError(error.message || 'Failed to save and publish post.');
    } finally {
      setIsSavingAndPublishing(false);
      if (successMessageTimeoutRef.current) clearTimeout(successMessageTimeoutRef.current);
      successMessageTimeoutRef.current = setTimeout(() => {
        setSaveAndPublishSuccess(null);
        setSaveAndPublishError(null);
      }, 7000); // Increased timeout for visibility
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
  const publishButtonClass = "bg-green-500 hover:bg-green-600 focus:ring-green-400";

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

  const combinedText = `${hookText}${hookText && (contentText || ctaText) ? '\n\n' : ''}${contentText}${contentText && ctaText ? '\n\n' : ''}${ctaText}`;

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
    if (!selectedCustomerId) {
      setMagicModalError('Please select a customer first.');
      return;
    }
    // TODO: Adapt logic based on aiInputType (text, pdf, url)
    if (aiInputType === 'text' && !magicModalText.trim()) {
      setMagicModalError('Please enter a topic or idea for the post.');
      return;
    }
    if (aiInputType === 'url' && !aiUrlInput.trim()) {
      setMagicModalError('Please enter a URL.');
      return;
    }
    // For PDF, actual handling will be implemented later

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

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      handleRemovePostImage(); // Clear if no file selected
      return;
    }

    // Validate customer is selected and is premium before attempting to get presigned URL
    if (!selectedCustomerId) {
      setPostImageError('Please select a customer before uploading an image.');
      setPostImageFile(null);
      setPostImagePreviewUrl(null);
      if (postImageInputRef.current) postImageInputRef.current.value = ""; // Reset file input
      return;
    }
    if (!isPremiumCustomer) {
        setPostImageError('Image uploads are only available for premium customers.');
        setPostImageFile(null);
        setPostImagePreviewUrl(null);
        if (postImageInputRef.current) postImageInputRef.current.value = "";
        return;
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

    if (file.size > MAX_SIZE) {
      setPostImageError('File is too large (max 2MB).');
      setPostImageFile(null);
      setPostImagePreviewUrl(null);
      if (postImageInputRef.current) postImageInputRef.current.value = "";
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setPostImageError('Invalid file type (PNG, JPG, JPEG only).');
      setPostImageFile(null);
      setPostImagePreviewUrl(null);
      if (postImageInputRef.current) postImageInputRef.current.value = "";
      return;
    }

    setPostImageFile(file);
    setPostImageError(null);
    setIsUploadingImage(true);
    setImageUploadError(null);
    setImageContentType(file.type); // ADDED - Set content type early
    setS3FileKey(null); // Clear previous key

    // Create a local preview URL
    const previewUrl = URL.createObjectURL(file);
    setPostImagePreviewUrl(previewUrl);

    try {
      // 1. Get presigned URL from backend
      const presignedData = await getPresignedUrlForPostImage({ 
        fileName: file.name,
        fileType: file.type,
        customerId: selectedCustomerId 
      });

      // 2. Upload file to S3 using FormData
      const formData = new FormData();
      Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append('file', file); // The file has to be the last field

      const response = await fetch(presignedData.uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Try to get error from S3 response XML if possible
        const s3ErrorText = await response.text();
        console.error("S3 Upload Error Response:", s3ErrorText);
        // Basic error or extract from XML if you want to be more specific
        let errorMessage = `S3 upload failed: ${response.status} ${response.statusText}`;
        if (s3ErrorText.includes("<Message>")) {
            const match = s3ErrorText.match(/<Message>(.*?)<\/Message>/);
            if (match && match[1]) errorMessage = `S3 Error: ${match[1]}`;
        }
        setImageContentType(null); // ADDED - Reset on error
        throw new Error(errorMessage);
      }

      // 3. Set S3 file key on successful upload
      setS3FileKey(presignedData.fileKey);
      setImageUploadError(null);

    } catch (error: any) {
      console.error('Image upload process failed:', error);
      setImageUploadError(error.message || 'Image upload failed. Please try again.');
      setPostImageFile(null); // Clear file on error
      setPostImagePreviewUrl(null); // Clear preview
      setS3FileKey(null); // Ensure key is not set
      setImageContentType(null); // ADDED - Reset on error
      if (postImageInputRef.current) postImageInputRef.current.value = ""; // Reset file input
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemovePostImage = () => {
    if (postImagePreviewUrl) {
      URL.revokeObjectURL(postImagePreviewUrl);
    }
    setPostImageFile(null);
    setPostImagePreviewUrl(null);
    setPostImageError(null);
    if (postImageInputRef.current) {
      postImageInputRef.current.value = ""; // Reset the file input
    }
    // Clear S3 related state
    setS3FileKey(null);
    setImageContentType(null);
    setIsUploadingImage(false); // Should be false anyway, but good to reset
    setImageUploadError(null);
  };

  // Effect for cleaning up the object URL when the component unmounts
  useEffect(() => {
    return () => {
      if (postImagePreviewUrl) {
        URL.revokeObjectURL(postImagePreviewUrl);
      }
    };
  }, [postImagePreviewUrl]);

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
            
            {/* Toolbar - With new Image Upload Button */}
            <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center space-x-2 relative mb-2">
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
              {/* New Image Upload Button */}
              <button 
                title="Upload Image (PNG, JPG, max 2MB)"
                className={`${toolbarButtonClass}`}
                onClick={() => postImageInputRef.current?.click()}
                disabled={isUploadingImage || !isPremiumCustomer}
              >
                <IoImageOutline size={18} />
              </button>
              {showEmojiPicker && ( <div className="absolute z-10 top-full mt-2 left-0 emoji-picker-container"><EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} theme={EmojiTheme.AUTO} categories={[{ name: "Recently Used", category: EmojiCategories.SUGGESTED },{ name: "Smileys & People", category: EmojiCategories.SMILEYS_PEOPLE }]}/></div>)}
              {showSpecialCharsPicker && ( <div className="absolute z-10 top-full mt-2 left-0 bg-white dark:bg-gray-800 border rounded-md shadow-lg p-2 special-chars-picker" style={{width: '300px'}}>{categorizedSpecialCharacters.map(cat => (<div key={cat.category} className="mb-1"><h4 className="text-xs font-semibold text-gray-400 mb-0.5">{cat.category}</h4><div className="grid grid-cols-8 gap-0.5">{cat.symbols.map((s, i) => (<button key={`${cat.category}-${i}`} onClick={() => onSpecialCharClick(s)} className="p-1 text-lg hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex items-center justify-center" title={`Insert ${s}`}>{s}</button>))}</div></div>))}</div>)}
              {/* Hidden file input for image upload */}
              <input 
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={handleImageFileChange}
                ref={postImageInputRef}
                className="hidden"
                id="postImageUpload"
              />
            </div>

            {/* Display area for selected image and errors - below toolbar */}
            {(postImageFile || postImageError) && (
              <div className="mb-4 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50">
                {postImageFile && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate pr-2" title={postImageFile.name}>Attached image: {postImageFile.name}</span>
                    <button 
                      onClick={handleRemovePostImage}
                      className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="Remove image"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {postImageError && (
                  <p className={`text-xs ${postImageFile ? 'mt-1' : ''} text-red-500 dark:text-red-400`}>{postImageError}</p>
                )}
              </div>
            )}

            {/* Hook Textarea */}
            <div><label htmlFor="hook" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hook</label><textarea id="hook" ref={hookTextareaRef} rows={3} value={hookText} onChange={(e) => handleTextChange('hook', e.target.value)} onFocus={() => handleFocus('hook')} onSelect={handleSelect} placeholder="Engaging hook..." className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white"/></div>

            {/* Content Textarea */}
            <div><label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label><textarea id="content" ref={contentTextareaRef} rows={8} value={contentText} onChange={(e) => handleTextChange('content', e.target.value)} onFocus={() => handleFocus('content')} onSelect={handleSelect} placeholder="Main post content..." className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white"/></div>

            {/* CTA Textarea and Character Counter */}
            <div>
                <label htmlFor="cta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CTA (Call to Action)</label>
                <textarea id="cta" ref={ctaTextareaRef} rows={3} value={ctaText} onChange={(e) => handleTextChange('cta', e.target.value)} onFocus={() => handleFocus('cta')} onSelect={handleSelect} placeholder="Call to action..." className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm dark:bg-gray-700 dark:text-white"/>
                {totalCharCount > 3000 ? (<p className="mt-2 text-xs text-red-600 dark:text-red-400 text-right">Warning: Post exceeds 3000 characters, which is typically the LinkedIn limit.</p>) : (<p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">Total Characters (Hook + Content + CTA): {totalCharCount} / 3000</p>)}
            </div>
          </div>

          {/* Column 2: Preview & Actions */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Post Preview</h2>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800 min-h-[300px] flex flex-col">
              {/* Author Info */}
              <div className="flex items-start space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xl">
                  {/* Generic User Icon Placeholder - Can be replaced with an SVG or actual image later */}
                  👤 
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">Your Name / Company</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your bio or a short description here.</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Just now • 🌍</p>
                </div>
              </div>

              {/* Post Text */}
              <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 mb-3 flex-grow">
                {combinedText}
              </div>

              {/* Display selected image preview - Adjusted for better alignment */}
              {postImagePreviewUrl && (
                <div className="mb-3">
                  <img 
                    src={postImagePreviewUrl} 
                    alt="Post preview" 
                    className="max-w-full h-auto rounded-md"
                  />
                </div>
              )}

              {/* Mockup Engagement Stats */}
              <div className="mt-3 pt-2 pb-2 border-t border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <span role="img" aria-label="likes" className="mr-1">👍❤️😂</span> 
                  <span className='hover:underline cursor-pointer'>You and 20 others</span>
                </div>
                <div>
                  <span className='hover:underline cursor-pointer'>8 Comments</span>
                  <span className='ml-2 hover:underline cursor-pointer'>3 Reposts</span>
                </div>
              </div>

              {/* Mockup Action Bar */}
              <div className="flex justify-around items-center pt-2 text-sm text-gray-600 dark:text-gray-300">
                <button className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md">
                  <IoThumbsUpOutline className="h-5 w-5" /> <span className='hidden sm:inline'>Like</span>
                </button>
                <button className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md">
                  <IoChatbubbleOutline className="h-5 w-5" /> <span className='hidden sm:inline'>Comment</span>
                </button>
                <button className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md">
                  <IoShareSocialOutline className="h-5 w-5" /> <span className='hidden sm:inline'>Repost</span>
                </button>
                <button className="flex items-center space-x-1 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md">
                  <IoSendOutline className="h-5 w-5" /> <span className='hidden sm:inline'>Send</span>
                </button>
              </div>
            </div>
            <button onClick={handleCopyToClipboard} className={`${actionButtonClass} ${isCopied ? copyButtonCopiedClass : copyButtonNormalClass}`} disabled={isCopied || totalCharCount > 3000}>{isCopied ? 'Copied!' : 'Copy to Clipboard'}</button>
            <div className='flex flex-col space-y-2 mt-4'>
              <button
                onClick={handleSaveOrUpdatePost}
                disabled={isSavingPost || isSavingAndPublishing || activelyLoadingPostFromUrl || isUploadingImage || (!selectedCustomerId || (!hookText.trim() && !contentText.trim()))}
                className={`${actionButtonClass} ${currentEditingPost ? updateButtonClass : saveButtonClass} flex-grow`}
              >
                {isSavingPost && <CgSpinner className='animate-spin mr-2' />}
                {currentEditingPost ? 'Update Post Draft' : 'Save Post Draft'}
              </button>
              
              {isPremiumCustomer && selectedCustomerId && (
                <button
                  onClick={handleSaveAndPublishImmediately}
                  disabled={isSavingAndPublishing || isSavingPost || activelyLoadingPostFromUrl || isUploadingImage || (!selectedCustomerId || (!hookText.trim() && !contentText.trim()))}
                  className={`${actionButtonClass} ${publishButtonClass} flex-grow`}
                >
                  {isSavingAndPublishing && <CgSpinner className='animate-spin mr-2' />}
                  Save & Publish Immediately
                </button>
              )}
            </div>
            {savePostError && <p className='text-red-500 mt-2 text-sm'>{savePostError}</p>}
            {savePostSuccess && <p className='text-green-500 mt-2 text-sm'>{savePostSuccess}</p>}
            {saveAndPublishError && <p className='text-red-500 mt-2 text-sm'>{saveAndPublishError}</p>}
            {saveAndPublishSuccess && <p className='text-green-500 mt-2 text-sm'>{saveAndPublishSuccess}</p>}
          </div>
        </div>
      )}

      {/* Magic Wand Modal - Updated */}
      {showMagicModal && (
        <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm'>
          <div className='bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg space-y-4'>
            <div className='flex justify-between items-center'>
              <h3 className='text-xl font-semibold text-white'>AI Post Generation</h3>
              <button onClick={() => setShowMagicModal(false)} className='text-gray-400 hover:text-gray-200'>
                <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='w-6 h-6'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>

            {/* Tabs for input type selection */} 
            <div className='flex border-b border-gray-700'>
              <button 
                onClick={() => setAiInputType('text')}
                className={`px-4 py-2 -mb-px font-medium text-sm ${aiInputType === 'text' ? 'border-b-2 border-yellow-500 text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}
              >
                Text/Idea
              </button>
              <button 
                onClick={() => setAiInputType('pdf')}
                className={`px-4 py-2 -mb-px font-medium text-sm ${aiInputType === 'pdf' ? 'border-b-2 border-yellow-500 text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}
              >
                PDF (max 5MB)
              </button>
              <button 
                onClick={() => setAiInputType('url')}
                className={`px-4 py-2 -mb-px font-medium text-sm ${aiInputType === 'url' ? 'border-b-2 border-yellow-500 text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}
              >
                URL (Scrape)
              </button>
            </div>

            {magicModalError && (
              <div className='bg-red-700/50 border border-red-500 text-red-300 px-3 py-2 rounded text-sm'>
                {magicModalError}
              </div>
            )}

            {aiInputType === 'text' && (
              <div className='space-y-2'>
                <textarea 
                  value={magicModalText}
                  onChange={(e) => {
                    if (e.target.value.length <= 3000) {
                        setMagicModalText(e.target.value);
                    }
                  }}
                  placeholder='Enter the main topic or idea for your LinkedIn post...'
                  rows={5}
                  className='w-full p-2.5 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-yellow-500 focus:border-yellow-500 placeholder-gray-400'
                  disabled={isGeneratingWithAI}
                />
                <p className='text-xs text-right text-gray-400'>{magicModalText.length} / 3000 characters</p>
              </div>
            )}

            {aiInputType === 'pdf' && (
              <div className='space-y-2 p-4 border border-dashed border-gray-600 rounded-md text-center'>
                <p className='text-gray-400'>PDF Upload (Mockup)</p>
                <button 
                    className='mt-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50'
                    disabled={true} // Mockup
                >
                    Select PDF File
                </button>
                <p className='text-xs text-gray-500 mt-1'>Max file size: 5MB</p>
              </div>
            )}

            {aiInputType === 'url' && (
              <div className='space-y-2'>
                <input 
                  type='url'
                  value={aiUrlInput}
                  onChange={(e) => setAiUrlInput(e.target.value)}
                  placeholder='Enter URL to scrape content from...'
                  className='w-full p-2.5 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-yellow-500 focus:border-yellow-500 placeholder-gray-400'
                  disabled={isGeneratingWithAI}
                />
              </div>
            )}

            <div className='flex justify-end space-x-3 pt-2'>
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