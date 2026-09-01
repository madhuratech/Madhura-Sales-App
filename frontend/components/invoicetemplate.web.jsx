import React, { useEffect, useState } from "react";
import api from "../services/api";
import companyLogo from "../assets/Com_logo.png";
import signImage from "../assets/sign.png";

const COMPANY = {
  gstin: "33AAUCM1456H1Z9",
  email: "biz@madhuratech.com",
  phone: "+91 90036 63660",
  address: "18, 2nd Floor, Rangaswamy Road, Sukrawar Pettai, R.S. Puram, Coimbatore, Tamil Nadu 641002",
};

function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function w(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1e3) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + w(n % 100) : "");
    if (n < 1e5) return w(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + w(n % 1000) : "");
    if (n < 1e7) return w(Math.floor(n / 1e5)) + " Lakh" + (n % 1e5 ? " " + w(n % 1e5) : "");
    return w(Math.floor(n / 1e7)) + " Crore" + (n % 1e7 ? " " + w(n % 1e7) : "");
  }
  const n = Math.round(Number(num) || 0);
  return n === 0 ? "Zero" : w(n);
}

const DB = "linear-gradient(135deg,#003366 0%,#004d99 100%)";
const BD = "1.5px solid #C8D8E8";
const F = "'Segoe UI',Arial,sans-serif";

const Invoice = ({ performaInvoiceId, quotationId, revisionId }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [signTime] = useState(() => {
    return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  });

  const getConfig = () => {
    if (performaInvoiceId) {
      const base = `/performainvoice/${performaInvoiceId}`;
      return { api: revisionId ? `${base}/revisions/${revisionId}` : base, label: "PROFORMA INVOICE", prefix: "PI", dateField: "invoice_date", idField: "performainvoice_id" };
    }
    if (quotationId) {
      const base = `/crm-quotations/${quotationId}`;
      return { api: revisionId ? `${base}/revisions/${revisionId}` : base, label: "QUOTATION", prefix: "QT", dateField: "quotation_date", idField: "quotation_id" };
    }
    return null;
  };
  const config = getConfig();

  useEffect(() => {
    if (!config) return;
    setError(null);
    api.get(config.api).then(r => setRows(r.data)).catch(e => setError(e?.response?.data?.message || e?.message || "Failed"));
  }, [performaInvoiceId, quotationId, revisionId]); // eslint-disable-line

  if (error) return <p style={{ padding: "2rem", color: "red", textAlign: "center" }}>{error}</p>;
  if (!rows.length) return <p style={{ padding: "2rem", color: "#666", textAlign: "center" }}>Loading…</p>;

  const h = rows[0];
  const fmtD = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const fmtN = n => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const docDate = h[config.dateField] || h.invoice_date || h.quotation_date;
  const docId = h[config.idField] || h.id;
  const year = docDate ? new Date(docDate).getFullYear() : new Date().getFullYear();
  const docNum = h.reference_no || `${config.prefix}-${year}-${String(docId).slice(-4)}`;
  const taxRate = h.tax_type === "GST0" ? 0
    : h.tax_type === "GST5" ? 5
    : h.tax_type === "CUSTOM" ? (Number(h.custom_tax) || 0)
    : 18;
  const showTax = taxRate > 0;
  const showHsn = rows.some(r => r.hsn_code && String(r.hsn_code).trim() !== "");
  const addr = [h.client_address1, h.client_address2, h.client_city, h.client_state, h.client_pincode].filter(Boolean).join(", ");

  let terms = [];
  try { if (h.terms_json) terms = JSON.parse(h.terms_json); } catch (_) { }
  if (!terms.length) terms = [
    "50% advance payment is required to initiate the project.",
    "Project confirmation will be made only after approval of the submitted proposal.",
    "Any additional requirements, modifications, or corrections beyond the agreed scope will be charged separately.",
    "The above-mentioned prices are exclusive of applicable taxes.",
    "GST @ 18% will be charged additionally as per government regulations.",
  ];

  const subtotal = Number(h.subtotal) || 0;
  const totDisc = Number(h.total_discount) || 0;
  const totCgst = Number(h.total_cgst) || 0;
  const totSgst = Number(h.total_sgst) || 0;
  const grandTotal = Number(h.grand_total) || 0;
  const amtWords = numberToWords(Math.round(grandTotal)).toUpperCase() + " ONLY";

  // Build dynamic column layout based on tax config and HSN data
  const colDefs = [];
  colDefs.push({ w: 4, align: "center" });
  if (showHsn) colDefs.push({ w: 9, align: "center" });
  colDefs.push({ w: 0, flex: true, align: "left" }); // Description (takes remaining width)
  colDefs.push({ w: 9, align: "center" }); // Qty
  colDefs.push({ w: 12, align: "right" }); // Rate
  if (showTax) colDefs.push({ w: 7, align: "center" }); // GST
  if (showTax) colDefs.push({ w: 12, align: "right" }); // Tax Val
  colDefs.push({ w: 15, align: "right" }); // Amount
  const fixedSum = colDefs.filter(c => c.w).reduce((s, c) => s + c.w, 0);
  colDefs.forEach(c => { if (c.flex) c.w = 100 - fixedSum; });

  const colLabels = [];
  colLabels.push("#");
  if (showHsn) colLabels.push("HSN");
  colLabels.push("Description");
  colLabels.push("Qty");
  colLabels.push("Rate (₹)");
  if (showTax) colLabels.push("GST");
  if (showTax) colLabels.push("Tax Val");
  colLabels.push("Amount (₹)");

  /* ── Blue header band ── */
  const Band = ({ children, style = {} }) => (
    <div style={{
      background: DB, color: "#fff", padding: "7px 14px", fontSize: "8pt",
      fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", ...style
    }}>
      {children}
    </div>
  );

  return (
    /* Outer wrapper: exact A4 pixel size at 96 dpi = 794 × 1123 px */
    <div style={{
      fontFamily: F, width: "794px", height: "1123px", boxSizing: "border-box",
      padding: "18px", background: "#fff", color: "#111", overflow: "hidden", position: "relative"
    }}>

      {/* ── BORDER FRAME ── */}
      <div style={{
        width: "100%", height: "100%", border: "2px solid #003366",
        boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative"
      }}>

        {/* ① HEADER */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 20px", background: "linear-gradient(135deg,#F4F8FC 0%,#E6EEF5 100%)",
          borderBottom: "3px solid #003366", flexShrink: 0
        }}>
          <img src={companyLogo} alt="logo" style={{ height: "48px", objectFit: "contain" }} />
          <div style={{
            color: "#003366", fontSize: "21pt", fontWeight: "900",
            letterSpacing: "3px", textTransform: "uppercase"
          }}>{config.label}</div>
        </div>

        {/* ② CORPORATE */}
        <div style={{
          padding: "7px 20px", borderBottom: BD, background: "#FAFBFC",
          textAlign: "center", fontSize: "7.5pt", lineHeight: "1.5", color: "#2C3E50", flexShrink: 0
        }}>
          <strong style={{ color: "#003366" }}>Corporate Office:</strong> {COMPANY.address}<br />
          <strong>Phone:</strong> {COMPANY.phone} &nbsp;|&nbsp;
          <strong>Email:</strong> {COMPANY.email} &nbsp;|&nbsp;
          <strong>GSTIN:</strong> {COMPANY.gstin}
        </div>

        {/* ③ BILL TO + INVOICE DETAILS */}
        <div style={{ display: "flex", borderBottom: BD, flexShrink: 0 }}>
          <div style={{ flex: "0 0 58%", borderRight: BD }}>
            <Band>Bill To</Band>
            <div style={{ padding: "9px 14px", fontSize: "8pt", lineHeight: "1.6" }}>
              <div style={{ fontWeight: "700", fontSize: "9.5pt", marginBottom: "3px" }}>{h.client_company || h.customer_name}</div>
              {addr && <div style={{ color: "#444" }}>{addr}{h.client_country ? `, ${h.client_country}` : ""}</div>}
              <div style={{ marginTop: "4px" }}><strong>Mobile:</strong> {h.mobile_number}</div>
              {h.client_gstin && <div><strong>GSTIN:</strong> {h.client_gstin}</div>}
            </div>
          </div>
          <div style={{ flex: "0 0 42%" }}>
            <Band>Invoice Details</Band>
            <div style={{ padding: "9px 14px", fontSize: "8pt", lineHeight: "1.85" }}>
              {[["Doc No", <strong key="d">{docNum}</strong>],
              ["Date", fmtD(docDate)],
              ["Valid Until", h.validity_date ? fmtD(h.validity_date) : "7 Days"],
              ["State Code", "33"],
              ["Customer ID", h.client_code || `MT${String(docId).slice(-3)}`],
              ...(h.email ? [["Email", <span key="e" style={{ fontSize: "7pt" }}>{h.email}</span>]] : []),
              ].map(([k, v], i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  borderTop: i === 4 ? "1px solid #eee" : "none", marginTop: i === 4 ? "3px" : "0", paddingTop: i === 4 ? "3px" : "0"
                }}>
                  <span style={{ color: "#666" }}>{k}:</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ④ ITEMS TABLE */}
        <div style={{ borderBottom: BD, flexShrink: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed" }}>
            <colgroup>
              {colDefs.map((c, i) => <col key={i} style={{ width: `${c.w}%` }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: DB, color: "#fff" }}>
                {colDefs.map((c, i) => (
                  <th key={i} style={{
                    padding: "8px 6px", fontSize: "7.5pt", fontWeight: "700",
                    textAlign: c.align
                  }}>
                    {colLabels[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, i) => {
                const iTax = Number(item.tax || taxRate || 0), iQty = Number(item.quantity || 1), iRate = Number(item.price || 0);
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAFC", borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "7px 6px", textAlign: "center", borderRight: "1px solid #eee", color: "#777" }}>{i + 1}</td>
                    {showHsn && <td style={{ padding: "7px 6px", textAlign: "center", borderRight: "1px solid #eee", fontSize: "7.5pt" }}>{item.hsn_code || "—"}</td>}
                    <td style={{ padding: "7px 8px", borderRight: "1px solid #eee", fontWeight: "600", textAlign: "left" }}>{item.description}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", borderRight: "1px solid #eee" }}>{iQty} {item.uom || "Nos"}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #eee" }}>{fmtN(iRate)}</td>
                    {showTax && <td style={{ padding: "7px 6px", textAlign: "center", borderRight: "1px solid #eee" }}>{iTax}%</td>}
                    {showTax && <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #eee" }}>{fmtN(iQty * iRate * (iTax / 100))}</td>}
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: "600" }}>{fmtN(iQty * iRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ⑤ TOTALS — right-aligned block */}
        <div style={{ display: "flex", justifyContent: "flex-end", borderBottom: BD, flexShrink: 0 }}>
          <div style={{ width: "42%", fontSize: "8pt" }}>
            {[["Subtotal", fmtN(subtotal), false],
            ...(totDisc > 0 ? [["Discount", `-${fmtN(totDisc)}`, true]] : []),
            ...(showTax ? [[`CGST (${taxRate / 2}%)`, fmtN(totCgst), false],
            [`SGST (${taxRate / 2}%)`, fmtN(totSgst), false]] : []),
            ].map(([l, v, d], i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 14px", borderBottom: BD, background: "#F8FAFB"
              }}>
                <span style={{ color: d ? "#dc2626" : "#555" }}>{l}</span>
                <strong style={{ color: d ? "#dc2626" : "#111" }}>&#8377;{v}</strong>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 14px", background: DB, color: "#fff", fontWeight: "900", fontSize: "9pt"
            }}>
              <span>Grand Total</span><span>&#8377;{fmtN(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* ⑥ AMOUNT IN WORDS */}
        <div style={{
          padding: "7px 20px", borderBottom: BD, background: "#FAFCFF", flexShrink: 0,
          textAlign: "center", fontSize: "8pt", fontWeight: "700", color: "#003366", fontStyle: "italic"
        }}>
          Amount in words: {amtWords}
        </div>

        {/* ⑦ TERMS + SIGNATURE — pinned to bottom of page as footer */}
        <div style={{
          position: "absolute", bottom: "0", left: "0", right: "0",
          display: "flex", borderTop: BD,
        }}>
          {/* Terms column */}
          <div style={{ width: "62%", borderRight: BD, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Band style={{ flexShrink: 0 }}>Terms &amp; Conditions</Band>
            <div style={{ padding: "10px 14px 10px 10px", background: "#F9FBFC" }}>
              <div style={{ margin: 0, paddingLeft: "4px" }}>
                {terms.map((t, i) => (
                  <div key={i} style={{ fontSize: "7.5pt", color: "#333", lineHeight: "1.6", marginBottom: "4px", display: "flex" }}>
                    <span style={{ marginRight: "6px", minWidth: "12px", fontWeight: "600" }}>{i + 1}.</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Signature column */}
          <div style={{
            width: "38%", display: "flex", flexDirection: "column",
            justifyContent: "flex-end", alignItems: "center", padding: "12px 14px 16px", background: "#fff",
            position: "relative", overflow: "hidden"
          }}>
            {/* Green Tick Watermark */}
            <div style={{
              position: "absolute",
              top: "52%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-12deg)",
              opacity: "0.08",
              pointerEvents: "none",
              zIndex: "0",
              fontSize: "72px",
              color: "#22c55e",
              fontWeight: "900",
              lineHeight: "1"
            }}>
              ✔
            </div>
            <div style={{ width: "85%", paddingTop: "6px", textAlign: "center", position: "relative", zIndex: "1" }}>
              <div style={{
                display: "inline-block",
                marginBottom: "6px",
                whiteSpace: "nowrap"
              }}>
                <span style={{
                  color: "#22c55e",
                  fontWeight: "900",
                  marginRight: "5px",
                  fontSize: "9pt",
                  display: "inline-block",
                  verticalAlign: "middle",
                  lineHeight: "1",
                  position: "relative",
                  top: "-1px"
                }}>✔</span>
                <span style={{
                  fontSize: "7pt", color: "#166534", fontWeight: "800",
                  textTransform: "uppercase", letterSpacing: "0.3px",
                  display: "inline-block", verticalAlign: "middle",
                  lineHeight: "1"
                }}>Digitally Signed</span>
              </div>
              <p style={{ fontSize: "7pt", color: "#166534", fontWeight: "700", margin: "0" }}>By Accounts Team</p>
              <p style={{ fontSize: "5.8pt", color: "#666", margin: "2px 0 0", fontFamily: "monospace" }}>
                Date: {fmtD(docDate)} {signTime} IST
              </p>
              <p style={{ fontSize: "6.2pt", color: "#666", margin: "3px 0 0" }}>For Madhura Technologies Pvt. Ltd.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Invoice;
