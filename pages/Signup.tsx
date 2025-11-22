
import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, User, Building2, Chrome, Github } from 'lucide-react';

interface SignupProps {
  onSignup: () => void;
  onNavigate: (view: string) => void;
}

const Signup: React.FC<SignupProps> = ({ onSignup, onNavigate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      onSignup();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-indigo-600 rounded-full mix-blend-screen filter blur-3xl opacity-30"></div>
        
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => onNavigate('home')}>
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-indigo-900">C</div>
                <span className="text-xl font-bold tracking-tight">ConnectFlo</span>
            </div>
        </div>

        <div className="relative z-10 max-w-lg">
            <h2 className="text-4xl font-bold mb-6 leading-tight">Start your 14-day free trial today.</h2>
            <ul className="space-y-4 text-indigo-100 text-lg">
                <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center text-indigo-900 font-bold text-sm">✓</span> Unified Inbox</li>
                <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center text-indigo-900 font-bold text-sm">✓</span> AI Workflow Builder</li>
                <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center text-indigo-900 font-bold text-sm">✓</span> No credit card required</li>
            </ul>
        </div>

        <div className="relative z-10 text-sm text-indigo-300">
            Join 10,000+ companies transforming support.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-slate-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
                <p className="text-slate-500 mt-2">Get started with ConnectFlo for free.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Jane Doe"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Acme Inc."
                                required
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Work Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="email" 
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="jane@acme.com"
                            required
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="password" 
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Must be at least 8 characters.</p>
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 mt-6"
                >
                    {isLoading ? 'Creating Account...' : <>Get Started <ArrowRight size={18} /></>}
                </button>
            </form>

            <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-slate-200"></div>
                <span className="px-4 text-xs text-slate-400 font-medium uppercase">Or sign up with</span>
                <div className="flex-1 border-t border-slate-200"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-700 text-sm">
                    <Chrome size={18} /> Google
                </button>
                <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-700 text-sm">
                    <Github size={18} /> GitHub
                </button>
            </div>

            <p className="text-center mt-6 text-xs text-slate-400 leading-relaxed">
                By clicking "Get Started", you agree to our <button onClick={() => onNavigate('terms')} className="text-indigo-600 hover:underline">Terms of Service</button> and <button onClick={() => onNavigate('privacy')} className="text-indigo-600 hover:underline">Privacy Policy</button>.
            </p>

            <p className="text-center mt-6 text-sm text-slate-500 pt-6 border-t border-slate-100">
                Already have an account? <button onClick={() => onNavigate('login')} className="text-indigo-600 font-bold hover:underline">Log in</button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
