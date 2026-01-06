import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

type VoicemailItem = {
  id: string;
  conversationId: string;
  createdAt: string;
  content: string;
  recordingUrl: string | null;
  playableUrl: string | null;
  subject: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    avatar: string | null;
  } | null;
};

const extractCaller = (text: string | null | undefined) => {
  const t = String(text || "");
  const match = t.match(/\+\d{7,15}/);
  return match ? match[0] : null;
};

const formatBody = (text: string | null | undefined) => {
  const t = String(text || "");
  // Remove the raw Recording URL chunk from the main body for readability.
  return t.replace(/\s*Recording:\s*https?:\/\/\S+/i, "").trim();
};

export default function Voicemails() {
  const [items, setItems] = useState<VoicemailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    let mounted = true;
    let objectUrlToRevoke: string | null = null;

    const loadAudio = async () => {
      if (!selectedId) {
        setAudioSrc(null);
        return;
      }

      try {
        setAudioLoading(true);
        const blob = await api.getBlob(`/voicemails/${selectedId}/audio`);
        if (!mounted) return;

        const objectUrl = URL.createObjectURL(blob);
        objectUrlToRevoke = objectUrl;
        setAudioSrc(objectUrl);
      } catch (e: any) {
        if (!mounted) return;
        setAudioSrc(null);
        setError(e?.message || "Failed to load voicemail audio");
      } finally {
        if (mounted) setAudioLoading(false);
      }
    };

    loadAudio();

    return () => {
      mounted = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [selectedId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get("/voicemails?limit=100");
        const voicemails = Array.isArray(res?.voicemails)
          ? (res.voicemails as VoicemailItem[])
          : [];

        if (!mounted) return;

        setItems(voicemails);
        if (voicemails.length > 0 && !selectedId) {
          setSelectedId(voicemails[0].id);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load voicemails");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Voicemails</h1>
        <p className="mt-1 text-sm text-slate-600">
          Listen to voicemail recordings captured by Twilio.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid h-[calc(100vh-172px)] grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-h-0 md:col-span-1">
          <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Inbox</div>
              {loading && (
                <div className="text-xs text-slate-500">Loading…</div>
              )}
            </div>
            <div className="min-h-0 overflow-auto">
              {items.length === 0 && !loading ? (
                <div className="p-4 text-sm text-slate-600">
                  No voicemails yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((vm) => {
                    const isSelected = vm.id === selectedId;
                    const when = vm.createdAt ? new Date(vm.createdAt) : null;
                    const caller =
                      vm.customer?.name ||
                      vm.customer?.email ||
                      extractCaller(vm.subject) ||
                      extractCaller(vm.content) ||
                      "Unknown caller";
                    const preview =
                      vm.subject ||
                      formatBody(vm.content) ||
                      (caller ? `Voicemail from ${caller}` : "Voicemail");
                    return (
                      <li
                        key={vm.id}
                        className={`cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 ${
                          isSelected ? "bg-indigo-50" : ""
                        }`}
                        onClick={() => setSelectedId(vm.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-7 w-7 shrink-0 rounded-full border text-xs font-semibold flex items-center justify-center ${
                                  isSelected
                                    ? "border-indigo-200 bg-white text-indigo-700"
                                    : "border-slate-200 bg-slate-50 text-slate-700"
                                }`}
                              >
                                {(
                                  String(caller).trim()[0] || "V"
                                ).toUpperCase()}
                              </div>
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {caller}
                              </div>
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                              {preview}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-slate-500">
                            {when ? when.toLocaleDateString() : ""}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 md:col-span-2">
          <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">
                {selected?.customer?.name ||
                  selected?.customer?.email ||
                  extractCaller(selected?.subject) ||
                  extractCaller(selected?.content) ||
                  "Voicemail"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {selected?.createdAt
                  ? new Date(selected.createdAt).toLocaleString()
                  : ""}
              </div>
            </div>

            {!selected ? (
              <div className="p-5 text-sm text-slate-600">
                Select a voicemail to listen.
              </div>
            ) : (
              <div className="min-h-0 p-5">
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold text-slate-700">
                    Message
                  </div>
                  <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
                    {formatBody(selected.content) || "Voicemail"}
                  </div>
                  {selected.recordingUrl ? (
                    <div className="mt-2 text-xs text-slate-500 truncate">
                      Recording: {selected.recordingUrl}
                    </div>
                  ) : null}
                </div>

                {audioLoading ? (
                  <div className="text-sm text-slate-600">Loading audio…</div>
                ) : audioSrc ? (
                  <div className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      Playback
                    </div>
                    <audio
                      controls
                      preload="none"
                      className="w-full"
                      src={audioSrc}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    Unable to load audio.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
