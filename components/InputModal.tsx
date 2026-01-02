import React, { useEffect, useMemo, useState } from "react";
import { X, Info } from "lucide-react";

interface InputModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  title,
  message,
  placeholder,
  initialValue = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  const isDisabled = useMemo(() => {
    if (confirmDisabled !== undefined) return confirmDisabled;
    return value.trim().length === 0;
  }, [confirmDisabled, value]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full shrink-0 bg-blue-100 text-blue-600">
              <Info size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
              {message && (
                <p className="text-slate-500 text-sm leading-relaxed">
                  {message}
                </p>
              )}
              <input
                autoFocus
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="mt-4 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isDisabled) onConfirm(value);
                }}
              />
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={isDisabled}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputModal;
