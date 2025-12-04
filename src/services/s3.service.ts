import {
  S3Client,
  GetObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Folder } from '@/common/constants';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { Readable } from 'stream';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

export default class S3Service {
  protected aws_access_key: string;
  protected aws_secret_key: string;
  protected aws_default_region: string;

  constructor(public s3_bucket?: string) {
    this.aws_access_key = process.env.AWS_ACCESS_KEY as string;
    this.aws_secret_key = process.env.AWS_SECRET_KEY as string;
    this.aws_default_region = process.env.AWS_DEFAULT_REGION as string;
    this.s3_bucket = this.s3_bucket || (process.env.AWS_S3_BUCKET_NAME as string);
  }

  private S3ClientInstance() {
    return new S3Client({
      credentials: {
        accessKeyId: this.aws_access_key,
        secretAccessKey: this.aws_secret_key,
      },
      region: this.aws_default_region,
    });
  }

  async uploadFile(
    file : any,
    folder: (typeof S3Folder)[keyof typeof S3Folder],
    key: string,
    contentType: string,
    isHls?: boolean
  ) {
    try {
      if (!isHls) {
        const timestamp = Date.now().toString();
        const extension = key.substring(key.lastIndexOf('.'));
        key = `${timestamp}${extension}`;
      }

      let upload = new Upload({
        client: this.S3ClientInstance(),
        params: {
          Key: folder + key,
          Bucket: this.s3_bucket,
          Body: file,
          ContentType: contentType,
        },
      });

      await upload.done();
      // return `https://${
      //   process.env.AWS_S3_BUCKET_NAME as string
      // }.s3.amazonaws.com/${folder}${key}`;
      return `${folder}${key}`;
    } catch (error) {
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
          compressedBuffer = await sharpImage
            .resize({ width: 500 })
            // .png({ compressionLevel: 9 })
            .toBuffer();
          outputContentType = 'image/png';
          break;
        case 'webp':
          compressedBuffer = await sharpImage
            .resize({ width: 500 })
            // .webp({ quality: 70 })
            .toBuffer();
          outputContentType = 'image/webp';
          break;
        case 'jpeg':
        case 'jpg':
        default:
          compressedBuffer = await sharpImage
            .resize({ width: 500 })
            // .jpeg({ quality: 70 })
            .toBuffer();
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

  // async downloadFolder(): Promise<boolean> {
  //   try {
  //     const listCmd = new ListObjectsV2Command({
  //       Bucket: this.s3_bucket,
  //       Prefix: 'vendor/',
  //     });

  //     const data = await this.S3ClientInstance().send(listCmd);

  //     if (!data.Contents || data.Contents.length === 0) {
  //       console.log('No objects found in folder.');
  //       return false;
  //     }
  //     const localDir = path.resolve(__dirname, '../downloads');
  //     await fs.mkdir(localDir, { recursive: true });

  //     for (const obj of data.Contents) {
  //       if (!obj.Key || obj.Key.endsWith('/')) continue;

  //       const fileName = path.basename(obj.Key);
  //       const localPath = path.join(localDir, fileName);

  //       console.log(`Downloading ${obj.Key} → ${localPath}`);

  //       const getCmd = new GetObjectCommand({
  //         Bucket: this.s3_bucket,
  //         Key: obj.Key,
  //       });

  //       const { Body } = await this.S3ClientInstance().send(getCmd);

  //       if (
  //         !Body ||
  //         typeof (Body as NodeJS.ReadableStream).pipe !== 'function'
  //       ) {
  //         throw new Error(`Body for ${obj.Key} is not a readable stream.`);
  //       }

  //       await pipeline(
  //         Body as NodeJS.ReadableStream,
  //         createWriteStream(localPath),
  //       );
  //     }

  //     console.log('✅ All files downloaded.');
  //     return true;
  //   } catch (err) {
  //     console.error('❌ Error downloading folder:', err);
  //     return false;
  //   }
  // }
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
  const seen = new WeakSet(); // Prevent cycles

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
