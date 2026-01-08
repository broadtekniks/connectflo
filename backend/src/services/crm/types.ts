// CRM Provider Types

export interface CRMCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  instanceUrl?: string;
  domain?: string;
  [key: string]: any;
}

export interface CRMFieldDefinition {
  name: string;
  label: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "datetime"
    | "picklist"
    | "textarea"
    | "email"
    | "phone"
    | "url";
  isRequired: boolean;
  isCustom: boolean;
  isReadOnly: boolean;
  picklistValues?: Array<{ label: string; value: string }>;
  description?: string;
}

export interface CRMContact {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  [key: string]: any; // Dynamic CRM fields
}

export interface CRMCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  [key: string]: any;
}

export interface CRMDeal {
  id: string;
  name: string;
  amount?: number;
  stage?: string;
  closeDate?: string;
  [key: string]: any;
}

export interface CRMActivity {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "chat";
  subject?: string;
  notes?: string;
  timestamp: string;
  duration?: number;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  [key: string]: any;
}

export interface CRMProvider {
  // Authentication
  authenticate(credentials: CRMCredentials): Promise<void>;
  refreshAuthentication(): Promise<void>;
  disconnect(): Promise<void>;

  // Field Discovery
  discoverFields(
    objectType: "contact" | "company" | "deal" | "activity"
  ): Promise<CRMFieldDefinition[]>;

  // Contacts
  getContact(id: string): Promise<CRMContact>;
  searchContacts(query: {
    email?: string;
    phone?: string;
    name?: string;
  }): Promise<CRMContact[]>;
  createContact(data: Partial<CRMContact>): Promise<CRMContact>;
  updateContact(id: string, data: Partial<CRMContact>): Promise<CRMContact>;

  // Companies
  getCompany(id: string): Promise<CRMCompany>;
  searchCompanies(query: {
    name?: string;
    domain?: string;
  }): Promise<CRMCompany[]>;
  createCompany(data: Partial<CRMCompany>): Promise<CRMCompany>;
  updateCompany(id: string, data: Partial<CRMCompany>): Promise<CRMCompany>;

  // Deals/Opportunities
  getDeal(id: string): Promise<CRMDeal>;
  searchDeals(query: {
    contactId?: string;
    companyId?: string;
    stage?: string;
  }): Promise<CRMDeal[]>;
  createDeal(data: Partial<CRMDeal>): Promise<CRMDeal>;
  updateDeal(id: string, data: Partial<CRMDeal>): Promise<CRMDeal>;

  // Activities
  logActivity(activity: Partial<CRMActivity>): Promise<CRMActivity>;
  getActivities(contactId?: string, companyId?: string): Promise<CRMActivity[]>;
}

export interface FieldCondition {
  objectType: "contact" | "company" | "deal";
  fieldName: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "greater_than"
    | "less_than"
    | "is_empty"
    | "is_not_empty"
    | "in"
    | "not_in";
  value: any;
}

export interface FieldAction {
  objectType: "contact" | "company" | "deal" | "activity";
  action: "create" | "update" | "log_activity";
  fieldUpdates: Record<string, any>;
}
