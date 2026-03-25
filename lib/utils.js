import { format, formatDistanceToNow } from 'date-fns';

// ─── CURRENCY ─────────────────────────────────────────────
export const formatCurrency = (amount, symbol = '₹') => {
  if (amount === null || amount === undefined) return `${symbol}0`;
  return `${symbol}${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

// ─── DATES ────────────────────────────────────────────────
export const formatDate = (date) =>
  date ? format(new Date(date), 'dd MMM yyyy') : '—';

export const formatDateShort = (date) =>
  date ? format(new Date(date), 'dd/MM/yy') : '—';

export const timeAgo = (date) =>
  date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : '—';

// ─── INVOICE NUMBER ───────────────────────────────────────
export const generateInvoiceNo = () => {
  const year  = new Date().getFullYear();
  const rand  = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${rand}`;
};

// ─── STATUS ───────────────────────────────────────────────
export const PROJECT_STATUS_LABELS = {
  active:    'Active',
  paused:    'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const INVOICE_STATUS_LABELS = {
  draft:   'Draft',
  sent:    'Sent',
  paid:    'Paid',
  overdue: 'Overdue',
};

export const SKILL_TYPE_LABELS = {
  painter:    'Painter',
  helper:     'Helper',
  supervisor: 'Supervisor',
};

// ─── VALIDATION ───────────────────────────────────────────
export const isValidPhone = (phone) =>
  /^[6-9]\d{9}$/.test(phone?.replace(/\s/g, ''));

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ─── PROFIT MARGIN ────────────────────────────────────────
export const calcProfitMargin = (revenue, cost) => {
  if (!revenue || revenue === 0) return 0;
  return (((revenue - cost) / revenue) * 100).toFixed(1);
};
