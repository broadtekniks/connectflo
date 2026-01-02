import React, { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import { api } from "../services/api";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
};

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.customers.list();
        setCustomers(
          data.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            avatar: c.avatar,
            createdAt: c.createdAt,
          }))
        );
      } catch (e) {
        console.error("Failed to load customers", e);
        setError(e instanceof Error ? e.message : "Failed to load customers");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">
            Customers in your tenant ({customers.length})
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-500 font-medium bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            customer.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              customer.name || "Customer"
                            )}`
                          }
                          alt={customer.name}
                          className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                        />
                        <span className="font-medium text-slate-900">
                          {customer.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {customer.email}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers;
