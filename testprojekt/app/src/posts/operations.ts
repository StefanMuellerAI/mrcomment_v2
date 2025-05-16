import { HttpError } from 'wasp/server';
import type { LinkedInPost, Customer, SystemSettings } from 'wasp/entities';
import type { CreateLinkedInPost, UpdateLinkedInPost, GetLinkedInPostsByCustomer, GetLinkedInPostById, DeleteLinkedInPost, GenerateLinkedInPostWithAI, SaveAndPublishLinkedInPost, GetPresignedUrlForPostImage, GetPostImageDownloadUrl } from 'wasp/server/operations';
import { z } from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';
import { getPlanById, type CustomerPlan as CustomerPlanInterface } from '../customers/plans'; // Import plan definitions and interface
import { getSystemSettings } from '../admin/settingsOperations'; // To get the system prompt
import OpenAI from 'openai';
import { publishPostToLinkedIn } from '../server/linkedinIntegration'; // Import publishPostToLinkedIn
import { prisma as prismaClient } from 'wasp/server'; // Import prisma client directly
import type { PrismaClient } from '@prisma/client'; // Import PrismaClient for type safety
import { v4 as uuidv4 } from 'uuid'; // For generating unique file names
import { generatePresignedPostForImage } from './s3PostImageUtils'; // Import new S3 utility
import { getDownloadFileSignedURLFromS3 } from '../file-upload/s3Utils';
import type { AuthUser } from 'wasp/auth'; // Import AuthUser for the context interface

// Define the Zod schema for input validation
const createLinkedInPostInputSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required.'),
  hook: z.string().min(1, 'Hook cannot be empty.'), // Add min lengths or other constraints as needed
  content: z.string().min(1, 'Content cannot be empty.'),
  cta: z.string().min(1, 'CTA cannot be empty.'),
  imageS3Key: z.string().optional().nullable(),
  imageContentType: z.string().optional().nullable(),
});

// Define the expected input type for the Wasp action based on the schema
interface CreateLinkedInPostInput {
  customerId: string;
  hook: string;
  content: string;
  cta: string;
  imageS3Key?: string | null;
  imageContentType?: string | null;
}

// This interface can remain for internal clarity if desired, or be removed if Zod type is used directly.
interface CreateLinkedInPostInputInternal {
  customerId: string;
  hook: string;
  content: string;
  cta: string;
  imageS3Key?: string | null;
  imageContentType?: string | null;
}

// Define the Zod schema for UpdateLinkedInPost input
const updateLinkedInPostInputSchema = z.object({
  postId: z.string().min(1, 'Post ID is required.'),
  hook: z.string().optional(), // Fields are optional for update
  content: z.string().optional(),
  cta: z.string().optional(),
  imageS3Key: z.string().optional().nullable(),
  imageContentType: z.string().optional().nullable(),
});

// Define the expected input type for the UpdateLinkedInPost action
interface UpdateLinkedInPostInput {
  postId: string;
  hook?: string;
  content?: string;
  cta?: string;
  imageS3Key?: string | null;
  imageContentType?: string | null;
}

// --- Query Schema and Interface for GetLinkedInPostsByCustomer ---
const getLinkedInPostsByCustomerInputSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required."),
});
interface GetLinkedInPostsByCustomerInput {
  customerId: string;
}

// --- Query Schema and Interface for GetLinkedInPostById ---
const getLinkedInPostByIdInputSchema = z.object({
  postId: z.string().min(1, "Post ID is required."),
});
interface GetLinkedInPostByIdInput {
  postId: string;
}

// --- Zod Schema and Interface for DeleteLinkedInPost ---
const deleteLinkedInPostInputSchema = z.object({
  postId: z.string().min(1, "Post ID is required."),
});
interface DeleteLinkedInPostInputInternal {
  postId: string;
}

// --- Zod Schema and Interface for GenerateLinkedInPostWithAI ---
const generateLinkedInPostWithAIInputSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required."),
  topic: z.string().min(10, "Topic must be at least 10 characters long."),
  aiInputType: z.enum(['text', 'pdf', 'url']),
  aiTextPrompt: z.string().max(3000).optional(),
  aiUrlInput: z.string().url().optional(),
});
interface GenerateLinkedInPostWithAIInput {
  customerId: string;
  topic: string;
  aiInputType: 'text' | 'pdf' | 'url';
  aiTextPrompt?: string;
  aiUrlInput?: string;
}

// Expected output structure from AI
interface AIPostGenerationResponse {
  hook: string;
  content: string;
  cta: string;
}

// --- OpenAI Client Setup ---
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
    console.warn('OPENAI_API_KEY is not set. AI post generation will be disabled.');
}

// Use `any` for the input type in the Wasp Action signature to satisfy Payload constraint.
// Zod schema (`createLinkedInPostInputSchema`) will handle runtime validation.
export const createLinkedInPost: CreateLinkedInPost<any, LinkedInPost> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }

  // Validate the raw `args` using the Zod schema. 
  // The type of validatedArgs will be inferred from the schema.
  const validatedArgs = ensureArgsSchemaOrThrowHttpError(createLinkedInPostInputSchema, args);
  const { customerId, hook, content, cta, imageS3Key, imageContentType } = validatedArgs; // These are now correctly typed from Zod

  // Verify that the customer belongs to the logged-in user
  const customer = await context.entities.Customer.findFirst({
    where: {
      id: customerId,
      userId: context.user.id,
    },
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found or access denied.');
  }

  // --- Enforce post storage limit --- 
  const planDetails = getPlanById(customer.subscriptionPlan);
  // Default to a very low limit (0) if plan or limit isn't defined, effectively blocking creation for misconfigured plans.
  // Or, set a sensible default for undefined plans, e.g., equivalent to free_tier.
  const maxPosts = planDetails?.maxPostsPerCustomer ?? 0; 

  const currentPostCount = await context.entities.LinkedInPost.count({
    where: {
      customerId: customerId,
      // userId: context.user.id, // userId check is implicitly handled by customer ownership already for this count
    },
  });

  if (currentPostCount >= maxPosts) {
    throw new HttpError(403, `Maximum post storage limit of ${maxPosts} reached for customer\'s plan (${planDetails?.name || 'Unknown Plan'}). Please upgrade or delete existing posts.`);
  }
  // --- End limit enforcement ---

  const newPost = await context.entities.LinkedInPost.create({
    data: {
      hook,
      content,
      cta,
      customerId: customer.id, // or just customerId from validatedArgs
      userId: context.user.id,
      imageS3Key: imageS3Key,
      imageContentType: imageContentType,
    },
  });

  return newPost;
};

// --- New: updateLinkedInPost Implementation ---
export const updateLinkedInPost: UpdateLinkedInPost<any, LinkedInPost> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }

  const validatedArgs = ensureArgsSchemaOrThrowHttpError(updateLinkedInPostInputSchema, args);
  const { postId, hook, content, cta, imageS3Key, imageContentType } = validatedArgs;

  // Verify the post exists and belongs to the current user
  const existingPost = await context.entities.LinkedInPost.findFirst({
    where: {
      id: postId,
      userId: context.user.id, // Ensure the user owns this post
    },
  });

  if (!existingPost) {
    throw new HttpError(404, 'Post not found or you do not have permission to edit it.');
  }

  // Prepare data for update (only include fields that are actually provided)
  const dataToUpdate: { 
    hook?: string; 
    content?: string; 
    cta?: string; 
    imageS3Key?: string | null; 
    imageContentType?: string | null 
  } = {};
  if (hook !== undefined) dataToUpdate.hook = hook;
  if (content !== undefined) dataToUpdate.content = content;
  if (cta !== undefined) dataToUpdate.cta = cta;
  if (imageS3Key !== undefined) dataToUpdate.imageS3Key = imageS3Key;
  if (imageContentType !== undefined) dataToUpdate.imageContentType = imageContentType;

  // Prevent update if no data is being changed (optional, but good practice)
  if (Object.keys(dataToUpdate).length === 0) {
    return existingPost; // Or throw an error indicating no changes were made
  }

  const updatedPost = await context.entities.LinkedInPost.update({
    where: {
      id: postId,
    },
    data: dataToUpdate,
  });

  return updatedPost;
};

// --- New Query: Get LinkedIn Posts By Customer ---
export const getLinkedInPostsByCustomer: GetLinkedInPostsByCustomer<any, LinkedInPost[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }

  const validatedArgs = ensureArgsSchemaOrThrowHttpError(getLinkedInPostsByCustomerInputSchema, args);
  const { customerId } = validatedArgs;

  // Verify the customer belongs to the user (optional, but good practice for security)
  const customer = await context.entities.Customer.findFirst({
    where: {
      id: customerId,
      userId: context.user.id,
    }
  });

  if (!customer) {
    // Depending on desired behavior, either return empty array or throw error
    // Returning empty array if customer not found or not owned by user, 
    // as the primary goal is to list posts for a known customer from the UI.
    // Client side should only allow selecting valid customers.
    return []; 
    // Alternatively, throw new HttpError(404, 'Customer not found or access denied.');
  }

  const posts = await context.entities.LinkedInPost.findMany({
    where: {
      customerId: customerId,
      userId: context.user.id, // Ensure we only fetch posts created by this user for that customer
    },
    orderBy: {
      updatedAt: 'desc', // Show most recently updated posts first
    },
  });

  return posts;
};

// --- New Query: Get LinkedIn Post By ID ---
export const getLinkedInPostById: GetLinkedInPostById<any, LinkedInPost | null> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }
  const validatedArgs = ensureArgsSchemaOrThrowHttpError(getLinkedInPostByIdInputSchema, args);
  const { postId } = validatedArgs;

  const post = await context.entities.LinkedInPost.findFirst({
    where: {
      id: postId,
      userId: context.user.id, // Ensure the user owns this post
    },
    // Optionally include customer if needed on PostsPage, though not strictly necessary if just loading content
    // include: { customer: { select: { id: true, name: true } } }
  });

  if (!post) {
    // Post not found or user does not have permission
    // Depending on how strict you want to be, you could throw HttpError(404) or return null.
    // Returning null is often friendlier for a direct load attempt from URL.
    return null;
  }
  return post;
};

// --- New Action: Delete LinkedIn Post ---
// Use `any` for the input type in the Wasp Action signature.
export const deleteLinkedInPost: DeleteLinkedInPost<any, void> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }

  // Zod schema still validates the raw `args`.
  const validatedArgs = ensureArgsSchemaOrThrowHttpError(deleteLinkedInPostInputSchema, args);
  const { postId } = validatedArgs;

  const postToDelete = await context.entities.LinkedInPost.findFirst({
    where: {
      id: postId,
      userId: context.user.id, 
    },
  });

  if (!postToDelete) {
    throw new HttpError(404, 'Post not found or you do not have permission to delete it.');
  }

  await context.entities.LinkedInPost.delete({
    where: {
      id: postId,
    },
  });
};

// --- Action: Generate LinkedIn Post with AI (Revised based on user snippet) ---
// Using `any` for BOTH Input AND Output types in Wasp generic to satisfy Payload constraint.
// Internal logic still uses specific types (validatedArgs from Zod, and AIPostGenerationResponse for parsing).
export const generateLinkedInPostWithAI: GenerateLinkedInPostWithAI<any, any> = async (args, context) => {
  if (!context.user) { throw new HttpError(401, 'User is not authenticated'); }
  if (!openai) { throw new HttpError(503, 'OpenAI client not initialized. Check API Key.'); }
  const validatedArgs = ensureArgsSchemaOrThrowHttpError(generateLinkedInPostWithAIInputSchema, args);
  const { customerId, topic, aiInputType, aiTextPrompt, aiUrlInput } = validatedArgs;
  const customer = await context.entities.Customer.findFirst({ where: { id: customerId, userId: context.user.id }, include: { style: true }, });
  if (!customer) { throw new HttpError(404, 'Customer not found or access denied.'); }
  const styleAnalysis = customer.style?.styleAnalysis || 'A general professional and engaging writing style.';
  let systemSettings = await getSystemSettings(undefined, context);
  let developerPromptText = systemSettings.linkedInPostGenerationSystemPrompt;
  if (!developerPromptText) { throw new HttpError(500, "LinkedIn post generation developer prompt is not configured.");}
  const openAIInputs = [
    { "role": "developer", "content": [{ "type": "input_text", "text": developerPromptText }] },
    { "role": "user", "content": [{ "type": "input_text", "text": `Zu diesem Thema: (( ${topic} )) möchte ich, dass du einen LinkedIn Post. Orientiere dich beim Stil am Ergebnis der (( ${styleAnalysis} )).` }]}
  ];
  const jsonOutputSchema = { type: "object", properties: { hook: { type: "string" }, content: { type: "string" }, cta: { type: "string" } }, required: ["hook", "content", "cta"], additionalProperties: false };

  try {
    const response = await (openai as any).responses.create({ 
      model: "o3",
      input: openAIInputs,
      text: { format: { type: "json_schema", name: "linkedin_post", strict: true, schema: jsonOutputSchema } }
    });
    
    let rawJsonResponse: string | undefined;

    // Corrected logic to extract the JSON string based on the new full response structure provided by user
    if (response && typeof response === 'object' && typeof (response as any).output_text === 'string') {
      rawJsonResponse = (response as any).output_text;
    } else if (response && Array.isArray((response as any).output)) {
      // Fallback to nested structure if output_text is not at root
      const outputArray = (response as any).output;
      const assistantMessage = outputArray.find((item: any) => item && item.role === 'assistant' && item.type === 'message');
      if (assistantMessage && Array.isArray(assistantMessage.content) && assistantMessage.content.length > 0) {
        const outputTextContent = assistantMessage.content.find((c: any) => c && c.type === 'output_text');
        if (outputTextContent && typeof outputTextContent.text === 'string') {
          rawJsonResponse = outputTextContent.text;
        }
      }
    }

    if (!rawJsonResponse) {
      console.error("[AI Post Gen] OpenAI response structure not as expected or JSON content missing. Full Response:", JSON.stringify(response, null, 2));
      throw new HttpError(500, 'OpenAI returned an unexpected response structure or missing content. Could not find output_text.');
    }
    
    let parsedOutput: AIPostGenerationResponse; 
    try {
      parsedOutput = JSON.parse(rawJsonResponse);
      if (!parsedOutput.hook || !parsedOutput.content || !parsedOutput.cta) { 
        throw new Error('AI response JSON missing required fields (hook, content, cta).'); 
      }
    } catch (parseError: any) {
      console.error("[AI Post Gen] Failed to parse JSON from AI response:", parseError.message, "Raw JSON was:", rawJsonResponse);
      throw new HttpError(500, 'Failed to understand or parse the AI\'s JSON output.');
    }
    return parsedOutput; 

  } catch (error: any) {
    // ... (error handling as before) ...
    console.error("[AI Post Gen] Error calling OpenAI API (o3 model):");
    if (error.response && error.response.data) { console.error("OpenAI API Error Data:", JSON.stringify(error.response.data, null, 2)); const errMessage = error.response.data.error?.message || 'OpenAI API error.'; throw new HttpError(error.response.status || 502, `OpenAI API Error: ${errMessage}`);
    } else { console.error(error.message); }
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, `Failed to generate post with AI: ${error.message || 'Unknown OpenAI error'}`);
  }
};

// --- Zod Schema and Interface for GetPresignedUrlForPostImage ---
const getPresignedUrlForPostImageInputSchema = z.object({
  fileName: z.string().min(1, 'File name is required.'),
  fileType: z.string().min(1, 'File type is required.'),
  customerId: z.string().min(1, 'Customer ID is required.'),
});

interface GetPresignedUrlForPostImageValidatedArgs {
  fileName: string;
  fileType: string;
  customerId: string;
}

// Return type updated for presigned POST
export const getPresignedUrlForPostImage: GetPresignedUrlForPostImage<
  any, 
  { uploadUrl: string; fields: Record<string, string>; fileKey: string }
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User is not authenticated');
  }

  const validatedArgs = ensureArgsSchemaOrThrowHttpError(getPresignedUrlForPostImageInputSchema, args) as GetPresignedUrlForPostImageValidatedArgs;
  const { fileName, fileType, customerId } = validatedArgs;

  const customer = await prismaClient.customer.findFirst({
    where: { id: customerId, userId: context.user.id },
    select: { subscriptionPlan: true },
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found or access denied.');
  }
  
  if (customer.subscriptionPlan !== 'premium_tier') {
    throw new HttpError(403, 'Image uploads are only available for premium_tier customers.');
  }

  try {
    // Use the new S3 utility instead of context.s3
    const { uploadUrl, key: generatedFileKey, uploadFields } = await generatePresignedPostForImage({
      fileName,
      fileType,
      customerId,
      userId: context.user.id, // Pass userId, s3PostImageUtils expects it
    });
    return { uploadUrl, fields: uploadFields, fileKey: generatedFileKey };
  } catch (error: any) {
    console.error('Error generating presigned POST URL for image:', error);
    throw new HttpError(500, `Failed to generate upload URL for image: ${error.message}`);
  }
};

// --- Zod Schema and Interface for SaveAndPublishLinkedInPost ---
const saveAndPublishLinkedInPostInputSchema = z.object({
  postId: z.string().optional().nullable(),
  customerId: z.string().min(1, 'Customer ID is required.'),
  hook: z.string().min(1, 'Hook is required.'),
  content: z.string().min(1, 'Content is required.'),
  cta: z.string().min(1, 'CTA is required.'),
  imageS3Key: z.string().optional().nullable(),
  imageContentType: z.string().optional().nullable(),
});

interface SaveAndPublishLinkedInPostValidatedArgs {
  postId?: string | null;
  customerId: string;
  hook: string;
  content: string;
  cta: string;
  imageS3Key?: string | null;
  imageContentType?: string | null;
}

// DUPLICATED Interface from linkedinIntegration.ts for now
// Standard Wasp Action context (simplified view relevant for this function)
interface WaspActionContext {
  user: AuthUser;       
  prisma: PrismaClient; 
}

// Action to save a post and then publish it to LinkedIn
export const saveAndPublishLinkedInPost: SaveAndPublishLinkedInPost<any, LinkedInPost> = async (
  args, 
  context // context here is the standard Wasp Action context, primarily for context.user
) => {
  if (!context.user) { 
    throw new HttpError(401, 'User is not authenticated');
  }

  const validatedArgs = ensureArgsSchemaOrThrowHttpError(saveAndPublishLinkedInPostInputSchema, args) as SaveAndPublishLinkedInPostValidatedArgs;
  const { postId, customerId, hook, content, cta, imageS3Key, imageContentType } = validatedArgs;

  // Use the imported prismaClient for DB operations
  const customer = await prismaClient.customer.findFirst({
    where: { id: customerId, userId: context.user.id },
    select: { id: true, subscriptionPlan: true, linkedinUserId: true }, 
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found or access denied.');
  }

  const planDetails = getPlanById(customer.subscriptionPlan);
  if (planDetails?.id !== 'premium_tier') {
    throw new HttpError(403, 'Publishing LinkedIn posts is a premium feature.');
  }

  let postToPublish: LinkedInPost;

  if (postId) {
    // Update existing post draft before publishing
    const existingPost = await prismaClient.linkedInPost.findFirst({
      where: { id: postId, userId: context.user.id }
    });
    if (!existingPost) {
      throw new HttpError(404, `Post with ID ${postId} not found or access denied.`);
    }
    // Check post limit only if it's effectively a new post being saved to this customer beyond what was there.
    // If we are just updating an existing one, the limit was checked at its creation.
    // However, to be safe, or if posts can be moved between customers (not the case here), re-checking might be desired.
    // For now, assume updating an existing post doesn't count against the limit again if it simply changes content.

    postToPublish = await prismaClient.linkedInPost.update({
      where: { id: postId }, // Ensure this is the ID of the existing post
      data: {
        hook,
        content,
        cta,
        // customerId and userId should not change for an existing post typically
        imageS3Key: imageS3Key, // Update image if new one was provided
        imageContentType: imageContentType, // Update content type
        // Ensure other fields like linkedInPostUgcId are NOT reset here accidentally
      },
    });
    console.log(`[SaveAndPublish] Updated existing post ${postId} before publishing.`);

  } else {
    // Create new post
    const maxPosts = planDetails?.maxPostsPerCustomer ?? 0;
    const currentPostCount = await prismaClient.linkedInPost.count({
      where: { customerId: customerId },
    });
    if (currentPostCount >= maxPosts) {
      throw new HttpError(403, `Maximum post storage limit of ${maxPosts} reached.`);
    }
    postToPublish = await prismaClient.linkedInPost.create({
      data: {
        hook, content, cta, customerId, userId: context.user.id, imageS3Key, imageContentType,
      },
    });
    console.log(`[SaveAndPublish] Created new post ${postToPublish.id} before publishing.`);
  }

  if (!customer.linkedinUserId) {
    console.warn(`Customer ${customerId} has no LinkedIn User ID. Post ${postToPublish.id} saved/updated but will not be published.`);
    return postToPublish; 
  }

  try {
    const contextForPublish: WaspActionContext = {
        user: context.user, 
        prisma: prismaClient, 
    };
    await publishPostToLinkedIn(
        { linkedInPostIdDb: postToPublish.id }, 
        contextForPublish
    );
    const publishedAndUpdatedPost = await prismaClient.linkedInPost.findUnique({ where: { id: postToPublish.id } });
    if (!publishedAndUpdatedPost) {
        throw new HttpError(500, `Post ${postToPublish.id} was published but could not be refetched with UGC ID.`);
    }
    return publishedAndUpdatedPost;
  } catch (publishError: any) {
    console.error(`[SaveAndPublish] Error during LinkedIn publishing for post ${postToPublish.id}:`, publishError.message);
    if (publishError instanceof HttpError) {
        throw new HttpError(publishError.statusCode, `Post ${postToPublish.id} saved/updated, but publishing failed: ${publishError.message}`);
    }
    throw new HttpError(500, `Post ${postToPublish.id} saved/updated, but an unexpected error occurred during publishing: ${publishError.message}`);
  }
};

// Query to get a download URL for an S3 object (e.g., post image)
// Make sure to declare this query (getPostImageDownloadUrl) in main.wasp
// and import its type from 'wasp/server/operations' if needed for strong typing elsewhere,
// though for the implementation itself, this signature is key.
export const getPostImageDownloadUrl: GetPostImageDownloadUrl<
  { s3Key: string }, 
  string 
> = async (args, context) => {
  if (!context.user) { // Auth Check
    throw new HttpError(401, "User is not authenticated.");
  }
  
  const { s3Key } = args;

  if (!s3Key) {
    throw new HttpError(400, "S3 key is required to generate a download URL.");
  }

  try {
    const downloadUrl = await getDownloadFileSignedURLFromS3({ key: s3Key });
    return downloadUrl;
  } catch (error: any) {
    console.error('Failed to generate download URL for post image:', error);
    throw new HttpError(500, error.message || 'Failed to generate image download URL.');
  }
};

// Ensure all other operations (create, update, delete, getByCustomer, getById) are present below this if they were in this file. 