import React from "react";
import {
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Shield,
} from "lucide-react";

const SalesforceGuide: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 p-8">
        <div className="flex items-start gap-4">
          <img
            src="https://cdn.simpleicons.org/salesforce"
            alt="Salesforce"
            className="w-16 h-16"
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Salesforce Integration Guide
            </h1>
            <p className="text-slate-600 text-lg">
              Connect ConnectFlo to Salesforce CRM to sync accounts, contacts,
              leads, and opportunities.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen size={24} className="text-blue-600" />
            What You Can Do
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Sync accounts and contacts bidirectionally",
              "Access lead and opportunity data",
              "View and update custom objects",
              "Use Salesforce fields in workflow conditions",
              "Log activities and tasks",
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
              Active Salesforce account (any edition)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              System Administrator or equivalent permissions
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
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Create a Connected App in Salesforce
                </h3>
                <ol className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">1.</span>
                    Log in to Salesforce with administrator credentials
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">2.</span>
                    Click the gear icon and select <strong>Setup</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">3.</span>
                    In Quick Find, search for <strong>App Manager</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">4.</span>
                    Click <strong>New Connected App</strong>
                  </li>
                  <li className="flex items-start gap-2 flex-col">
                    <span className="font-medium text-slate-500">5.</span>
                    <div className="ml-6">
                      Fill in the <strong>Basic Information</strong>:
                      <ul className="mt-2 space-y-1 ml-4">
                        <li>
                          • <strong>Connected App Name:</strong> ConnectFlo
                          Integration
                        </li>
                        <li>
                          • <strong>API Name:</strong> ConnectFlo_Integration
                        </li>
                        <li>
                          • <strong>Contact Email:</strong> Your email address
                        </li>
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
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Configure OAuth Settings
                </h3>
                <ol className="space-y-3 text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">1.</span>
                    In the <strong>API (Enable OAuth Settings)</strong> section,
                    check <strong>Enable OAuth Settings</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">2.</span>
                    <strong>Callback URL:</strong> Enter{" "}
                    <code className="bg-slate-100 px-2 py-1 rounded">
                      https://login.salesforce.com/services/oauth2/success
                    </code>
                  </li>
                  <li className="flex items-start gap-2 flex-col">
                    <span className="font-medium text-slate-500">3.</span>
                    <div className="ml-6">
                      Select <strong>OAuth Scopes</strong>:
                      <div className="mt-2 space-y-2">
                        {[
                          "Full access (full)",
                          "Perform requests at any time (refresh_token, offline_access)",
                          "Access and manage your data (api)",
                        ].map((scope) => (
                          <div
                            key={scope}
                            className="flex items-center gap-2 text-sm bg-slate-50 px-3 py-2 rounded border border-slate-200"
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
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">4.</span>
                    Click <strong>Save</strong> at the bottom of the page
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Get Instance URL and Access Token
                </h3>
                <div className="space-y-4 text-slate-700">
                  <div>
                    <h4 className="font-semibold mb-2">Instance URL:</h4>
                    <p className="mb-2">
                      Your Salesforce instance URL is visible in your browser
                      when logged into Salesforce:
                    </p>
                    <code className="block bg-slate-100 px-3 py-2 rounded text-sm">
                      https://[your-domain].my.salesforce.com
                    </code>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 mb-2">
                      Access Token:
                    </h4>
                    <p className="text-amber-800 text-sm mb-2">
                      You'll need to use OAuth 2.0 to obtain an access token.
                      Options:
                    </p>
                    <ul className="space-y-1 text-sm text-amber-800 ml-4">
                      <li>
                        • Use Salesforce Workbench to get a session ID/token
                      </li>
                      <li>• Use Postman OAuth 2.0 authentication flow</li>
                      <li>
                        • Contact ConnectFlo support for OAuth flow setup
                        assistance
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
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
                    Find <strong>Salesforce</strong> in the CRM & ERP section
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
                          name
                        </li>
                        <li>
                          • <strong>Instance URL:</strong> Your Salesforce
                          instance URL
                        </li>
                        <li>
                          • <strong>Access Token:</strong> Your OAuth access
                          token
                        </li>
                      </ul>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-slate-500">5.</span>
                    Click <strong>Connect</strong>
                  </li>
                </ol>

                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900 flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>
                      <strong>Success!</strong> ConnectFlo will now sync with
                      Salesforce
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
            <Shield size={20} className="text-blue-600" />
            Security & Best Practices
          </h3>
          <div className="space-y-3 text-slate-700">
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>Encrypted Storage:</strong> Credentials are encrypted
                using AES-256-GCM
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>API Limits:</strong> Respects Salesforce API call limits
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-green-600 mt-1 shrink-0" />
              <div>
                <strong>Token Refresh:</strong> Access tokens should be
                refreshed periodically
              </div>
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
              href="https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <ExternalLink size={14} />
              Create a Connected App
            </a>
            <a
              href="https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <ExternalLink size={14} />
              Salesforce REST API Documentation
            </a>
          </div>
        </section>

        {/* Support */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-blue-700 mb-4">
            Our support team can assist with OAuth setup
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Contact Support
          </button>
        </section>
      </div>
    </div>
  );
};

export default SalesforceGuide;
