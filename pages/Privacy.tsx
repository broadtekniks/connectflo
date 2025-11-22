
import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onNavigate: (view: string) => void;
}

const Privacy: React.FC<LegalPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
                <span className="text-xl font-bold tracking-tight">ConnectFlo</span>
            </div>
            <button onClick={() => onNavigate('home')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600">
                <ArrowLeft size={16} /> Back to Home
            </button>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-slate-500 mb-12 pb-8 border-b border-slate-100">Last updated: October 24, 2025</p>
        
        <div className="space-y-12 text-lg text-slate-700 leading-relaxed">
            <section>
                <p className="mb-6">
                    This Privacy Policy describes how <strong>BroadTekniks LLC</strong> ("we", "us", or "our") collects, uses, and discloses your information when you use our ConnectFlo application (the "Service"). By accessing or using the Service, you agree to the collection and use of information in accordance with this policy.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">1. Information We Collect</h3>
                <p className="mb-4">
                    We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us. This may include:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-slate-600">
                    <li><strong>Account Information:</strong> Name, email address, company name, and password.</li>
                    <li><strong>Payment Information:</strong> Billing address and payment method details (processed by our secure payment providers).</li>
                    <li><strong>Customer Data:</strong> Data you upload or connect via integrations (e.g., customer conversations, workflow configurations) to use the Service.</li>
                </ul>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">2. How We Use Your Information</h3>
                <p className="mb-4">
                    We use the information we collect to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-slate-600">
                    <li>Provide, maintain, and improve the ConnectFlo platform.</li>
                    <li>Process transactions and send related information, including confirmations and invoices.</li>
                    <li>Send you technical notices, updates, security alerts, and support messages.</li>
                    <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">3. AI and Data Processing</h3>
                <p className="mb-4">
                   ConnectFlo utilizes Artificial Intelligence (AI) technologies. Data submitted to our AI features may be processed by third-party LLM providers (such as Google Gemini or OpenAI) solely for the purpose of generating responses or analyzing content as requested by you. We do not use your customer data to train our foundational public models without your explicit consent.
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">4. Data Security</h3>
                <p>
                    BroadTekniks LLC takes reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction. Please review our <button onClick={() => onNavigate('security')} className="text-indigo-600 font-medium hover:underline">Security Policy</button> for more details.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">5. Contact Us</h3>
                <p>
                    If you have any questions about this Privacy Policy, please contact BroadTekniks LLC at <a href="mailto:privacy@connectflo.com" className="text-indigo-600 hover:underline">privacy@connectflo.com</a>.
                </p>
            </section>
        </div>
      </div>
      <footer className="bg-slate-50 border-t border-slate-200 py-12 text-center text-slate-500 text-sm">
        &copy; 2025 BroadTekniks LLC. All rights reserved.
      </footer>
    </div>
  );
};

export default Privacy;
