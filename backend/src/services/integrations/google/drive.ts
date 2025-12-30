import { google } from "googleapis";
import { GoogleAuthService } from "./auth";

const authService = new GoogleAuthService();

export class GoogleDriveService {
  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    tenantId: string,
    fileData: {
      name: string;
      content: string; // Base64 or buffer
      mimeType: string;
      folderId?: string;
    }
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "drive");
    const drive = google.drive({ version: "v3", auth });

    const fileMetadata = {
      name: fileData.name,
      parents: fileData.folderId ? [fileData.folderId] : undefined,
    };

    const media = {
      mimeType: fileData.mimeType,
      body: Buffer.from(fileData.content, "base64"),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    return {
      success: true,
      fileId: response.data.id,
      name: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  }

  /**
   * Create a shareable link for a file
   */
  async shareFile(
    tenantId: string,
    fileId: string,
    permissions: {
      type: "user" | "group" | "domain" | "anyone";
      role: "reader" | "writer" | "commenter";
      emailAddress?: string;
    }
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "drive");
    const drive = google.drive({ version: "v3", auth });

    await drive.permissions.create({
      fileId,
      requestBody: {
        type: permissions.type,
        role: permissions.role,
        emailAddress: permissions.emailAddress,
      },
    });

    const file = await drive.files.get({
      fileId,
      fields: "webViewLink",
    });

    return {
      success: true,
      fileId,
      shareLink: file.data.webViewLink,
    };
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(
    tenantId: string,
    folderName: string,
    parentFolderId?: string
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "drive");
    const drive = google.drive({ version: "v3", auth });

    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, webViewLink",
    });

    return {
      success: true,
      folderId: response.data.id,
      name: response.data.name,
      webViewLink: response.data.webViewLink,
    };
  }
}
