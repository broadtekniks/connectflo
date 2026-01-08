import {
  CRMProvider,
  CRMCredentials,
  CRMFieldDefinition,
  CRMContact,
  CRMCompany,
  CRMDeal,
  CRMActivity,
} from "../types";

export abstract class BaseCRMProvider implements CRMProvider {
  protected credentials: CRMCredentials = {};
  protected connectionId: string;

  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }

  abstract authenticate(credentials: CRMCredentials): Promise<void>;
  abstract refreshAuthentication(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract discoverFields(
    objectType: "contact" | "company" | "deal" | "activity"
  ): Promise<CRMFieldDefinition[]>;
  abstract getContact(id: string): Promise<CRMContact>;
  abstract searchContacts(query: {
    email?: string;
    phone?: string;
    name?: string;
  }): Promise<CRMContact[]>;
  abstract createContact(data: Partial<CRMContact>): Promise<CRMContact>;
  abstract updateContact(
    id: string,
    data: Partial<CRMContact>
  ): Promise<CRMContact>;
  abstract getCompany(id: string): Promise<CRMCompany>;
  abstract searchCompanies(query: {
    name?: string;
    domain?: string;
  }): Promise<CRMCompany[]>;
  abstract createCompany(data: Partial<CRMCompany>): Promise<CRMCompany>;
  abstract updateCompany(
    id: string,
    data: Partial<CRMCompany>
  ): Promise<CRMCompany>;
  abstract getDeal(id: string): Promise<CRMDeal>;
  abstract searchDeals(query: {
    contactId?: string;
    companyId?: string;
    stage?: string;
  }): Promise<CRMDeal[]>;
  abstract createDeal(data: Partial<CRMDeal>): Promise<CRMDeal>;
  abstract updateDeal(id: string, data: Partial<CRMDeal>): Promise<CRMDeal>;
  abstract logActivity(activity: Partial<CRMActivity>): Promise<CRMActivity>;
  abstract getActivities(
    contactId?: string,
    companyId?: string
  ): Promise<CRMActivity[]>;

  protected handleRateLimit(error: any): Promise<never> {
    if (error.statusCode === 429 || error.status === 429) {
      const retryAfter = error.headers?.["retry-after"] || 60;
      throw new Error(
        `Rate limit exceeded. Retry after ${retryAfter} seconds.`
      );
    }
    throw error;
  }

  protected handleAuthError(error: any): Promise<never> {
    if (
      error.statusCode === 401 ||
      error.status === 401 ||
      error.statusCode === 403 ||
      error.status === 403
    ) {
      throw new Error("Authentication failed. Please reconnect your CRM.");
    }
    throw error;
  }
}
