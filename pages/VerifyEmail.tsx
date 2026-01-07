import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader, Mail } from "lucide-react";
import { api } from "../services/api";

interface VerifyEmailProps {
  onNavigate?: (view: string) => void;
}

const VerifyEmail: React.FC<VerifyEmailProps> = ({ onNavigate }) => {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Get token from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link");
      return;
    }

    verifyEmail(token);
  }, []);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(
        `http://localhost:3002/api/auth/verify-email?token=${token}`
      );
      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Email verified successfully!");
        // Redirect to login after 3 seconds
        setTimeout(() => {
          if (onNavigate) {
            onNavigate("login");
          } else {
            window.location.href = "/login";
          }
        }, 3000);
      } else {
        setStatus("error");
        setMessage(data.error || "Verification failed");
        if (data.email) {
          setEmail(data.email);
        }
      }
    } catch (error) {
      setStatus("error");
      setMessage("Failed to verify email. Please try again.");
    }
  };

  const handleResendEmail = async () => {
    if (!email) return;

    try {
      setStatus("loading");
      const response = await fetch(
        `http://localhost:3002/api/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage("Verification email sent! Please check your inbox.");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to resend email");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Failed to resend email. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          {status === "loading" && (
            <>
              <Loader
                className="mx-auto animate-spin text-indigo-600 mb-4"
                size={48}
              />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Verifying your email...
              </h2>
              <p className="text-slate-600">Please wait a moment</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Email Verified!
              </h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-500">
                Redirecting you to login...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="mx-auto text-red-500 mb-4" size={48} />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Verification Failed
              </h2>
              <p className="text-slate-600 mb-6">{message}</p>

              {email && message.includes("expired") && (
                <button
                  onClick={handleResendEmail}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={20} />
                  Resend Verification Email
                </button>
              )}

              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate("login");
                  } else {
                    window.location.href = "/login";
                  }
                }}
                className="mt-4 text-indigo-600 hover:underline"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
