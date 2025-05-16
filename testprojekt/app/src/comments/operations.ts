import { HttpError } from 'wasp/server';
import { type User, type Customer, type SystemSettings, type CustomerDailyUsage } from 'wasp/entities';
import type { 
    GenerateComments,
    GetAllCustomersForSelection
} from 'wasp/server/operations';
import OpenAI from 'openai';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';
// Re-enable import for settings operations using relative path
import { getSystemSettings } from '../admin/settingsOperations.js';
import { getPlanById, CustomerPlan } from '../customers/plans'; // Import plan definitions
import { prisma } from 'wasp/server'; // Import global Prisma Client instance

// --- Types --- 
// type CustomerSelection = Pick<Customer, 'id' | 'name'>; // Old type, not used by the query itself but for context

// Structure expected from AI inside the 'comments' array
interface AICommentData {
    text: string;
    sentiment: "positive" | "neutral" | "negative";
}

// Overall structure AI is asked to return
interface AIResponseFormat {
    comments: AICommentData[];
}

// Final structure for the client
interface CommentForClient {
    type: string;
    content: string;
}
interface GeneratedCommentsPayload {
    comments: CommentForClient[];
}

const generateCommentsInputSchema = z.object({
    linkedInPostText: z.string().min(50, 'LinkedIn post must be at least 50 characters long'),
    customerId: z.string().min(1, 'Customer selection is required'),
});
type GenerateCommentsInput = z.infer<typeof generateCommentsInputSchema>;

// --- OpenAI Client Setup ---
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
    console.warn('OPENAI_API_KEY is not set. Comment generation will be disabled.');
}

// --- Query --- 
export const getAllCustomersForSelection: GetAllCustomersForSelection<void, Pick<Customer, 'id' | 'name' | 'subscriptionPlan'>[]> = async (_args, context) => {
    if (!context.user) {
        throw new HttpError(401);
    }
    return context.entities.Customer.findMany({
        where: { userId: context.user.id },
        select: { id: true, name: true, subscriptionPlan: true },
        orderBy: { name: 'asc' },
    });
};

// --- Action --- 
export const generateComments: GenerateComments<GenerateCommentsInput, any> = async (rawArgs, context) => {
    console.log('[generateComments] Action started.');
    if (!context.user) { throw new HttpError(401); }
    if (!openai) { throw new HttpError(503, 'OpenAI client not initialized.'); }

    const { linkedInPostText, customerId } = ensureArgsSchemaOrThrowHttpError(generateCommentsInputSchema, rawArgs);
    console.log(`[generateComments] Inputs: customerId: ${customerId}, postText length: ${linkedInPostText.length}`);
    
    const customer = await context.entities.Customer.findUnique({ where: { id: customerId }, include: { style: true } });
    if (!customer || customer.userId !== context.user.id) { throw new HttpError(404, 'Customer not found or access denied.'); }
    const planDetails = getPlanById(customer.subscriptionPlan);
    const dailyLimit = planDetails?.dailyCommentLimit ?? 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const currentUsage = await prisma.customerDailyUsage.findUnique({ where: { customerDateUnique: { customerId: customerId, date: today } } });
    const currentGenerations = currentUsage?.commentGenerations || 0;
    console.log(`[generateComments] Customer: ${customer.name}, Plan: ${planDetails?.name}, Limit: ${dailyLimit}, Current Usage Today: ${currentGenerations}`);
    if (currentGenerations >= dailyLimit) { 
        console.warn('[generateComments] Daily limit reached.');
        throw new HttpError(429, `Daily comment generation limit: ${dailyLimit} reached for ${planDetails?.name || 'plan'}.`);
    }

    const systemSettings = await getSystemSettings(undefined, context);
    const developerPromptText = systemSettings.commentGenerationSystemPrompt;
    if (!developerPromptText) { throw new HttpError(500, "Comment generation system prompt not configured.");}
    const styleAnalysis = customer.style?.styleAnalysis || "a general, engaging, and professional tone appropriate for LinkedIn.";
    
    const openAIInputs = [
        { role: "developer", content: [{ type: "input_text", text: developerPromptText }] },
        { role: "user", content: [ {type: "input_text", text: `LinkedIn Post to comment on: \"${linkedInPostText}\". Please use the following style for the comments: \"${styleAnalysis}\".` } ]}
    ];

    const commentsJSONSchema = {
        type: "object" as const,
        required: ["comments"],
        properties: {
            comments: {
                type: "array" as const,
                description: "A collection of comments with their associated sentiment.",
                items: {
                    type: "object" as const,
                    required: ["text", "sentiment"],
                    properties: {
                        text: { type: "string" as const, description: "The content of the comment." },
                        sentiment: { type: "string" as const, enum: ["positive", "neutral", "negative"], description: "The sentiment of the comment." }
                    },
                    additionalProperties: false
                }
            }
        },
        additionalProperties: false
    };

    let rawJsonResponse: string | undefined;
    // console.log('[generateComments] Attempting OpenAI API call.'); // Keep commented for now
    try {
        const response = await (openai as any).responses.create({
            model: "o4-mini", 
            input: openAIInputs,
            text: { format: { type: "json_schema", name: "comments_with_sentiment", schema: commentsJSONSchema, strict: true } },
            temperature: 1,
            max_output_tokens: 15000,
            top_p: 1,
            // store: true, // REMOVED this line as it might be an invalid parameter
        });
        // console.log('[generateComments] OpenAI response received:', JSON.stringify(response, null, 2)); 
        
        if (response && typeof response === 'object' && typeof (response as any).output_text === 'string') {
            rawJsonResponse = (response as any).output_text;
        } else {
            console.warn("[generateComments] response.output_text not found or not a string. Full Response was logged above.");
            // Fallback to nested structure if output_text is not at root - remove if not applicable to o3 model
            // if (response && Array.isArray((response as any).output)) { ... }
        }

        if (!rawJsonResponse) {
            throw new HttpError(500, 'OpenAI did not return output_text in the expected structure.');
        }
    } catch (error: any) {
        console.error('[generateComments] Error during OpenAI API call or initial response handling:', error.message);
        if (error.response?.data?.error?.message) { throw new HttpError(502, `AI API Error: ${error.response.data.error.message}`); }
        if (error instanceof HttpError) throw error;
        throw new HttpError(502, `AI interaction failed: ${error.message || 'Unknown OpenAI error'}`);
    }

    if (!rawJsonResponse || rawJsonResponse.trim() === '') { 
        console.warn('[generateComments] rawJsonResponse is empty after API call attempt.');
        return { comments: [] } as GeneratedCommentsPayload;
    }
    console.log('[generateComments] Attempting to parse rawJsonResponse:', rawJsonResponse);

    let parsedJson: AIResponseFormat;
    try {
        parsedJson = JSON.parse(rawJsonResponse) as AIResponseFormat;
    } catch (parseError: any) {
        console.error('[generateComments] Failed to parse JSON from AI:', parseError.message);
        console.error('[generateComments] Raw JSON that failed parsing was:', rawJsonResponse);
        return { comments: [] } as GeneratedCommentsPayload; 
    }

    if (typeof parsedJson !== 'object' || parsedJson === null || !Array.isArray(parsedJson.comments)) {
        console.warn(`[generateComments] Parsed JSON lacks root 'comments' array. Parsed: ${JSON.stringify(parsedJson)}`);
        return { comments: [] } as GeneratedCommentsPayload;
    }

    const validatedComments: CommentForClient[] = [];
    for (const item of parsedJson.comments) {
        if (item && typeof item.text === 'string' && item.text.trim() !== '' && 
            typeof item.sentiment === 'string' && ["positive", "neutral", "negative"].includes(item.sentiment)) {
            validatedComments.push({ type: item.sentiment, content: item.text });
        } else {
            console.warn('[generateComments] Filtered malformed comment item:', item);
        }
    }
    console.log(`[generateComments] Processed ${validatedComments.length} valid comments.`);

    const finalPayload: GeneratedCommentsPayload = { comments: validatedComments };

    if (finalPayload.comments.length > 0) {
        try {
            await prisma.customerDailyUsage.upsert({ 
                where: { customerDateUnique: { customerId: customerId, date: today } },
                create: { customerId: customerId, date: today, commentGenerations: 1 },
                update: { commentGenerations: { increment: 1 } },
            });
        } catch (updateError) {
            console.error(`[generateComments] Failed to update daily usage for customer ${customerId}:`, updateError);
        }

        // Also increment global User counter if needed
        try {
            await context.entities.User.update({
                where: { id: context.user.id },
                data: { commentRequestCount: { increment: 1 } },
            });
        } catch (userUpdateError) {
            console.error(`[generateComments] Failed to increment global count for user ${context.user.id}:`, userUpdateError);
        }
    }
    return finalPayload;
}; 