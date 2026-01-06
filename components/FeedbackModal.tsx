import React, { useState } from "react";
import { Star, MessageSquare, X, Send } from "lucide-react";
import { api } from "../services/api";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  customerId?: string;
  onSubmitSuccess?: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  customerId,
  onSubmitSuccess,
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    { value: "service", label: "Service Quality" },
    { value: "response-time", label: "Response Time" },
    { value: "resolution", label: "Problem Resolution" },
    { value: "communication", label: "Communication" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      alert("Please provide feedback before submitting");
      return;
    }

    setSubmitting(true);
    try {
      // Determine sentiment based on rating
      let sentiment = null;
      if (rating) {
        if (rating >= 4) sentiment = "positive";
        else if (rating === 3) sentiment = "neutral";
        else sentiment = "negative";
      }

      await api.feedbackLogs.submit({
        conversationId,
        customerId,
        rating,
        sentiment,
        category: category || null,
        feedback,
        source: "chat",
      });

      alert("Thank you for your feedback!");
      onSubmitSuccess?.();
      handleClose();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(null);
    setHoveredRating(null);
    setCategory("");
    setFeedback("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <MessageSquare className="text-indigo-600" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Share Your Feedback
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={24} className="text-slate-600" />
            </button>
          </div>
          <p className="text-slate-600 mt-2 ml-14">
            Help us improve by sharing your experience
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Rating */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              How would you rate your experience?
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(null)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={40}
                    className={`${
                      star <= (hoveredRating || rating || 0)
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-slate-300"
                    } transition-colors`}
                  />
                </button>
              ))}
              {rating && (
                <span className="ml-3 text-lg font-semibold text-slate-700">
                  {rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Category (Optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback Text */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Your Feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your experience with us..."
              rows={5}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting || !feedback.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-indigo-200 transition-all"
            >
              <Send size={18} />
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
