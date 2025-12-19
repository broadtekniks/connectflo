import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";

export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || "connectflo-kb";

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
      },
    });
  }

  async uploadFile(key: string, body: Buffer | Uint8Array | Blob | string, contentType: string) {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        },
      });

      await upload.done();
      return key;
    } catch (error) {
      console.error("R2 Upload Error:", error);
      throw error;
    }
  }

  async getFileContent(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new Error("Empty response body");
      }
      
      return await response.Body.transformToString();
    } catch (error) {
      console.error("R2 Download Error:", error);
      throw error;
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new Error("Empty response body");
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error) {
      console.error("R2 Download Error:", error);
      throw error;
    }
  }
  
  async getSignedUrl(key: string): Promise<string> {
      const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
