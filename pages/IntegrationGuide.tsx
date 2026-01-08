import React from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import HubSpotGuide from "../components/guides/HubSpotGuide";
import SalesforceGuide from "../components/guides/SalesforceGuide";

const IntegrationGuide: React.FC = () => {
  // Extract provider from URL path
  const getProviderFromPath = () => {
    const path = window.location.pathname;
    const match = path.match(/\/integrations\/guide\/([^/]+)/);
    return match ? match[1] : null;
  };

  const provider = getProviderFromPath();

  const handleBack = () => {
    window.history.pushState({}, "", "/integrations");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const guideComponents: Record<string, React.FC> = {
    hubspot: HubSpotGuide,
    salesforce: SalesforceGuide,
    // More guides coming soon:
    // zoho: ZohoGuide,
    // odoo: OdooGuide,
    // "google-calendar": GoogleCalendarGuide,
  };

  const GuideComponent = provider ? guideComponents[provider] : null;

  if (!GuideComponent) {
    return (
      <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft size={16} />
            Back to Integrations
          </button>
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <AlertCircle size={48} className="mx-auto text-slate-400 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Guide Not Found
            </h2>
            <p className="text-slate-600">
              The integration guide for "{provider}" is not available yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Integrations
        </button>
        <GuideComponent />
      </div>
    </div>
  );
};

export default IntegrationGuide;
