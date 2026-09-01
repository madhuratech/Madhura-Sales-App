import React from "react";
import { PlusCircle, X, RefreshCw, Eye, FileText } from "lucide-react";

const UOM_OPTIONS = ["Lumpsum", "Nos", "Units", "Pieces", "Sets", "Meters", "Kg", "Liters", "Hours"];
const SERVICE_TYPES = ["CRM", "WEBSITE", "DM", "POSTERS"];

export default function TaxInvoiceFormModal({
  open,
  editId,
  clientSearch,
  clientDropdown,
  handleClientSearch,
  handleSelectClient,
  showClientDrop,
  serviceType,
  handleServiceTypeChange,
  header,
  setHeader,
  items,
  updateItem,
  addItem,
  removeItem,
  subtotal,
  cgst,
  sgst,
  grandTotal,
  netPayable,
  handleSubmit,
  handleRefresh,
  resetForm,
  submitting,
  onSaveDraft,
  aggregatedData,
  setItems,
}) {
  if (!open) return null;

  const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

  const handleSelectQuotation = (e) => {
    const qId = e.target.value;
    if (!qId) return;
    const q = aggregatedData?.quotations?.find(x => x._id === qId);
    if (q && q.items) {
      setItems(q.items.map((item, index) => ({
        sl_no: index + 1,
        description: item.description || "",
        sac_code: item.hsn_code || "",
        uom: item.uom || "Nos",
        quantity: item.quantity || 1,
        total_amount: item.subtotal || 0,
      })));
    }
  };

  const handleSelectProforma = (e) => {
    const pId = e.target.value;
    if (!pId) return;
    const p = aggregatedData?.proformaInvoices?.find(x => x._id === pId);
    if (p && p.items) {
      setItems(p.items.map((item, index) => ({
        sl_no: index + 1,
        description: item.description || "",
        sac_code: item.hsn_code || "",
        uom: item.uom || "Nos",
        quantity: item.quantity || 1,
        total_amount: item.subtotal || 0,
      })));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-center items-start overflow-y-auto pt-6 pb-10">
      <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-5xl p-7 relative">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-[#0088CC]">Create Madhura Invoice</h2>
          <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={resetForm} />
        </div>
        <p className="text-xs text-gray-400 mb-5">Blue fields are auto-generated — you can still edit them manually.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* CLIENT INFORMATION */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-6 bg-[#0088CC] rounded" />
              <h3 className="text-xs font-bold text-[#0088CC] uppercase tracking-wide">CLIENT INFORMATION</h3>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Search & Select Client</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => handleClientSearch(e.target.value)}
                    placeholder="Type client name or company..."
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
                    value={header.client_company}
                    onChange={e => setHeader(h => ({ ...h, client_company: e.target.value }))}
                    placeholder="e.g. Acme Communication"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={header.client_name}
                    onChange={e => setHeader(h => ({ ...h, client_name: e.target.value }))}
                    placeholder="e.g. Ravi Kumar"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Address</label>
                <textarea
                  value={header.client_address}
                  onChange={e => setHeader(h => ({ ...h, client_address: e.target.value }))}
                  placeholder="e.g. 436 H Avinashi Road, Coimbatore, Tamil Nadu - 641004"
                  rows={2}
                  className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">GSTIN</label>
                <input
                  type="text"
                  value={header.client_gstin}
                  onChange={e => setHeader(h => ({ ...h, client_gstin: e.target.value }))}
                  placeholder="e.g. 33AAHFA7876M1ZX"
                  className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                />
              </div>

              {aggregatedData && (aggregatedData.quotations?.length > 0 || aggregatedData.proformaInvoices?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  {aggregatedData.quotations?.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-[#0088CC] uppercase mb-1">Auto-fill from Quotation</label>
                      <select
                        onChange={handleSelectQuotation}
                        defaultValue=""
                        className="border border-blue-200 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white focus:border-[#0088CC]"
                      >
                        <option value="">-- Select Quotation --</option>
                        {aggregatedData.quotations.map(q => (
                          <option key={q._id} value={q._id}>
                            {q.reference_no || q._id.slice(-6)} - {new Date(q.quotation_date).toLocaleDateString()} (₹{fmtNum(q.grand_total)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {aggregatedData.proformaInvoices?.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-[#0088CC] uppercase mb-1">Auto-fill from Proforma</label>
                      <select
                        onChange={handleSelectProforma}
                        defaultValue=""
                        className="border border-blue-200 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white focus:border-[#0088CC]"
                      >
                        <option value="">-- Select Proforma Invoice --</option>
                        {aggregatedData.proformaInvoices.map(p => (
                          <option key={p._id} value={p._id}>
                            {p.reference_no || p.invoice_no || p._id.slice(-6)} - {new Date(p.invoice_date).toLocaleDateString()} (₹{fmtNum(p.grand_total)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* INVOICE DETAILS */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-6 bg-[#0088CC] rounded" />
              <h3 className="text-xs font-bold text-[#0088CC] uppercase tracking-wide">INVOICE DETAILS</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Service Type</label>
                <div className="flex gap-2 flex-wrap">
                  {SERVICE_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleServiceTypeChange(type)}
                      className={`px-6 py-2 rounded-lg font-semibold text-sm transition ${
                        serviceType === type
                          ? "bg-[#0088CC] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="ml-auto px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-2"
                    title="Refresh auto-generated fields"
                  >
                    <RefreshCw size={14} /> Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">
                    Service No <span className="text-[10px] font-normal">(auto)</span>
                  </label>
                  <input
                    type="text"
                    value={header.service_no}
                    onChange={e => setHeader(h => ({ ...h, service_no: e.target.value }))}
                    className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 outline-none text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">
                    Invoice No <span className="text-[10px] font-normal">(auto)</span> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={header.invoice_no}
                    onChange={e => setHeader(h => ({ ...h, invoice_no: e.target.value }))}
                    className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 outline-none text-sm w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">
                    Client Code <span className="text-[10px] font-normal">(auto)</span>
                  </label>
                  <input
                    type="text"
                    value={header.client_code}
                    onChange={e => setHeader(h => ({ ...h, client_code: e.target.value }))}
                    className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 outline-none text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">
                    Running Bill No <span className="text-[10px] font-normal">(auto)</span>
                  </label>
                  <input
                    type="text"
                    value={header.running_bill_no}
                    onChange={e => setHeader(h => ({ ...h, running_bill_no: e.target.value }))}
                    className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 outline-none text-sm w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Bill Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={header.bill_date}
                    onChange={e => setHeader(h => ({ ...h, bill_date: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Advance Amount Received (INR)
                  </label>
                  <input
                    type="number"
                    value={header.advance_amount}
                    onChange={e => setHeader(h => ({ ...h, advance_amount: Number(e.target.value) }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full focus:border-[#0088CC] focus:ring-1 focus:ring-[#0088CC]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* LINE ITEMS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-1 w-6 bg-[#0088CC] rounded" />
                <h3 className="text-xs font-bold text-[#0088CC] uppercase tracking-wide">LINE ITEMS</h3>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-[#0088CC] font-semibold text-xs hover:underline"
              >
                <PlusCircle size={14} /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-500 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        placeholder="Item description"
                        className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">SAC/HSN Code</label>
                      <input
                        type="text"
                        value={item.sac_code || ""}
                        onChange={e => updateItem(i, "sac_code", e.target.value)}
                        placeholder="SAC/HSN Code"
                        className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">UOM</label>
                      <select
                        value={item.uom}
                        onChange={e => updateItem(i, "uom", e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white"
                      >
                        {UOM_OPTIONS.map(u => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", Number(e.target.value))}
                        min="1"
                        className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Total Amount (INR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={item.total_amount}
                      onChange={e => updateItem(i, "total_amount", Number(e.target.value))}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="border border-gray-300 rounded-lg px-3 py-2 outline-none text-sm w-full bg-white"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TOTALS SUMMARY */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
            <div className="max-w-md ml-auto space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold">₹{fmtNum(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>CGST 9%</span>
                <span className="font-semibold">₹{fmtNum(cgst)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>SGST 9%</span>
                <span className="font-semibold">₹{fmtNum(sgst)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-800 border-t pt-2">
                <span>Grand Total</span>
                <span>₹{fmtNum(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#0088CC]">
                <span>Net Payable</span>
                <span>₹{fmtNum(netPayable)}</span>
              </div>
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
              className="bg-[#0088CC] hover:bg-[#006FA8] disabled:bg-gray-400 text-white rounded-lg px-8 py-2.5 text-sm font-semibold shadow-md flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <><Eye size={16} /> Save & Preview</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
