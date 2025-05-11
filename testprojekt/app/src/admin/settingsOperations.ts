import { HttpError } from 'wasp/server';
import { type SystemSettings } from 'wasp/entities';
import type {
  GetSystemSettings,
  UpdateSystemSettings,
} from 'wasp/server/operations';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';

// Default prompts (can be customized)
const DEFAULT_STYLE_ANALYSIS_PROMPT = `Analyze the writing style based on the following LinkedIn post examples provided by a user. Focus on tone, typical sentence structure, common themes or topics, and overall communication style. Keep the analysis concise (around 2-4 sentences).

Examples:
{{EXAMPLES}}

Style Analysis:`;

// This is now ONLY the system/developer instruction for comment generation.
// The user role content (instructing on post and style analysis) and JSON schema will be added in the action.
const DEFAULT_COMMENT_GENERATION_PROMPT = `Du schreibst Kommentare für LinkedIn. Deine Aufgabe ist es, relevante und ansprechende Kommentare zu einem gegebenen LinkedIn-Post zu verfassen. Jeder Kommentar sollte ein zugehöriges Sentiment (positiv, neutral oder negativ) haben. Formatiere deine Antwort als JSON-Objekt mit einem Wurzelschlüssel "comments", der ein Array von Kommentarobjekten enthält. Jedes Kommentarobjekt muss die Schlüssel "text" (der Kommentarinhalt) und "sentiment" haben.`;

// This is now ONLY the developer's instruction to the AI.
// The schema definition, topic, and style analysis will be added programmatically in the action.
const DEFAULT_LINKEDIN_POST_GENERATION_PROMPT = `Du bist ein Linkedin Copywriter und schreibst zu einem bestimmten Thema einen LinkedIn Post. Deine Aufgabe ist es, einen ansprechenden Hook, informativen Content und einen klaren Call-to-Action (CTA) zu generieren. Formatiere deine Antwort als JSON-Objekt mit den Schlüsseln "hook", "content" und "cta".`;

// Schema for the update action
const updateSettingsSchema = z.object({
  styleAnalysisSystemPrompt: z.string().optional(),
  commentGenerationSystemPrompt: z.string().optional(),
  linkedInPostGenerationSystemPrompt: z.string().optional(),
});
type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Define the return type, ensuring prompts are never null
type SystemSettingsResult = {
  styleAnalysisSystemPrompt: string;
  commentGenerationSystemPrompt: string;
  linkedInPostGenerationSystemPrompt: string;
};

const SETTINGS_ID = 1; // Fixed ID for the single settings row

// Query to get settings
export const getSystemSettings: GetSystemSettings<void, SystemSettingsResult> = async (_args, context) => {
  const settings = await context.entities.SystemSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  return {
    styleAnalysisSystemPrompt:
      settings?.styleAnalysisSystemPrompt ?? DEFAULT_STYLE_ANALYSIS_PROMPT,
    commentGenerationSystemPrompt:
      settings?.commentGenerationSystemPrompt ?? DEFAULT_COMMENT_GENERATION_PROMPT,
    linkedInPostGenerationSystemPrompt:
      settings?.linkedInPostGenerationSystemPrompt ?? DEFAULT_LINKEDIN_POST_GENERATION_PROMPT,
  };
};

// Action to update settings
export const updateSystemSettings: UpdateSystemSettings<
  UpdateSettingsInput,
  SystemSettings
> = async (rawArgs, context) => {
  if (!context.user?.isAdmin) {
    throw new HttpError(403, 'Administrative privileges required.');
  }

  const args = ensureArgsSchemaOrThrowHttpError(updateSettingsSchema, rawArgs);

  // Prepare data for upsert, only include fields that are provided
  const dataToUpdate: Partial<Omit<SystemSettings, 'id' | 'updatedAt'> & { updatedAt?: Date }> = {};
  if (args.styleAnalysisSystemPrompt !== undefined) {
    dataToUpdate.styleAnalysisSystemPrompt = args.styleAnalysisSystemPrompt;
  }
  if (args.commentGenerationSystemPrompt !== undefined) {
    dataToUpdate.commentGenerationSystemPrompt = args.commentGenerationSystemPrompt;
  }
  if (args.linkedInPostGenerationSystemPrompt !== undefined) {
    dataToUpdate.linkedInPostGenerationSystemPrompt = args.linkedInPostGenerationSystemPrompt;
  }

  // Check if there is anything to update
  if (Object.keys(dataToUpdate).length === 0) {
     // If nothing to update, just return the current settings or null
     const currentSettings = await context.entities.SystemSettings.findUnique({ where: { id: SETTINGS_ID }});
     if (!currentSettings) {
         // This case should ideally not happen after first upsert, but handle it
         // Maybe create with defaults here? Or return an indication of no settings?
         // For now, let's attempt an upsert even with empty data to create the row if needed.
     } else {
         return currentSettings;
     }
  }

  // Ensure updatedAt is set if there are changes
  if (Object.keys(dataToUpdate).length > 0) {
      dataToUpdate.updatedAt = new Date();
  }

  return context.entities.SystemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      styleAnalysisSystemPrompt: dataToUpdate.styleAnalysisSystemPrompt ?? DEFAULT_STYLE_ANALYSIS_PROMPT,
      commentGenerationSystemPrompt: dataToUpdate.commentGenerationSystemPrompt ?? DEFAULT_COMMENT_GENERATION_PROMPT,
      linkedInPostGenerationSystemPrompt: dataToUpdate.linkedInPostGenerationSystemPrompt ?? DEFAULT_LINKEDIN_POST_GENERATION_PROMPT,
    },
    update: dataToUpdate,
  });
}; 