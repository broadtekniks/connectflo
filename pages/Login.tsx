import React, { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  ArrowRight,
  Github,
  Chrome,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "../services/api";

declare global {
  interface Window {
    google?: any;
  }
}

interface LoginProps {
  onLogin: () => void;
  onNavigate: (view: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onNavigate }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setShowResendVerification(false);

    try {
      const response = await api.auth.login({ email, password });
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      onLogin();
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData?.code === "EMAIL_NOT_VERIFIED") {
        setError(errorData.error);
        setShowResendVerification(true);
        setResendEmail(errorData.email || email);
      } else {
        setError(
          err.response?.data?.error ||
            err.message ||
            "Invalid email or password"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "http://localhost:3002/api/auth/resend-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resendEmail }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setError("Verification email sent! Please check your inbox.");
        setShowResendVerification(false);
      } else {
        setError(data.error || "Failed to resend verification email");
      }
    } catch (err) {
      setError("Failed to resend verification email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.auth.googleAuth(credential);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      onLogin();
    } catch (err: any) {
      if (err.requiresCompanyName) {
        // New user - redirect to signup
        onNavigate("signup");
      } else {
        setError(err.error || "Google authentication failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const initiateGoogleSignIn = () => {
    if (!window.google) {
      setError("Google Sign-In not loaded. Please refresh the page.");
      return;
    }

    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        "Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in .env file."
      );
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: any) => handleGoogleLogin(response.credential),
      ux_mode: "popup", // Use popup instead of redirect
    });

    // Render a temporary button and click it programmatically
    const buttonDiv = document.createElement("div");
    buttonDiv.style.display = "none";
    document.body.appendChild(buttonDiv);

    window.google.accounts.id.renderButton(buttonDiv, {
      type: "standard",
      size: "large",
    });

    // Find and click the button
    setTimeout(() => {
      const btn = buttonDiv.querySelector('div[role="button"]') as HTMLElement;
      if (btn) {
        btn.click();
      }
      // Clean up
      setTimeout(() => document.body.removeChild(buttonDiv), 1000);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Left Side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10">
          <div
            className="flex items-center gap-2 mb-8 cursor-pointer"
            onClick={() => onNavigate("home")}
          >
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">
              C
            </div>
            <span className="text-xl font-bold tracking-tight">ConnectFlo</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            "ConnectFlo cut our response times by 60% in the first week."
          </h2>
          <div className="flex items-center gap-4">
            <img
              src="https://picsum.photos/id/338/100/100"
              alt="Testimonial"
              className="w-12 h-12 rounded-full border-2 border-indigo-500"
            />
            <div>
              <p className="font-bold text-lg">Elena Rodriguez</p>
              <p className="text-indigo-300">Head of CX, TechFlow</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-500">
          &copy; 2024 ConnectFlo Inc.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-slate-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-slate-500 mt-2">
              Enter your details to access your workspace.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3 text-red-700 mb-2">
                <AlertCircle size={20} />
                <p className="text-sm">{error}</p>
              </div>
              {showResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                >
                  Resend verification email
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={20}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={20}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                "Signing in..."
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="px-4 text-xs text-slate-400 font-medium uppercase">
              Or continue with
            </span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={initiateGoogleSignIn}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-700 text-sm disabled:opacity-50"
            >
              <Chrome size={18} /> Google
            </button>
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-400 text-sm opacity-50 cursor-not-allowed"
            >
              <Github size={18} /> GitHub
            </button>
          </div>

          <p className="text-center mt-8 text-sm text-slate-500">
            Don't have an account?{" "}
            <button
              onClick={() => onNavigate("signup")}
              className="text-indigo-600 font-bold hover:underline"
            >
              Sign up for free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
