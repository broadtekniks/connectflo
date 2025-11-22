
import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onNavigate: (view: string) => void;
}

const Terms: React.FC<LegalPageProps> = ({ onNavigate }) => {
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
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-slate-500 mb-12 pb-8 border-b border-slate-100">Last updated: October 24, 2025</p>
        
        <div className="space-y-12 text-lg text-slate-700 leading-relaxed">
            <section>
                <p className="mb-6">
                    Please read these Terms of Service ("Terms") carefully before using the ConnectFlo platform operated by <strong>BroadTekniks LLC</strong> ("us", "we", or "our"). Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">1. Accounts</h3>
                <p className="mb-4">
                   When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">2. Subscription & Payments</h3>
                <p className="mb-4">
                   Some parts of the Service are billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring and periodic basis (such as monthly or annually). All payments are processed securely by our third-party payment processors. Refunds are handled according to our Refund Policy.
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">3. Intellectual Property</h3>
                <p className="mb-4">
                   The Service and its original content, features, and functionality are and will remain the exclusive property of BroadTekniks LLC and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">4. Termination</h3>
                <p>
                   We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">5. Limitation of Liability</h3>
                <p>
                   In no event shall BroadTekniks LLC, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">6. Governing Law</h3>
                <p>
                    These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">7. Changes</h3>
                <p>
                    We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
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

export default Terms;
