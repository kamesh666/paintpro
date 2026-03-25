import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Alert } from 'react-native';
import { formatCurrency, formatDate } from './utils';

// ─── Generate Invoice HTML ────────────────────────────────
export const buildInvoiceHTML = ({ invoice, items, client, project }) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 36px; color: #1A1A2E; font-size: 13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; }
  .brand-name { font-size:26px; font-weight:800; color:#1E3A5F; }
  .brand-sub  { font-size:11px; color:#6B7280; letter-spacing:2px; text-transform:uppercase; margin-top:2px; }
  .inv-label  { text-align:right; }
  .inv-title  { font-size:20px; font-weight:800; color:#1E3A5F; }
  .inv-no     { font-size:14px; font-weight:700; color:#1A1A2E; margin-top:2px; }
  .inv-date   { font-size:11px; color:#6B7280; margin-top:3px; }
  .divider    { height:3px; background:linear-gradient(90deg,#1E3A5F,#2E5490); margin:0 0 24px; border-radius:2px; }
  .parties    { display:flex; justify-content:space-between; margin-bottom:28px; gap:24px; }
  .party      { flex:1; }
  .party-lbl  { font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:6px; }
  .party-name { font-size:15px; font-weight:700; color:#1A1A2E; margin-bottom:3px; }
  .party-info { font-size:11px; color:#6B7280; line-height:1.7; }
  table       { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr    { background:#1E3A5F; }
  th          { color:#fff; padding:9px 12px; text-align:left; font-size:11px; font-weight:700; letter-spacing:0.5px; }
  th:last-child { text-align:right; }
  td          { padding:9px 12px; border-bottom:1px solid #F0F0F0; font-size:12px; color:#1A1A2E; vertical-align:top; }
  td:last-child { text-align:right; font-weight:600; color:#1E3A5F; }
  tr:nth-child(even) td { background:#FAFAFA; }
  .totals-wrap { display:flex; justify-content:flex-end; margin-bottom:24px; }
  .totals     { width:240px; }
  .t-row      { display:flex; justify-content:space-between; padding:5px 0; font-size:12px; }
  .t-row.tax  { color:#6B7280; }
  .t-row.grand{ border-top:2px solid #1E3A5F; margin-top:8px; padding-top:10px; font-size:15px; font-weight:800; color:#1E3A5F; }
  .t-row.paid { color:#27AE60; font-weight:600; }
  .t-row.bal  { color:#E74C3C; font-weight:800; font-size:13px; margin-top:4px; }
  .status-stamp { display:inline-block; padding:4px 14px; border-radius:20px; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; margin-bottom:20px; }
  .status-paid    { background:#E1F5EE; color:#085041; border:1.5px solid #1D9E75; }
  .status-sent    { background:#FAEEDA; color:#633806; border:1.5px solid #EF9F27; }
  .status-draft   { background:#F1EFE8; color:#444441; border:1.5px solid #888780; }
  .status-overdue { background:#FCEBEB; color:#791F1F; border:1.5px solid #E24B4A; }
  .notes      { background:#F5F6FA; border-radius:8px; padding:12px; font-size:11px; color:#6B7280; margin-bottom:24px; line-height:1.6; }
  .notes strong { color:#1A1A2E; }
  .footer     { text-align:center; font-size:10px; color:#9CA3AF; border-top:1px solid #E0E0E0; padding-top:14px; margin-top:8px; line-height:1.8; }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand-name">PaintPro</div>
    <div class="brand-sub">Painting Contractor</div>
  </div>
  <div class="inv-label">
    <div class="inv-title">INVOICE</div>
    <div class="inv-no">${invoice.invoice_no}</div>
    <div class="inv-date">Date: ${formatDate(invoice.invoice_date)}</div>
    ${invoice.due_date ? `<div class="inv-date">Due: ${formatDate(invoice.due_date)}</div>` : ''}
  </div>
</div>

<div class="divider"></div>

<span class="status-stamp status-${invoice.status}">${invoice.status.toUpperCase()}</span>

<div class="parties">
  <div class="party">
    <div class="party-lbl">Bill to</div>
    <div class="party-name">${client?.name ?? 'Client'}</div>
    <div class="party-info">
      ${client?.phone   ? `📞 ${client.phone}<br/>` : ''}
      ${client?.email   ? `✉ ${client.email}<br/>` : ''}
      ${client?.address ? `📍 ${client.address}`    : ''}
    </div>
  </div>
  <div class="party">
    <div class="party-lbl">Project</div>
    <div class="party-name">${project?.title ?? '—'}</div>
    <div class="party-info">
      ${project?.location ? `📍 ${project.location}<br/>` : ''}
      ${project?.start_date ? `Started: ${formatDate(project.start_date)}` : ''}
    </div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:48%">Description</th>
      <th style="width:12%;text-align:center">Qty</th>
      <th style="width:20%;text-align:right">Unit price</th>
      <th style="width:20%">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${(items ?? []).map(item => `
      <tr>
        <td>${item.description ?? ''}</td>
        <td style="text-align:center">${item.quantity ?? 1}</td>
        <td style="text-align:right">${formatCurrency(item.unit_price)}</td>
        <td>${formatCurrency((parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0))}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <div class="t-row">
      <span>Subtotal</span>
      <span>${formatCurrency(invoice.subtotal)}</span>
    </div>
    ${parseFloat(invoice.tax_percent) > 0 ? `
    <div class="t-row tax">
      <span>Tax (${invoice.tax_percent}%)</span>
      <span>${formatCurrency(invoice.tax_amount)}</span>
    </div>` : ''}
    <div class="t-row grand">
      <span>Total</span>
      <span>${formatCurrency(invoice.total)}</span>
    </div>
    ${parseFloat(invoice.amount_paid) > 0 ? `
    <div class="t-row paid">
      <span>Amount paid</span>
      <span>− ${formatCurrency(invoice.amount_paid)}</span>
    </div>` : ''}
    ${parseFloat(invoice.balance) > 0 ? `
    <div class="t-row bal">
      <span>Balance due</span>
      <span>${formatCurrency(invoice.balance)}</span>
    </div>` : `
    <div class="t-row" style="color:#27AE60;font-weight:700;margin-top:4px">
      <span>✓ Fully paid</span><span></span>
    </div>`}
  </div>
</div>

${invoice.notes ? `
<div class="notes">
  <strong>Notes:</strong> ${invoice.notes}
</div>` : ''}

<div class="footer">
  Thank you for your business!<br/>
  Generated by PaintPro · ${new Date().toLocaleDateString('en-IN')}
</div>

</body>
</html>
`;

// ─── Generate PDF and share ───────────────────────────────
export const shareInvoicePDF = async ({ invoice, items, client, project }) => {
  try {
    const html = buildInvoiceHTML({ invoice, items, client, project });

    // Generate PDF file
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Check if sharing is available
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Not supported', 'Sharing is not available on this device.');
      return;
    }

    // Share the PDF — opens share sheet including WhatsApp
    await Sharing.shareAsync(uri, {
      mimeType:    'application/pdf',
      dialogTitle: `Invoice ${invoice.invoice_no}`,
      UTI:         'com.adobe.pdf',
    });
  } catch (e) {
    Alert.alert('Error', 'Could not generate PDF.\n' + e.message);
  }
};

// ─── Share invoice as WhatsApp text message ───────────────
export const shareInvoiceWhatsApp = async ({ invoice, client }) => {
  const phone = client?.phone?.replace(/\D/g, '');
  const number = phone
    ? (phone.startsWith('91') ? phone : '91' + phone)
    : null;

  const balance = parseFloat(invoice.balance ?? 0);
  const isPaid  = balance <= 0;

  const message = [
    `*Invoice ${invoice.invoice_no}*`,
    `Date: ${formatDate(invoice.invoice_date)}`,
    ``,
    `*Amount: ${formatCurrency(invoice.total)}*`,
    invoice.amount_paid > 0 ? `Paid: ${formatCurrency(invoice.amount_paid)}` : null,
    balance > 0 ? `*Balance due: ${formatCurrency(balance)}*` : `✅ Fully paid`,
    invoice.due_date ? `Due date: ${formatDate(invoice.due_date)}` : null,
    ``,
    `Thank you for your business!`,
    `— PaintPro`,
  ].filter(Boolean).join('\n');

  const encodedMsg = encodeURIComponent(message);
  const url = number
    ? `https://wa.me/${number}?text=${encodedMsg}`
    : `https://wa.me/?text=${encodedMsg}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not found', 'Please install WhatsApp to use this feature.');
    }
  } catch (e) {
    Alert.alert('Error', 'Could not open WhatsApp.\n' + e.message);
  }
};
