import React, { useState, useEffect, useRef } from "react";
import AppLayout from "../components/AppLayout";
import { Plus, Search, Download, X, Edit2, Trash2, Mail, RefreshCw, Eye, FileText, History } from "lucide-react";
import api from "../services/api";
import AsyncStorage from '@react-native-async-storage/async-storage';
import InvoiceTemplate from "../components/invoicetemplate.web";
import ProformaInvoiceFormModal from "../components/ProformaInvoiceFormModal";
import DraftModal from "../components/DraftModal";
import RevisionHistoryModal from "../components/RevisionHistoryModal";
import { getDrafts, saveDraft, removeDraft, clearDrafts } from "../utils/drafts";

const UOM_OPTIONS = ["Nos", "Units", "Pieces", "Boxes", "Sets", "Meters", "Kg", "Liters"];

const defaultTerms = [
  "50% advance payment is required to initiate the project.",
  "Project confirmation will be made only after approval of the submitted proposal.",
  "Any additional requirements, modifications, or corrections beyond the agreed scope will be charged separately.",
  "The above-mentioned prices are exclusive of applicable taxes.",
  "GST @ 18% will be charged additionally as per government regulations."
];

const emptyExtra = () => ({
  client_company: "", client_address1: "", client_address2: "",
  client_city: "", client_state: "", client_pincode: "", client_country: "India", client_gstin: "",
  tax_type: "GST18", custom_tax: "",
  exec_name: "", exec_phone: "", exec_email: "",
  validity_date: "",
  terms_json: JSON.stringify(defaultTerms)
});

export default function ProformaInvoiceScreenWeb() {
  const [role, setRole] = useState("Field Executive");
  const [performaInvoices, setPerformaInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [showinvoice, setShowInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Email state
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailSending, setMailSending] = useState(false);

  // Revision history state
  const [revOpen, setRevOpen] = useState(false);
  const [revDocId, setRevDocId] = useState(null);

  // Client Search Autocomplete
  const [clientSearch, setClientSearch] = useState("");
  const [clientList, setClientList] = useState([]);
  const [showClientDrop, setShowClientDrop] = useState(false);

  // Form Fields
  const [items, setItems] = useState([{ hsn_code: "", name: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
  const [customer, setCustomer] = useState({ customer_name: "", mobile_number: "", email: "", location_city: "" });
  const [performaInvoice, setPerformaInvoice] = useState({ invoice_date: new Date().toISOString().slice(0, 10) });
  const [extra, setExtra] = useState(emptyExtra());
  const [terms, setTerms] = useState(defaultTerms);

  // Draft states
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [msg, setMsg] = useState(null);
  const draftsPromptedRef = useRef(false);

  const notify = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2600);
  };

  const refreshDrafts = async () => {
    const list = await getDrafts("proforma");
    setDrafts(list);
    return list;
  };

  const invoiceRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) setRole(JSON.parse(stored).role);
      fetchPerformaInvoices();
      fetchQuotations();
      refreshDrafts();

      try {
        const savedTerms = await AsyncStorage.getItem('lastPI_Terms');
        if (savedTerms) {
          const parsed = JSON.parse(savedTerms);
          setTerms(parsed);
          setExtra(prev => ({ ...prev, terms_json: savedTerms }));
        }
      } catch (e) {}
    };
    load();
  }, []);

  const fetchPerformaInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get("/performainvoice");
      setPerformaInvoices(res.data);
    } catch (err) {
      console.warn("Error fetching performa invoices:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async () => {
    try {
      const res = await api.get("/crm-quotations");
      setQuotations(res.data);
    } catch (err) {
      console.warn("Error fetching quotations:", err.message);
    }
  };

  // Client Autocomplete
  const handleClientSearch = async (val) => {
    setClientSearch(val);
    if (!val.trim()) { setClientList([]); setShowClientDrop(false); return; }
    try {
      const res = await api.get(`/client/search?name=${encodeURIComponent(val)}`);
      setClientList(res.data);
      setShowClientDrop(true);
    } catch {
      setClientList([]);
    }
  };

  const selectClient = (client) => {
    setClientSearch(client.company_name || client.name);
    setExtra(prev => ({
      ...prev,
      client_company: client.company_name || '',
      client_address1: client.address1 || '',
      client_address2: client.address2 || '',
      client_city: client.city || '',
      client_state: client.state || '',
      client_pincode: client.pincode || '',
      client_gstin: client.gstin || ''
    }));
    setCustomer({
      customer_name: client.name,
      mobile_number: client.phone,
      email: client.email || '',
      location_city: client.city || ''
    });
    setClientList([]);
    setShowClientDrop(false);
  };

  const handleSelectQuotation = async (quotationId) => {
    if (!quotationId) return;
    try {
      const res = await api.get(`/crm-quotations/${quotationId}`);
      const rows = res.data;
      if (rows.length > 0) {
        const h = rows[0];
        
        setCustomer({ 
          customer_name: h.customer_name, 
          mobile_number: h.mobile_number, 
          email: h.email, 
          location_city: h.location_city 
        });
        
        setExtra(prev => ({
          ...prev,
          client_company: h.client_company || '',
          client_address1: h.client_address1 || '',
          client_address2: h.client_address2 || '',
          client_city: h.client_city || '',
          client_state: h.client_state || '',
          client_pincode: h.client_pincode || '',
          client_gstin: h.client_gstin || '',
          tax_type: h.tax_type || 'GST18',
          custom_tax: h.custom_tax || '',
          exec_name: h.exec_name || '',
          exec_phone: h.exec_phone || '',
          exec_email: h.exec_email || '',
          validity_date: h.validity_date || '',
        }));
        
        const loadedItems = rows.map(r => ({
          hsn_code: r.hsn_code || "",
          name: r.description,
          uom: r.uom || "Nos",
          price: Number(r.price) || 0,
          qty: Number(r.quantity) || 1,
          tax: Number(r.tax) || 18,
          discount: Number(r.discount) || 0
        }));
        setItems(loadedItems);

        // Load terms if available
        let parsedTerms = defaultTerms;
        try {
          if (h.terms_json) parsedTerms = JSON.parse(h.terms_json);
        } catch (_) {}
        setTerms(parsedTerms);
      }
    } catch (err) {
      alert("Error loading quotation data");
      console.error(err);
    }
  };

  const handleEdit = async (id) => {
    try {
      const res = await api.get(`/performainvoice/${id}`);
      const rows = res.data;
      const h = rows[0];
      
      setCustomer({ 
        customer_name: h.customer_name, 
        mobile_number: h.mobile_number, 
        email: h.email, 
        location_city: h.location_city 
      });
      
      setPerformaInvoice({ 
        invoice_date: h.invoice_date?.split("T")[0] || "" 
      });
      
      const loadedItems = rows.map(r => ({
        hsn_code: r.hsn_code || "",
        name: r.description,
        uom: r.uom || "Nos",
        price: Number(r.price) || 0,
        qty: Number(r.quantity) || 1,
        tax: Number(r.tax) || 18,
        discount: Number(r.discount) || 0
      }));
      setItems(loadedItems);

      let parsedTerms = defaultTerms;
      try {
        if (h.terms_json) parsedTerms = JSON.parse(h.terms_json);
      } catch (_) {}
      setTerms(parsedTerms);

      setExtra({
        client_company: h.client_company || "",
        client_address1: h.client_address1 || "",
        client_address2: h.client_address2 || "",
        client_city: h.client_city || "",
        client_state: h.client_state || "",
        client_pincode: h.client_pincode || "",
        client_country: h.client_country || "India",
        client_gstin: h.client_gstin || "",
        tax_type: h.tax_type || "GST18",
        custom_tax: h.custom_tax || "",
        exec_name: h.exec_name || "",
        exec_phone: h.exec_phone || "",
        exec_email: h.exec_email || "",
        validity_date: h.validity_date || "",
        terms_json: h.terms_json || JSON.stringify(parsedTerms)
      });
      
      setClientSearch(h.client_company || h.customer_name || "");
      setEditId(id);
      setOpen(true);
    } catch (err) {
      alert("Failed to load invoice details");
    }
  };

  const getTaxRate = () => {
    if (extra.tax_type === "GST0") return 0;
    if (extra.tax_type === "GST5") return 5;
    if (extra.tax_type === "CUSTOM") return Number(extra.custom_tax) || 0;
    return 18;
  };

  const calculateItemTotals = (item) => {
    const rate = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
    const discount = Number(item.discount) || 0;
    const tax = getTaxRate();

    const subtotal = (rate * qty) - discount;
    const taxValue = subtotal * (tax / 100);
    const amount = subtotal + taxValue;

    return { subtotal, taxValue, amount };
  };

  const calculateGrandTotals = () => {
    const taxRate = getTaxRate();
    let subtotal = 0;
    
    items.forEach(item => {
      const { subtotal: itemSubtotal } = calculateItemTotals(item);
      subtotal += itemSubtotal;
    });

    const cgst = subtotal * (taxRate / 200);
    const sgst = subtotal * (taxRate / 200);
    const grandTotal = subtotal + cgst + sgst;

    return { subtotal, cgst, sgst, grandTotal };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!performaInvoice.invoice_date) return alert("Please select date");
    if (items.some(i => !i.name.trim())) return alert("Description cannot be empty");

    setSubmitting(true);
    try {
      const taxRate = getTaxRate();
      const totals = calculateGrandTotals();
      
      const payload = {
        customer,
        performaInvoice: {
          invoice_date: performaInvoice.invoice_date,
          subtotal: totals.subtotal,
          total_discount: items.reduce((sum, i) => sum + (Number(i.discount) || 0), 0),
          total_cgst: totals.cgst,
          total_sgst: totals.sgst,
          total_tax: totals.cgst + totals.sgst,
          grand_total: totals.grandTotal
        },
        items: items.map(i => ({
          hsn_code: i.hsn_code || "",
          description: i.name,
          brand_model: i.brand_model || "",
          uom: i.uom,
          price: i.price,
          quantity: i.qty,
          tax: taxRate,
          discount: i.discount,
          subtotal: calculateItemTotals(i).subtotal
        })),
        extra: {
          ...extra,
          terms_json: JSON.stringify(terms)
        }
      };

      if (editId) {
        await api.put(`/performainvoice/${editId}`, payload);
        alert("Updated successfully");
      } else {
        await api.post("/performainvoice/create", payload);
        alert("Created successfully");
      }
      
      await AsyncStorage.setItem('lastPI_Terms', JSON.stringify(terms));
      if (currentDraftId) {
        await removeDraft("proforma", currentDraftId);
        setCurrentDraftId(null);
      }
      refreshDrafts();
      setOpen(false);
      resetForm();
      fetchPerformaInvoices();
    } catch (err) {
      console.error(err);
      alert("Error saving Performa Invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = async () => {
    setCustomer({ customer_name: "", mobile_number: "", email: "", location_city: "" });
    setItems([{ hsn_code: "", name: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
    setPerformaInvoice({ invoice_date: new Date().toISOString().slice(0, 10) });
    setExtra(emptyExtra());
    
    try {
      const savedTerms = await AsyncStorage.getItem('lastPI_Terms');
      if (savedTerms) {
        setTerms(JSON.parse(savedTerms));
        setExtra(prev => ({ ...prev, terms_json: savedTerms }));
      } else {
        setTerms(defaultTerms);
      }
    } catch (e) {
      setTerms(defaultTerms);
    }

    setClientSearch("");
    setEditId(null);
    setOpen(false);
  };

  const handleSaveDraft = async () => {
    const payload = {
      customer,
      performaInvoice,
      extra,
      items,
      terms,
      clientSearch,
    };
    const summary = {
      label: performaInvoice.invoice_date
        ? `Proforma · ${performaInvoice.invoice_date}`
        : "Proforma draft",
      customer: customer.customer_name || "",
      company: extra.client_company || "",
    };
    const draft = await saveDraft("proforma", payload, summary);
    setCurrentDraftId(draft.id);
    await refreshDrafts();
    draftsPromptedRef.current = false;
    notify("Draft saved — you can leave and resume anytime");
  };

  const handleLoadDraft = async (draft) => {
    const d = (draft && draft.payload) || {};
    setCustomer({ customer_name: "", mobile_number: "", email: "", location_city: "", ...(d.customer || {}) });
    setPerformaInvoice({ invoice_date: new Date().toISOString().slice(0, 10), ...(d.performaInvoice || {}) });
    setExtra({ ...emptyExtra(), ...(d.extra || {}) });
    setItems((d.items && d.items.length ? d.items : [{ hsn_code: "", name: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]));
    setTerms(Array.isArray(d.terms) && d.terms.length ? d.terms : defaultTerms);
    setClientSearch(d.clientSearch || "");
    setCurrentDraftId(draft.id);
    setEditId(null);
    setShowDrafts(false);
    setOpen(true);
    notify("Draft loaded");
  };

  const handleDeleteDraft = async (id) => {
    await removeDraft("proforma", id);
    if (currentDraftId === id) setCurrentDraftId(null);
    await refreshDrafts();
  };

  const handleClearDrafts = async () => {
    await clearDrafts("proforma");
    setCurrentDraftId(null);
    await refreshDrafts();
  };

  const handleStartNewDraft = async () => {
    setCurrentDraftId(null);
    setShowDrafts(false);
    await resetForm();
    setOpen(true);
  };

  const openCreate = async () => {
    const dl = await refreshDrafts();
    await resetForm();
    setEditId(null);
    setOpen(true);
    if (dl.length > 0 && !draftsPromptedRef.current) {
      setShowDrafts(true);
      draftsPromptedRef.current = true;
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return alert("Select an item to delete");
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/performainvoice/${selectedId}`);
      setSelectedId(null);
      fetchPerformaInvoices();
    } catch (error) {
      console.error(error);
    }
  };

  const openMailModal = () => {
    if (!selectedId) return alert("Select an invoice to send");
    const inv = performaInvoices.find(p => p.id === selectedId);
    setMailTo(inv?.email || "");
    setMailSubject(`Proforma Invoice ${formatPINumber(selectedId, inv?.invoice_date)}`);
    setMailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!mailTo) return alert("Please enter recipient email");
    setMailSending(true);
    try {
      await api.post(`/performainvoice/send-email/${selectedId}`, { to: mailTo, subject: mailSubject });
      alert("Email sent successfully");
      setMailOpen(false);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to send email");
    } finally {
      setMailSending(false);
    }
  };

  const downloadPDF = async () => {
    const el = document.getElementById("pi-pdf-content");
    if (!el) return alert("Invoice content not ready");
    const inv = performaInvoices.find(p => p.id === viewId);
    const filename = `ProformaInvoice_${formatPINumber(viewId, inv?.invoice_date)}.pdf`;

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    // Template renders at exactly 794×1123px (A4 at 96dpi)
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      height: 1123,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    // Place image to fill full A4 (210×297mm) edge to edge
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 210, 297);
    pdf.save(filename);
  };

  const updateItem = (i, field, value) => {
    const copy = [...items];
    copy[i][field] = value;
    setItems(copy);
  };

  const addItem = () => {
    setItems(p => [...p, { hsn_code: "", name: "", uom: "Nos", price: 0, qty: 1, tax: getTaxRate(), discount: 0 }]);
  };

  const removeItem = (idx) => {
    if (items.length <= 1) return;
    if (typeof idx === 'number') {
      setItems(prev => prev.filter((_, i) => i !== idx));
    } else {
      setItems(prev => prev.slice(0, -1));
    }
  };

  const formatPINumber = (id, dateStr) => {
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    return `PI-${year}-${String(id).slice(-3)}`;
  };

  const filteredInvoices = performaInvoices.filter(q =>
    q.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.reference_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout currentScreen="ProformaInvoice" role={role} scrollable={true}>
      <div 
        className="p-6 max-w-7xl mx-auto w-full"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif' }}
      >
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={24} /> Proforma Invoices
          </h2>
          <div className="flex gap-2">
            <button onClick={openCreate} className="bg-[#1B2B4B] hover:bg-[#243454] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Plus size={16} /> Create PI</button>
            {drafts.length > 0 && (
              <button onClick={() => setShowDrafts(true)} className="border text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                <FileText size={16} /> Drafts
                <span className="bg-[#0088CC] text-white text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center">{drafts.length}</span>
              </button>
            )}
            <button onClick={openMailModal} className="border text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Mail size={16} /> Send Email</button>
            <button onClick={() => { if (selectedId) { setViewId(selectedId); setShowInvoice(true); } else { alert("Select an item to view"); } }} className="border text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Eye size={16} /> View Invoice</button>
            <button onClick={() => { if (selectedId) handleEdit(selectedId); else alert("Select item to edit"); }} className="border text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Edit2 size={16} /> Edit</button>
            <button onClick={handleDelete} className="border border-red-200 text-red-600 bg-white hover:bg-red-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Trash2 size={16} /> Delete</button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl shadow mb-6 border flex gap-3 items-center">
          <Search className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name or reference no..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-sm outline-none text-gray-700 bg-transparent"
          />
        </div>

        {/* PI Table */}
        {loading ? (
          <div className="text-center py-10"><RefreshCw className="animate-spin inline-block text-gray-400" size={32} /></div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white p-10 rounded-xl border text-center text-gray-500">No proforma invoices found.</div>
        ) : (
          <div className="bg-white rounded-xl shadow border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b">
                  <th className="p-4">Select</th>
                  <th className="p-4">PI No</th>
                  <th className="p-4">Reference No</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">City</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                    className={`border-b cursor-pointer hover:bg-blue-50/50 transition ${selectedId === p.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="p-4"><input type="radio" checked={selectedId === p.id} onChange={() => setSelectedId(selectedId === p.id ? null : p.id)} /></td>
                    <td className="p-4 font-semibold text-gray-800">{formatPINumber(p.id, p.invoice_date)}</td>
                    <td className="p-4 text-gray-600">{p.reference_no || "—"}</td>
                    <td className="p-4 text-gray-600">{new Date(p.invoice_date).toLocaleDateString()}</td>
                    <td className="p-4 font-semibold text-gray-700">{p.customer_name}</td>
                    <td className="p-4 text-gray-600">{p.location_city || "—"}</td>
                    <td className="p-4 font-bold text-gray-800">&#8377;{Number(p.grand_total).toLocaleString()}</td>
                    <td className="p-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRevDocId(p.id); setRevOpen(true); }}
                        className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg"
                        title={`Revisions - ${p.customer_name || "Customer"}`}
                      >
                        <History size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Proforma Invoice Form Modal */}
        <ProformaInvoiceFormModal
          open={open}
          editId={editId}
          quotations={quotations}
          handleSelectQuotation={handleSelectQuotation}
          clientSearch={clientSearch}
          clientDropdown={clientList}
          handleClientSearch={handleClientSearch}
          handleSelectClient={selectClient}
          showClientDrop={showClientDrop}
          customer={customer}
          setCustomer={setCustomer}
          performaInvoice={performaInvoice}
          setPerformaInvoice={setPerformaInvoice}
          extra={extra}
          setExtra={setExtra}
          items={items}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
          terms={terms}
          setTerms={setTerms}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
          submitting={submitting}
          onSaveDraft={handleSaveDraft}
        />

        {/* View Invoice Printable Preview Modal */}
        {showinvoice && viewId && (
          <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-6 pb-10">
            <div className="bg-white rounded-xl shadow-2xl p-6 relative w-full max-w-4xl">
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="text-lg font-bold text-gray-800">Proforma Invoice Print View</h3>
                <div className="flex items-center gap-3">
                  <button onClick={downloadPDF} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded flex items-center gap-1.5 text-sm shadow"><Download size={14} /> Download PDF</button>
                  <button onClick={() => { setShowInvoice(false); setViewId(null); }} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
                </div>
              </div>
              {/* Scrollable preview */}
              <div className="overflow-y-auto bg-gray-200 rounded-lg" style={{ maxHeight: "80vh" }}>
                <div id="pi-pdf-content" style={{ width: "794px", margin: "0 auto", display: "block" }}>
                  <InvoiceTemplate performaInvoiceId={viewId} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Send Modal */}
        {mailOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 flex justify-center items-center">
            <div className="bg-white rounded-xl shadow-2xl p-6 relative w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Mail className="text-blue-600" /> Send Performa PDF by Email</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">To</label>
                  <input type="email" value={mailTo} onChange={e => setMailTo(e.target.value)} className="border rounded-lg px-3 py-2 outline-none text-sm bg-white" placeholder="recipient@example.com" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
                  <input type="text" value={mailSubject} onChange={e => setMailSubject(e.target.value)} className="border rounded-lg px-3 py-2 outline-none text-sm bg-white" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button onClick={() => setMailOpen(false)} className="border rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSendEmail} disabled={mailSending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-semibold shadow-md">
                    {mailSending ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drafts Modal */}
        <DraftModal
          open={showDrafts}
          title="Proforma Invoices"
          drafts={drafts}
          onLoad={handleLoadDraft}
          onDelete={handleDeleteDraft}
          onClearAll={handleClearDrafts}
          onStartNew={handleStartNewDraft}
          onClose={() => setShowDrafts(false)}
        />

        {/* Revision History Modal */}
        <RevisionHistoryModal
          open={revOpen}
          onClose={() => setRevOpen(false)}
          title="Proforma Invoice Revisions"
          docId={revDocId}
          baseUrl="/performainvoice"
          type="proforma"
          onDeleted={fetchPerformaInvoices}
        />

        {msg && (
          <div className="fixed bottom-6 right-6 z-[80] bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl text-sm flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400" /> {msg}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
