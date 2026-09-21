import React, { useEffect } from 'react';
import { X, Package, Wrench, UserCheck, Clock } from 'lucide-react';

const UOM_OPTIONS = ['Nos', 'Hours', 'Month', 'Year'];
const CATEGORIES = ['Software', 'SaaS', 'Website', 'Digital Product', 'Other'];
const BILLING_TYPES = ['One-time', 'Monthly', 'Yearly'];

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5">
      <div className="h-1 w-5 bg-[#0088CC] rounded" />
      <h3 className="text-xs font-bold text-[#0088CC] uppercase tracking-wide">{children}</h3>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  );
}

function TypePill({ selected, onClick, label, icon }) {
  const isSelected = selected === label;
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition ${
        isSelected ? 'border-[#0088CC] bg-blue-50 text-[#0088CC]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TogglePill({ selected, onClick, label }) {
  const isSelected = selected === label;
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
        isSelected ? 'border-[#0088CC] bg-blue-50 text-[#0088CC]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function SelectField({ label, required, value, onChange, options }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC] bg-white text-gray-800"
      >
        <option value="" disabled>Select {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function Field({ label, required, value, onChange, placeholder, type = 'text', min, step }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        min={min}
        step={step}
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC] text-gray-800"
      />
    </div>
  );
}

function TextareaField({ label, required, value, onChange, placeholder }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm resize-none focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC] text-gray-800"
      />
    </div>
  );
}

export default function ProductFormModal({ open, editId, product, setProduct, onSubmit, submitting, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  const handleReset = () => {
    if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center items-start overflow-y-auto pt-8 pb-10 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 md:p-8 relative border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-2">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Package size={22} className="text-[#0088CC]" />
            {editId ? 'Edit Product / Service' : 'Add Product / Service'}
          </h2>
          <button
            type="button"
            onClick={handleReset}
            className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {editId && (product.lastModifiedByName || product.createdByName) && (
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-blue-950 mb-3 mt-1">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-[#0088CC] shrink-0" />
              <span>
                Last changed by: <strong className="font-semibold text-gray-900">{product.lastModifiedByName || product.createdByName}</strong>
                {product.lastModifiedRole ? (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-white text-[#0088CC] border border-blue-200 rounded text-[10px] font-semibold">
                    {product.lastModifiedRole}
                  </span>
                ) : null}
              </span>
            </div>
            {(product.lastModifiedAt || product.createdAt) && (
              <span className="text-gray-500 text-[11px] flex items-center gap-1">
                <Clock size={12} className="text-gray-400" />
                {new Date(product.lastModifiedAt || product.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* BASIC INFO */}
          <div>
            <SectionTitle>BASIC INFORMATION</SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Item Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <TypePill
                    selected={product.item_type}
                    onClick={(val) => setProduct({ ...product, item_type: val })}
                    label="Product"
                    icon={<Package size={16} />}
                  />
                  <TypePill
                    selected={product.item_type}
                    onClick={(val) => setProduct({ ...product, item_type: val })}
                    label="Service"
                    icon={<Wrench size={16} />}
                  />
                </div>
              </div>

              <div>
                <Field
                  label="Item Name"
                  required
                  value={product.name}
                  onChange={(val) => setProduct({ ...product, name: val })}
                  placeholder={product.item_type === 'Product' ? 'E.g. CRM Software License' : 'E.g. Website Development'}
                />
              </div>
            </div>
          </div>

          {/* CODE & TAX */}
          <div>
            <SectionTitle>CODE & TAX</SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Field
                  label={product.item_type === 'Product' ? 'HSN Code' : 'SAC Code'}
                  value={product.hsn_sac_code}
                  onChange={(val) => setProduct({ ...product, hsn_sac_code: val })}
                  placeholder={product.item_type === 'Product' ? 'E.g. 8523' : 'E.g. 9983'}
                />
              </div>

              <div>
                <SelectField
                  label="UOM (Unit of Measurement)"
                  value={product.uom}
                  onChange={(val) => setProduct({ ...product, uom: val })}
                  options={UOM_OPTIONS}
                />
              </div>

              <div>
                <Field
                  label="Unit Rate (₹)"
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={product.rate}
                  onChange={(val) => setProduct({ ...product, rate: val })}
                  placeholder="E.g. 50000"
                />
              </div>

              <div>
                <Field
                  label="GST Rate (%)"
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={product.gst_rate}
                  onChange={(val) => setProduct({ ...product, gst_rate: val })}
                  placeholder="E.g. 18"
                />
              </div>
            </div>
          </div>

          {/* CLASSIFICATION */}
          <div>
            <SectionTitle>CLASSIFICATION</SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SelectField
                  label="Category"
                  value={product.category}
                  onChange={(val) => setProduct({ ...product, category: val })}
                  options={CATEGORIES}
                />
              </div>

              <div>
                <SelectField
                  label="Billing Type"
                  value={product.billing_type}
                  onChange={(val) => setProduct({ ...product, billing_type: val })}
                  options={BILLING_TYPES}
                />
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <SectionTitle>DESCRIPTION</SectionTitle>
            <TextareaField
              label="Description / Scope"
              value={product.description}
              onChange={(val) => setProduct({ ...product, description: val })}
              placeholder="Item description shown in quotations, proformas, and invoices..."
            />
          </div>

          {/* STATUS */}
          <div>
            <SectionTitle>STATUS</SectionTitle>
            <div className="flex gap-2">
              <TogglePill
                selected={product.status}
                onClick={(val) => setProduct({ ...product, status: val })}
                label="Active"
              />
              <TogglePill
                selected={product.status}
                onClick={(val) => setProduct({ ...product, status: val })}
                label="Inactive"
              />
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleReset}
              className="border border-gray-300 rounded-xl px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#0088CC] hover:bg-[#006FA8] disabled:bg-gray-400 text-white rounded-xl px-8 py-2.5 text-sm font-semibold shadow-md transition cursor-pointer flex items-center gap-2"
            >
              {submitting ? 'Saving...' : editId ? 'Save Changes' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}