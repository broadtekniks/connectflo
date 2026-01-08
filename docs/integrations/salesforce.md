# Salesforce Integration Guide

Connect ConnectFlo to Salesforce CRM to sync leads, accounts, contacts, and opportunities, and leverage Salesforce data in your customer service workflows.

## Overview

The Salesforce integration allows you to:

- ✅ Sync contacts and leads between ConnectFlo and Salesforce
- ✅ Access account (company) information
- ✅ View and update opportunity data
- ✅ Use Salesforce fields in workflow conditions
- ✅ Log customer interactions as tasks and activities
- ✅ Automatically discover custom objects and fields

## Prerequisites

- Active Salesforce account (any edition with API access)
- System Administrator or API Enabled User permissions
- ConnectFlo account with integration access

## Setup Instructions

### Step 1: Create a Connected App in Salesforce

1. Log in to your Salesforce account
2. Click the **Setup** icon (gear icon) in the top right
3. In Quick Find, search for **App Manager**
4. Click **New Connected App**
5. Fill in the Basic Information:
   - **Connected App Name**: `ConnectFlo Integration`
   - **API Name**: `ConnectFlo_Integration`
   - **Contact Email**: Your email address

### Step 2: Enable OAuth Settings

1. Check **Enable OAuth Settings**
2. **Callback URL**: `https://app.connectflo.com/oauth/callback`
3. **Selected OAuth Scopes** - Add the following:

   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - `Access your basic information (id, profile, email, address, phone)`

4. Click **Save**
5. Click **Continue**

### Step 3: Get OAuth Credentials

1. After saving, click **Manage Consumer Details**
2. Verify your identity (email code may be sent)
3. Copy the following:
   - **Consumer Key** (Client ID)
   - **Consumer Secret** (Client Secret)
4. Note your **Instance URL** (e.g., `https://yourcompany.salesforce.com`)

### Step 4: Generate Access Token

**Option A: Using Salesforce OAuth Flow**

1. Navigate to this URL in your browser (replace `{CONSUMER_KEY}` with your Consumer Key):

```
https://login.salesforce.com/services/oauth2/authorize?response_type=token&client_id={CONSUMER_KEY}&redirect_uri=https://app.connectflo.com/oauth/callback
```

2. Log in and authorize the app
3. Copy the `access_token` from the redirect URL

**Option B: Using Postman or cURL**

```bash
curl -X POST https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=password" \
  -d "client_id=YOUR_CONSUMER_KEY" \
  -d "client_secret=YOUR_CONSUMER_SECRET" \
  -d "username=YOUR_SALESFORCE_USERNAME" \
  -d "password=YOUR_PASSWORD_AND_SECURITY_TOKEN"
```

### Step 5: Connect in ConnectFlo

1. In ConnectFlo, navigate to **Settings → Integrations**
2. Find **Salesforce** in the CRM & ERP section
3. Click **Connect**
4. In the connection modal:
   - **Connection Name**: Enter a friendly name (e.g., "Production Salesforce")
   - **Instance URL**: Your Salesforce instance URL
   - **Access Token**: Paste the access token you obtained
5. Click **Connect**
6. Wait for the connection to be established

### Step 6: Verify the Connection

1. You should see a success message
2. The Salesforce card will show **CONNECTED** status
3. Click **Test Connection** to verify
4. Navigate to **Workflows** to see Salesforce fields

## Using Salesforce Data in Workflows

### Available Standard Objects

- **Leads**: All lead fields
- **Contacts**: All contact fields
- **Accounts**: All account (company) fields
- **Opportunities**: All opportunity fields
- **Cases**: All case fields
- **Tasks**: All task fields

### Custom Objects

ConnectFlo automatically discovers your custom objects and their fields.

### Workflow Examples

**Lead Qualification:**

- **Trigger**: New conversation from unknown contact
- **Action**: Create Lead in Salesforce
- **Data**: Map conversation data to lead fields

**Account Insights:**

- **Condition**: If Account.AnnualRevenue > $500,000
- **Action**: Route to enterprise support team

**Opportunity Tracking:**

- **Trigger**: Deal closed in conversation
- **Action**: Update Opportunity.Stage to "Closed Won"

## Field Discovery

ConnectFlo discovers:

- ✅ Standard Salesforce objects and fields
- ✅ Custom objects you've created
- ✅ Custom fields on standard objects
- ✅ Field metadata (type, label, picklist values)
- ✅ Validation rules and field dependencies

## Security & Permissions

### Token Security

- Access tokens are encrypted with AES-256-GCM
- Refresh tokens stored securely
- All API calls use HTTPS (TLS 1.2+)

### Salesforce Permissions

The connected app can only access:

- Objects the OAuth scopes allow
- Records the logged-in user can access
- Fields based on field-level security

### Token Refresh

- Access tokens expire after a set time
- ConnectFlo automatically refreshes using refresh token
- No manual intervention required

### Revoke Access

To revoke ConnectFlo's access:

1. In Salesforce, go to **Setup → Connected Apps**
2. Find **ConnectFlo Integration**
3. Click **Revoke** or delete the app

## API Limits

Salesforce enforces API call limits:

| Edition      | API Calls per 24 Hours |
| ------------ | ---------------------- |
| Developer    | 5,000                  |
| Professional | 1,000 per user license |
| Enterprise   | 1,000 per user license |
| Unlimited    | 5,000 per user license |

ConnectFlo efficiently batches requests to minimize API usage.

## Troubleshooting

### "Invalid Instance URL"

- ✅ Use format: `https://yourcompany.salesforce.com`
- ✅ Don't include paths after `.com`
- ✅ Check for sandbox vs. production (`test.salesforce.com` for sandbox)

### "Authentication Failed"

- ✅ Verify access token hasn't expired
- ✅ Check Consumer Key and Secret are correct
- ✅ Ensure user account is still active
- ✅ Verify IP restrictions aren't blocking ConnectFlo

### "Insufficient Privileges"

- ✅ Check user has API Enabled permission
- ✅ Verify object permissions (Read, Create, Edit)
- ✅ Check field-level security settings
- ✅ Review profile and permission set assignments

### "API Limit Exceeded"

- ✅ Check your org's API usage in **Setup → System Overview**
- ✅ Consider upgrading your Salesforce edition
- ✅ Optimize workflow frequency settings
- ✅ Contact support to review API usage patterns

## Common Use Cases

### 1. Lead Capture

Automatically create Salesforce leads from web chat or phone calls.

### 2. Case Management

Create and update Salesforce cases based on customer interactions.

### 3. Contact Enrichment

Pull Salesforce contact data to personalize conversations.

### 4. Opportunity Updates

Update opportunity stages based on conversation outcomes.

### 5. Activity Logging

Log all customer interactions as Tasks in Salesforce.

## Best Practices

1. **Use Named Credentials**: For enhanced security in production
2. **Set Up Sandbox First**: Test in sandbox before production
3. **Monitor API Usage**: Keep track of API limits
4. **Use Selective Sync**: Only sync objects you need
5. **Implement Error Handling**: Set up alerts for sync failures
6. **Regular Token Rotation**: Rotate credentials periodically

## Additional Resources

- [Salesforce Connected Apps](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)
- [Salesforce OAuth Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [Salesforce API Limits](https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm)
- [ConnectFlo Workflow Guide](../workflows/README.md)

## Support

Need help with your Salesforce integration?

- 📧 Email: support@connectflo.com
- 💬 Live Chat: Available in-app
- 📚 Knowledge Base: https://docs.connectflo.com
