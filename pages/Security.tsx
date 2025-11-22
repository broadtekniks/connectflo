
import React from 'react';
import { ArrowLeft, Shield, Lock, Server, Eye } from 'lucide-react';

interface LegalPageProps {
  onNavigate: (view: string) => void;
}

const Security: React.FC<LegalPageProps> = ({ onNavigate }) => {
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

      <div className="bg-indigo-900 text-white py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
              <Shield size={48} className="mx-auto mb-6 text-indigo-400" />
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Security at ConnectFlo</h1>
              <p className="text-xl text-indigo-200 leading-relaxed">
                  BroadTekniks LLC is committed to keeping your data safe. Security is not an afterthought; it is core to our infrastructure and operations.
              </p>
          </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 -mt-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4">
                    <Lock size={20} />
                </div>
                <h3 className="font-bold text-lg mb-2">Encryption</h3>
                <p className="text-slate-500 text-sm">All data is encrypted at rest (AES-256) and in transit (TLS 1.3).</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <Server size={20} />
                </div>
                <h3 className="font-bold text-lg mb-2">Infrastructure</h3>
                <p className="text-slate-500 text-sm">Hosted on AWS/GCP with strict network isolation and firewalls.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <Eye size={20} />
                </div>
                <h3 className="font-bold text-lg mb-2">Monitoring</h3>
                <p className="text-slate-500 text-sm">24/7 automated threat detection and vulnerability scanning.</p>
            </div>
        </div>
        
        <div className="space-y-12 text-lg text-slate-700 leading-relaxed max-w-3xl mx-auto">
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Compliance & Certifications</h3>
                <p className="mb-4">
                    BroadTekniks LLC adheres to industry best practices for security and compliance. We are currently in the process of obtaining SOC 2 Type II certification. Our payment processing partners are PCI-DSS Level 1 compliant.
                </p>
            </section>
            
            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Access Control</h3>
                <p className="mb-4">
                    Access to customer data is strictly limited to authorized employees who require it for their job functions (e.g., customer support or engineering). We use Multi-Factor Authentication (MFA) and Single Sign-On (SSO) for all internal access.
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Vulnerability Disclosure</h3>
                <p className="mb-4">
                   We welcome reports from security researchers. If you believe you have found a vulnerability in ConnectFlo, please report it to <a href="mailto:security@connectflo.com" className="text-indigo-600 hover:underline">security@connectflo.com</a>. We will investigate immediately.
                </p>
            </section>

            <section>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Data Backup & Recovery</h3>
                <p>
                    We perform automated daily backups of all databases. Backups are encrypted and stored in multiple geographic regions to ensure business continuity and disaster recovery capabilities.
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

export default Security;
