import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  Clock,
  RefreshCw,
  Filter,
  BarChart3,
} from "lucide-react";
import { api } from "../services/api";
import { DateTime } from "luxon";

interface Feedback {
  id: string;
  rating: number | null;
  sentiment: string | null;
  category: string | null;
  feedback: string;
  source: string;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

interface FeedbackAnalytics {
  totalCount: number;
  averageRating: number;
  sentimentBreakdown: Array<{ sentiment: string; _count: number }>;
  categoryBreakdown: Array<{ category: string; _count: number }>;
}

const Feedback: React.FC = () => {
  const [feedbackLogs, setFeedbackLogs] = useState<Feedback[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAnalytics, setShowAnalytics] = useState(true);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (sentimentFilter !== "all") params.sentiment = sentimentFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;

      const [feedbackData, analyticsData] = await Promise.all([
        api.feedbackLogs.list(params),
        api.feedbackLogs.analytics(),
      ]);

      setFeedbackLogs(feedbackData.feedbackLogs || []);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [sentimentFilter, categoryFilter]);

  const formatDate = (isoString: string) => {
    const dt = DateTime.fromISO(isoString);
    return dt.toLocaleString(DateTime.DATETIME_MED);
  };

  const getSentimentIcon = (sentiment: string | null) => {
    if (!sentiment) return <Minus className="text-slate-400" size={18} />;
    switch (sentiment.toLowerCase()) {
      case "positive":
        return <TrendingUp className="text-green-600" size={18} />;
      case "negative":
        return <TrendingDown className="text-red-600" size={18} />;
      case "neutral":
        return <Minus className="text-slate-400" size={18} />;
      default:
        return <Minus className="text-slate-400" size={18} />;
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    if (!sentiment) return "bg-slate-100 text-slate-700";
    switch (sentiment.toLowerCase()) {
      case "positive":
        return "bg-green-100 text-green-700";
      case "negative":
        return "bg-red-100 text-red-700";
      case "neutral":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating)
      return <span className="text-slate-400 text-sm">No rating</span>;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={
              star <= rating
                ? "text-yellow-500 fill-yellow-500"
                : "text-slate-300"
            }
          />
        ))}
        <span className="ml-1 text-sm font-medium text-slate-700">
          ({rating}/5)
        </span>
      </div>
    );
  };

  const uniqueCategories =
    analytics?.categoryBreakdown
      .map((c) => c.category)
      .filter((c) => c !== null) || [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw
            className="mx-auto mb-4 animate-spin text-indigo-600"
            size={40}
          />
          <p className="text-slate-600">Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <MessageCircle size={28} />
              Customer Feedback
            </h1>
            <p className="text-slate-600 mt-1">
              {feedbackLogs.length}{" "}
              {feedbackLogs.length === 1 ? "response" : "responses"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              <BarChart3 size={16} />
              {showAnalytics ? "Hide" : "Show"} Analytics
            </button>
            <button
              onClick={loadFeedback}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Analytics Cards */}
        {showAnalytics && analytics && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Feedback */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">
                  Total Feedback
                </span>
                <MessageCircle className="text-indigo-500" size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {analytics.totalCount}
              </p>
            </div>

            {/* Average Rating */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">
                  Average Rating
                </span>
                <Star className="text-yellow-500 fill-yellow-500" size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {analytics.averageRating.toFixed(1)} / 5
              </p>
            </div>

            {/* Sentiment Breakdown */}
            {analytics.sentimentBreakdown.map((item) => (
              <div
                key={item.sentiment}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600 capitalize">
                    {item.sentiment || "Unknown"} Sentiment
                  </span>
                  {getSentimentIcon(item.sentiment)}
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {item._count}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">
              Sentiment:
            </span>
            <button
              onClick={() => setSentimentFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSentimentFilter("positive")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === "positive"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              Positive
            </button>
            <button
              onClick={() => setSentimentFilter("neutral")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === "neutral"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              Neutral
            </button>
            <button
              onClick={() => setSentimentFilter("negative")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sentimentFilter === "negative"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              Negative
            </button>
          </div>

          {uniqueCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                Category:
              </span>
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter === "all"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              {uniqueCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === category
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feedback List */}
        {feedbackLogs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <MessageCircle className="mx-auto mb-4 text-slate-400" size={48} />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No feedback found
            </h3>
            <p className="text-slate-600">
              {sentimentFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your filters."
                : "Customer feedback will appear here once submitted."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbackLogs.map((feedback) => (
              <div
                key={feedback.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Customer & Rating */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {feedback.customer ? (
                          <>
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User size={20} className="text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-800">
                                {feedback.customer.name}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {feedback.customer.email}
                              </p>
                            </div>
                          </>
                        ) : (
                          <h3 className="text-base font-semibold text-slate-800">
                            Anonymous
                          </h3>
                        )}
                      </div>
                      {renderStars(feedback.rating)}
                    </div>

                    {/* Sentiment & Category */}
                    <div className="flex items-center gap-2 mb-3">
                      {feedback.sentiment && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${getSentimentColor(
                            feedback.sentiment
                          )}`}
                        >
                          {getSentimentIcon(feedback.sentiment)}
                          {feedback.sentiment}
                        </span>
                      )}
                      {feedback.category && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                          {feedback.category}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                        {feedback.source}
                      </span>
                    </div>

                    {/* Feedback Text */}
                    <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {feedback.feedback}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={14} />
                      <span>{formatDate(feedback.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feedback;
