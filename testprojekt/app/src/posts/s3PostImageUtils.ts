import * as path from 'path';
import { randomUUID } from 'crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { MAX_FILE_SIZE_BYTES } from '../file-upload/validation'; // Assuming a shared validation for max size

// Initialize S3 client - ensure AWS credentials and region are in env for this to work.
// These environment variables are typically AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
// The bucket name will also be from an environment variable.
const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    // Using AWS_S3_IAM_ACCESS_KEY and AWS_S3_IAM_SECRET_KEY as seen in the other s3Utils.ts
    // Ensure these are the correct env variable names for your setup.
    accessKeyId: process.env.AWS_S3_IAM_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_S3_IAM_SECRET_KEY!,
  },
});

interface GeneratePresignedPostForImageArgs {
  fileName: string;
  fileType: string; // MIME type e.g. 'image/png'
  customerId: string;
  userId: string; // For namespacing, audit, or other uses if needed
}

export const generatePresignedPostForImage = async ({
  fileName,
  fileType,
  customerId,
  // userId, // userId is not strictly used in key generation here but passed for potential future use
}: GeneratePresignedPostForImageArgs) => {
  // Construct the S3 key. Example: customers/CUSTOMER_ID/postImages/RANDOM_UUID.extension
  const ext = path.extname(fileName).slice(1);
  const uniqueFileName = `${randomUUID()}.${ext}`;
  const key = `customers/${customerId}/postImages/${uniqueFileName}`;

  // Ensure the bucket name env variable is set.
  // Using AWS_S3_FILES_BUCKET as seen in the other s3Utils.ts
  const bucketName = process.env.AWS_S3_FILES_BUCKET;
  if (!bucketName) {
    console.error('AWS_S3_FILES_BUCKET environment variable is not set.');
    throw new Error('S3 bucket name is not configured.');
  }

  // Define conditions for the presigned POST
  const conditions: any = [
    ['content-length-range', 0, MAX_FILE_SIZE_BYTES],
    // Can add more conditions, e.g., specific ACLs, or content type starts with 'image/'
  ];

  const fields = {
    'Content-Type': fileType,
    // 'acl': 'private', // Corresponding field if ACL condition is set
  };

  try {
    const { url: uploadUrl, fields: uploadFields } = await createPresignedPost(s3Client, {
      Bucket: bucketName,
      Key: key,
      Conditions: conditions,
      Fields: fields,
      Expires: 3600, // URL expires in 1 hour
    });

    return { uploadUrl, key, uploadFields };
  } catch (error) {
    console.error('Error creating presigned POST for image:', error);
    throw new Error('Failed to generate signed URL for image upload.');
  }
}; 