import { S3Client } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION;

if (!REGION) {
  throw new Error("Please define the AWS_REGION environment variable in .env.local");
}

// Credentials are picked up from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// env vars automatically by the SDK — no need to pass them explicitly.
export const s3 = new S3Client({ region: REGION });

export const S3_BUCKET = process.env.S3_BUCKET_NAME;

if (!S3_BUCKET) {
  throw new Error("Please define the S3_BUCKET_NAME environment variable in .env.local");
}

export function publicUrlFor(key) {
  return `https://${S3_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}
