import React, { useState, useEffect } from "react";
import { X, Download, Eye, Trash2, RefreshCw, History } from "lucide-react";
import api from "../services/api";
import InvoiceTemplate from "./invoicetemplate.web";

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
};

const fmtN = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RevisionHistoryModal({
  open,
  onClose,
  title = "Revision History",
  docId,
  baseUrl,
  type = "quotation", // "quotation" | "proforma" | "taxinvoice"
  onDeleted,
  renderRevPreview,
}) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { kind: "current" } | { kind: "revision", rev }
  const [previewRows, setPreviewRows] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRevisions = async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${baseUrl}/${docId}/revisions`);
      setRevisions(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load revisions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setPreview(null);
      setPreviewRows(null);
      loadRevisions();
    }
  }, [open, docId, baseUrl]); // eslint-disable-line

  const loadRows = async (url) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(url);
      setPreviewRows(res.data);
      return res.data;
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load preview");
      return [];
    } finally {
      setPreviewLoading(false);
    }
  };

  const viewCurrent = async () => {
    if (type === "taxinvoice") {
      await loadRows(`${baseUrl}/${docId}`);
    }
    setPreview({ kind: "current" });
  };

  const viewRevision = async (rev) => {
    if (type === "taxinvoice") {
      await loadRows(`${baseUrl}/${docId}/revisions/${rev.id}`);
    }
    setPreview({ kind: "revision", rev });
  };

  const handleDelete = async (rev) => {
    if (!window.confirm(`Delete revision #${rev.revision_no}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`${baseUrl}/${docId}/revisions/${rev.id}`);
      setRevisions(prev => prev.filter(r => r.id !== rev.id));
      if (preview?.kind === "revision" && preview?.rev?.id === rev.id) {
        setPreview(null);
        setPreviewRows(null);
      }
      if (onDeleted) onDeleted();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to delete revision");
    } finally {
      setDeleting(false);
    }
  };

  const downloadPDF = async () => {
    const el = document.getElementById("revision-pdf-content");
    if (!el) return alert("Revision content not ready");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
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
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 210, 297);
      const revTag = preview?.kind === "revision" ? `_Rev${preview.rev.revision_no}` : "";
      pdf.save(`${title.replace(/\s+/g, "_")}${revTag}.pdf`);
    } catch (e) {
      alert("Failed to generate PDF");
    }
  };

  if (!open) return null;

  const renderPreviewContent = () => {
    if (previewLoading && type === "taxinvoice" && !previewRows) {
      return <p style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Loading…</p>;
    }
    if (type === "taxinvoice") {
      if (!previewRows || !previewRows.length) {
        return <p style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Loading…</p>;
      }
      return renderRevPreview ? renderRevPreview(previewRows) : null;
    }
    if (type === "proforma") {
      return <InvoiceTemplate performaInvoiceId={docId} revisionId={preview?.kind === "revision" ? preview.rev.id : null} />;
    }
    return <InvoiceTemplate quotationId={docId} revisionId={preview?.kind === "revision" ? preview.rev.id : null} />;
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center items-start overflow-y-auto pt-6 pb-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 relative">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <History className="text-[#0088CC]" size={20} /> {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>
        )}

        {/* Preview pane */}
        {preview && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">
                {preview.kind === "current" ? "Current / Latest Version" : `Revision #${preview.rev.revision_no}`}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={downloadPDF} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded flex items-center gap-1.5 text-sm shadow">
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => { setPreview(null); setPreviewRows(null); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
              </div>
            </div>
            <div className="overflow-y-auto bg-gray-200 rounded-lg" style={{ maxHeight: "60vh" }}>
              <div id="revision-pdf-content" style={{ width: "794px", margin: "0 auto", display: "block" }}>
                {renderPreviewContent()}
              </div>
            </div>
          </div>
        )}

        {/* Revisions list */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-bold text-gray-700">Versions</h4>
            <button onClick={loadRevisions} className="text-xs text-gray-400 hover:text-[#0088CC] flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Current / Latest version */}
          <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 mb-2 flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-bold text-green-700">Current / Latest Version</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {docId ? docId.slice(-8) : ""} · This is the active document currently in use.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={viewCurrent} className="bg-[#0088CC] hover:bg-[#006FA8] text-white text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1">
                <Eye size={13} /> View
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8"><RefreshCw className="animate-spin inline-block text-gray-400" size={24} /></div>
          ) : revisions.length === 0 ? (
            <div className="bg-gray-50 border rounded-lg p-8 text-center text-gray-500 text-sm">
              No previous revisions yet. Revisions are created automatically whenever this document is edited and saved.
            </div>
          ) : (
            revisions.map(rev => (
              <div key={rev.id} className="border rounded-lg px-4 py-3 mb-2 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">
                    Revision #{rev.revision_no}
                    <span className="ml-2 text-xs text-gray-400">saved on {fmtDate(rev.savedAt)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {rev.reference_no && <span className="mr-3">Ref: {rev.reference_no}</span>}
                    {rev.customer_name && <span className="mr-3">Customer: {rev.customer_name}</span>}
                    {rev.invoice_no && <span className="mr-3">Invoice: {rev.invoice_no}</span>}
                    {rev.grand_total != null && <span>Amount: ₹{fmtN(rev.grand_total)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => viewRevision(rev)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1">
                    <Eye size={13} /> View
                  </button>
                  <button
                    onClick={() => handleDelete(rev)}
                    disabled={deleting}
                    className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
