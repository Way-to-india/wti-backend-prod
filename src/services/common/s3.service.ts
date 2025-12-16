import {
  S3Client,
  GetObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { S3Folder } from '@/common/constants';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { Readable } from 'stream';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

export default class S3Service {
  protected aws_access_key: string;
  protected aws_secret_key: string;
  protected aws_default_region: string;
  protected s3_bucket: string;

  constructor(s3_bucket?: string) {
    // Load and trim all environment variables
    this.aws_access_key = (process.env.AWS_ACCESS_KEY || '').trim();
    this.aws_secret_key = (process.env.AWS_SECRET_KEY || '').trim();
    this.aws_default_region = (process.env.AWS_DEFAULT_REGION || 'ap-south-1').trim();
    this.s3_bucket = s3_bucket?.trim() || (process.env.AWS_S3_BUCKET_NAME || '').trim();

    // Validate credentials
    if (!this.aws_access_key || !this.aws_secret_key) {
      throw new Error('AWS credentials are missing. Check your .env file.');
    }

    if (!this.s3_bucket) {
      throw new Error('S3 bucket name is missing. Check your .env file.');
    }

    // Debug log (remove in production)
    console.log('🔧 S3Service initialized:', {
      accessKey: this.aws_access_key.substring(0, 10) + '...',
      secretKeyLength: this.aws_secret_key.length,
      region: this.aws_default_region,
      bucket: this.s3_bucket,
    });
  }

  private S3ClientInstance() {
    return new S3Client({
      region: this.aws_default_region,
      credentials: {
        accessKeyId: this.aws_access_key,
        secretAccessKey: this.aws_secret_key,
      },
    });
  }

  async uploadFile(
    file: any,
    folder: (typeof S3Folder)[keyof typeof S3Folder],
    key: string,
    contentType: string,
    isHls?: boolean
  ) {
    try {
      // Generate unique filename
      if (!isHls) {
        const timestamp = Date.now().toString();
        const extension = key.substring(key.lastIndexOf('.'));
        key = `${timestamp}${extension}`;
      }

      const fullKey = folder + key;

      console.log(`📤 Uploading to S3: ${fullKey}`);

      // Use PutObjectCommand directly (same as working test script)
      const command = new PutObjectCommand({
        Bucket: this.s3_bucket,
        Key: fullKey,
        Body: file,
        ContentType: contentType,
      });

      const client = this.S3ClientInstance();
      await client.send(command);

      console.log(`✅ Successfully uploaded: ${fullKey}`);
      return fullKey;
    } catch (error: any) {
      console.error('❌ S3 Upload Error:', {
        message: error.message,
        code: error.Code,
        key: folder + key,
      });
      throw error;
    }
  }

  async S3GetObject(Key: string) {
    try {
      const client = this.S3ClientInstance();
      const command = new GetObjectCommand({ Bucket: this.s3_bucket, Key });
      return await getSignedUrl(client, command);
    } catch (error) {
      throw error;
    }
  }

  async S3BulkDelete(keys: string[]) {
    try {
      const objects = {
        Bucket: this.s3_bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      };
      const command = new DeleteObjectsCommand(objects);

      const response = await this.S3ClientInstance().send(command);

      return { deletedKeys: response.Deleted, errorKeys: response.Errors };
    } catch (error) {
      throw error;
    }
  }

  async S3Copy(key: string) {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.s3_bucket,
        CopySource: `${this.s3_bucket}/${key}`,
        Key: `archive/${key}`,
      });

      await this.S3ClientInstance().send(command);
      console.log(`Moved: ${key} → archive/${key}`);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  S3ListObjects = async (prefix: string, continuationToken: undefined | string) => {
    const command = new ListObjectsV2Command({
      Bucket: this.s3_bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await this.S3ClientInstance().send(command);
    return response;
  };

  async S3CompressImage(keyOrUrl: string) {
    try {
      const key = keyOrUrl.startsWith('http') ? extractS3KeyFromUrl(keyOrUrl) : keyOrUrl;

      const getCmd = new GetObjectCommand({ Bucket: this.s3_bucket, Key: key });
      const s3Response = await this.S3ClientInstance().send(getCmd);
      if (!s3Response.Body) throw new Error('No body in S3 response');
      const imageBuffer = await streamToBuffer(s3Response.Body as Readable);

      const sharpImage = sharp(imageBuffer);
      const metadata = await sharpImage.metadata();

      let compressedBuffer: Buffer;
      let outputContentType: string;

      switch (metadata.format) {
        case 'png':
          compressedBuffer = await sharpImage.resize({ width: 500 }).toBuffer();
          outputContentType = 'image/png';
          break;
        case 'webp':
          compressedBuffer = await sharpImage.resize({ width: 500 }).toBuffer();
          outputContentType = 'image/webp';
          break;
        case 'jpeg':
        case 'jpg':
        default:
          compressedBuffer = await sharpImage.resize({ width: 500 }).toBuffer();
          outputContentType = 'image/jpeg';
          break;
      }

      const putCmd = new PutObjectCommand({
        Bucket: this.s3_bucket,
        Key: key,
        Body: compressedBuffer,
        ContentType: outputContentType,
      });
      const res = await this.S3ClientInstance().send(putCmd);
      console.log(`:white_check_mark: Compressed and uploaded: ${key} `, res);
      return true;
    } catch (error) {
      console.error(`error while compressing the ${keyOrUrl} - ${error}`);
      return false;
    }
  }

  identity = async () => {
    const sts = new STSClient({
      region: this.aws_default_region,
      credentials: {
        accessKeyId: this.aws_access_key,
        secretAccessKey: this.aws_secret_key,
      },
    });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    console.log(identity);
  };
}

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

export function extractS3KeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  return decodeURIComponent(urlObj.pathname.replace(/^\/+/, ''));
}

export const prependCloudFrontURL = (destination: string): string => {
  if (!destination || typeof destination !== 'string') return destination;

  const cleanDestination = destination.startsWith('/') ? destination.substring(1) : destination;

  return `${process.env.AWS_CLOUDFRONT_ENDPOINT}/${cleanDestination}`;
};

const MEDIA_FIELDS = ['images'];

export const patchCloudFrontURLs = (doc: any): void => {
  if (!doc || typeof doc !== 'object') return;

  const queue = [doc];
  const seen = new WeakSet();

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    for (const key of Object.keys(current)) {
      const value = current[key];

      if (
        typeof value === 'string' &&
        MEDIA_FIELDS.includes(key) &&
        !value.startsWith(process.env.AWS_CLOUDFRONT_ENDPOINT as string)
      ) {
        current[key] = prependCloudFrontURL(value);
      }

      if (typeof value === 'object' && value !== null) {
        queue.push(value);
      }
    }
  }
};
