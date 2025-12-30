import React, { useState, useEffect } from "react";
import { Volume2, Check, AlertCircle, Save } from "lucide-react";
import { api } from "../services/api";

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  language: string;
  description: string;
}

interface PhoneVoiceSettingsProps {
  tenantId: string;
}

const PhoneVoiceSettings: React.FC<PhoneVoiceSettingsProps> = ({
  tenantId,
}) => {
  const [availablePhoneVoices, setAvailablePhoneVoices] = useState<
    VoiceOption[]
  >([]);
  const [selectedPhoneVoice, setSelectedPhoneVoice] = useState("female");
  const [selectedPhoneLanguage, setSelectedPhoneLanguage] = useState("en-US");
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testingVoice, setTestingVoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load available phone voices
  useEffect(() => {
    api.voiceConfig
      .getVoices()
      .then((response) => {
        setAvailablePhoneVoices(response.voices);
      })
      .catch(console.error);
  }, []);

  // Load current phone voice preference
  useEffect(() => {
    if (tenantId) {
      api.voiceConfig
        .getPreference(tenantId)
        .then((response) => {
          if (response.preference) {
            setSelectedPhoneVoice(response.preference.voice);
            setSelectedPhoneLanguage(response.preference.language || "en-US");
          }
        })
        .catch(console.error);
    }
  }, [tenantId]);

  const handleSavePhoneVoice = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await api.voiceConfig.setPreference({
        tenantId: tenantId,
        voice: selectedPhoneVoice,
        language: selectedPhoneLanguage,
      });
      setTestSuccess("Voice preference saved successfully!");
      setTimeout(() => setTestSuccess(null), 3000);
    } catch (error) {
      console.error("Failed to save phone voice preference", error);
      setTestError("Failed to save voice preference");
      setTimeout(() => setTestError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPhoneVoice = async () => {
    if (!testPhoneNumber) {
      setTestError("Please enter a phone number");
      setTimeout(() => setTestError(null), 3000);
      return;
    }

    setTestingVoice(true);
    setTestError(null);
    setTestSuccess(null);

    try {
      const response = await api.voiceConfig.testVoice({
        phoneNumber: testPhoneNumber,
        voice: selectedPhoneVoice,
        language: selectedPhoneLanguage,
        testMessage: `Hello! This is a test of the ${
          availablePhoneVoices.find((v) => v.id === selectedPhoneVoice)?.name ||
          selectedPhoneVoice
        } voice. This is how your AI assistant will sound on phone calls. Thank you for testing!`,
      });
      setTestSuccess(
        response.message ||
          "Voice validated! Call your ConnectFlo number to hear it."
      );
    } catch (error: any) {
      console.error("Failed to test voice", error);
      setTestError(error.message || "Failed to validate voice");
    } finally {
      setTestingVoice(false);
      setTimeout(() => {
        setTestSuccess(null);
        setTestError(null);
      }, 8000);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 shadow-sm p-6">
      <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
        <Volume2 size={18} className="text-purple-600" /> Phone Voice Settings
      </h3>
      <p className="text-xs text-slate-600 mb-4">
        Select the TTS voice that will be used when customers call your phone
        number. Test different voices to find the perfect fit for your brand.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Selection */}
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
            Select Voice
          </label>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availablePhoneVoices.map((voice) => (
              <button
                key={voice.id}
                onClick={() => {
                  setSelectedPhoneVoice(voice.id);
                  setSelectedPhoneLanguage(voice.language);
                }}
                className={`w-full text-left px-4 py-3 border-2 rounded-lg transition-all ${
                  selectedPhoneVoice === voice.id
                    ? "bg-purple-50 border-purple-500"
                    : "bg-white border-slate-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {voice.name}
                      </span>
                      {selectedPhoneVoice === voice.id && (
                        <Check size={16} className="text-purple-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {voice.description}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {voice.gender}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {voice.language}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Test Voice */}
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
            Test Voice
          </label>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Your Phone Number
              </label>
              <input
                type="tel"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                placeholder="+12345678900"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Include country code (e.g., +1 for US)
              </p>
            </div>

            <button
              onClick={handleTestPhoneVoice}
              disabled={testingVoice || !testPhoneNumber}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {testingVoice ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Validating...
                </>
              ) : (
                <>
                  <Volume2 size={16} />
                  Validate Voice Selection
                </>
              )}
            </button>

            {testSuccess && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Check
                  size={16}
                  className="text-green-600 mt-0.5 flex-shrink-0"
                />
                <p className="text-sm text-green-800">{testSuccess}</p>
              </div>
            )}

            {testError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle
                  size={16}
                  className="text-red-600 mt-0.5 flex-shrink-0"
                />
                <p className="text-sm text-red-800">{testError}</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                Current Selection
              </h4>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-800">
                  {availablePhoneVoices.find((v) => v.id === selectedPhoneVoice)
                    ?.name || selectedPhoneVoice}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedPhoneLanguage}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Phone Voice Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSavePhoneVoice}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Phone Voice Preference"}
        </button>
      </div>
    </div>
  );
};

export default PhoneVoiceSettings;
