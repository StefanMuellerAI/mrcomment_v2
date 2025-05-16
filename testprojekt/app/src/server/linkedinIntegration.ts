import { AuthClient, RestliClient } from 'linkedin-api-client';
import { HttpError, env } from 'wasp/server';
import type { Customer, LinkedInAuthState, User as FullUserType } from 'wasp/entities'; // Umbenannt, um Konflikt zu vermeiden
import { Prisma } from '@prisma/client'; // Behalte Prisma für DbNull etc.
import type { AuthUser } from 'wasp/auth'; // Wasp's AuthUser importieren
import crypto from 'crypto';
import axios from 'axios'; // Importiere axios
import { getDownloadFileSignedURLFromS3 } from '../file-upload/s3Utils'; // Assuming this can be imported and used here
import type { PrismaClient } from '@prisma/client';

const LINKEDIN_CLIENT_ID = env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_REDIRECT_URI = (env.WASP_SERVER_URL || 'http://localhost:3001') + '/api/auth/linkedin/customer/callback';
const WEB_CLIENT_URL = (env.WASP_WEB_CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');

interface InitiateAuthArgs {
  customerId: string;
}

// Typ für den Kontext, wie von Wasp für authentifizierte Actions/Queries bereitgestellt

// Basis Kontext für Operationen, die User und Customer benötigen
interface WaspContextBase {
  user?: AuthUser;
  entities: {
    Customer: PrismaClientInJobContext['customer'];
    User: PrismaClientInJobContext['user'];
    // LinkedInAuthState ist hier NICHT definiert
  };
}

// Erweiterter Kontext für Operationen, die zusätzlich LinkedInAuthState benötigen
interface WaspContextWithLinkedInAuth extends WaspContextBase {
  entities: WaspContextBase['entities'] & {
    LinkedInAuthState: PrismaClientInJobContext['linkedInAuthState'];
  };
}

// Context type expected by Wasp actions that require an authenticated user.
// Ensure this matches the actual context structure provided by Wasp.
interface WaspContextWithUser extends WaspContextBase {
  user: AuthUser;
  entities: {
    User: PrismaClient['user'];
    Customer: PrismaClient['customer'];
    LinkedInPost: PrismaClient['linkedInPost'];
    LinkedInAuthState: PrismaClient['linkedInAuthState'];
    Schedule: PrismaClient['schedule'];
    Prisma: PrismaClient; // Assuming Prisma client might be nested here for actions
  };
  // If Prisma is top-level for some contexts (e.g. jobs), this might need adjustment
  // or the function needs to be robust to both structures.
  prisma?: PrismaClient; // For flexibility if prisma is sometimes top-level
}

interface WaspContextBaseForJobs { // Simpler context for jobs
  prisma: PrismaClient;
}

// Standard Wasp Action context (simplified view relevant for this function)
interface WaspActionContext {
  user: AuthUser;       // Authenticated user
  prisma: PrismaClient; // Full Prisma client
  // It might also contain 'entities', but we'll primarily use 'prisma' for direct DB access
}

// Standard Wasp Job context (simplified view)
interface WaspJobContext {
  prisma: PrismaClient; // Full Prisma client
}

export const initiateLinkedInAuthForCustomer = async (
  args: InitiateAuthArgs,
  context: WaspContextWithLinkedInAuth // Verwendung des erweiterten Kontext-Typs
): Promise<{ authUrl: string }> => {
  if (!context.user) { // Standard-Auth-Check
    throw new HttpError(401, 'User not authenticated.');
  }
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    console.error('LinkedIn API credentials not configured. Check .env.server for LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET');
    throw new HttpError(500, 'LinkedIn API credentials not configured.');
  }

  const customer = await context.entities.Customer.findUnique({
    where: { id: args.customerId },
  });

  // Zugriff auf context.user.id ist sicher nach dem Check oben
  if (!customer || customer.userId !== context.user.id) {
    throw new HttpError(403, 'User does not have access to this customer.');
  }

  const authClient = new AuthClient({
    clientId: LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    redirectUrl: LINKEDIN_REDIRECT_URI,
  });

  const state = crypto.randomBytes(16).toString('hex');
  const tenMinutesInMilliseconds = 10 * 60 * 1000;

  await context.entities.LinkedInAuthState.deleteMany({
    where: {
      OR: [
        { customerId: args.customerId },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });

  await context.entities.LinkedInAuthState.create({
    data: {
      state: state,
      customerId: args.customerId,
      initiatingWaspUserId: context.user.id, // context.user.id ist hier verfügbar
      expiresAt: new Date(Date.now() + tenMinutesInMilliseconds),
    },
  });

  const scopes = ['openid', 'profile', 'email', 'w_member_social'];
  const authUrl = authClient.generateMemberAuthorizationUrl(scopes, state);

  return { authUrl };
};

// Für API-Routen ist der Kontext-Typ etwas anders, er enthält keine 'user'-Eigenschaft direkt,
// es sei denn, die API-Route hat `auth: true` (was unsere nicht hat).
interface ApiContext {
    entities: {
        Customer: PrismaClientInJobContext['customer'];
        LinkedInAuthState: PrismaClientInJobContext['linkedInAuthState'];
        User: PrismaClientInJobContext['user'];
    };
}

// Ursprüngliche Implementierung der handleLinkedInCustomerCallback Funktion
export const handleLinkedInCustomerCallback = async (req: any, res: any, context: ApiContext ): Promise<void> => {
  const { code, state: receivedState } = req.query;

  if (!code || !receivedState) {
    res.redirect(WEB_CLIENT_URL + '/customers?linkedin_status=error&message=MissingCallbackParams');
    return;
  }

  const storedStateEntry = await context.entities.LinkedInAuthState.findUnique({
    where: { state: receivedState as string },
  });

  if (!storedStateEntry || storedStateEntry.expiresAt < new Date()) {
    if (storedStateEntry) {
      await context.entities.LinkedInAuthState.delete({ where: { id: storedStateEntry.id } });
    }
    const customerRedirectPath = storedStateEntry ? `/customer/${storedStateEntry.customerId}` : '/customers';
    res.redirect(WEB_CLIENT_URL + customerRedirectPath + '?linkedin_status=error&message=InvalidOrExpiredState');
    return;
  }

  const customerId = storedStateEntry.customerId;
  await context.entities.LinkedInAuthState.delete({ where: { id: storedStateEntry.id } });

  try {
    const authClient = new AuthClient({
      clientId: LINKEDIN_CLIENT_ID,
      clientSecret: LINKEDIN_CLIENT_SECRET,
      redirectUrl: LINKEDIN_REDIRECT_URI,
    });

    const tokenResponse = await authClient.exchangeAuthCodeForAccessToken(code as string);
    const accessToken = tokenResponse.access_token;
    const expiresIn = tokenResponse.expires_in;
    const refreshToken = tokenResponse.refresh_token;
    // LinkedIn sendet Scopes mit Komma getrennt, aber der linkedin-api-client könnte sie schon als Array parsen.
    // Sicherstellen, dass es immer ein Array ist.
    const rawScopes = tokenResponse.scope;
    let grantedScopes: string[] = [];
    if (typeof rawScopes === 'string') {
      grantedScopes = rawScopes.split(/\s*,\s*|\s+/); // Split by comma or space, trim whitespace
    } else if (Array.isArray(rawScopes)) {
      grantedScopes = rawScopes;
    }

    // Direkter Aufruf mit axios
    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0' // Vorsorglich hinzufügen, oft von LinkedIn APIs erwartet
      }
    });
    const linkedInProfileData = profileResponse.data;

    // Die User ID kommt vom 'sub' Feld im OIDC UserInfo Response
    const rawLinkedInSubId = linkedInProfileData.sub; 

    if (!rawLinkedInSubId) {
      throw new Error('LinkedIn User ID (sub) not found in userinfo response.');
    }
    // Stelle sicher, dass es eine URN ist
    const linkedInUrn = rawLinkedInSubId.startsWith('urn:li:person:') ? rawLinkedInSubId : `urn:li:person:${rawLinkedInSubId}`;

    await context.entities.Customer.update({
      where: { id: customerId },
      data: {
        linkedinUserId: linkedInUrn, // Speichere die volle URN
        linkedinAccessToken: accessToken,
        linkedinAccessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        linkedinRefreshToken: refreshToken || null,
        linkedinGrantedScopes: grantedScopes,
        linkedinProfileData: linkedInProfileData as any, // Prisma Json type
      },
    });

    // Erfolgreich verbunden, leite zur Customer Details Seite weiter (ohne /settings)
    res.redirect(WEB_CLIENT_URL + `/customer/${customerId}?linkedin_status=success`);

  } catch (error: any) {
    console.error('LinkedIn OAuth callback error:', error.response?.data || error.message, error.stack);
    const customerRedirectPath = customerId ? `/customer/${customerId}` : '/customers';
    let redirectUrl = WEB_CLIENT_URL + customerRedirectPath + '?linkedin_status=error&message=AuthFailed';
    if (error.response?.data?.error_description) {
      redirectUrl += `&desc=${encodeURIComponent(error.response.data.error_description)}`;
    }
    res.redirect(redirectUrl);
  }
};

export const getLinkedInConnectionStatusForCustomer = async (
  args: { customerId: string },
  context: WaspContextBase // Verwendung des Basis Kontext-Typs
): Promise<{ isConnected: boolean; profileData?: any; error?: string; requiresReauth?: boolean }> => {
  if (!context.user) { // Standard-Auth-Check
    throw new HttpError(401, 'User not authenticated.');
  }
  const customer = await context.entities.Customer.findUnique({
    where: { id: args.customerId },
    select: { userId: true, linkedinUserId: true, linkedinAccessToken: true, linkedinAccessTokenExpiresAt: true, linkedinProfileData: true, linkedinGrantedScopes: true },
  });

  if (!customer || customer.userId !== context.user.id) { // context.user.id ist sicher
    throw new HttpError(403, 'User does not have access to this customer.');
  }

  if (customer.linkedinUserId && customer.linkedinAccessToken) {
    if (customer.linkedinAccessTokenExpiresAt && customer.linkedinAccessTokenExpiresAt < new Date()) {
      return { isConnected: true, profileData: customer.linkedinProfileData, requiresReauth: true };
    }
    return { isConnected: true, profileData: customer.linkedinProfileData };
  }
  return { isConnected: false };
};

export const disconnectLinkedInForCustomer = async (
  args: { customerId: string },
  context: WaspContextBase // Verwendung des Basis Kontext-Typs
): Promise<void> => {
  if (!context.user) { // Standard-Auth-Check
    throw new HttpError(401, 'User not authenticated.');
  }
  const customer = await context.entities.Customer.findUnique({
    where: { id: args.customerId },
    select: { userId: true }, // Nur userId wird für den Auth-Check benötigt
  });

  if (!customer || customer.userId !== context.user.id) { // context.user.id ist sicher
    throw new HttpError(403, 'User does not have access to this customer.');
  }

  await context.entities.Customer.update({
    where: { id: args.customerId },
    data: {
      linkedinUserId: null,
      linkedinAccessToken: null,
      linkedinAccessTokenExpiresAt: null,
      linkedinRefreshToken: null,
      linkedinGrantedScopes: [],
      linkedinProfileData: Prisma.DbNull,
    },
  });
};

// Neue, einfache Test-Callback-Funktion mit ASCII-Namen
export const simpleTestCallback = async (req: any, res: any, context: any): Promise<void> => {
  console.log('!!!!!!!! TEST SIMPLE CALLBACK REACHED !!!!!!!!!!');
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('Test Simple Callback Reached Successfully!');
};

// ++ NEUE FUNKTION: Post auf LinkedIn veröffentlichen ++
interface PublishToLinkedInArgs {
  linkedInPostIdDb: string; // ID des Posts in unserer DB
}

// Helper function to upload image to LinkedIn and get asset URN
// This is a conceptual placeholder and needs to be adapted to LinkedIn's exact API requirements.
async function uploadImageToLinkedInAndGetAssetUrn(
  accessToken: string,
  authorUrn: string, 
  s3ImageKey: string,
  imageContentType: string
): Promise<string> {
  console.log("[LinkedIn Image Upload Doku] Starting process for S3 key:", s3ImageKey);
  let imageDownloadUrl: string;
  try {
    imageDownloadUrl = await getDownloadFileSignedURLFromS3({ key: s3ImageKey });
    console.log("[LinkedIn Image Upload Doku] Got S3 download URL:", imageDownloadUrl);
  } catch (e: any) {
    console.error("[LinkedIn Image Upload Doku] Failed to get S3 download URL:", e);
    throw new Error(`Failed to get S3 download URL: ${e.message}`);
  }

  // Step 1: Register the image upload with LinkedIn using /assets API
  const registerUploadPayload = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: authorUrn,
      serviceRelationships: [
        {
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent"
        }
      ]
    }
  };
  console.log("[LinkedIn Image Upload Doku] Register Upload Request Body (/assets):", JSON.stringify(registerUploadPayload, null, 2));

  let uploadUrl: string;
  let assetUrn: string;

  try {
    const registerResponse = await axios.post(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      registerUploadPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );
    console.log("[LinkedIn Image Upload Doku] Register Upload Response Status:", registerResponse.status);
    console.log("[LinkedIn Image Upload Doku] Register Upload Response Data:", JSON.stringify(registerResponse.data, null, 2));
    
    const responseValue = registerResponse.data.value;
    if (!responseValue || 
        !responseValue.uploadMechanism || 
        !responseValue.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'] || 
        !responseValue.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl ||
        !responseValue.asset) {
      console.error("[LinkedIn Image Upload Doku] Invalid structure in Register Upload Response:", responseValue);
      throw new Error('LinkedIn registerUpload did not return expected structure with uploadUrl or asset URN.');
    }
    uploadUrl = responseValue.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    assetUrn = responseValue.asset;

  } catch (error: any) {
    console.error('[LinkedIn Image Upload Doku] Register Upload API call failed:', error.response?.status, error.response?.data || error.message);
    throw new HttpError(502, `LinkedIn image registerUpload failed: ${error.response?.data?.message || error.message}`);
  }
  
  console.log("[LinkedIn Image Upload Doku] Received Upload URL:", uploadUrl);
  console.log("[LinkedIn Image Upload Doku] Received Asset URN:", assetUrn);

  // Step 2: Upload the image binary to the URL provided by LinkedIn
  try {
    console.log("[LinkedIn Image Upload Doku] Fetching image from S3 for PUT:", imageDownloadUrl);
    const imageResponse = await axios.get(imageDownloadUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);
    console.log("[LinkedIn Image Upload Doku] Image fetched from S3, buffer length:", imageBuffer.length);

    console.log("[LinkedIn Image Upload Doku] Performing PUT to LinkedIn Upload URL:", uploadUrl, "with Content-Type:", imageContentType);
    // The cURL example uses --upload-file which is like a POST, but for raw data upload, PUT is often used.
    // LinkedIn docs sometimes show POST for this step for specific SDKs, but raw HTTP is often PUT.
    // The key is the Auth header mentioned in their cURL example.
    const putResponse = await axios.put(uploadUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${accessToken}`, // Added as per LinkedIn cURL example for this step
        'Content-Type': imageContentType,
        // LinkedIn S3 uploads might not need X-Restli-Protocol-Version for the PUT to storage
      },
    });
    console.log("[LinkedIn Image Upload Doku] PUT to LinkedIn Upload URL - Status:", putResponse.status);
    // A successful PUT to S3-like storage usually returns 200 or 201 without a significant body.
  } catch (error: any) {
    console.error('[LinkedIn Image Upload Doku] PUT to LinkedIn uploadUrl failed:', error.response?.status, error.response?.data || error.message);
    throw new HttpError(502, `LinkedIn image binary upload failed: ${error.response?.data?.message || error.message}`);
  }

  // According to the provided docs, no explicit finalize step is mentioned after the binary upload for this flow.
  // The asset URN from step 1 is used directly.

  console.log("[LinkedIn Image Upload Doku] Successfully processed, returning Asset URN:", assetUrn);
  return assetUrn;
}

type PrismaClientInJobContext = PrismaClient; // More specific type for Prisma

export async function publishPostToLinkedIn(
  args: PublishToLinkedInArgs,
  context: WaspActionContext | WaspJobContext // Expects a context that definitely has .prisma
): Promise<void> { 
  console.log(`[LinkedIn Publish] Entered function for DB post ID: ${args.linkedInPostIdDb}`);
  const { linkedInPostIdDb } = args;
  
  const prismaClient: PrismaClient = context.prisma; // Directly use context.prisma
  let authUser: AuthUser | undefined = undefined;

  if ('user' in context && context.user) { // Check if it's WaspActionContext with a user
    authUser = context.user;
  }

  // Optional: Auth check if needed internally, though primary auth is responsibility of calling Wasp op.
  // if (('user' in context && !context.user)) { // If it should be an action context but user is missing
  //   throw new HttpError(401, "User authentication is required for this operation within publishPostToLinkedIn.");
  // }

  const LinkedInPost = prismaClient.linkedInPost;
  const Customer = prismaClient.customer; // Customer entity for fetching customer details

  const post = await LinkedInPost.findUnique({
    where: { id: linkedInPostIdDb },
    include: { customer: true },
  });

  if (!post) {
    console.error(`[LinkedIn Publish] Post with ID ${linkedInPostIdDb} not found in DB.`);
    throw new HttpError(404, `Post with ID ${linkedInPostIdDb} not found.`);
  }
  console.log(`[LinkedIn Publish] Fetched post from DB - ID: ${post.id}, imageS3Key: ${post.imageS3Key}, imageContentType: ${post.imageContentType}`);

  const customer = post.customer;
  if (!customer) {
    console.error(`[LinkedIn Publish] Customer not found for post ${linkedInPostIdDb}.`);
    throw new HttpError(404, `Customer for post ${linkedInPostIdDb} not found.`);
  }

  if (!customer.linkedinAccessToken || !customer.linkedinUserId) {
    console.error('[LinkedIn Publish] Customer is not fully connected to LinkedIn (missing access token or user ID).');
    throw new HttpError(400, 'Customer LinkedIn connection is incomplete.');
  }

  const accessToken = customer.linkedinAccessToken;
  const authorUrn = customer.linkedinUserId; 
  const postBodyText = `${post.hook}\n\n${post.content}\n\n${post.cta}`;
  let imageAssetForPost: string | undefined = undefined;

  if (post.imageS3Key && post.imageContentType && accessToken && authorUrn) {
      try {
          console.log(`[LinkedIn Publish] Attempting to upload image ${post.imageS3Key} to LinkedIn for post ${linkedInPostIdDb}...`);
          imageAssetForPost = await uploadImageToLinkedInAndGetAssetUrn(accessToken,authorUrn,post.imageS3Key,post.imageContentType );
          console.log(`[LinkedIn Publish] Image uploaded to LinkedIn for post ${linkedInPostIdDb}, asset URN: ${imageAssetForPost}`);
      } catch (imgError: any) {
          console.error("[LinkedIn Publish] Failed to process image for LinkedIn post:", imgError.message);
          console.warn(`[LinkedIn Publish] Proceeding to post to LinkedIn without image due to error: ${imgError.message}`);
      }
  } else {
      console.log(`[LinkedIn Publish] Skipping image upload for post ${linkedInPostIdDb}. Details: imageS3Key: ${post.imageS3Key}, imageContentType: ${post.imageContentType}, token: ${!!accessToken}, authorUrn: ${!!authorUrn}`);
  }

  const payload: any = { 
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: postBodyText,
        },
        shareMediaCategory: imageAssetForPost ? 'IMAGE' : 'NONE', 
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  if (imageAssetForPost) {
    payload.specificContent['com.linkedin.ugc.ShareContent'].media = [
      {
        status: 'READY',
        media: imageAssetForPost, 
      },
    ];
  }

  console.log("[LinkedIn Publish] Final UGC Post Request Body for post " + linkedInPostIdDb + ":", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202304' 
      },
    });

    if (response.status >= 200 && response.status < 300) {
      const linkedInPostUgcId = response.data?.id; 
      console.log(`[LinkedIn Publish] Successfully published UGC post to LinkedIn for DB post ${linkedInPostIdDb}. LinkedIn UGC ID: ${linkedInPostUgcId}`);
      
      if (linkedInPostUgcId) {
        await LinkedInPost.update({
          where: { id: linkedInPostIdDb },
          data: { linkedInPostUgcId: linkedInPostUgcId },
        });
        console.log(`[LinkedIn Publish] DB Post ${linkedInPostIdDb} updated with UGC ID: ${linkedInPostUgcId}`);
      } else {
        console.warn(`[LinkedIn Publish] LinkedIn UGC ID not found in response for DB post ${linkedInPostIdDb}. Post not updated with UGC ID.`);
      }
    } else {
      console.error(`[LinkedIn Publish] Error publishing UGC post to LinkedIn. Status: ${response.status}, Data:`, response.data);
      throw new HttpError(response.status, `LinkedIn API responded with status ${response.status}`);
    }
  } catch (error: any) {
    let errorMessage = 'Failed to publish UGC post to LinkedIn.';
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `[LinkedIn Publish] Axios error publishing UGC post to LinkedIn for DB post ${linkedInPostIdDb}:`,
        error.response.data
      );
      errorMessage = `LinkedIn API error: ${error.response.data?.message || error.message}`;
      throw new HttpError(error.response.status || 500, errorMessage);
    } else {
      console.error(`[LinkedIn Publish] Unknown error publishing UGC post to LinkedIn for DB post ${linkedInPostIdDb}:`, error);
      errorMessage = error.message || 'Unknown error during LinkedIn publish.';
      throw new HttpError(500, errorMessage);
    }
  }
} 