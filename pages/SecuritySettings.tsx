import React, { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle,
  XCircle,
  Lock,
  Phone,
  Mail,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import PhoneVerification from "../components/PhoneVerification";
import TOTPSetup from "../components/TOTPSetup";

interface SecurityStatus {
  level1_emailVerified: boolean;
  level2_phoneVerified: boolean;
  level3_mfaEnabled: boolean;
  hasPhoneNumber: boolean;
  currentLevel: number;
  canAccessVoice: boolean;
  canAccessBilling: boolean;
  canAccessAdmin: boolean;
}

export default function SecuritySettings() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeSetup, setActiveSetup] = useState<"phone" | "totp" | null>(null);

  const fetchSecurityStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:3002/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const user = await response.json();

      const status: SecurityStatus = {
        level1_emailVerified: user.emailVerified || false,
        level2_phoneVerified: user.phoneVerified || false,
        level3_mfaEnabled: user.mfaEnabled || false,
        hasPhoneNumber: !!user.phoneNumber,
        currentLevel: user.mfaEnabled
          ? 3
          : user.phoneVerified
          ? 2
          : user.emailVerified
          ? 1
          : 0,
        canAccessVoice: user.emailVerified && user.phoneVerified,
        canAccessBilling:
          user.emailVerified && user.phoneVerified && user.mfaEnabled,
        canAccessAdmin:
          user.emailVerified && user.phoneVerified && user.mfaEnabled,
      };

      setSecurityStatus(status);
    } catch (error) {
      console.error("Failed to fetch security status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  const handleSetupComplete = () => {
    setActiveSetup(null);
    fetchSecurityStatus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading security settings...</p>
        </div>
      </div>
    );
  }

  if (activeSetup === "phone") {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto mb-6">
          <button
            onClick={() => setActiveSetup(null)}
            className="text-blue-600 hover:underline mb-4"
          >
            ← Back to Security Settings
          </button>
        </div>
        <PhoneVerification onVerified={handleSetupComplete} />
      </div>
    );
  }

  if (activeSetup === "totp") {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto mb-6">
          <button
            onClick={() => setActiveSetup(null)}
            className="text-blue-600 hover:underline mb-4"
          >
            ← Back to Security Settings
          </button>
        </div>
        <TOTPSetup onSetupComplete={handleSetupComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Security Settings</h1>
              <p className="text-gray-600">
                Current Level: {securityStatus?.currentLevel}/3
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Security Progress
              </span>
              <span className="text-sm font-medium text-gray-700">
                {Math.round((securityStatus?.currentLevel! / 3) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${(securityStatus?.currentLevel! / 3) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Security Levels */}
        <div className="space-y-4">
          {/* Level 1: Email Verification */}
          <div
            className={`bg-white rounded-lg shadow p-6 ${
              securityStatus?.level1_emailVerified
                ? "border-l-4 border-green-500"
                : "border-l-4 border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-full ${
                    securityStatus?.level1_emailVerified
                      ? "bg-green-100"
                      : "bg-gray-100"
                  }`}
                >
                  <Mail
                    className={`w-6 h-6 ${
                      securityStatus?.level1_emailVerified
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">
                      Level 1: Email Verification
                    </h3>
                    {securityStatus?.level1_emailVerified ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Basic authentication and account recovery
                  </p>
                  <div className="text-xs text-gray-500">
                    <strong>Unlocks:</strong> Account access, basic features
                  </div>
                </div>
              </div>
            </div>
            {securityStatus?.level1_emailVerified && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                ✓ Email verified and active
              </div>
            )}
          </div>

          {/* Level 2: Phone Verification */}
          <div
            className={`bg-white rounded-lg shadow p-6 ${
              securityStatus?.level2_phoneVerified
                ? "border-l-4 border-blue-500"
                : "border-l-4 border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div
                  className={`p-3 rounded-full ${
                    securityStatus?.level2_phoneVerified
                      ? "bg-blue-100"
                      : "bg-gray-100"
                  }`}
                >
                  <Phone
                    className={`w-6 h-6 ${
                      securityStatus?.level2_phoneVerified
                        ? "text-blue-600"
                        : "text-gray-400"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">
                      Level 2: Phone Verification
                    </h3>
                    {securityStatus?.level2_phoneVerified ? (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    SMS verification for enhanced security
                  </p>
                  <div className="text-xs text-gray-500 mb-3">
                    <strong>Unlocks:</strong> Voice calls, SMS messaging, call
                    logs, voicemail, view billing
                  </div>
                  {!securityStatus?.level1_emailVerified && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Complete Level 1 (email verification) first</span>
                    </div>
                  )}
                </div>
              </div>
              {securityStatus?.level1_emailVerified &&
                !securityStatus?.level2_phoneVerified && (
                  <button
                    onClick={() => setActiveSetup("phone")}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    Set Up
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
            </div>
            {securityStatus?.level2_phoneVerified && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                ✓ Phone verified • Voice features enabled
              </div>
            )}
          </div>

          {/* Level 3: TOTP/MFA */}
          <div
            className={`bg-white rounded-lg shadow p-6 ${
              securityStatus?.level3_mfaEnabled
                ? "border-l-4 border-purple-500"
                : "border-l-4 border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div
                  className={`p-3 rounded-full ${
                    securityStatus?.level3_mfaEnabled
                      ? "bg-purple-100"
                      : "bg-gray-100"
                  }`}
                >
                  <Lock
                    className={`w-6 h-6 ${
                      securityStatus?.level3_mfaEnabled
                        ? "text-purple-600"
                        : "text-gray-400"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">
                      Level 3: Two-Factor Authentication (TOTP)
                    </h3>
                    {securityStatus?.level3_mfaEnabled ? (
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Authenticator app protection for sensitive operations
                  </p>
                  <div className="text-xs text-gray-500 mb-3">
                    <strong>Unlocks:</strong> Billing modifications (payment
                    methods, subscriptions), team administration, API keys,
                    OAuth integrations, account deletion
                  </div>
                  {!securityStatus?.level2_phoneVerified && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Complete Level 2 (phone verification) first</span>
                    </div>
                  )}
                </div>
              </div>
              {securityStatus?.level2_phoneVerified &&
                !securityStatus?.level3_mfaEnabled && (
                  <button
                    onClick={() => setActiveSetup("totp")}
                    className="ml-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    Set Up
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
            </div>
            {securityStatus?.level3_mfaEnabled && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
                ✓ Two-factor authentication active • Full access enabled
              </div>
            )}
          </div>
        </div>

        {/* Feature Access Summary */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Feature Access</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Voice Calls & SMS</span>
              {securityStatus?.canAccessVoice ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Enabled
                </span>
              ) : (
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Locked
                </span>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">View Billing</span>
              {securityStatus?.canAccessVoice ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Enabled
                </span>
              ) : (
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Locked
                </span>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Modify Billing (Payments)</span>
              {securityStatus?.canAccessBilling ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Enabled
                </span>
              ) : (
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Locked
                </span>
              )}
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Admin & Integrations</span>
              {securityStatus?.canAccessAdmin ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Enabled
                </span>
              ) : (
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Locked
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
