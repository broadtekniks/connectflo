import React, { useState } from "react";
import {
  Shield,
  Key,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
} from "lucide-react";

interface TOTPSetupProps {
  onSetupComplete?: () => void;
}

export default function TOTPSetup({ onSetupComplete }: TOTPSetupProps) {
  const [step, setStep] = useState<"init" | "scan" | "verify" | "backup">(
    "init"
  );
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInitiateSetup = async () => {
    setError("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in first");
        setIsLoading(false);
        return;
      }

      const response = await fetch("http://localhost:3002/api/auth/mfa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate MFA setup");
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("scan");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    setError("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in first");
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        "http://localhost:3002/api/auth/mfa/verify-setup",
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
        throw new Error(data.error || "Failed to verify MFA setup");
      }

      setBackupCodes(data.backupCodes);
      setStep("backup");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
  };

  const handleDownloadBackupCodes = () => {
    const text = `ConnectFlo Backup Codes
Generated: ${new Date().toLocaleString()}

Keep these codes in a safe place. Each code can only be used once.

${backupCodes.join("\n")}

If you lose access to your authenticator app, use one of these codes to log in.`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "connectflo-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    onSetupComplete?.();
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
      <div className="flex items-center justify-center mb-6">
        <div className="bg-purple-100 p-3 rounded-full">
          <Shield className="w-8 h-8 text-purple-600" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-center mb-2">
        Two-Factor Authentication
      </h2>
      <p className="text-gray-600 text-center mb-6">
        Level 3 Security - Required for billing, admin, and integrations
      </p>

      {/* Step 1: Initial */}
      {step === "init" && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">
              Why Enable Two-Factor Authentication?
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Protect sensitive billing and payment information</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Secure team management and administrative actions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Control API keys and third-party integrations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Prevent unauthorized account changes</span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              What You'll Need
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              An authenticator app on your phone. We recommend:
            </p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Google Authenticator (iOS/Android)</li>
              <li>• Microsoft Authenticator (iOS/Android)</li>
              <li>• Authy (iOS/Android/Desktop)</li>
              <li>• 1Password (supports TOTP)</li>
            </ul>
          </div>

          <button
            onClick={handleInitiateSetup}
            disabled={isLoading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Setting up..." : "Begin Setup"}
          </button>
        </div>
      )}

      {/* Step 2: Scan QR Code */}
      {step === "scan" && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-4">Step 1: Scan QR Code</h3>
            <p className="text-sm text-gray-600 mb-6">
              Open your authenticator app and scan this QR code
            </p>
            <div className="bg-white border-4 border-gray-200 rounded-lg p-4 inline-block">
              <img src={qrCode} alt="QR Code" className="w-64 h-64" />
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Can't scan? Enter this code manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-300 font-mono text-sm">
                {secret}
              </code>
              <button
                onClick={handleCopySecret}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Copy secret"
              >
                <Copy className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4 text-center">
              Step 2: Enter Verification Code
            </h3>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Enter the 6-digit code from your authenticator app
            </p>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest font-mono mb-4"
            />
            <button
              onClick={handleVerifySetup}
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Backup Codes */}
      {step === "backup" && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-lg text-green-900 mb-2">
              Two-Factor Authentication Enabled!
            </h3>
            <p className="text-sm text-green-700">
              Your account is now protected with an additional layer of security
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Save Your Backup Codes
            </h3>
            <p className="text-sm text-yellow-800 mb-4">
              Store these codes in a safe place. If you lose access to your
              authenticator app, you can use these one-time codes to log in.
            </p>
            <div className="bg-white border border-yellow-300 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="bg-gray-50 px-3 py-2 rounded">
                    {code}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleDownloadBackupCodes}
              className="w-full bg-yellow-600 text-white py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Backup Codes
            </button>
          </div>

          <button
            onClick={handleComplete}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Complete Setup
          </button>
        </div>
      )}
    </div>
  );
}
