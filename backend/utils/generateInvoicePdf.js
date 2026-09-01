"use strict";

const path = require("path");
const fs   = require("fs");

const COMPANY_DETAILS = {
  name: "Madhura Technologies Pvt. Ltd.",
  gstin: "33AAUCM1456H1Z9",
  email: "biz@madhuratech.com",
  website: "www.madhuratech.com",
  phone: "+91 90036 63660",
  address: "18, 2nd Floor, Rangaswamy Road, Sukrawar Pettai, R.S. Puram, Coimbatore, Tamil Nadu 641002",
};

let LOGO_B64 = "";
const LOGO_PATHS = [
  path.resolve(__dirname, "../../frontend/assets/madhura.png"),
  path.resolve(__dirname, "../../frontend/assets/logo.png"),
  path.resolve(__dirname, "../../frontend/assets/favicon.png"),
];
for (const p of LOGO_PATHS) {
  try { 
    LOGO_B64 = fs.readFileSync(p).toString("base64"); 
    break; 
  } catch (_) {}
}
if (!LOGO_B64) console.warn("[PDF] Logo not found – using text fallback");
const LOGO_SRC = LOGO_B64 ? `data:image/png;base64,${LOGO_B64}` : "";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function generateInvoicePdf({ invoice, items, type, label, prefix }) {
  const puppeteer = require("puppeteer");

  const TYPE_MAP = {
    quotation : { label: "PROPOSAL",          prefix: "QT" },
    performa  : { label: "PROFORMA INVOICE",  prefix: "PI" },
  };
  const def = TYPE_MAP[type] || TYPE_MAP.performa;
  const docLabel  = label  || def.label;
  const docPrefix = prefix || def.prefix;

  const h = invoice;

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "---";
  const fmtNum  = (n) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const invoiceDate = h.invoice_date || h.quotation_date || h.estimate_date || new Date().toISOString();
  const year        = new Date(invoiceDate).getFullYear();
  const docId       = h.invoice_id || h.quotation_id || h.id || "001";
  
  // Format doc number cleanly
  const docNumber   = h.reference_no || `${docPrefix}-${year}-${String(docId).slice(-3)}`;
  const taxRate     = h.tax_type === "GST0" ? 0
    : h.tax_type === "GST5" ? 5
    : h.tax_type === "CUSTOM" ? (Number(h.custom_tax) || 0)
    : 18;

  // Only show the tax columns when GST is applicable
  const showTax = taxRate > 0;
  // Only show the HSN column when at least one line item has an HSN code
  const showHsn = (items || []).some(item => item.hsn_code && String(item.hsn_code).trim() !== "");

  const clientAddr  = [h.client_address1, h.client_address2, h.client_city, h.client_state, h.client_pincode]
    .filter(Boolean).join(", ");

  const terms = [];
  if (h.terms_general)        terms.push("General Terms &amp; Conditions apply.");
  if (h.terms_tax)            terms.push("Prices quoted are exclusive of Sales and Service Tax (SEZ – NIL Tax applicable).");
  if (h.terms_project_period) terms.push(`Project Period: ${esc(h.terms_project_period)}`);
  if (h.terms_validity)       terms.push("Quote valid for 15 days from the date of quotation.");
  try {
    const so = typeof h.terms_separate_orders === "string"
      ? JSON.parse(h.terms_separate_orders) : (h.terms_separate_orders || {});
    if (so.material)     terms.push("A. Material Supply (As per actuals)");
    if (so.installation) terms.push("B. Installation / Services");
    if (so.usd)          terms.push("C. Price may vary based on USD rates");
    if (so.boq)          terms.push("D. Factory BOQ may vary");
  } catch (_) {}
  if (h.terms_payment) {
    const pt = h.terms_payment === "Custom" ? h.terms_payment_custom : h.terms_payment;
    if (pt) terms.push(`Payment Terms: ${esc(pt)}`);
  }
  if (h.terms_warranty) terms.push(`Warranty: ${esc(h.terms_warranty)}`);

  const itemRows = (items || []).map((item, i) => {
    const itemTax = Number(item.tax || taxRate || 0);
    const itemQty = Number(item.quantity || 1);
    const itemRate = Number(item.price || 0);
    const taxVal = itemQty * itemRate * (itemTax / 100);
    const itemAmt = itemQty * itemRate;

    let cells = `<td class="tc center">${i + 1}</td>`;
    if (showHsn) cells += `<td class="tc center">${esc(item.hsn_code || "—")}</td>`;
    cells += `<td class="td-desc"><strong>${esc(item.description || "")}</strong></td>`;
    cells += `<td class="tc center">${esc(String(itemQty))} ${esc(item.uom || "Nos")}</td>`;
    cells += `<td class="tc right">&#8377;${fmtNum(itemRate)}</td>`;
    if (showTax) {
      cells += `<td class="tc center">${itemTax}%</td>`;
      cells += `<td class="tc right">&#8377;${fmtNum(taxVal)}</td>`;
    }
    cells += `<td class="tc right bold">&#8377;${fmtNum(itemAmt)}</td>`;

    return `<tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">${cells}</tr>`;
  }).join("");

  const logoHtml = LOGO_SRC
    ? `<img src="${LOGO_SRC}" alt="Madhura Technologies" class="logo-img" />`
    : `<div class="logo-text">MADHURA</div>`;

  const execHtml = (h.exec_name || h.exec_phone || h.exec_email)
    ? `<div class="exec-row">
        <span class="label">Executive:</span>
        ${h.exec_name  ? `<strong>${esc(h.exec_name)}</strong>` : ""}
        ${h.exec_phone ? `<span>&#128222; ${esc(h.exec_phone)}</span>` : ""}
        ${h.exec_email ? `<span>&#9993; ${esc(h.exec_email)}</span>` : ""}
      </div>` : "";

  const discRow = Number(h.total_discount) > 0
    ? `<tr><td>Discount</td><td class="right red">-&#8377;${fmtNum(h.total_discount)}</td></tr>` : "";

  const termsSection = terms.length
    ? `<div class="section avoid">
        <div class="section-title">Terms &amp; Conditions</div>
        <ul class="terms-list">${terms.map(t => `<li>${t}</li>`).join("")}</ul>
      </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4 portrait; margin: 8mm 8mm 10mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #1a1a1a;
    background: #FFFFFF;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-container {
    border: 2px solid #003366;
    border-radius: 4px;
    overflow: hidden;
    background: #FFFFFF;
    position: relative;
  }
  .watermark {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    opacity: 0.03; pointer-events: none; z-index: 0;
    width: 80%; height: 80%;
    display: flex; align-items: center; justify-content: center;
  }
  .watermark img { width: 100%; height: 100%; object-fit: contain; }
  .pdf-content { position: relative; z-index: 1; }

  .avoid          { page-break-inside: avoid; break-inside: avoid; }
  .bold           { font-weight: 700; }
  .center         { text-align: center; }
  .right          { text-align: right; }
  .red            { color: #dc2626; }
  .accent         { color: #003366; }

  .header-bar     { display: flex; justify-content: space-between; align-items: center;
                    padding: 16px 20px; background: linear-gradient(135deg, #F8FAFB 0%, #E6EEF5 100%); 
                    border-bottom: 3px solid #003366; box-shadow: 0 2px 4px rgba(0,51,102,0.08); }
  .logo-img       { height: 50px; width: auto; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
  .logo-text      { font-size: 20pt; font-weight: 900; color: #003366; }
  .doc-title      { font-size: 20pt; font-weight: 900; color: #003366;
                    letter-spacing: 3px; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,51,102,0.1); }

  .corp-office    { padding: 15px 20px; border-bottom: 1px solid #D0DFEC; background: #FAFBFC;
                    text-align: center; }
  .corp-text      { font-size: 8.5pt; color: #2C3E50; line-height: 1.7; }
  .corp-text strong { color: #003366; font-weight: 700; letter-spacing: 0.5px; }

  .addr-strip     { display: flex; border-bottom: 1px solid #dde3ea; margin-top: 10px; }
  .addr-from      { flex: 1; padding: 10px 20px; border-right: 1px solid #dde3ea; }
  .addr-to        { flex: 1; padding: 10px 20px; background: #f9fafb; }
  .addr-label     { font-size: 8pt; font-weight: 700; color: #003366;
                    text-transform: uppercase; letter-spacing: 1px;
                    border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 6px; }
  .to-company     { font-size: 10pt; font-weight: 900; color: #111; margin-bottom: 3px; }
  .to-name        { font-size: 9pt; font-weight: 700; color: #222; margin-bottom: 4px; }
  .to-addr        { font-size: 8pt; color: #555; line-height: 1.6; margin-bottom: 4px; }
  .to-contacts    { display: flex; gap: 14px; font-size: 8pt; font-weight: 600;
                    color: #333; border-top: 1px solid #e5e7eb; padding-top: 5px; margin-top: 4px; }

  .doc-details-box { width: 230px; min-width: 230px; background: #FFFFFF; }
  .doc-box-header  { background: linear-gradient(135deg, #003366 0%, #004080 100%); color: #fff; padding: 7px 10px; font-size: 8.5pt;
                     font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
  .doc-box-content { padding: 10px 10px; font-size: 8pt; line-height: 2; color: #333; }
  .doc-row         { display: flex; justify-content: space-between; }
  .doc-row strong  { font-weight: 700; }
  .doc-divider     { border-top: 1px solid #e0e0e0; margin-top: 6px; padding-top: 6px; }

  .section        { padding: 10px 20px; }
  .items-wrap     { border: 1.5px solid #d0d8e0; border-radius: 3px; overflow: hidden; }
  table.items     { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.items thead tr { background: linear-gradient(135deg, #003366 0%, #004080 100%); color: #fff; }
  table.items thead th {
    padding: 8px 5px; text-align: center; font-size: 8pt;
    text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;
  }
  table.items thead th.left  { text-align: left; padding-left: 10px; }
  table.items thead th.right { text-align: right; padding-right: 10px; }
  .tc             { padding: 6px 5px; font-size: 8pt; color: #333; border-bottom: 1px solid #eee; }
  .td-desc        { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .td-desc strong { font-size: 8.5pt; font-weight: 700; color: #111; }
  .desc-sub       { font-size: 7.5pt; color: #555; margin-top: 1px; }
  .row-even       { background: #fff; }
  .row-odd        { background: #f9fafb; }
  table.items tbody tr:last-child .tc,
  table.items tbody tr:last-child .td-desc { border-bottom: none; }

  .totals-wrap    { display: flex; justify-content: flex-end; padding: 0 20px 10px; }
  .totals-box     { width: 280px; background: #f8fafc; border: 1px solid #dde3ea;
                    border-radius: 4px; padding: 10px 12px; }
  table.totals    { width: 100%; font-size: 8pt; }
  table.totals td { padding: 3px 0; color: #555; }
  table.totals .right { text-align: right; font-weight: 700; color: #111; }
  .gt-row td      { padding-top: 7px; font-size: 10pt; font-weight: 900;
                    border-top: 1px solid #d1d5db; padding-top: 7px; }
  .gt-row .right  { color: #003366; font-size: 11pt; }

  .section-title  { font-size: 8pt; font-weight: 700; color: #003366;
                    text-transform: uppercase; letter-spacing: 0.8px;
                    border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 7px; }
  .terms-list     { padding-left: 16px; list-style: disc; }
  .terms-list li  { font-size: 8pt; color: #444; margin-bottom: 3px; font-weight: 500; line-height: 1.6; }

  .signature-section { padding: 12px 20px 16px; text-align: right; }
  .sig-for        { font-size: 8pt; color: #666; margin-bottom: 4px; }
  .sig-stamp      { height: 55px; object-fit: contain; mix-blend-mode: multiply; }
  .sig-line       { border-top: 1px solid #003366; font-weight: 700; font-size: 8pt;
                    text-transform: uppercase; padding-top: 4px; color: #003366;
                    letter-spacing: 0.5px; margin-top: 6px; display: inline-block; min-width: 180px; }
</style>
</head>
<body>

<div class="pdf-container">

<div class="watermark">
  ${LOGO_SRC ? `<img src="${LOGO_SRC}" alt="" />` : ""}
</div>

<div class="pdf-content">

<!-- ── HEADER: Logo + Title ── -->
<div class="header-bar avoid">
  <div>${logoHtml}</div>
  <div class="doc-title">${docLabel}</div>
</div>

<!-- ── CORPORATE OFFICE ── -->
<div class="corp-office avoid">
  <div class="corp-text">
    <strong>Corporate Office:</strong> ${esc(COMPANY_DETAILS.address)}<br/>
    <strong>Phone:</strong> ${esc(COMPANY_DETAILS.phone)} | <strong>Email:</strong> ${esc(COMPANY_DETAILS.email)} | <strong>GSTIN:</strong> ${esc(COMPANY_DETAILS.gstin)}
  </div>
</div>

<!-- ── CUSTOMER & DOC DETAILS ── -->
<div class="addr-strip avoid">
  <div class="addr-from">
    <div class="addr-label">Bill To</div>
    <div class="to-company">${esc(h.client_company || h.customer_name)}</div>
    ${clientAddr ? `<div class="to-addr">${esc(clientAddr)}</div>` : ""}
    ${h.client_country ? `<div class="to-addr">${esc(h.client_country)}</div>` : ""}
    <div class="to-contacts">
      <span>&#128222; ${esc(h.mobile_number || "")}</span>
      ${h.email ? `<span>&#9993; ${esc(h.email)}</span>` : ""}
    </div>
    ${h.client_gstin ? `<div style="margin-top:5px;font-size:8pt;"><strong>GSTIN:</strong> ${esc(h.client_gstin)}</div>` : ""}
  </div>
  <div class="doc-details-box">
    <div class="doc-box-header">Details</div>
    <div class="doc-box-content">
      <div class="doc-row"><strong>Doc No:</strong> <span>${docNumber}</span></div>
      <div class="doc-row"><strong>Date:</strong> <span>${fmtDate(invoiceDate)}</span></div>
      <div class="doc-row"><strong>Valid Until:</strong> <span>${h.validity || "15 Days"}</span></div>
      <div class="doc-row"><strong>State Code:</strong> <span>33</span></div>
      <div class="doc-row doc-divider"><strong>Customer ID:</strong> <span>${h.client_code || `MT${String(h.customer_id || docId).slice(-3)}`}</span></div>
      ${h.email ? `<div class="doc-row"><strong>Email:</strong> <span style="font-size:7pt;">${esc(h.email)}</span></div>` : ""}
    </div>
  </div>
</div>

<!-- ── ITEMS TABLE ── -->
<div class="section">
  <div class="items-wrap">
    <table class="items">
      <thead>
        <tr>
          <th style="width:4%;">#</th>
          ${showHsn ? '<th style="width:8%;">HSN</th>' : ''}
          <th class="left" style="text-align:left;">Description</th>
          <th style="width:7%;">Qty</th>
          <th style="width:10%;text-align:right;">Rate</th>
          ${showTax ? '<th style="width:6%;">GST</th>' : ''}
          ${showTax ? '<th style="width:11%;text-align:right;">Tax Val</th>' : ''}
          <th style="width:16%;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>
</div>

<!-- ── TOTALS ── -->
<div class="totals-wrap avoid">
  <div class="totals-box">
    <table class="totals">
      <tr><td>Subtotal</td><td class="right">&#8377;${fmtNum(h.subtotal)}</td></tr>
      ${discRow}
      ${showTax ? `<tr><td>CGST (${taxRate / 2}%)</td><td class="right">&#8377;${fmtNum(h.total_cgst)}</td></tr>` : ''}
      ${showTax ? `<tr><td>SGST (${taxRate / 2}%)</td><td class="right">&#8377;${fmtNum(h.total_sgst)}</td></tr>` : ''}
      <tr class="gt-row">
        <td class="bold">Grand Total</td>
        <td class="right">&#8377;${fmtNum(h.grand_total)}</td>
      </tr>
    </table>
  </div>
</div>

<!-- ── TERMS ── -->
${termsSection}

<!-- ── SIGNATURE ── -->
<div class="signature-section avoid">
  <div style="text-align:center;display:inline-block;min-width:200px;">
    <div class="sig-for">For ${esc(COMPANY_DETAILS.name)}</div>
    ${LOGO_SRC ? `<img src="${LOGO_SRC}" alt="Signature" class="sig-stamp" />` : `<div style="height:55px;"></div>`}
    <div class="sig-line">Authorised Signatory</div>
  </div>
</div>

</div><!-- /pdf-content -->
</div><!-- /pdf-container -->

</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    
    // Wait for logo to load
    await page.evaluate(() =>
      new Promise((resolve) => {
        const imgs = Array.from(document.images);
        if (imgs.every(i => i.complete)) return resolve();
        let loaded = 0;
        imgs.forEach(img => {
          img.addEventListener("load",  () => { if (++loaded === imgs.length) resolve(); });
          img.addEventListener("error", () => { if (++loaded === imgs.length) resolve(); });
        });
        setTimeout(resolve, 3000);
      })
    );

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateInvoicePdf };
