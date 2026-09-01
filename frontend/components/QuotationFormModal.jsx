import React from "react";
import { PlusCircle, X, FileText } from "lucide-react";

const UOM_OPTIONS = ["Nos", "Units", "Pieces", "Boxes", "Sets", "Meters", "Kg", "Liters"];
const TAX_OPTIONS = [
  { value: "GST18", label: "GST 18%" },
  { value: "GST0", label: "GST 0%" },
];

// Default terms
const DEFAULT_TERMS = [
  "50% advance payment is required to initiate the project.",
  "Project confirmation will be made only after approval of the submitted proposal.",
  "Any additional requirements, modifications, or corrections beyond the agreed scope will be charged separately.",
  "The above-mentioned prices are exclusive of applicable taxes.",
  "GST @ 18% will be charged additionally as per government regulations."
];

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5">
      <div className="h-1 w-5 bg-[#0088CC] rounded" />
      <h3 className="text-xs font-bold text-[#0088CC] uppercase tracking-wide">{children}</h3>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  );
}

export default function QuotationFormModal({
  open,
  editId,
  clientSearch,
  clientDropdown,
  handleClientSearch,
  handleSelectClient,
  showClientDrop,
  customer,
  setCustomer,
  quotation,
  setQuotation,
  extra,
  setExtra,
  items,
  updateItem,
  addItem,
  removeItem,
  terms,
  setTerms,
  handleSubmit,
  resetForm,
  submitting,
  onSaveDraft,
}) {
  if (!open) return null;

  const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Get tax rate
  const getTaxRate = () => {
    if (extra.tax_type === "GST0") return 0;
    if (extra.tax_type === "GST5") return 5;
    if (extra.tax_type === "CUSTOM") return Number(extra.custom_tax) || 0;
    return 18;
  };

  const taxRate = getTaxRate();

  // Calculate item totals
  const calculateItemTotals = (item) => {
    const rate = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
    const discount = Number(item.discount) || 0;
    const tax = taxRate;

    const subtotal = (rate * qty) - discount;
    const taxValue = subtotal * (tax / 100);
    const amount = subtotal + taxValue;

    return { subtotal, taxValue, amount };
  };

  // Calculate grand totals
  const calculateGrandTotals = () => {
    let subtotal = 0;
    items.forEach(item => {
      const { subtotal: itemSubtotal } = calculateItemTotals(item);
      subtotal += itemSubtotal;
    });

    const cgst = subtotal * (taxRate / 200); // Half of tax rate
    const sgst = subtotal * (taxRate / 200); // Half of tax rate
    const netTotal = subtotal + cgst + sgst;

    return { subtotal, cgst, sgst, netTotal };
  };

  const totals = calculateGrandTotals();

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-center items-start overflow-y-auto pt-6 pb-10">
      <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-6xl p-7 relative">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">Create Quotation</h2>
          <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={resetForm} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* CLIENT DETAILS (TO ADDRESS) */}
          <div>
            <SectionTitle>CLIENT DETAILS (TO ADDRESS)</SectionTitle>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Search & Autocomplete Client Details
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => handleClientSearch(e.target.value)}
                    placeholder="Search client by name or company..."
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm flex-1 focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                  {clientSearch && (
                    <button type="button" onClick={() => handleClientSearch("")} className="text-gray-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
                {showClientDrop && clientDropdown.length > 0 && (
                  <div className="absolute z-20 bg-white border border-gray-200 shadow-lg rounded-lg mt-1 w-full max-h-48 overflow-y-auto">
                    {clientDropdown.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
                      >
                        <span className="font-semibold text-gray-800">{c.company_name || c.name}</span>
                        {c.phone && <span className="text-gray-400 ml-2 text-xs">📞 {c.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Company Name</label>
                  <input
                    type="text"
                    value={extra.client_company}
                    onChange={e => setExtra(ex => ({ ...ex, client_company: e.target.value }))}
                    placeholder="e.g. ABC Technologies"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customer.customer_name}
                    onChange={e => setCustomer({ ...customer, customer_name: e.target.value })}
                    placeholder="e.g. Ravi Kumar"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customer.mobile_number}
                    onChange={e => setCustomer({ ...customer, mobile_number: e.target.value })}
                    placeholder="e.g. 1234567890"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={e => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="e.g. ravi@example.com"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={extra.client_address1}
                    onChange={e => setExtra(ex => ({ ...ex, client_address1: e.target.value }))}
                    placeholder="Street / Building"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    value={extra.client_address2}
                    onChange={e => setExtra(ex => ({ ...ex, client_address2: e.target.value }))}
                    placeholder="Area / Landmark"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">City / District</label>
                  <input
                    type="text"
                    value={extra.client_city}
                    onChange={e => setExtra(ex => ({ ...ex, client_city: e.target.value }))}
                    placeholder="e.g. Chennai"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={extra.client_state}
                    onChange={e => setExtra(ex => ({ ...ex, client_state: e.target.value }))}
                    placeholder="e.g. Tamil Nadu"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={extra.client_pincode}
                    onChange={e => setExtra(ex => ({ ...ex, client_pincode: e.target.value }))}
                    placeholder="e.g. 600001"
                    maxLength={6}
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Country</label>
                  <input
                    type="text"
                    value={extra.client_country}
                    onChange={e => setExtra(ex => ({ ...ex, client_country: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Quotation Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={quotation.quotation_date}
                    onChange={e => setQuotation({ ...quotation, quotation_date: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Validity Period (e.g. 07-07-2026)
                  </label>
                  <input
                    type="date"
                    value={extra.validity_date || ""}
                    onChange={e => setExtra(ex => ({ ...ex, validity_date: e.target.value }))}
                    placeholder="07-07-2026"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TAX CONFIGURATION */}
          <div>
            <SectionTitle>TAX CONFIGURATION</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TAX_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition ${
                    extra.tax_type === opt.value ? "border-[#0088CC] bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="tax_type"
                    value={opt.value}
                    checked={extra.tax_type === opt.value}
                    onChange={e => setExtra(ex => ({ ...ex, tax_type: e.target.value }))}
                    className="accent-[#0088CC]"
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
            {taxRate > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                GST @ {taxRate}% will be calculated automatically on the quote items.
              </p>
            )}
          </div>

          {/* QUOTE ITEMS */}
          <div>
            <SectionTitle>QUOTE ITEMS</SectionTitle>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1000px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-gray-600 font-semibold uppercase text-[10px]">
                      <th className="px-3 py-3 text-center" style={{ width: "50px" }}>S.NO</th>
                      <th className="px-3 py-3 text-left" style={{ width: "100px" }}>HSN CODE</th>
                      <th className="px-3 py-3 text-left" style={{ width: "250px" }}>
                        PRODUCT / DESCRIPTION <span className="text-red-500">*</span>
                      </th>
                      <th className="px-3 py-3 text-center" style={{ width: "80px" }}>UOM</th>
                      <th className="px-3 py-3 text-center" style={{ width: "70px" }}>QTY</th>
                      <th className="px-3 py-3 text-right" style={{ width: "100px" }}>RATE (₹)</th>
                      {taxRate > 0 && <th className="px-3 py-3 text-right" style={{ width: "100px" }}>TAX VALUE</th>}
                      <th className="px-3 py-3 text-right" style={{ width: "120px" }}>AMOUNT (₹)</th>
                      <th className="px-3 py-3 text-center" style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const { taxValue, amount } = calculateItemTotals(item);
                      return (
                        <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.hsn_code || ""}
                              onChange={e => updateItem(i, "hsn_code", e.target.value)}
                              placeholder="HSN Code"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs outline-none focus:border-[#0088CC]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => updateItem(i, "name", e.target.value)}
                              placeholder="Product details"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs outline-none focus:border-[#0088CC]"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={item.uom}
                              onChange={e => updateItem(i, "uom", e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs outline-none focus:border-[#0088CC] bg-white"
                            >
                              {UOM_OPTIONS.map(u => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.qty}
                              onChange={e => updateItem(i, "qty", Number(e.target.value))}
                              min="1"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs outline-none text-center focus:border-[#0088CC]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.price}
                              onChange={e => updateItem(i, "price", Number(e.target.value))}
                              min="0"
                              step="0.01"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs outline-none text-right focus:border-[#0088CC]"
                            />
                          </td>
                          {taxRate > 0 && (
                            <td className="px-3 py-2 text-right font-medium text-gray-700">
                              ₹{fmtNum(taxValue)}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-bold text-gray-800">
                            ₹{fmtNum(amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(i)}
                                className="text-gray-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50"
                                title="Remove item"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 text-[#0088CC] font-semibold text-sm hover:underline"
                >
                  <PlusCircle size={16} /> Add Line Item
                </button>
              </div>
            </div>

            {/* Totals Section */}
            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal (Exclusive)</span>
                  <span className="font-semibold">₹{fmtNum(totals.subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>CGST ({taxRate / 2}%)</span>
                      <span className="font-semibold">₹{fmtNum(totals.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>SGST ({taxRate / 2}%)</span>
                      <span className="font-semibold">₹{fmtNum(totals.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold text-[#0088CC] border-t pt-2">
                  <span>Net Total</span>
                  <span>₹{fmtNum(totals.netTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* EXECUTIVE DETAILS */}
          <div>
            <SectionTitle>EXECUTIVE DETAILS</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Executive Name</label>
                <input
                  type="text"
                  value={extra.exec_name}
                  onChange={e => setExtra(ex => ({ ...ex, exec_name: e.target.value }))}
                  placeholder="e.g. Krishna Kumar"
                  className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Contact Number</label>
                <input
                  type="text"
                  value={extra.exec_phone}
                  onChange={e => setExtra(ex => ({ ...ex, exec_phone: e.target.value }))}
                  placeholder="e.g. +91 90036 63660"
                  className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email ID</label>
                <input
                  type="email"
                  value={extra.exec_email}
                  onChange={e => setExtra(ex => ({ ...ex, exec_email: e.target.value }))}
                  placeholder="biz@madhuratech.com"
                  className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                />
              </div>
            </div>
          </div>

          {/* TERMS & CONDITIONS (EDITABLE) */}
          <div>
            <SectionTitle>TERMS & CONDITIONS (EDITABLE)</SectionTitle>
            <div className="space-y-3">
              {terms.map((term, idx) => (
                <div key={idx} className="flex gap-2 items-start relative group">
                  <span className="text-xs font-semibold text-gray-500 mt-2 min-w-[60px]">TERM {idx + 1}</span>
                  <textarea
                    value={term}
                    onChange={e => {
                      const updated = [...terms];
                      updated[idx] = e.target.value;
                      setTerms(updated);
                    }}
                    rows={2}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC] resize-none"
                    placeholder={`Enter term ${idx + 1}...`}
                  />
                  {terms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 mt-2"
                      title="Remove Term"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTerms([...terms, ''])}
                className="text-xs font-bold text-[#0088CC] hover:text-[#006699] flex items-center gap-1 mt-2"
              >
                <PlusCircle size={14} /> Add Another Term
              </button>
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={resetForm}
              className="border border-gray-300 rounded-lg px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              className="border border-[#0088CC] text-[#0088CC] hover:bg-blue-50 rounded-lg px-6 py-2.5 text-sm font-semibold flex items-center gap-2"
            >
              <FileText size={15} /> Save Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#0088CC] hover:bg-[#006FA8] disabled:bg-gray-400 text-white rounded-lg px-8 py-2.5 text-sm font-semibold shadow-md"
            >
              {submitting ? "Saving..." : "Save Quotation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
