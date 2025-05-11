import { HttpError } from 'wasp/server'
import type { Prisma, Customer, Style, Persona } from '@prisma/client'
import type { 
    CreateCustomer as CreateCustomerOperation,
    UpdateCustomer as UpdateCustomerOperation,
    DeleteCustomer as DeleteCustomerOperation,
    GetAllCustomers as GetAllCustomersOperation,
    GetCustomerDetails as GetCustomerDetailsOperation 
} from 'wasp/server/operations'
import { type User, type SystemSettings, type Customer as CustomerEntity } from 'wasp/entities'
import { prisma } from 'wasp/server'
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation'
import OpenAI from 'openai'
import { getSystemSettings } from '../admin/settingsOperations.js'
import * as z from 'zod'

// --- OpenAI Client Setup ---
let openai: OpenAI | null = null
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
} else {
    console.warn('OPENAI_API_KEY is not set. Style analysis generation will be disabled.')
}

// --- Helper Function for Style Analysis (accepts prompt) ---
async function generateAndSaveStyleAnalysis(
    styleId: string, 
    examples: string[],
    systemPromptTemplate: string // Re-enable parameter
): Promise<void> {
    if (!openai || examples.length === 0) { return; }

    const promptContent = systemPromptTemplate.replace(
        '{{EXAMPLES}}',
        examples.map((ex, i) => `${i + 1}. \"${ex.substring(0, 500)}${ex.length > 500 ? '...' : ''}\"`).join('\n')
    );

    try {
        console.log(`Requesting style analysis for style ID: ${styleId} using custom prompt.`)
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "user", content: promptContent }],
            temperature: 0.5,
            max_tokens: 150,
        })

        const analysis = completion.choices[0]?.message?.content?.trim()
        console.log(`Received analysis: ${analysis ? analysis.substring(0, 100) + '...' : '(empty)'}`)

        if (analysis) {
            await prisma.style.update({
                where: { id: styleId },
                data: { styleAnalysis: analysis },
            })
            console.log(`Successfully saved style analysis for style ID: ${styleId}`)
        }
    } catch (error: any) {
        console.error(`Error generating or saving style analysis for style ID ${styleId}:`, error.message)
    }
}

// Specific input types for actions (can be used for internal validation/casting)
interface CreateCustomerPayload {
  name: string;
  styleData?: Partial<Omit<Style, 'id' | 'createdAt' | 'customerId'> & { customerId?: string }>;
  personaData?: Partial<Omit<Persona, 'id' | 'createdAt' | 'customerId'> & { customerId?: string }>;
}

interface UpdateCustomerPayload extends CreateCustomerPayload {
  customerId: string;
}

interface DeleteCustomerPayload {
  customerId: string;
}

interface GetCustomerDetailsPayload {
  customerId: string;
}

// Expected return types for queries
type CustomerWithRelations = Customer & { 
  style?: Style | null;
  persona?: Persona | null;
};

// TODO: Implement actual logic
export const createCustomer: CreateCustomerOperation<any, CustomerWithRelations> = async (args, context) => {
  if (!context.user) { throw new HttpError(401) }
  const { name, styleData, personaData } = args as CreateCustomerPayload;
  
  const examplesToSave = styleData?.linkedinExamples?.map(s => s.trim()).filter(s => s) || [];
  if (examplesToSave.length < 3) {
    throw new HttpError(400, 'At least 3 non-empty LinkedIn examples are required.');
  }

  let systemSettings;
  try {
      systemSettings = await getSystemSettings(undefined, context); 
  } catch (settingsError: any) {
      console.error("Failed to fetch system settings in createCustomer:", settingsError.message);
      throw new HttpError(500, "Could not retrieve system settings.");
  }

  const finalStyleData = {
      ...(styleData || {}),
      linkedinExamples: examplesToSave,
      styleAnalysis: '' 
  };

  const newCustomer = await context.entities.Customer.create({
    data: {
      name,
      userId: context.user.id,
      style: { create: finalStyleData as Prisma.StyleCreateWithoutCustomerInput }, 
      persona: personaData ? { create: personaData as Prisma.PersonaCreateWithoutCustomerInput } : undefined,
      subscriptionPlan: "free_tier",
      subscriptionStatus: "active",
    },
    include: {
      style: true,
      persona: true,
    }
  });

  if (newCustomer.style?.id && systemSettings?.styleAnalysisSystemPrompt) {
     generateAndSaveStyleAnalysis(
         newCustomer.style.id, 
         examplesToSave, 
         systemSettings.styleAnalysisSystemPrompt
     )
       .catch(e => console.error("Background style analysis failed:", e)); 
  }

  return newCustomer;
}

// TODO: Implement actual logic
export const updateCustomer: UpdateCustomerOperation<any, CustomerWithRelations> = async (args, context) => {
  if (!context.user) { throw new HttpError(401) }
  const { customerId, name, styleData, personaData } = args as UpdateCustomerPayload;

  const currentCustomer = await context.entities.Customer.findFirst({
    where: { id: customerId, userId: context.user.id },
    include: { style: true }
  });
  if (!currentCustomer) { throw new HttpError(403, 'Customer not found or access denied'); }

  let systemSettings;
  try {
      systemSettings = await getSystemSettings(undefined, context);
  } catch (settingsError: any) {
      console.error("Failed to fetch system settings in updateCustomer:", settingsError.message);
      throw new HttpError(500, "Could not retrieve system settings.");
  }

  const currentExamples = currentCustomer.style?.linkedinExamples || [];
  const newExamples = styleData?.linkedinExamples?.map(s => s.trim()).filter(s => s) || [];
  const examplesChanged = currentExamples.length !== newExamples.length || 
                         currentExamples.some((val, idx) => val !== newExamples[idx]);

  const updatedCustomerData = await context.entities.Customer.update({
    where: {
      id: customerId,
    },
    data: {
      name,
      style: styleData ? { 
          upsert: { 
              create: { 
                  ...(styleData as Prisma.StyleCreateWithoutCustomerInput),
                  linkedinExamples: newExamples, 
                  styleAnalysis: styleData.styleAnalysis || ''
              },
              update: { 
                  ...(styleData as Prisma.StyleUpdateWithoutCustomerInput),
                  linkedinExamples: newExamples, 
                  styleAnalysis: styleData.styleAnalysis || ''
              }
          } 
      } : undefined,
      persona: personaData ? { 
          upsert: { 
              create: personaData as Prisma.PersonaCreateWithoutCustomerInput, 
              update: personaData as Prisma.PersonaUpdateWithoutCustomerInput 
          } 
      } : undefined,
    },
    include: {
      style: true,
      persona: true,
    }
  });

  if (examplesChanged && newExamples.length > 0 && updatedCustomerData.style?.id && systemSettings?.styleAnalysisSystemPrompt) {
      console.log('LinkedIn examples changed, triggering style analysis regeneration...');
      generateAndSaveStyleAnalysis(
          updatedCustomerData.style.id, 
          newExamples, 
          systemSettings.styleAnalysisSystemPrompt
      )
        .catch(e => console.error("Background style analysis regeneration failed:", e));
  }
  return updatedCustomerData;
}

// TODO: Implement actual logic
export const deleteCustomer: DeleteCustomerOperation<any, Customer> = async (args, context) => {
  if (!context.user) { throw new HttpError(401) }
  const { customerId } = args as DeleteCustomerPayload;
  const customer = await context.entities.Customer.findFirst({
    where: { id: customerId, userId: context.user.id },
  });
  if (!customer) {
    throw new HttpError(404, 'Customer not found or you do not have permission to delete it.');
  }

  // Manually delete related Style and Persona records
  // Prisma cascade deletes are not always straightforward with 1-to-1 optional relations
  // if not configured with specific onDelete options in schema.prisma.
  await context.entities.Style.deleteMany({ where: { customerId: customerId } });
  await context.entities.Persona.deleteMany({ where: { customerId: customerId } });

  return context.entities.Customer.delete({
    where: {
      id: customerId,
    }
  });
}

// TODO: Implement actual logic
export const getAllCustomers: GetAllCustomersOperation<any, CustomerEntity[]> = async (_args, context) => {
  if (!context.user) { throw new HttpError(401) }
  return context.entities.Customer.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    }
  });
}

// TODO: Implement actual logic
export const getCustomerDetails: GetCustomerDetailsOperation<any, CustomerWithRelations | null> = async (args, context) => {
  if (!context.user) { throw new HttpError(401) }
  const { customerId } = args as GetCustomerDetailsPayload;
  return context.entities.Customer.findFirst({
    where: {
      id: customerId,
      userId: context.user.id,
    },
    include: {
      style: true,
      persona: true,
    }
  });
}

// --- New Action: Update Customer Subscription ---
const updateCustomerSubscriptionInputSchema = z.object({
  customerId: z.string(),
  planId: z.string(), // e.g., "free_tier", "basic_tier", "premium_tier"
});

// Define the expected arguments type for Wasp
interface UpdateCustomerSubscriptionInput {
  customerId: string;
  planId: string;
}

// Define the return type (Customer entity with its relations)
// We might not need full relations here, just the updated Customer.
// For consistency, using CustomerWithRelations, but Prisma returns the raw Customer type here.
type UpdateCustomerSubscriptionResult = CustomerEntity; 

// Since this is not a predefined Wasp operation type, we use a more generic form for the function signature.
// However, Wasp will generate a specific type for `UpdateCustomerSubscription` based on main.wasp definition.
export const updateCustomerSubscription: 
  (args: UpdateCustomerSubscriptionInput, context: any) => Promise<UpdateCustomerSubscriptionResult> 
  = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required.");
  }

  const { customerId, planId } = ensureArgsSchemaOrThrowHttpError(updateCustomerSubscriptionInputSchema, rawArgs);

  // Verify the user owns this customer
  const customer = await context.entities.Customer.findFirst({
    where: {
      id: customerId,
      userId: context.user.id,
    },
  });

  if (!customer) {
    throw new HttpError(404, "Customer not found or you do not have permission to update it.");
  }

  // TODO: Validate planId against a list of known valid plan IDs if needed.
  // For now, we assume planId is valid.

  const updatedCustomer = await context.entities.Customer.update({
    where: {
      id: customerId,
    },
    data: {
      subscriptionPlan: planId,
      subscriptionStatus: "active", // For now, any plan change makes it active. Could be more nuanced.
    },
    // No include needed if we only return the CustomerEntity from Prisma update
  });

  return updatedCustomer;
}; 