import { useEffect, useMemo, useState } from "react";
import { Mail, MailOpen, Trash2, Filter } from "lucide-react";
import { api } from "../services/api";
import { socketService } from "../services/socket";
import ConfirmationModal from "../components/ConfirmationModal";

type VoicemailItem = {
  id: string;
  conversationId: string;
  createdAt: string;
  content: string;
  recordingUrl: string | null;
  playableUrl: string | null;
  isRead: boolean;
  subject: string | null;
  phoneNumber: string | null;
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
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterPhoneNumber, setFilterPhoneNumber] = useState("");

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  );

  const markAsRead = async (conversationId: string) => {
    // Optimistically mark as read in UI.
    setItems((prev) =>
      prev.map((i) =>
        i.conversationId === conversationId ? { ...i, isRead: true } : i
      )
    );

    try {
      await api.post(`/voicemails/${conversationId}/mark-read`, {});
    } catch {
      // Non-blocking: the list will reconcile on next refresh.
    }
  };

  const handleDelete = (messageId: string) => {
    setItemToDelete(messageId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    setDeleting(true);
    setDeleteConfirmOpen(false);
    try {
      await api.delete(`/voicemails/${itemToDelete}`);
      // Remove from list
      setItems((prev) => prev.filter((item) => item.id !== itemToDelete));
      // Clear selection if deleted item was selected
      if (selectedId === itemToDelete) {
        setSelectedId(null);
        setAudioSrc(null);
      }
    } catch (error) {
      console.error("Failed to delete voicemail:", error);
      alert("Failed to delete voicemail. Please try again.");
    } finally {
      setDeleting(false);
      setItemToDelete(null);
    }
  };

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

        // Build query params
        const params = new URLSearchParams({ limit: "100" });
        if (fromDate) params.append("fromDate", fromDate);
        if (toDate) params.append("toDate", toDate);
        if (filterPhoneNumber) params.append("phoneNumber", filterPhoneNumber);

        const res = await api.get(`/voicemails?${params.toString()}`);
        const voicemails = Array.isArray(res?.voicemails)
          ? (res.voicemails as VoicemailItem[])
          : [];

        if (!mounted) return;

        setItems(voicemails);
        // Don't auto-select the first voicemail to avoid premature read marking
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
  }, [fromDate, toDate, filterPhoneNumber]);

  // Listen for new voicemails via WebSocket
  useEffect(() => {
    socketService.connect();

    socketService.onNewMessage(async (message: any) => {
      // Only handle voicemail messages (CUSTOMER sender with attachments)
      if (message.sender === "CUSTOMER" && message.attachments?.length > 0) {
        // Reload the full list to get proper customer data and ensure consistency
        try {
          const res = await api.get("/voicemails?limit=100");
          const voicemails = Array.isArray(res?.voicemails)
            ? (res.voicemails as VoicemailItem[])
            : [];
          setItems(voicemails);
        } catch (e) {
          console.error("Failed to reload voicemails after new message:", e);
        }
      }
    });

    return () => {
      socketService.offNewMessage();
    };
  }, []);

  return (
    <div className="h-full w-full p-6">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Voicemails</h1>
            <p className="mt-1 text-sm text-slate-600">
              Listen to voicemail recordings.
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              showFilters
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {/* Stats Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Voicemails
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {items.length}
                  </span>
                </div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <Mail size={20} />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Unread</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {items.filter((item) => !item.isRead).length}
                  </span>
                </div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <Mail size={20} />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Read</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {items.filter((item) => item.isRead).length}
                  </span>
                </div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <MailOpen size={20} />
              </div>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Received On
                </label>
                <select
                  value={filterPhoneNumber}
                  onChange={(e) => setFilterPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">All Numbers</option>
                  {Array.from(
                    new Set(items.map((vm) => vm.phoneNumber).filter(Boolean))
                  ).map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(fromDate || toDate || filterPhoneNumber) && (
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setFilterPhoneNumber("");
                }}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid h-[calc(100vh-172px)] grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-h-0 md:col-span-1">
          <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
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
                            <div className="mt-1 space-y-0.5">
                              <div className="line-clamp-2 text-xs text-slate-600">
                                {preview}
                              </div>
                              {vm.phoneNumber && (
                                <div className="text-xs text-slate-500 font-mono">
                                  → {vm.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              {vm.isRead ? (
                                <MailOpen
                                  size={14}
                                  className="text-slate-400"
                                />
                              ) : (
                                <Mail size={14} className="text-indigo-600" />
                              )}
                            </div>
                            {when && (
                              <div className="text-xs text-slate-500">
                                <div>{when.toLocaleDateString()}</div>
                                <div>
                                  {when.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                            )}
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
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">
                {selected?.customer?.name ||
                  selected?.customer?.email ||
                  extractCaller(selected?.subject) ||
                  extractCaller(selected?.content) ||
                  "Voicemail"}
              </div>
              {selected && (
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">
                    {selected?.createdAt
                      ? new Date(selected.createdAt).toLocaleString()
                      : ""}
                  </div>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    disabled={deleting}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete voicemail"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
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
                </div>

                {audioLoading ? (
                  <div className="text-sm text-slate-600">Loading audio…</div>
                ) : audioSrc ? (
                  <div className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      Playback
                    </div>
                    <audio
                      key={selectedId} // Force re-mount when selection changes
                      controls
                      preload="none"
                      className="w-full"
                      src={audioSrc}
                      onPlay={(e) => {
                        console.log("Audio onPlay triggered", {
                          selectedId,
                          isRead: selected?.isRead,
                          conversationId: selected?.conversationId,
                          paused: e.currentTarget.paused,
                          currentTime: e.currentTarget.currentTime,
                        });
                        if (
                          selected &&
                          !selected.isRead &&
                          selected.conversationId
                        ) {
                          console.log(
                            "Marking as read:",
                            selected.conversationId
                          );
                          markAsRead(selected.conversationId);
                        }
                      }}
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

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        title="Delete Voicemail"
        message="Are you sure you want to delete this voicemail? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setItemToDelete(null);
        }}
        isDestructive={true}
      />
    </div>
  );
}
