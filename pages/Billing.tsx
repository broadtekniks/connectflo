import React from "react";

const Billing: React.FC = () => {
  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Billing & Usage</h1>
          <p className="text-slate-500 mt-1">
            Manage your subscription plan and monitor AI costs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Pro Plan</h3>
                <p className="text-sm text-slate-500">
                  $49 / month • Billed Monthly
                </p>
              </div>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Active
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                  <span>Voice Minutes</span>
                  <span>850 / 1,000</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: "85%" }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                  <span>AI Tokens</span>
                  <span>2.4M / 5.0M</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full"
                    style={{ width: "48%" }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button className="text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100">
                Upgrade Plan
              </button>
              <button className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2">
                View Invoices
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 mb-4">Payment Method</h3>
              <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-red-500 opacity-50" />
                  <div className="w-4 h-4 rounded-full bg-yellow-500 opacity-50 -ml-2" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">
                    •••• 4242
                  </div>
                  <div className="text-xs text-slate-400">Expires 12/25</div>
                </div>
              </div>
            </div>

            <button className="w-full mt-4 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Update Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Billing;
