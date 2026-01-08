# HubSpot Integration Guide

Connect ConnectFlo to HubSpot CRM to sync contacts, companies, and deals, and use CRM data in your AI-powered workflows.

## Overview

The HubSpot integration allows you to:

- ✅ Sync contacts between ConnectFlo and HubSpot
- ✅ Access company information from HubSpot
- ✅ View and update deal data
- ✅ Use HubSpot fields in workflow conditions
- ✅ Log customer interactions as activities in HubSpot
- ✅ Automatically discover custom fields from your HubSpot account

## Prerequisites

- Active HubSpot account (Free, Starter, Professional, or Enterprise)
- Super Admin permissions in HubSpot (required to create private apps)
- ConnectFlo account with integration access

## Setup Instructions

### Step 1: Create a HubSpot Private App

1. Log in to your HubSpot account
2. Click the **Settings** icon (gear icon) in the top navigation
3. In the left sidebar, navigate to **Integrations → Private Apps**
4. Click **Create a private app** (or **Create legacy app → Private**)
5. On the **Basic Info** tab:
   - **App name**: `ConnectFlo Integration`
   - **Description**: `Integrates ConnectFlo with HubSpot CRM`
   - Upload a logo (optional)

### Step 2: Configure Scopes

On the **Scopes** tab, add the following scopes by clicking **Add new scope** and selecting each one:

#### Required Scopes (Minimum)

- ✅ `crm.objects.companies.read` - View companies
- ✅ `crm.objects.companies.write` - Create and update companies
- ✅ `crm.objects.contacts.write` - Create and update contacts
- ✅ `crm.schemas.appointments.read` - Read appointment schema metadata
- ✅ `crm.schemas.companies.read` - View company field definitions
- ✅ `crm.schemas.contacts.read` - View contact field definitions
- ✅ `crm.schemas.contacts.write` - Create and update contact field definitions
- ✅ `crm.schemas.deals.read` - View deal field definitions

#### Recommended Scopes

- ⭐ `timeline` - Log custom events on CRM records
- ⭐ `crm.objects.owners.read` - View user/owner information
- ⭐ `sales-email-read` - Read email engagement details

### Step 3: Create the App

1. Review your selected scopes
2. Click **Create app** in the top right
3. In the dialog box, review the access token information
4. Click **Continue creating**

### Step 4: Copy the Access Token

1. After the app is created, click the **Auth** tab
2. Click **Show token** to reveal your access token
3. Click **Copy** to copy the token to your clipboard
   - Token format: `pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
4. ⚠️ **Important**: Save this token securely - you'll need it in the next step

### Step 5: Connect in ConnectFlo

1. In ConnectFlo, navigate to **Settings → Integrations**
2. Find **HubSpot** in the CRM & ERP section
3. Click **Connect**
4. In the connection modal:
   - **Connection Name**: Enter a friendly name (e.g., "Production HubSpot")
   - **Access Token**: Paste the token you copied from HubSpot
5. Click **Connect**
6. Wait for the connection to be established and fields to be discovered

### Step 6: Verify the Connection

1. After connecting, you should see a success message
2. The HubSpot integration card will show **CONNECTED** status
3. Click **Test Connection** to verify it's working
4. Navigate to **Workflows** to see HubSpot fields available for use

## Using HubSpot Data in Workflows

Once connected, HubSpot fields are automatically discovered and available in your workflows:

### Available Objects

- **Contacts**: All contact properties (default and custom)
- **Companies**: All company properties (default and custom)
- **Deals**: All deal properties (default and custom)

### Workflow Conditions

Use HubSpot fields to create conditional logic:

- "If contact's lifecycle stage is 'Customer'"
- "If company's annual revenue is greater than $100,000"
- "If deal's close date is within the next 7 days"

### Workflow Actions

Update HubSpot data from workflows:

- Create new contacts from form submissions
- Update deal stages based on conversation outcomes
- Log activities on contact records

## Field Discovery

ConnectFlo automatically discovers all fields from your HubSpot account, including:

- ✅ Standard HubSpot properties
- ✅ Custom properties you've created
- ✅ Field types (text, number, date, picklist, etc.)
- ✅ Picklist options for dropdown fields
- ✅ Field labels and descriptions

Fields are re-discovered automatically when you:

- Update your credentials
- Click **Refresh Fields** in the integration settings

## Security & Permissions

### Data Encryption

- Access tokens are encrypted using AES-256-GCM encryption
- Tokens are never stored in plain text
- All API communications use HTTPS

### Token Rotation

HubSpot recommends rotating access tokens every 6 months:

1. In HubSpot, go to your private app settings
2. Click **Rotate** next to your access token
3. Copy the new token
4. In ConnectFlo, click the **Settings** icon on the HubSpot integration
5. Click **Update Credentials** and paste the new token

### Permissions

- The access token only has the scopes you selected
- ConnectFlo can only access data allowed by those scopes
- You can revoke access anytime by deleting the private app in HubSpot

## API Rate Limits

HubSpot enforces API rate limits based on your account tier:

| Account Tier | Per Private App  | Per Account   |
| ------------ | ---------------- | ------------- |
| Free/Starter | 100 requests/10s | 250,000/day   |
| Professional | 190 requests/10s | 625,000/day   |
| Enterprise   | 190 requests/10s | 1,000,000/day |

ConnectFlo automatically handles rate limiting with exponential backoff.

## Troubleshooting

### "Connection Failed" Error

- ✅ Verify you copied the complete access token
- ✅ Ensure the token hasn't been revoked in HubSpot
- ✅ Check that all required scopes are enabled
- ✅ Verify your HubSpot account is active

### "Field Discovery Failed"

- ✅ Ensure `.schemas.*.read` scopes are enabled
- ✅ Check your HubSpot account has access to the objects you're trying to discover
- ✅ Try disconnecting and reconnecting the integration

### "Permission Denied" Errors

- ✅ Review the scopes selected in your private app
- ✅ Add any missing scopes and update the token
- ✅ Verify the user who created the private app is still active

### Fields Not Showing in Workflows

- ✅ Click **Refresh Fields** in the integration settings
- ✅ Wait a few minutes for field discovery to complete
- ✅ Check that the object type is supported (contacts, companies, deals)

### Rate Limit Errors

- ✅ ConnectFlo automatically retries with backoff
- ✅ If persistent, consider upgrading your HubSpot plan
- ✅ Contact support to optimize API usage

## Common Use Cases

### 1. Automatic Contact Creation

Create HubSpot contacts automatically when customers interact with your service:

- **Trigger**: New conversation started
- **Action**: Create contact in HubSpot with name, email, phone
- **Benefit**: All customer data centralized in HubSpot

### 2. Deal Stage Updates

Update deal stages based on conversation outcomes:

- **Trigger**: Conversation resolved
- **Condition**: Deal exists for this contact
- **Action**: Update deal stage to "Closed Won"
- **Benefit**: Automated sales pipeline management

### 3. Smart Routing

Route conversations based on HubSpot data:

- **Trigger**: Incoming call/chat
- **Condition**: Contact's "Account Tier" is "Enterprise"
- **Action**: Route to senior support team
- **Benefit**: VIP customer prioritization

### 4. Activity Logging

Log all customer interactions in HubSpot:

- **Trigger**: Conversation ended
- **Action**: Create timeline event on contact record
- **Benefit**: Complete interaction history in HubSpot

## Best Practices

1. **Use Descriptive Connection Names**: If you have multiple HubSpot accounts (production, sandbox), name them clearly
2. **Regularly Rotate Tokens**: Set a reminder to rotate access tokens every 6 months
3. **Test Before Production**: Test your workflows in a sandbox HubSpot account first
4. **Monitor API Usage**: Keep an eye on API rate limits if you have high volume
5. **Document Custom Fields**: Document any custom fields you create for workflow use
6. **Use Field Groups**: Organize custom properties in HubSpot using property groups for easier discovery

## Additional Resources

- [HubSpot Private Apps Documentation](https://developers.hubspot.com/docs/api/private-apps)
- [HubSpot API Reference](https://developers.hubspot.com/docs/api/crm/properties)
- [HubSpot Scopes Reference](https://developers.hubspot.com/docs/api/scopes)
- [ConnectFlo Workflow Guide](../workflows/README.md)

## Support

Need help with your HubSpot integration?

- 📧 Email: support@connectflo.com
- 💬 Live Chat: Available in-app
- 📚 Knowledge Base: https://docs.connectflo.com
