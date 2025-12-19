import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Check,
  RefreshCw,
  Trash2,
  AlertCircle,
  Eye,
  FileCode,
  FileImage,
  File,
} from "lucide-react";
import { api } from "../services/api";
import ConfirmationModal from "../components/ConfirmationModal";
import AlertModal from "../components/AlertModal";

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: "PENDING" | "INDEXING" | "READY" | "ERROR";
  updatedAt: string;
}

const KnowledgeBase: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  // Poll for updates if any document is in pending/indexing state
  useEffect(() => {
    const hasPendingDocs = documents.some(
      (doc) => doc.status === "PENDING" || doc.status === "INDEXING"
    );

    if (hasPendingDocs) {
      const interval = setInterval(() => {
        loadDocuments(true); // Pass true to indicate background polling
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [documents]);

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const loadDocuments = async (isPolling = false) => {
    try {
      const docs = await api.knowledgeBase.list();
      // Only update if there are changes to avoid unnecessary re-renders
      setDocuments((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(docs)) {
          return docs;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to load documents", error);
      if (!isPolling) {
        showAlert("Error", "Failed to load documents", "error");
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        const newDoc = await api.knowledgeBase.upload(file);
        // Optimistically add the new document
        setDocuments((prev) => [newDoc, ...prev]);
        showAlert("Success", "Document uploaded successfully", "success");
      } catch (error) {
        console.error("Upload failed", error);
        showAlert("Upload Failed", "Failed to upload document", "error");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const url = await api.knowledgeBase.getPreviewUrl(id);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Failed to get preview URL", error);
      showAlert("Preview Failed", "Failed to preview document", "error");
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      // Optimistically update status to INDEXING
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, status: "INDEXING" } : doc
        )
      );

      await api.knowledgeBase.reprocess(id);
      showAlert("Success", "Document reprocessing started", "success");
    } catch (error) {
      console.error("Reprocess failed", error);
      // Revert status on error (reload from server)
      loadDocuments();
      showAlert("Reprocess Failed", "Failed to reprocess document", "error");
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      await api.knowledgeBase.delete(deleteId);
      setDocuments((docs) => docs.filter((d) => d.id !== deleteId));
      showAlert("Success", "Document deleted successfully", "success");
    } catch (error) {
      console.error("Delete failed", error);
      showAlert("Delete Failed", "Failed to delete document", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileVisuals = (doc: Document) => {
    const type = doc.type.toLowerCase();
    const name = doc.name.toLowerCase();

    if (type.includes("pdf")) {
      return {
        icon: <FileText size={18} className="text-red-600" />,
        bg: "bg-red-50",
      };
    }
    if (
      type.includes("word") ||
      type.includes("document") ||
      name.endsWith(".docx") ||
      name.endsWith(".doc")
    ) {
      return {
        icon: <FileText size={18} className="text-blue-600" />,
        bg: "bg-blue-50",
      };
    }
    if (type.includes("image") || name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return {
        icon: <FileImage size={18} className="text-purple-600" />,
        bg: "bg-purple-50",
      };
    }
    if (
      type.includes("sheet") ||
      type.includes("excel") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".csv")
    ) {
      return {
        icon: <FileText size={18} className="text-green-600" />,
        bg: "bg-green-50",
      };
    }
    if (
      name.endsWith(".md") ||
      name.endsWith(".json") ||
      name.endsWith(".js") ||
      name.endsWith(".ts")
    ) {
      return {
        icon: <FileCode size={18} className="text-slate-600" />,
        bg: "bg-slate-100",
      };
    }
    return {
      icon: <File size={18} className="text-slate-500" />,
      bg: "bg-slate-100",
    };
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 mt-1">
            Manage documents and FAQs to train your AI assistant.
          </p>
        </div>

        <div className="space-y-6">
          <div
            className="bg-white p-10 rounded-xl border border-slate-200 border-dashed text-center hover:border-indigo-400 transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.docx,.md,.csv,.xlsx,.xls,.json"
            />
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500 group-hover:scale-110 transition-transform">
              {uploading ? (
                <RefreshCw size={32} className="animate-spin" />
              ) : (
                <UploadCloud size={32} />
              )}
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">
              {uploading ? "Uploading & Indexing..." : "Upload Documents"}
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Click to select PDF, DOCX, CSV, Excel, or TXT files to train your
              AI agent.
            </p>
            <button
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              disabled={uploading}
            >
              Select Files
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Indexed Documents</h3>
              <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                {documents.length} Documents
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No documents uploaded yet.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-slate-500 font-medium bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Last Updated</th>
                    <th className="px-6 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const visuals = getFileVisuals(doc);
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className={`p-2 rounded ${visuals.bg}`}>
                            {visuals.icon}
                          </div>
                          <div>
                            <span className="font-medium text-slate-700 block">
                              {doc.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatSize(doc.size)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {doc.status === "READY" && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                              <Check size={10} /> Ready
                            </span>
                          )}
                          {(doc.status === "INDEXING" ||
                            doc.status === "PENDING") && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                              <RefreshCw size={10} className="animate-spin" />{" "}
                              Indexing
                            </span>
                          )}
                          {doc.status === "ERROR" && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100">
                              <AlertCircle size={10} /> Error
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(doc.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReprocess(doc.id);
                            }}
                            className="text-slate-400 hover:text-blue-600 font-medium transition-colors mr-3"
                            title="Reprocess"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(doc.id);
                            }}
                            className="text-slate-400 hover:text-indigo-600 font-medium transition-colors mr-3"
                            title="Preview"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(doc.id);
                            }}
                            className="text-slate-400 hover:text-red-600 font-medium transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        isDestructive={true}
      />

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={closeAlert}
      />
    </div>
  );
};

export default KnowledgeBase;
