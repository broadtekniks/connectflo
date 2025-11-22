import React, { useState } from "react";
import { CheckCircle, Zap, X } from "lucide-react";

interface PricingProps {
  onNavigate: (view: string) => void;
}

const Pricing: React.FC<PricingProps> = ({ onNavigate }) => {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      price: isAnnual ? 0 : 0,
      desc: "Perfect for small teams just getting started.",
      features: [
        "2 Agent Seats",
        "Unified Inbox",
        "Basic Analytics",
        "100 AI Conversations/mo",
        "Email Support",
      ],
      cta: "Start for Free",
      popular: false,
      color: "bg-white border-slate-200",
    },
    {
      name: "Pro",
      price: isAnnual ? 49 : 59,
      desc: "For growing businesses needing automation.",
      features: [
        "5 Agent Seats",
        "Advanced Workflows",
        "Voice & SMS Channels",
        "Unlimited AI Conversations",
        "Priority Support",
        "CRM Integrations",
      ],
      cta: "Start 14-Day Trial",
      popular: true,
      color: "bg-indigo-50 border-indigo-200 shadow-indigo-100",
    },
    {
      name: "Enterprise",
      price: "Custom",
      desc: "For large organizations with custom needs.",
      features: [
        "Unlimited Seats",
        "Custom AI Models",
        "SSO & Audit Logs",
        "Dedicated Success Manager",
        "SLA Guarantees",
        "On-premise Deployment",
      ],
      cta: "Contact Sales",
      popular: false,
      color: "bg-white border-slate-200",
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate("home")}
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              C
            </div>
            <span className="text-xl font-bold tracking-tight">ConnectFlo</span>
          </div>
          <button
            onClick={() => onNavigate("home")}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>
      </nav>

      <div className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-slate-500 mb-8">
              Choose the plan that's right for your team. All plans include a
              14-day free trial.
            </p>

            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm font-bold ${
                  !isAnnual ? "text-slate-900" : "text-slate-500"
                }`}
              >
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-14 h-8 bg-indigo-600 rounded-full p-1 relative transition-colors duration-300"
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${
                    isAnnual ? "translate-x-6" : "translate-x-0"
                  }`}
                ></div>
              </button>
              <span
                className={`text-sm font-bold ${
                  isAnnual ? "text-slate-900" : "text-slate-500"
                }`}
              >
                Yearly{" "}
                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs ml-1">
                  -20%
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-8 relative ${plan.color} ${
                  plan.popular
                    ? "ring-2 ring-indigo-500 shadow-xl"
                    : "shadow-sm"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-slate-500 text-sm mb-6 min-h-[40px]">
                  {plan.desc}
                </p>

                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {typeof plan.price === "number"
                      ? `$${plan.price}`
                      : plan.price}
                  </span>
                  {typeof plan.price === "number" && (
                    <span className="text-slate-500 font-medium">/month</span>
                  )}
                </div>

                <button
                  onClick={() => onNavigate("signup")}
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-all mb-8 ${
                    plan.popular
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                      : "bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-600 hover:text-indigo-600"
                  }`}
                >
                  {plan.cta}
                </button>

                <div className="space-y-4">
                  {plan.features.map((feat, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-sm text-slate-600"
                    >
                      <CheckCircle
                        size={16}
                        className="text-green-500 mt-0.5 shrink-0"
                      />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-24 border-t border-slate-100 pt-16">
            <h2 className="text-3xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
              <div>
                <h4 className="font-bold text-lg mb-2">
                  Can I change plans later?
                </h4>
                <p className="text-slate-500 leading-relaxed">
                  Yes, you can upgrade or downgrade your plan at any time from
                  the billing settings.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-2">
                  Do you offer a free trial?
                </h4>
                <p className="text-slate-500 leading-relaxed">
                  Absolutely. Every paid plan comes with a 14-day free trial. No
                  credit card required to start.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-2">
                  How does AI pricing work?
                </h4>
                <p className="text-slate-500 leading-relaxed">
                  We count an "AI Conversation" as any session where the AI
                  successfully resolves the ticket or handles &gt;5 messages.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-2">Is my data secure?</h4>
                <p className="text-slate-500 leading-relaxed">
                  Yes, we are SOC2 Type II compliant and encrypt all data at
                  rest and in transit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
