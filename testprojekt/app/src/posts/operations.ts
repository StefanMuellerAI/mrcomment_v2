import { HttpError } from 'wasp/server';
import type { LinkedInPost, Customer, SystemSettings } from 'wasp/entities';
import type { CreateLinkedInPost, UpdateLinkedInPost, GetLinkedInPostsByCustomer, GetLinkedInPostById, DeleteLinkedInPost, GenerateLinkedInPostWithAI } from 'wasp/server/operations';
import { z } from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';
import { getPlanById, CustomerPlan } from '../customers/plans'; // Import plan definitions
import { getSystemSettings } from '../admin/settingsOperations'; // To get the system prompt
import OpenAI from 'openai';

// Define the Zod schema for input validation
const createLinkedInPostInputSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required.'),
  hook: z.string().min(1, 'Hook cannot be empty.'), // Add min lengths or other constraints as needed
  content: z.string().min(1, 'Content cannot be empty.'),
  cta: z.string().min(1, 'CTA cannot be empty.'),
});

// Define the expected input type for the Wasp action based on the schema
interface CreateLinkedInPostInput {
  customerId: string;
  hook: string;
  content: string;
  cta: string;
}

// This interface can remain for internal clarity if desired, or be removed if Zod type is used directly.
interface CreateLinkedInPostInputInternal {
  customerId: string;
  hook: string;
  content: string;
  cta: string;
}

// Define the Zod schema for UpdateLinkedInPost input
const updateLinkedInPostInputSchema = z.object({
  postId: z.string().min(1, 'Post ID is required.'),
  hook: z.string().optional(), // Fields are optional for update
  content: z.string().optional(),
  cta: z.string().optional(),
});

// Define the expected input type for the UpdateLinkedInPost action
interface UpdateLinkedInPostInput {
  postId: string;
  hook?: string;
  content?: string;
  cta?: string;
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
});
interface GenerateLinkedInPostWithAIInput {
  customerId: string;
  topic: string;
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
  const { customerId, hook, content, cta } = validatedArgs; // These are now correctly typed from Zod

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
  const { postId, hook, content, cta } = validatedArgs;

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
  const dataToUpdate: { hook?: string; content?: string; cta?: string } = {};
  if (hook !== undefined) dataToUpdate.hook = hook;
  if (content !== undefined) dataToUpdate.content = content;
  if (cta !== undefined) dataToUpdate.cta = cta;

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
  const { customerId, topic } = validatedArgs;
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

// Ensure all other operations (create, update, delete, getByCustomer, getById) are present below this if they were in this file. 