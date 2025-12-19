import React from "react";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
  type?: "success" | "error" | "info";
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  buttonLabel = "OK",
  onClose,
  type = "info",
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle size={24} />;
      case "error":
        return <AlertCircle size={24} />;
      default:
        return <Info size={24} />;
    }
  };

  const getColors = () => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-600";
      case "error":
        return "bg-red-100 text-red-600";
      default:
        return "bg-blue-100 text-blue-600";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${getColors()}`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
