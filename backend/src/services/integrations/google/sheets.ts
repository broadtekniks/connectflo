import { google } from "googleapis";
import { GoogleAuthService } from "./auth";

const authService = new GoogleAuthService();

export class GoogleSheetsService {
  /**
   * Append a row to a Google Sheet
   */
  async appendRow(
    tenantId: string,
    spreadsheetId: string,
    sheetName: string,
    values: any[]
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "sheets");
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });

    return {
      success: true,
      updatedRange: response.data.updates?.updatedRange,
      updatedRows: response.data.updates?.updatedRows,
    };
  }

  /**
   * Read data from a Google Sheet
   */
  async readSheet(tenantId: string, spreadsheetId: string, range: string) {
    const auth = await authService.getAuthenticatedClient(tenantId, "sheets");
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return {
      success: true,
      values: response.data.values || [],
    };
  }

  /**
   * Update a cell or range in a Google Sheet
   */
  async updateCells(
    tenantId: string,
    spreadsheetId: string,
    range: string,
    values: any[][]
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "sheets");
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return {
      success: true,
      updatedRange: response.data.updatedRange,
      updatedCells: response.data.updatedCells,
    };
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(
    tenantId: string,
    title: string,
    sheetNames?: string[]
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "sheets");
    const sheets = google.sheets({ version: "v4", auth });

    const requestBody = {
      properties: {
        title,
      },
      sheets: sheetNames?.map((name) => ({
        properties: {
          title: name,
        },
      })),
    };

    const response = await sheets.spreadsheets.create({
      requestBody,
    });

    return {
      success: true,
      spreadsheetId: response.data.spreadsheetId,
      spreadsheetUrl: response.data.spreadsheetUrl,
    };
  }
}
