import React, { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { Search, Plus, X, Edit2, Trash2, Download, Eye, FileText, RefreshCw, ArrowLeft, MapPin, Phone, Globe, Mail, History } from "lucide-react";
import api from "../services/api";
import html2pdf from "html2pdf.js";
import AsyncStorage from '@react-native-async-storage/async-storage';
import TaxInvoiceFormModal from "../components/TaxInvoiceFormModal";
import DraftModal from "../components/DraftModal";
import RevisionHistoryModal from "../components/RevisionHistoryModal";
import { getDrafts, saveDraft, removeDraft, clearDrafts } from "../utils/drafts";
import useClientData from "../hooks/useClientData";
import madhuraLogo from "../assets/madhura.png";
import signatureImage from "../assets/sign.png";


const SERVICE_TYPES = ["CRM", "WEBSITE", "DM", "POSTERS"];
const UOM_OPTIONS = ["Lumpsum", "Nos", "Units", "Pieces", "Sets", "Meters", "Kg", "Liters", "Hours"];

const emptyItem = (sl) => ({ sl_no: sl, description: "", sac_code: "", uom: "Lumpsum", quantity: 1, total_amount: 0 });

const emptyHeader = () => ({
  client_id: "", client_name: "", client_company: "", client_address: "",
  client_gstin: "", service_no: "", client_code: "", invoice_no: "",
  running_bill_no: "", bill_date: new Date().toISOString().slice(0, 10), advance_amount: 0
});

// Number-to-words helper
function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function w(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + w(n % 100) : "");
    if (n < 100000) return w(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + w(n % 1000) : "");
    if (n < 10000000) return w(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + w(n % 100000) : "");
    return w(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + w(n % 10000000) : "");
  }
  const n = Math.round(Number(num) || 0);
  return n === 0 ? "Zero" : w(n);
}

const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "---";

// Preview component
const InvoicePreview = React.forwardRef(function InvoicePreview(
  { header, items, subtotal, cgst, sgst, grandTotal, advance, netPayable }, ref
) {
  const amtWords = numberToWords(Math.round(netPayable)).toUpperCase() + " ONLY";
  const bankRows = [
    ["Account Name", "Madhura Technologies Private Limited"],
    ["Account Type", "Current Account"],
    ["Bank Name", "Axis Bank, Aruppukottai"],
    ["Account number", "925020029656189"],
    ["IFSC Code", "UTIB0002029"],
    ["GST Number", "33AAUCM1456H1Z9"],
  ];

  return (
    <div ref={ref} style={{
      fontFamily: "'Times New Roman', Times, serif",
      fontSize: "9.5pt",
      color: "#000",
      background: "#fff",
      maxWidth: "794px",
      margin: "0 auto",
      padding: "20px 24px 0",
      boxSizing: "border-box",
      border: "2px solid #002060",
      display: "flex",
      flexDirection: "column",
      minHeight: "1122px",
      position: "relative",
      justifyContent: "flex-start",
      textAlign: "left"
    }}>
      <div style={{ flexGrow: 1, paddingBottom: "110px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: "10px", borderBottom: "3.5px solid #002060" }}>
          <img src={madhuraLogo} alt="Madhura" style={{ height: "60px", objectFit: "contain" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", color: "#002060", fontSize: "8pt", lineHeight: "1.4" }}>
            <div style={{ background: "#002060", color: "#fff", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px", flexShrink: 0 }}>
              <MapPin size={12} color="#fff" />
            </div>
            <div>
              <strong style={{ fontSize: "8.5pt", textTransform: "uppercase", letterSpacing: "0.5px" }}>Corporate Office</strong><br />
              <span>18, 2nd Floor, Rangaswamy Road, Sukrawar Pettai,</span><br />
              <span>R.S. Puram, Coimbatore, Tamil Nadu 641002.</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", fontSize: "17pt", fontWeight: "bold", color: "#002060", letterSpacing: "2px", padding: "12px 0 6px", textTransform: "uppercase" }}>
          TAX INVOICE
        </div>
        
        <div style={{ textAlign: "center", fontSize: "8.5pt", fontWeight: "bold", borderTop: "1.5px solid #000", borderBottom: "1.5px solid #000", padding: "3px 0", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
          TAX INVOICE
        </div>

        {/* Customer & Invoice Details */}
        <div style={{ display: "flex", border: "1.5px solid #000", marginBottom: "8px" }}>
          <div style={{ flex: "1.2", padding: "6px 10px", borderRight: "1.5px solid #000", fontSize: "9.5pt", lineHeight: "1.5" }}>
            <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}>INVOICE TO :</div>
            <div style={{ fontWeight: "bold", fontSize: "10.5pt", marginBottom: "4px" }}>{header.client_company || header.client_name || "—"}</div>
            <div style={{ whiteSpace: "pre-line", color: "#111" }}>{header.client_address || ""}</div>
            {header.client_gstin && (
              <div style={{ marginTop: "4px" }}>
                <strong>GSTIN : </strong>{header.client_gstin}
              </div>
            )}
          </div>
          <div style={{ flex: "1.5", display: "flex", padding: "6px 10px", fontSize: "9.5pt", lineHeight: "1.7" }}>
            <div style={{ flex: "1", paddingRight: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div><strong>Service No :</strong> {header.service_no}</div>
              <div><strong>Client Code:</strong> {header.client_code}</div>
            </div>
            <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div><strong>INVOICE NO:</strong> {header.invoice_no}</div>
              <div><strong>BILL DATE:</strong> {fmtDate(header.bill_date)}</div>
              <div><strong>RUNNING BILL NO:</strong> {header.running_bill_no}</div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", border: "1.5px solid #000", marginBottom: "0px" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #000" }}>
              <th style={{ width: "8%", borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold" }}>SL.NO</th>
              <th style={{ width: "32%", borderRight: "1.5px solid #000", padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>DESCRIPTION</th>
              <th style={{ width: "10%", borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold" }}>SAC/HSN CODE</th>
              <th style={{ width: "15%", borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold" }}>UOM</th>
              <th style={{ width: "12%", borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center", fontWeight: "bold" }}>QTY</th>
              <th style={{ width: "23%", padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>TOTAL AMOUNT IN INR</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #000" }}>
                <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}>{it.sl_no}</td>
                <td style={{ borderRight: "1.5px solid #000", padding: "5px 8px", textAlign: "left" }}>{it.description}</td>
                <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}>{it.sac_code || ""}</td>
                <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}>{it.uom || "Lumpsum"}</td>
                <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}>{it.quantity}</td>
                <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>{fmtNum(it.total_amount)}/-</td>
              </tr>
            ))}
            <tr style={{ borderBottom: "1px solid #000", fontWeight: "bold" }}>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td colSpan="2" style={{ borderRight: "1.5px solid #000", padding: "5px 8px", textAlign: "left", textTransform: "uppercase" }}>TOTAL (EXCLUSIVE OF TAX)</td>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td style={{ padding: "5px 8px", textAlign: "center" }}>{fmtNum(subtotal)}/-</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #000" }}>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td colSpan="2" style={{ borderRight: "1.5px solid #000", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>CGST</td>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}>9%</td>
              <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>{fmtNum(cgst)}/-</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #000" }}>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td colSpan="2" style={{ borderRight: "1.5px solid #000", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>SGST</td>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}></td>
              <td style={{ borderRight: "1.5px solid #000", padding: "5px 4px", textAlign: "center" }}>9%</td>
              <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>{fmtNum(sgst)}/-</td>
            </tr>
            <tr style={{ borderBottom: "1.5px solid #000", fontWeight: "bold" }}>
              <td colSpan="5" style={{ borderRight: "1.5px solid #000", padding: "5px 12px", textAlign: "center", textTransform: "uppercase" }}>TOTAL (INCLUSIVE OF TAX)</td>
              <td style={{ padding: "5px 8px", textAlign: "center" }}>{fmtNum(grandTotal)}/-</td>
            </tr>
            <tr style={{ borderBottom: "1.5px solid #000", fontWeight: "bold" }}>
              <td colSpan="5" style={{ borderRight: "1.5px solid #000", padding: "5px 12px", textAlign: "center", textTransform: "uppercase" }}>ADVANCE AMOUNT RECEIVED</td>
              <td style={{ padding: "5px 8px", textAlign: "center" }}>{fmtNum(advance)}/-</td>
            </tr>
            <tr style={{ borderBottom: "1.5px solid #000", fontWeight: "bold" }}>
              <td colSpan="5" style={{ borderRight: "1.5px solid #000", padding: "5px 12px", textAlign: "center", textTransform: "uppercase" }}>NET PAYABLE AMOUNT</td>
              <td style={{ padding: "5px 8px", textAlign: "center" }}>{fmtNum(netPayable)}/-</td>
            </tr>
            <tr style={{ fontWeight: "bold" }}>
              <td colSpan="6" style={{ padding: "5px 12px", textAlign: "center", textTransform: "uppercase", fontSize: "9pt", letterSpacing: "0.5px" }}>
                {amtWords}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bank & Signatory */}
        <div style={{ display: "flex", border: "1.5px solid #000", borderTop: "none", fontSize: "9.5pt" }}>
          <div style={{ flex: "1.2", padding: "6px 10px", borderRight: "1.5px solid #000", lineHeight: "1.5" }}>
            {bankRows.map(([k, v]) => (
              <div key={k} style={{ marginBottom: "2px" }}>
                <strong>{k} : </strong>{v}
              </div>
            ))}
          </div>
          <div style={{ flex: "1.5", padding: "6px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "center", minHeight: "115px" }}>
            <div style={{ fontWeight: "bold" }}>For MADHURA TECHNOLOGIES PVT LTD</div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "4px 0" }}>
              <img src={signatureImage} alt="Authorized Seal & Signature" style={{ height: "60px", objectFit: "contain" }} />
            </div>
            <div style={{ fontWeight: "bold", borderTop: "1px solid #000", width: "160px", margin: "0 auto", paddingTop: "2px", textTransform: "uppercase", fontSize: "8.5pt" }}>
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "38px", left: "24px", right: "24px", padding: "6px 0 4px", fontSize: "10pt", color: "#002060", lineHeight: "1.4" }}>
        <strong style={{ fontSize: "10.5pt" }}>Registered address:</strong><br />
        <span>2/315, savaspuram, Aruppukottai, Virudhunagar, Tamilnadu - 626101</span>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", height: "38px", fontFamily: "'Times New Roman', Times, serif", fontWeight: "bold", fontSize: "10pt", boxSizing: "border-box" }}>
        <div style={{ background: "#002060", color: "#fff", width: "35%", display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(0 0, 92% 0, 100% 100%, 0% 100%)", paddingRight: "15px", gap: "6px" }}>
          <Phone size={14} color="#fff" /> +91 90036 63660
        </div>
        <div style={{ background: "#f9b233", color: "#000", width: "65%", display: "flex", alignItems: "center", justifyContent: "space-around", paddingLeft: "10px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Globe size={14} color="#000" /> www.madhuratech.com</span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Mail size={14} color="#000" /> biz@madhuratech.com</span>
        </div>
      </div>
    </div>
  );
});

export default function InvoiceScreenWeb() {
  const [role, setRole] = useState("Field Executive");
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [postSavePreview, setPostSavePreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [viewData, setViewData] = useState(null);

  const [clientSearch, setClientSearch] = useState("");
  const [clientList, setClientList] = useState([]);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [proposals, setProposals] = useState([]);

  // Revision history state
  const [revOpen, setRevOpen] = useState(false);
  const [revDocId, setRevDocId] = useState(null);

  const [serviceType, setServiceType] = useState("CRM");
  const [items, setItems] = useState([emptyItem(1)]);
  const [header, setHeader] = useState(emptyHeader());
  const [submitting, setSubmitting] = useState(false);

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
    const list = await getDrafts("invoice");
    setDrafts(list);
    return list;
  };

  const previewRef = useRef(null);
  const postSaveRef = useRef(null);

  const { aggregatedData, fetchClientAggregatedData, clearClientData } = useClientData();

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) setRole(JSON.parse(stored).role);
      fetchInvoices();
      fetchProposals();
      refreshDrafts();
    };
    load();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get("/madhura-invoice");
      setInvoices(res.data);
    } catch (err) {
      console.error("Fetch invoices error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProposals = async () => {
    try {
      const res = await api.get("/crm-quotations");
      setProposals(res.data);
    } catch (err) {
      console.error("Fetch proposals error:", err);
    }
  };

  const fetchNextDetails = useCallback(async (cid, stype) => {
    try {
      const res = await api.get("/madhura-invoice/next-details", {
        params: { clientId: cid || undefined, serviceType: stype || "CRM" }
      });
      setHeader(prev => ({
        ...prev,
        invoice_no: res.data.invoice_no,
        service_no: res.data.service_no,
        client_code: res.data.client_code || prev.client_code,
        running_bill_no: res.data.running_bill_no,
        bill_date: res.data.bill_date,
      }));
    } catch (err) {
      console.error("Next details error:", err);
    }
  }, []);

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

  const handleSelectClient = async (client) => {
    const addrParts = [client.address1, client.address2, client.city, client.state, client.pincode].filter(Boolean);
    setClientSearch(client.company_name || client.name);
    setClientList([]);
    setShowClientDrop(false);
    setHeader(prev => ({
      ...prev, client_id: client.id, client_name: client.name || "",
      client_company: client.company_name || "", client_address: addrParts.join(", "), client_gstin: client.gstin || "",
    }));
    await fetchNextDetails(client.id, serviceType);
    await fetchClientAggregatedData(client.id, client.company_name || client.name);
  };

  const handleServiceTypeChange = async (newType) => {
    setServiceType(newType);
    await fetchNextDetails(header.client_id, newType);
  };

  const rowsToHeaderItems = (rows) => {
    const h = rows[0];
    const header = {
      client_id: h.client_id || null, client_name: h.client_name || "",
      client_company: h.client_company || "", client_address: h.client_address || "",
      client_gstin: h.client_gstin || "", service_no: h.service_no || "",
      client_code: h.client_code || "", invoice_no: h.invoice_no || "",
      running_bill_no: h.running_bill_no || "",
      bill_date: h.bill_date ? String(h.bill_date).slice(0, 10) : "",
      advance_amount: h.advance_amount || "",
    };
    const items = rows.filter(r => r.sl_no != null).map(r => ({
      sl_no: r.sl_no, description: r.description || "", sac_code: r.sac_code || "",
      uom: r.uom || "Lumpsum", quantity: r.quantity || 1,
      total_amount: Number(r.total_amount) || 0,
    }));
    return { header, items: items.length ? items : [emptyItem(1)] };
  };

  const renderRevPreview = (rows) => {
    const { header, items } = rowsToHeaderItems(rows);
    const sub = items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0);
    return (
      <InvoicePreview
        header={header}
        items={items}
        subtotal={sub}
        cgst={sub * 0.09}
        sgst={sub * 0.09}
        grandTotal={sub * 1.18}
        advance={Number(header.advance_amount) || 0}
        netPayable={(sub * 1.18) - (Number(header.advance_amount) || 0)}
      />
    );
  };

  const openPreview = async (inv) => {
    setViewId(inv.id);
    try {
      const res = await api.get(`/madhura-invoice/${inv.id}`);
      const { header, items } = rowsToHeaderItems(res.data);
      setViewData({ header, items });
      setShowPreview(true);
    } catch (err) {
      console.error("Preview load error:", err);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setViewId(null);
    setViewData(null);
  };

  const downloadPreviewPDF = () => {
    if (!previewRef.current || !viewData) return;
    html2pdf().from(previewRef.current).set({
      margin: 0,
      filename: `Madhura_Invoice_${viewData.header.invoice_no || viewId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).save();
  };

  const downloadPostSavePDF = () => {
    if (!postSaveRef.current) return;
    html2pdf().from(postSaveRef.current).set({
      margin: 0,
      filename: `Madhura_Invoice_${header.invoice_no || savedId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).save();
  };

  const openNew = async () => {
    setEditInvoiceId(null); setSavedId(null); setPostSavePreview(false);
    setClientSearch(""); setClientList([]); setShowClientDrop(false);
    setServiceType("CRM"); setItems([emptyItem(1)]);
    setHeader(emptyHeader());
    setOpen(true);
    clearClientData();
    await fetchNextDetails(null, "CRM");
    const dl = await refreshDrafts();
    if (dl.length > 0 && !draftsPromptedRef.current) {
      setShowDrafts(true);
      draftsPromptedRef.current = true;
    }
  };

  const openEdit = async (inv) => {
    setEditInvoiceId(inv.id); setSavedId(inv.id); setPostSavePreview(false);
    setClientSearch(inv.client_company || "");
    setServiceType("CRM"); setOpen(true);
    try {
      const res = await api.get(`/madhura-invoice/${inv.id}`);
      const rows = res.data; const h = rows[0];
      setHeader({
        client_id: h.client_id || null, client_name: h.client_name || "",
        client_company: h.client_company || "", client_address: h.client_address || "",
        client_gstin: h.client_gstin || "", service_no: h.service_no || "",
        client_code: h.client_code || "", invoice_no: h.invoice_no || "",
        running_bill_no: h.running_bill_no || "",
        bill_date: h.bill_date ? h.bill_date.slice(0, 10) : "",
        advance_amount: h.advance_amount || 0,
      });
      const svMatch = (h.service_no || "").match(/MT\/([^/]+)\/INV/);
      if (svMatch) setServiceType(svMatch[1]);
      const loaded = rows.filter(r => r.sl_no != null).map(r => ({
        sl_no: r.sl_no, description: r.description || "", sac_code: r.sac_code || "",
        uom: r.uom || "Lumpsum", quantity: r.quantity || 1,
        total_amount: Number(r.total_amount) || 0,
      }));
      setItems(loaded.length ? loaded : [emptyItem(1)]);
    } catch (err) {
      console.error("Edit load error:", err);
    }
  };

  const resetClose = () => {
    setOpen(false); setPostSavePreview(false); setEditInvoiceId(null); setSavedId(null);
    setClientSearch(""); setClientList([]); setShowClientDrop(false);
    setServiceType("CRM"); setItems([emptyItem(1)]); setHeader(emptyHeader());
    clearClientData();
  };

  const handleSaveDraft = async () => {
    const payload = {
      header,
      items,
      serviceType,
      clientSearch,
    };
    const summary = {
      label: header.bill_date
        ? `Tax Invoice · ${header.bill_date}`
        : "Invoice draft",
      customer: header.client_name || "",
      company: header.client_company || "",
    };
    const draft = await saveDraft("invoice", payload, summary);
    setCurrentDraftId(draft.id);
    await refreshDrafts();
    draftsPromptedRef.current = false;
    notify("Draft saved — you can leave and resume anytime");
  };

  const handleLoadDraft = async (draft) => {
    const d = (draft && draft.payload) || {};
    setHeader({ ...emptyHeader(), ...(d.header || {}) });
    setItems(
      d.items && d.items.length
        ? d.items
        : [emptyItem(1)]
    );
    setServiceType((d.serviceType) || "CRM");
    setClientSearch(d.clientSearch || "");
    setClientList([]);
    setShowClientDrop(false);
    setCurrentDraftId(draft.id);
    setEditInvoiceId(null);
    setSavedId(null);
    setPostSavePreview(false);
    setShowDrafts(false);
    setOpen(true);
    notify("Draft loaded");
  };

  const handleDeleteDraft = async (id) => {
    await removeDraft("invoice", id);
    if (currentDraftId === id) setCurrentDraftId(null);
    await refreshDrafts();
  };

  const handleClearDrafts = async () => {
    await clearDrafts("invoice");
    setCurrentDraftId(null);
    await refreshDrafts();
  };

  const handleStartNewDraft = async () => {
    setCurrentDraftId(null);
    setShowDrafts(false);
    draftsPromptedRef.current = true;
    resetClose();
    await openNew();
  };

  const updateItem = (idx, field, value) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  const addItem = () => setItems(prev => [...prev, emptyItem(prev.length + 1)]);
  const removeItem = (idx) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sl_no: i + 1 })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!header.invoice_no.trim()) return alert("Invoice No is required");
    if (!header.bill_date) return alert("Bill Date is required");
    if (items.some(it => !it.description.trim())) return alert("All item descriptions are required");
    setSubmitting(true);
    try {
      const payload = {
        header,
        items: items.map(item => ({
          sl_no: item.sl_no,
          description: item.description,
          sac_code: item.sac_code,
          uom: item.uom,
          quantity: item.quantity,
          total_amount: item.total_amount,
        }))
      };
      if (editInvoiceId || savedId) {
        await api.put(`/madhura-invoice/${editInvoiceId || savedId}`, payload);
      } else {
        const res = await api.post("/madhura-invoice/create", payload);
        setSavedId(res.data.invoiceId);
      }
      setPostSavePreview(true);
      if (currentDraftId) {
        await removeDraft("invoice", currentDraftId);
        setCurrentDraftId(null);
      }
      refreshDrafts();
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      await api.delete(`/madhura-invoice/${id}`);
      if (viewId === id) closePreview();
      fetchInvoices();
    } catch {
      alert("Delete failed");
    }
  };

  const filterInvoices = invoices.filter(inv =>
    inv.client_company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.project_names?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = items.reduce((sum, it) => sum + Number(it.total_amount || 0), 0);
  const cgst = subtotal * 0.09;
  const sgst = subtotal * 0.09;
  const grandTotal = subtotal + cgst + sgst;
  const advance = Number(header.advance_amount) || 0;
  const netPayable = grandTotal - advance;

  return (
    <AppLayout currentScreen="Invoice" role={role} scrollable={true}>
      <div 
        className="p-6 max-w-7xl mx-auto w-full"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif' }}
      >
        {/* Title and Controls */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-[#1B2B4B]" /> Tax Invoice Management
          </h1>
          <button
            onClick={openNew}
            className="bg-[#1B2B4B] hover:bg-[#243454] text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 shadow"
          >
            <Plus size={18} /> New Invoice
          </button>
          {drafts.length > 0 && (
            <button
              onClick={() => setShowDrafts(true)}
              className="border bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 shadow"
            >
              <FileText size={16} /> Drafts
              <span className="bg-[#0088CC] text-white text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center">{drafts.length}</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl shadow mb-6 border flex gap-3 items-center">
          <Search className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by client company or service type..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-sm outline-none text-gray-700 bg-transparent"
          />
        </div>

        {/* Invoice List */}
        {loading ? (
          <div className="text-center py-10"><RefreshCw className="animate-spin inline-block text-gray-400" size={32} /></div>
        ) : filterInvoices.length === 0 ? (
          <div className="bg-white p-10 rounded-xl border text-center text-gray-500">No tax invoices found.</div>
        ) : (
          <div className="bg-white rounded-xl shadow border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b">
                  <th className="p-4">Invoice No</th>
                  <th className="p-4">Client Company</th>
                  <th className="p-4">Bill Date</th>
                  <th className="p-4">Service No</th>
                  <th className="p-4">Paid Amount</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filterInvoices.map(inv => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 font-semibold text-gray-700">{inv.category || "—"}</td>
                    <td className="p-4 font-semibold text-gray-800">{inv.client_company}</td>
                    <td className="p-4 text-gray-600">{fmtDate(inv.invoice_date)}</td>
                    <td className="p-4 text-gray-600">{inv.project_names}</td>
                    <td className="p-4 font-bold text-green-600">&#8377;{fmtNum(inv.paid_amount)}</td>
                    <td className="p-4 flex gap-2 justify-center">
                      <button onClick={() => openPreview(inv)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Preview Print"><Eye size={16} /></button>
                      <button onClick={() => openEdit(inv)} className="p-2 hover:bg-yellow-50 text-yellow-600 rounded-lg" title="Edit"><Edit2 size={16} /></button>
                      <button onClick={() => { setRevDocId(inv.id); setRevOpen(true); }} className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg" title="Revisions"><History size={16} /></button>
                      <button onClick={() => handleDelete(inv.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Modal */}
        <TaxInvoiceFormModal
          open={open}
          editId={editInvoiceId}
          clientSearch={clientSearch}
          clientDropdown={clientList}
          handleClientSearch={handleClientSearch}
          handleSelectClient={handleSelectClient}
          showClientDrop={showClientDrop}
          serviceType={serviceType}
          handleServiceTypeChange={handleServiceTypeChange}
          header={header}
          setHeader={setHeader}
          items={items}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
          subtotal={subtotal}
          cgst={cgst}
          sgst={sgst}
          grandTotal={grandTotal}
          netPayable={netPayable}
          handleSubmit={handleSubmit}
          handleRefresh={() => fetchNextDetails(header.client_id, serviceType)}
          resetForm={resetClose}
          submitting={submitting}
          onSaveDraft={handleSaveDraft}
          aggregatedData={aggregatedData}
          setItems={setItems}
        />

        {/* Preview Modal */}
        {showPreview && viewData && (
          <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-6 pb-10">
            <div className="bg-white rounded-xl shadow-2xl p-6 relative w-full max-w-4xl">
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="text-lg font-bold text-gray-800">Invoice Print Preview</h3>
                <div className="flex items-center gap-3">
                  <button onClick={downloadPreviewPDF} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded flex items-center gap-1.5 text-sm shadow"><Download size={14} /> Download PDF</button>
                  <button onClick={closePreview} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
                </div>
              </div>
              <div className="overflow-x-auto bg-gray-100 p-4 rounded-lg max-h-[80vh]">
                <InvoicePreview
                  ref={previewRef}
                  header={viewData.header}
                  items={viewData.items}
                  subtotal={viewData.items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0)}
                  cgst={viewData.items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0) * 0.09}
                  sgst={viewData.items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0) * 0.09}
                  grandTotal={viewData.items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0) * 1.18}
                  advance={Number(viewData.header.advance_amount) || 0}
                  netPayable={(viewData.items.reduce((s, it) => s + (Number(it.total_amount) || 0), 0) * 1.18) - (Number(viewData.header.advance_amount) || 0)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Post Save Preview */}
        {postSavePreview && (
          <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-6 pb-10">
            <div className="bg-white rounded-xl shadow-2xl p-6 relative w-full max-w-4xl">
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="text-lg font-bold text-green-600 flex items-center gap-2">✔ Saved Successfully!</h3>
                <div className="flex items-center gap-3">
                  <button onClick={downloadPostSavePDF} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded flex items-center gap-1.5 text-sm shadow"><Download size={14} /> Download PDF</button>
                  <button onClick={resetClose} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
                </div>
              </div>
              <div className="overflow-x-auto bg-gray-100 p-4 rounded-lg max-h-[80vh]">
                <InvoicePreview
                  ref={postSaveRef}
                  header={header}
                  items={items}
                  subtotal={subtotal}
                  cgst={cgst}
                  sgst={sgst}
                  grandTotal={grandTotal}
                  advance={advance}
                  netPayable={netPayable}
                />
              </div>
            </div>
          </div>
        )}

        {/* Drafts Modal */}
        <DraftModal
          open={showDrafts}
          title="Tax Invoices"
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
          title="Tax Invoice Revisions"
          docId={revDocId}
          baseUrl="/madhura-invoice"
          type="taxinvoice"
          onDeleted={fetchInvoices}
          renderRevPreview={renderRevPreview}
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
