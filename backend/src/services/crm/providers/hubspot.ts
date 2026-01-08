import axios, { AxiosInstance } from "axios";
import { BaseCRMProvider } from "./base";
import {
  CRMCredentials,
  CRMFieldDefinition,
  CRMContact,
  CRMCompany,
  CRMDeal,
  CRMActivity,
} from "../types";

export class HubSpotProvider extends BaseCRMProvider {
  private client: AxiosInstance | null = null;
  private readonly baseUrl = "https://api.hubapi.com";

  private formatHubSpotApiError(error: any): Error {
    const status =
      error?.response?.status ??
      error?.status ??
      error?.statusCode ??
      undefined;

    const data = error?.response?.data;
    if (data && typeof data === "object") {
      const category = data.category ? String(data.category) : undefined;
      const message = data.message ? String(data.message) : undefined;
      const correlationId = data.correlationId
        ? String(data.correlationId)
        : undefined;

      const requiredGranularScopes: string[] = Array.isArray(data.errors)
        ? data.errors
            .flatMap((e: any) =>
              Array.isArray(e?.context?.requiredGranularScopes)
                ? e.context.requiredGranularScopes
                : []
            )
            .map((s: any) => String(s))
            .filter(Boolean)
        : [];

      const scopeHint =
        requiredGranularScopes.length > 0
          ? ` Required scopes: ${requiredGranularScopes.join(", ")}.`
          : "";
      const correlationHint = correlationId
        ? ` CorrelationId: ${correlationId}.`
        : "";

      if (category === "MISSING_SCOPES") {
        return new Error(
          `HubSpot API permission error${status ? ` (${status})` : ""}: ${
            message || "Missing required scopes for this call."
          }.${scopeHint}${correlationHint}`
        );
      }

      if (message) {
        return new Error(
          `HubSpot API error${
            status ? ` (${status})` : ""
          }: ${message}.${correlationHint}`
        );
      }
    }

    const fallback = String(
      error?.message || error || "HubSpot request failed"
    );
    return new Error(
      `HubSpot request failed${status ? ` (${status})` : ""}: ${fallback}`
    );
  }

  private throwIfRateLimited(error: any): void {
    const status =
      error?.response?.status ?? error?.status ?? error?.statusCode;
    if (status === 429) {
      const retryAfter =
        error?.response?.headers?.["retry-after"] ||
        error?.headers?.["retry-after"] ||
        60;
      throw new Error(
        `HubSpot rate limit exceeded. Retry after ${retryAfter} seconds.`
      );
    }
  }

  async authenticate(credentials: CRMCredentials): Promise<void> {
    this.credentials = credentials;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Test the connection
    try {
      await this.client.get("/crm/v3/objects/contacts", {
        params: { limit: 1 },
      });
    } catch (error: any) {
      await this.handleAuthError(error);
    }
  }

  async refreshAuthentication(): Promise<void> {
    if (!this.credentials.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await axios.post(
        "https://api.hubapi.com/oauth/v1/token",
        {
          grant_type: "refresh_token",
          client_id: process.env.HUBSPOT_CLIENT_ID,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET,
          refresh_token: this.credentials.refreshToken,
        }
      );

      this.credentials.accessToken = response.data.access_token;
      this.credentials.refreshToken =
        response.data.refresh_token || this.credentials.refreshToken;

      // Reinitialize client
      await this.authenticate(this.credentials);
    } catch (error: any) {
      throw new Error(`Failed to refresh HubSpot token: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.credentials = {};
  }

  async discoverFields(
    objectType: "contact" | "company" | "deal" | "activity"
  ): Promise<CRMFieldDefinition[]> {
    if (!this.client) throw new Error("Not authenticated");

    const objectTypeMap: Record<string, string> = {
      contact: "contacts",
      company: "companies",
      deal: "deals",
      activity: "engagements",
    };

    const hsObjectType = objectTypeMap[objectType];

    try {
      const response = await this.client.get(
        `/crm/v3/properties/${hsObjectType}`
      );
      const properties = response.data.results;

      return properties.map((prop: any) => ({
        name: prop.name,
        label: prop.label,
        type: this.mapHubSpotType(prop.type),
        isRequired: prop.required || false,
        isCustom: prop.hubspotDefined === false,
        isReadOnly: prop.modificationMetadata?.readOnlyValue || false,
        picklistValues: prop.options?.map((opt: any) => ({
          label: opt.label,
          value: opt.value,
        })),
        description: prop.description,
      }));
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  private mapHubSpotType(hsType: string): CRMFieldDefinition["type"] {
    const typeMap: Record<string, CRMFieldDefinition["type"]> = {
      string: "string",
      number: "number",
      bool: "boolean",
      date: "date",
      datetime: "datetime",
      enumeration: "picklist",
      phone_number: "phone",
      email: "email",
    };
    return typeMap[hsType] || "string";
  }

  async getContact(id: string): Promise<CRMContact> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.get(`/crm/v3/objects/contacts/${id}`);
      return this.mapHubSpotContact(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async searchContacts(query: {
    email?: string;
    phone?: string;
    name?: string;
  }): Promise<CRMContact[]> {
    if (!this.client) throw new Error("Not authenticated");

    const filters: any[] = [];
    if (query.email) {
      filters.push({
        propertyName: "email",
        operator: "EQ",
        value: query.email,
      });
    }
    if (query.phone) {
      filters.push({
        propertyName: "phone",
        operator: "EQ",
        value: query.phone,
      });
    }
    if (query.name) {
      filters.push({
        filters: [
          {
            propertyName: "firstname",
            operator: "CONTAINS_TOKEN",
            value: query.name,
          },
          {
            propertyName: "lastname",
            operator: "CONTAINS_TOKEN",
            value: query.name,
          },
        ],
      });
    }

    try {
      const response = await this.client.post(
        "/crm/v3/objects/contacts/search",
        {
          filterGroups: filters.length > 0 ? [{ filters }] : [],
          limit: 100,
        }
      );

      return response.data.results.map((contact: any) =>
        this.mapHubSpotContact(contact)
      );
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async createContact(data: Partial<CRMContact>): Promise<CRMContact> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.post("/crm/v3/objects/contacts", {
        properties: this.mapToHubSpotContact(data),
      });
      return this.mapHubSpotContact(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async updateContact(
    id: string,
    data: Partial<CRMContact>
  ): Promise<CRMContact> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.patch(
        `/crm/v3/objects/contacts/${id}`,
        {
          properties: this.mapToHubSpotContact(data),
        }
      );
      return this.mapHubSpotContact(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async getCompany(id: string): Promise<CRMCompany> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.get(`/crm/v3/objects/companies/${id}`);
      return this.mapHubSpotCompany(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async searchCompanies(query: {
    name?: string;
    domain?: string;
  }): Promise<CRMCompany[]> {
    if (!this.client) throw new Error("Not authenticated");

    const filters: any[] = [];
    if (query.name) {
      filters.push({
        propertyName: "name",
        operator: "CONTAINS_TOKEN",
        value: query.name,
      });
    }
    if (query.domain) {
      filters.push({
        propertyName: "domain",
        operator: "EQ",
        value: query.domain,
      });
    }

    try {
      const response = await this.client.post(
        "/crm/v3/objects/companies/search",
        {
          filterGroups: filters.length > 0 ? [{ filters }] : [],
          limit: 100,
        }
      );

      return response.data.results.map((company: any) =>
        this.mapHubSpotCompany(company)
      );
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async createCompany(data: Partial<CRMCompany>): Promise<CRMCompany> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.post("/crm/v3/objects/companies", {
        properties: data,
      });
      return this.mapHubSpotCompany(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async updateCompany(
    id: string,
    data: Partial<CRMCompany>
  ): Promise<CRMCompany> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.patch(
        `/crm/v3/objects/companies/${id}`,
        {
          properties: data,
        }
      );
      return this.mapHubSpotCompany(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async getDeal(id: string): Promise<CRMDeal> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.get(`/crm/v3/objects/deals/${id}`);
      return this.mapHubSpotDeal(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async searchDeals(query: {
    contactId?: string;
    companyId?: string;
    stage?: string;
  }): Promise<CRMDeal[]> {
    if (!this.client) throw new Error("Not authenticated");

    const filters: any[] = [];
    if (query.stage) {
      filters.push({
        propertyName: "dealstage",
        operator: "EQ",
        value: query.stage,
      });
    }

    try {
      const response = await this.client.post("/crm/v3/objects/deals/search", {
        filterGroups: filters.length > 0 ? [{ filters }] : [],
        limit: 100,
      });

      return response.data.results.map((deal: any) =>
        this.mapHubSpotDeal(deal)
      );
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async createDeal(data: Partial<CRMDeal>): Promise<CRMDeal> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.post("/crm/v3/objects/deals", {
        properties: data,
      });
      return this.mapHubSpotDeal(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async updateDeal(id: string, data: Partial<CRMDeal>): Promise<CRMDeal> {
    if (!this.client) throw new Error("Not authenticated");

    try {
      const response = await this.client.patch(`/crm/v3/objects/deals/${id}`, {
        properties: data,
      });
      return this.mapHubSpotDeal(response.data);
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async logActivity(activity: Partial<CRMActivity>): Promise<CRMActivity> {
    if (!this.client) throw new Error("Not authenticated");

    const engagementType =
      activity.type === "call"
        ? "call"
        : activity.type === "email"
        ? "email"
        : "note";

    try {
      const response = await this.client.post(
        `/crm/v3/objects/${engagementType}s`,
        {
          properties: {
            hs_timestamp: activity.timestamp || new Date().toISOString(),
            hs_note_body: activity.notes || activity.subject || "",
            ...(activity.duration && { hs_call_duration: activity.duration }),
          },
          associations: [
            ...(activity.contactId
              ? [
                  {
                    to: { id: activity.contactId },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 194,
                      },
                    ],
                  },
                ]
              : []),
            ...(activity.companyId
              ? [
                  {
                    to: { id: activity.companyId },
                    types: [
                      {
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: 280,
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      );

      return {
        id: response.data.id,
        type: activity.type || "note",
        timestamp: response.data.properties.hs_timestamp,
        notes: response.data.properties.hs_note_body,
      };
    } catch (error: any) {
      this.throwIfRateLimited(error);
      throw this.formatHubSpotApiError(error);
    }
  }

  async getActivities(
    contactId?: string,
    companyId?: string
  ): Promise<CRMActivity[]> {
    // HubSpot requires associations API for this
    return [];
  }

  private mapHubSpotContact(hsContact: any): CRMContact {
    return {
      id: hsContact.id,
      email: hsContact.properties.email,
      firstName: hsContact.properties.firstname,
      lastName: hsContact.properties.lastname,
      phone: hsContact.properties.phone,
      company: hsContact.properties.company,
      ...hsContact.properties, // Include all other fields
    };
  }

  private mapToHubSpotContact(contact: Partial<CRMContact>): any {
    const { id, firstName, lastName, ...rest } = contact;
    return {
      firstname: firstName,
      lastname: lastName,
      ...rest,
    };
  }

  private mapHubSpotCompany(hsCompany: any): CRMCompany {
    return {
      id: hsCompany.id,
      name: hsCompany.properties.name,
      domain: hsCompany.properties.domain,
      industry: hsCompany.properties.industry,
      ...hsCompany.properties,
    };
  }

  private mapHubSpotDeal(hsDeal: any): CRMDeal {
    return {
      id: hsDeal.id,
      name: hsDeal.properties.dealname,
      amount: parseFloat(hsDeal.properties.amount || "0"),
      stage: hsDeal.properties.dealstage,
      closeDate: hsDeal.properties.closedate,
      ...hsDeal.properties,
    };
  }
}
