import React from 'react';
import { UploadCloud, FileText, Check, RefreshCw } from 'lucide-react';

const KnowledgeBase: React.FC = () => {
  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
            <p className="text-slate-500 mt-1">Manage documents and FAQs to train your AI assistant.</p>
        </div>

        <div className="space-y-6">
            <div className="bg-white p-10 rounded-xl border border-slate-200 border-dashed text-center hover:border-indigo-400 transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500 group-hover:scale-110 transition-transform">
                    <UploadCloud size={32} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1">Upload Documents</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">Drag and drop PDF, DOCX, or TXT files here to train your AI agent on company policies, product manuals, and FAQs.</p>
                <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                    Select Files
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Indexed Documents</h3>
                    <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">1.2 MB Used</span>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="text-slate-500 font-medium bg-white border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3 font-semibold">Name</th>
                            <th className="px-6 py-3 font-semibold">Status</th>
                            <th className="px-6 py-3 font-semibold">Last Updated</th>
                            <th className="px-6 py-3 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <div className="p-2 bg-red-50 rounded text-red-500">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <span className="font-medium text-slate-700 block">Refund_Policy_2024.pdf</span>
                                    <span className="text-xs text-slate-400">145 KB</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                    <Check size={10} /> Ready
                                    </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">Oct 24, 2024</td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-indigo-600 hover:underline font-medium">Edit</button>
                            </td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded text-blue-500">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <span className="font-medium text-slate-700 block">Product_Catalog_v2.docx</span>
                                    <span className="text-xs text-slate-400">2.4 MB</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                    <RefreshCw size={10} className="animate-spin" /> Indexing
                                    </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">Just now</td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-slate-400 hover:text-slate-600 font-medium">Cancel</button>
                            </td>
                            </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;