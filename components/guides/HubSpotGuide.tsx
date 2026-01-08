import React from "react";
import {
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Copy,
  Shield,
  Zap,
} from "lucide-react";

const HubSpotGuide: React.FC = () => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 p-8">
        <div className="flex items-start gap-4">
          <img
            src="https://cdn.simpleicons.org/hubspot"
            alt="HubSpot"
            className="w-16 h-16"
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              HubSpot Integration Guide
            </h1>
            <p className="text-slate-600 text-lg">
              Connect ConnectFlo to HubSpot CRM to sync contacts, companies, and
              deals, and use CRM data in your AI-powered workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen size={24} className="text-indigo-600" />
            What You Can Do
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Sync contacts between ConnectFlo and HubSpot",
              "Access company information from HubSpot",
              "View and update deal data",
              "Use HubSpot fields in workflow conditions",
              "Log customer interactions as activities",
              "Automatically discover custom fields",
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle
                  size={20}
                  className="text-green-600 mt-0.5 shrink-0"
                />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Prerequisites */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={20} />
            Before You Begin
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              Active HubSpot account (Free, Starter, Professional, or
              Enterprise)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              Super Admin permissions in HubSpot (required to create private
              apps)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              ConnectFlo account with integration access
            </li>
          </ul>
        </section>

        {/* Setup Steps */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Setup Instructions
          </h2>

          {/* Step 1 */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Create a HubSpot Private App
                </h3>
                <ol className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">1.</span>
                    Log in to your HubSpot account
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">2.</span>
                    Click the <strong>Settings</strong> icon (gear icon) in the
                    top navigation
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">3.</span>
                    Navigate to <strong>Integrations → Private Apps</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">4.</span>
                    Click <strong>Create a private app</strong> (or{" "}
                    <strong>Create legacy app → Private</strong>)
                  </li>
                  <li className="flex items-start gap-2 flex-col">
                    <span className="font-medium text-slate-500">5.</span>
                    <div className="ml-6">
                      On the <strong>Basic Info</strong> tab:
                      <ul className="mt-2 space-y-1 ml-4">
                        <li>
                          • <strong>App name:</strong> ConnectFlo Integration
                        </li>
                        <li>
                          • <strong>Description:</strong> Integrates ConnectFlo
                          with HubSpot CRM
                        </li>
                        <li>• Upload a logo (optional)</li>
                      </ul>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Configure Scopes
                </h3>
                <p className="text-slate-600 mb-4">
                  On the <strong>Scopes</strong> tab, add the following scopes
                  by clicking <strong>Add new scope</strong>:
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-slate-900 mb-3">
                    Required Scopes (Minimum 9)
                  </h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {[
                      "crm.objects.contacts.read",
                      "crm.objects.contacts.write",
                      "crm.schemas.contacts.read",
                      "crm.objects.companies.read",
                      "crm.objects.companies.write",
                      "crm.schemas.companies.read",
                      "crm.objects.deals.read",
                      "crm.objects.deals.write",
                      "crm.schemas.deals.read",
                    ].map((scope) => (
                      <div
                        key={scope}
                        className="flex items-center gap-2 text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200"
                      >
                        <CheckCircle
                          size={14}
                          className="text-green-600 shrink-0"
                        />
                        <span className="text-slate-700">{scope}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-3">
                    Recommended Scopes (Optional)
                  </h4>
                  <div className="space-y-2">
                    {[
                      {
                        scope: "timeline",
                        desc: "Log custom events on CRM records",
                      },
                      {
                        scope: "crm.objects.owners.read",
                        desc: "View user/owner information",
                      },
                      {
                        scope: "sales-email-read",
                        desc: "Read email engagement details",
                      },
                    ].map((item) => (
                      <div
                        key={item.scope}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="font-mono text-amber-900 font-medium">
                          {item.scope}
                        </span>
                        <span className="text-amber-700">- {item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>💡 Tip:</strong> The{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      .schemas.*.read
                    </code>{" "}
                    scopes are critical - they allow ConnectFlo to discover all
                    your custom fields!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Create the App & Get Access Token
                </h3>
                <ol className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">1.</span>
                    Review your selected scopes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">2.</span>
                    Click <strong>Create app</strong> in the top right
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">3.</span>
                    Click <strong>Continue creating</strong> in the confirmation
                    dialog
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">4.</span>
                    Click the <strong>Auth</strong> tab
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">5.</span>
                    Click <strong>Show token</strong> to reveal your access
                    token
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">6.</span>
                    Click <strong>Copy</strong> to copy the token
                  </li>
                </ol>

                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-900 flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>
                      <strong>Important:</strong> Save this token securely! It
                      looks like:
                      <code className="block mt-2 bg-red-100 px-2 py-1 rounded text-xs">
                        pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                      </code>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Connect in ConnectFlo
                </h3>
                <ol className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">1.</span>
                    Navigate to <strong>Settings → Integrations</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">2.</span>
                    Find <strong>HubSpot</strong> in the CRM & ERP section
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">3.</span>
                    Click <strong>Connect</strong>
                  </li>
                  <li className="flex items-start gap-2 flex-col">
                    <span className="font-medium text-slate-500">4.</span>
                    <div className="ml-6">
                      In the connection modal:
                      <ul className="mt-2 space-y-1 ml-4">
                        <li>
                          • <strong>Connection Name:</strong> Enter a friendly
                          name (e.g., "Production HubSpot")
                        </li>
                        <li>
                          • <strong>Access Token:</strong> Paste the token you
                          copied
                        </li>
                      </ul>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">5.</span>
                    Click <strong>Connect</strong> and wait for field discovery
                    to complete
                  </li>
                </ol>

                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900 flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>
                      <strong>Success!</strong> You should see a success message
                      and the integration marked as <strong>CONNECTED</strong>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-slate-50 border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield size={20} className="text-indigo-600" />
            Security & Best Practices
          </h3>
          <div className="space-y-3 text-slate-700">
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>Encryption:</strong> Access tokens are encrypted using
                AES-256-GCM encryption
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>Token Rotation:</strong> Rotate your access token every
                6 months for security
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>Rate Limits:</strong> ConnectFlo automatically handles
                HubSpot's API rate limits
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>Revoke Access:</strong> Delete the private app in
                HubSpot anytime to revoke access
              </div>
            </div>
          </div>
        </section>

        {/* Webhooks Configuration */}
        <section className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Zap size={24} className="text-purple-600" />
            Real-Time Webhooks (Optional)
          </h2>
          <p className="text-slate-700 mb-6">
            Enable real-time sync by configuring webhooks to receive instant
            notifications when data changes in HubSpot.
          </p>

          {/* Webhook Setup Steps */}
          <div className="bg-white rounded-lg p-5 mb-6 border border-purple-100">
            <h3 className="font-semibold text-slate-900 mb-4">
              Setup Instructions
            </h3>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-600 mt-0.5">1.</span>
                <div>
                  In your HubSpot private app, click the{" "}
                  <strong>Webhooks</strong> tab
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-600 mt-0.5">2.</span>
                <div>
                  Set <strong>Target URL</strong> to:
                  <code className="block mt-1 bg-slate-100 px-3 py-2 rounded text-xs break-all">
                    https://chamois-holy-unduly.ngrok-free.app/webhooks/hubspot
                  </code>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-600 mt-0.5">3.</span>
                <div>
                  Set <strong>Event throttling</strong> to <strong>10</strong>{" "}
                  concurrent requests
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-600 mt-0.5">4.</span>
                <div>
                  Click <strong>Create subscription</strong> and add the events
                  below
                </div>
              </li>
            </ol>
          </div>

          {/* Recommended Webhooks */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-5 border border-purple-100">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Contact Events
              </h4>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  "contact.creation",
                  "contact.propertyChange",
                  "contact.deletion",
                  "contact.merge",
                  "contact.associationChange",
                ].map((event) => (
                  <div
                    key={event}
                    className="flex items-center gap-2 text-xs font-mono bg-slate-50 px-3 py-2 rounded"
                  >
                    <CheckCircle
                      size={12}
                      className="text-green-600 shrink-0"
                    />
                    <span>{event}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border border-purple-100">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Company Events
              </h4>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  "company.creation",
                  "company.propertyChange",
                  "company.deletion",
                  "company.merge",
                  "company.associationChange",
                ].map((event) => (
                  <div
                    key={event}
                    className="flex items-center gap-2 text-xs font-mono bg-slate-50 px-3 py-2 rounded"
                  >
                    <CheckCircle size={12} className="text-blue-600 shrink-0" />
                    <span>{event}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border border-purple-100">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                Deal Events
              </h4>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  "deal.creation",
                  "deal.propertyChange",
                  "deal.deletion",
                  "deal.merge",
                  "deal.associationChange",
                ].map((event) => (
                  <div
                    key={event}
                    className="flex items-center gap-2 text-xs font-mono bg-slate-50 px-3 py-2 rounded"
                  >
                    <CheckCircle
                      size={12}
                      className="text-orange-600 shrink-0"
                    />
                    <span>{event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} />
              Important Notes
            </h4>
            <ul className="space-y-1 text-sm text-amber-800">
              <li>
                • New subscriptions start <strong>paused</strong> - remember to
                activate them
              </li>
              <li>• HubSpot sends up to 100 events per request in batches</li>
              <li>• Your endpoint must respond within 5 seconds</li>
              <li>• Failed webhooks retry up to 10 times over 24 hours</li>
              <li>
                • For propertyChange events, leave properties blank to monitor
                all properties
              </li>
            </ul>
          </div>
        </section>

        {/* Troubleshooting */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Troubleshooting
          </h2>
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">
                "Connection Failed" Error
              </h4>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>✓ Verify you copied the complete access token</li>
                <li>✓ Ensure the token hasn't been revoked in HubSpot</li>
                <li>✓ Check that all required scopes are enabled</li>
                <li>✓ Verify your HubSpot account is active</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">
                Fields Not Showing in Workflows
              </h4>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>
                  ✓ Ensure{" "}
                  <code className="bg-slate-100 px-1 rounded">
                    .schemas.*.read
                  </code>{" "}
                  scopes are enabled
                </li>
                <li>✓ Click "Refresh Fields" in integration settings</li>
                <li>✓ Wait a few minutes for field discovery to complete</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">
                Webhooks Not Firing
              </h4>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>
                  ✓ Check that webhooks are <strong>activated</strong> (not
                  paused)
                </li>
                <li>
                  ✓ Verify the webhook URL is correct and publicly accessible
                </li>
                <li>✓ Test the webhook using the "Test" button in HubSpot</li>
                <li>✓ Check your server logs for incoming requests</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Additional Resources */}
        <section className="border-t border-slate-200 pt-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Additional Resources
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            <a
              href="https://developers.hubspot.com/docs/api/private-apps"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm"
            >
              <ExternalLink size={14} />
              HubSpot Private Apps Documentation
            </a>
            <a
              href="https://developers.hubspot.com/docs/api/crm/properties"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm"
            >
              <ExternalLink size={14} />
              HubSpot API Reference
            </a>
            <a
              href="https://developers.hubspot.com/docs/api/scopes"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm"
            >
              <ExternalLink size={14} />
              HubSpot Scopes Reference
            </a>
            <a
              href="https://developers.hubspot.com/docs/api/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm"
            >
              <ExternalLink size={14} />
              HubSpot Webhooks API Documentation
            </a>
          </div>
        </section>

        {/* Support */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-indigo-900 mb-2">Need Help?</h3>
          <p className="text-indigo-700 mb-4">
            Our support team is here to help you get connected
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Contact Support
            </button>
            <button className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-200">
              View Video Tutorial
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HubSpotGuide;
