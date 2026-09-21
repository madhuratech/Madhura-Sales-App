import React, { useState, useEffect, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import {
  Package,
  Wrench,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  Tag,
  Filter,
  IndianRupee,
  AlertCircle
} from "lucide-react";
import api from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ProductFormModal from "../components/ProductFormModal";

const ALL_CATEGORIES = ['Software', 'SaaS', 'Consulting', 'Website', 'Digital Product', 'Other'];

const initialProductState = {
  item_type: "Product",
  name: "",
  hsn_sac_code: "",
  uom: "Nos",
  rate: "",
  gst_rate: 18,
  description: "",
  category: "Software",
  billing_type: "One-time",
  status: "Active",
};

export default function ProductScreenWeb() {
  const [role, setRole] = useState("Field Executive");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All"); // All | Product | Service
  const [statusFilter, setStatusFilter] = useState("All"); // All | Active | Inactive
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [product, setProduct] = useState(initialProductState);

  // Delete Dialog State
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast / Feedback message
  const [feedback, setFeedback] = useState(null);

  const showFeedback = (msg, type = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(res.data || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      const errMsg = err.response?.data?.message || err.message || "Failed to fetch products";
      showFeedback(errMsg, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          if (u.role) setRole(u.role);
        }
      } catch (err) {
        console.error("Error reading stored user:", err);
      }
    };
    loadUser();
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setProduct(initialProductState);
    setEditId(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setProduct({
      item_type: item.item_type || "Product",
      name: item.name || "",
      hsn_sac_code: item.hsn_sac_code || "",
      uom: item.uom || "Nos",
      rate: item.rate !== undefined ? item.rate : "",
      gst_rate: item.gst_rate !== undefined ? item.gst_rate : 18,
      description: item.description || "",
      category: item.category || "Software",
      billing_type: item.billing_type || "One-time",
      status: item.status || "Active",
    });
    setEditId(item._id);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!product.name || !product.name.trim()) {
      showFeedback("Item Name is required.", "error");
      return;
    }
    if (!product.item_type) {
      showFeedback("Item Type is required.", "error");
      return;
    }
    if (product.rate === "" || product.rate === null || product.rate === undefined) {
      showFeedback("Rate is required.", "error");
      return;
    }
    if (Number(product.rate) < 0) {
      showFeedback("Rate must be >= 0.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        item_type: product.item_type,
        name: product.name.trim(),
        hsn_sac_code: product.hsn_sac_code || "",
        uom: product.uom || "Nos",
        rate: Number(product.rate) || 0,
        gst_rate: Number(product.gst_rate) || 0,
        description: product.description || "",
        category: product.category || "",
        billing_type: product.billing_type || "One-time",
        status: product.status || "Active",
      };

      if (editId) {
        await api.put(`/products/${editId}`, payload);
        showFeedback("Item updated successfully!");
      } else {
        await api.post("/products", payload);
        showFeedback("Item added to catalog successfully!");
      }

      setModalOpen(false);
      setEditId(null);
      fetchProducts();
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to save item.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteCandidate._id}`);
      showFeedback(`"${deleteCandidate.name}" deleted successfully.`);
      setDeleteCandidate(null);
      fetchProducts();
    } catch (err) {
      showFeedback(err.response?.data?.message || "Failed to delete item.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // KPIs
  const totalCount = products.length;
  const productCount = products.filter((p) => p.item_type === "Product").length;
  const serviceCount = products.filter((p) => p.item_type === "Service").length;
  const activeCount = products.filter((p) => p.status === "Active").length;

  // Filtered List
  const filteredProducts = products.filter((item) => {
    const matchesSearch =
      (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hsn_sac_code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "All" || item.item_type === typeFilter;
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;

    return matchesSearch && matchesType && matchesStatus && matchesCategory;
  });

  const allAvailableCategories = Array.from(new Set([...ALL_CATEGORIES, ...products.map((p) => p.category).filter(Boolean)]));

  return (
    <AppLayout currentScreen="Product" role={role} scrollable={true}>
      <div
        className="p-6 max-w-7xl mx-auto w-full"
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif',
        }}
      >
        {/* Feedback Alert Toast */}
        {feedback && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition animate-in slide-in-from-top-4 duration-200 ${
              feedback.type === "error"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {feedback.type === "error" ? (
              <AlertCircle size={18} className="text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0088CC] mb-1">
              <Layers size={14} /> Catalog Management
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Package className="text-[#0088CC]" size={26} /> Products & Services
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Standardize your billable items, HSN/SAC codes, and GST tax rates for quotes and invoices.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProducts}
              className="border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 px-3.5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition shadow-xs cursor-pointer"
              title="Refresh catalog"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-[#0088CC]" : "text-gray-500"} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="bg-[#0088CC] hover:bg-[#006FA8] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus size={16} /> Add Product / Service
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
              <Layers size={22} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{productCount}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0088CC]">
              <Package size={22} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Services</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{serviceCount}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wrench size={22} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Status</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-gray-900">{activeCount}</span>
                <span className="text-xs text-gray-400 font-medium">/ {totalCount} active</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50/70 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 mb-6 flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Search products by name, HSN/SAC code, category, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 outline-none text-gray-800 placeholder-gray-400 focus:bg-white focus:border-[#0088CC] focus:ring-2 focus:ring-[#0088CC]/10 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1.5 py-0.5 rounded bg-gray-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
            {["All", "Product", "Service"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex-1 md:flex-initial text-center ${
                  typeFilter === t
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t === "All" ? "All Items" : t + "s"}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 outline-none focus:border-[#0088CC]"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-40">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 outline-none focus:border-[#0088CC]"
            >
              <option value="All">All Categories</option>
              {allAvailableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-16 text-center">
            <RefreshCw className="animate-spin inline-block text-[#0088CC] mb-3" size={32} />
            <p className="text-sm font-medium text-gray-600">Loading catalog items...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#0088CC] flex items-center justify-center mx-auto mb-4">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {searchTerm || typeFilter !== "All" || statusFilter !== "All"
                ? "No matching products or services"
                : "Your catalog is empty"}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              {searchTerm || typeFilter !== "All" || statusFilter !== "All"
                ? "Try adjusting your search criteria or filters to locate items."
                : "Add items to your catalog to streamline quotation, proforma, and invoice line creation."}
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="bg-[#0088CC] hover:bg-[#006FA8] text-white px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 transition cursor-pointer"
            >
              <Plus size={16} /> Add First Item
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Item Details</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">HSN / SAC</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">UOM</th>
                    <th className="py-3.5 px-4 text-right">Unit Rate (₹)</th>
                    <th className="py-3.5 px-4 text-center">GST %</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredProducts.map((item, idx) => (
                    <tr
                      key={item._id}
                      className="hover:bg-blue-50/30 transition duration-100 group"
                    >
                      <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 leading-snug">{item.name}</div>
                        {item.description ? (
                          <p
                            className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-md"
                            title={item.description}
                          >
                            {item.description}
                          </p>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            item.item_type === "Product"
                              ? "bg-blue-50 text-[#0088CC] border border-blue-100"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}
                        >
                          {item.item_type === "Product" ? (
                            <Package size={13} />
                          ) : (
                            <Wrench size={13} />
                          )}
                          {item.item_type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {item.hsn_sac_code ? (
                          <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {item.hsn_sac_code}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-gray-800">
                          {item.category || "—"}
                        </div>
                        {item.billing_type && (
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">
                            {item.billing_type}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-gray-600">
                        {item.uom || "Nos"}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 font-mono">
                        ₹{Number(item.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {item.gst_rate ?? 18}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-100 text-gray-500 border border-gray-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === "Active" ? "bg-emerald-500" : "bg-gray-400"
                            }`}
                          />
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-gray-500 hover:text-[#0088CC] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(item)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="py-3 px-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> items
              </span>
              <span className="text-[11px] text-gray-400">
                Sorted by latest created
              </span>
            </div>
          </div>
        )}

        {/* Product Form Modal */}
        <ProductFormModal
          open={modalOpen}
          editId={editId}
          product={product}
          setProduct={setProduct}
          onSubmit={handleSubmit}
          submitting={submitting}
          onClose={() => {
            setModalOpen(false);
            setEditId(null);
          }}
        />

        {/* Delete Confirmation Modal */}
        {deleteCandidate && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center items-center p-4 animate-in fade-in duration-100">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Product / Service?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete <strong className="text-gray-900">"{deleteCandidate.name}"</strong>? This will remove it from the product catalog.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteCandidate(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Deleting...
                    </>
                  ) : (
                    "Yes, Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
