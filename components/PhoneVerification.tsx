import React, { useState } from "react";
import { Phone, Lock, CheckCircle, AlertCircle } from "lucide-react";

interface PhoneVerificationProps {
  onVerified?: () => void;
}

export default function PhoneVerification({
  onVerified,
}: PhoneVerificationProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendCode = async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in first");
        setIsLoading(false);
        return;
      }

      // First, update phone number if it's changed
      if (phoneNumber) {
        const updateResponse = await fetch(
          "http://localhost:3002/api/users/me",
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ phoneNumber }),
          }
        );

        if (!updateResponse.ok) {
          const data = await updateResponse.json();
          throw new Error(data.error || "Failed to update phone number");
        }
      }

      // Send verification code
      const response = await fetch(
        "http://localhost:3002/api/auth/send-phone-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      setCodeSent(true);
      setSuccess(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in first");
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        "http://localhost:3002/api/auth/verify-phone",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code: verificationCode }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      setSuccess("Phone number verified successfully! 🎉");
      setTimeout(() => {
        onVerified?.();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
      <div className="flex items-center justify-center mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <Phone className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-center mb-2">
        Verify Your Phone Number
      </h2>
      <p className="text-gray-600 text-center mb-6">
        Level 2 Security - Required for voice features
      </p>

      {!codeSent ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <button
            onClick={handleSendCode}
            disabled={isLoading || !phoneNumber}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Sending..." : "Send Verification Code"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Code sent to your phone!
              </p>
              <p className="text-xs text-green-700 mt-1">
                Check your messages for a 6-digit code
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/\D/g, "").slice(0, 6)
                )
              }
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
            />
          </div>

          <button
            onClick={handleVerifyCode}
            disabled={isLoading || verificationCode.length !== 6}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </button>

          <button
            onClick={() => {
              setCodeSent(false);
              setVerificationCode("");
              setError("");
              setSuccess("");
            }}
            className="w-full text-blue-600 py-2 text-sm hover:underline"
          >
            Change Phone Number
          </button>

          <button
            onClick={handleSendCode}
            disabled={isLoading}
            className="w-full text-gray-600 py-2 text-sm hover:underline"
          >
            Resend Code
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Your phone number is used for SMS verification and will never be
            shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
