import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, TextInput, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { useInvoices, useUpsertInvoice, useClients, useProjects } from '../../hooks/useSupabase';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, FontSize } from '../../constants/colors';
import { formatCurrency, formatDate, generateInvoiceNo, INVOICE_STATUS_LABELS } from '../../lib/utils';
import { ShareSheet } from '../../lib/ShareSheet';

const INPUT = {
  backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
  fontSize: 15, color: '#1A1A2E',
};

const STATUS_CONFIG = {
  draft:   { bg: '#F1EFE8', text: '#444441', dot: '#888780' },
  sent:    { bg: '#FAEEDA', text: '#633806', dot: '#F39C12' },
  paid:    { bg: '#E1F5EE', text: '#085041', dot: '#27AE60' },
  overdue: { bg: '#FCEBEB', text: '#791F1F', dot: '#E74C3C' },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <View style={[styles.dot, { backgroundColor: s.dot }]} />
      <Text style={[styles.badgeText, { color: s.text }]}>{INVOICE_STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

function InvoiceCard({ invoice, onPress, onShare }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNo}>{invoice.invoice_no}</Text>
          <Text style={styles.cardClient} numberOfLines={1}>{invoice.clients?.name ?? 'No client'}</Text>
          <Text style={styles.cardProject} numberOfLines={1}>{invoice.projects?.title ?? ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={invoice.status} />
          <Text style={styles.cardTotal}>{formatCurrency(invoice.total)}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>📅 {formatDate(invoice.invoice_date)}</Text>
        {(invoice.balance ?? 0) > 0 && (
          <Text style={[styles.cardMeta, { color: Colors.danger }]}>⚠ Due: {formatCurrency(invoice.balance)}</Text>
        )}
        <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(invoice)}>
          <Text style={styles.shareBtnText}>↗ Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Invoice Modal ────────────────────────────────────────
function InvoiceModal({ visible, onClose, invoice }) {
  const { data: clients }  = useClients();
  const { data: projects } = useProjects();
  const upsert  = useUpsertInvoice();
  const profile = useAuthStore((s) => s.profile);
  const isEdit  = !!invoice?.id;

  // ✅ Individual state + useEffect reset
  const [invoiceNo,   setInvoiceNo]   = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [clientId,    setClientId]    = useState('');
  const [projectId,   setProjectId]   = useState('');
  const [taxPercent,  setTaxPercent]  = useState('0');
  const [amountPaid,  setAmountPaid]  = useState('0');
  const [status,      setStatus]      = useState('draft');
  const [notes,       setNotes]       = useState('');
  const [items,       setItems]       = useState([{ description: 'Painting work', quantity: '1', unit_price: '' }]);
  const [saving,      setSaving]      = useState(false);
  const [clientOpen,  setClientOpen]  = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [statusOpen,  setStatusOpen]  = useState(false);

  useEffect(() => {
    if (visible) {
      setInvoiceNo  (invoice?.invoice_no   ?? generateInvoiceNo());
      setInvoiceDate(invoice?.invoice_date ?? new Date().toISOString().split('T')[0]);
      setDueDate    (invoice?.due_date     ?? '');
      setClientId   (invoice?.client_id   ?? '');
      setProjectId  (invoice?.project_id  ?? '');
      setTaxPercent (invoice?.tax_percent?.toString()  ?? '0');
      setAmountPaid (invoice?.amount_paid?.toString()  ?? '0');
      setStatus     (invoice?.status      ?? 'draft');
      setNotes      (invoice?.notes       ?? '');
      setItems      (invoice?.invoice_items?.length
        ? invoice.invoice_items.map(i => ({ description: i.description, quantity: i.quantity?.toString(), unit_price: i.unit_price?.toString() }))
        : [{ description: 'Painting work', quantity: '1', unit_price: '' }]);
      setClientOpen (false);
      setProjectOpen(false);
      setStatusOpen (false);
    }
  }, [visible, invoice]);

  const subtotal   = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const taxAmount  = subtotal * ((parseFloat(taxPercent) || 0) / 100);
  const total      = subtotal + taxAmount;
  const paid       = parseFloat(amountPaid) || 0;
  const balance    = total - paid;

  const addItem    = () => setItems(prev => [...prev, { description: '', quantity: '1', unit_price: '' }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const setItem    = (i, k, v) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const selectedClient  = clients?.find(c => c.id === clientId);
  const selectedProject = projects?.find(p => p.id === projectId);

  const handleSave = async () => {
    if (!clientId)  { Alert.alert('Required', 'Please select a client');  return; }
    if (!projectId) { Alert.alert('Required', 'Please select a project'); return; }
    if (items.every(i => !i.unit_price)) { Alert.alert('Required', 'Add at least one item with a price'); return; }
    setSaving(true);
    try {
      await upsert.mutateAsync({
        invoice: {
          ...(isEdit ? { id: invoice.id } : {}),
          invoice_no: invoiceNo, invoice_date: invoiceDate,
          due_date: dueDate || null, client_id: clientId, project_id: projectId,
          subtotal, tax_percent: parseFloat(taxPercent) || 0,
          tax_amount: taxAmount, total, amount_paid: paid,
          status, notes, created_by: profile?.id,
        },
        items: items.filter(i => i.description && i.unit_price).map(i => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
        })),
      });
      onClose();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const Picker = ({ label, open, onToggle, value, placeholder, children }) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.picker} onPress={onToggle}>
        <Text style={value ? styles.pickerValue : styles.pickerPlaceholder}>{value ?? placeholder}</Text>
        <Text style={styles.pickerArrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.dropdown}>{children}</View>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{isEdit ? 'Edit invoice' : 'New invoice'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Invoice no.</Text>
              <TextInput style={INPUT} value={invoiceNo} onChangeText={setInvoiceNo} underlineColorAndroid="transparent" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date</Text>
              <TextInput style={INPUT} value={invoiceDate} onChangeText={setInvoiceDate}
                placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation" underlineColorAndroid="transparent" />
            </View>
          </View>

          <Picker label="Client *" open={clientOpen} onToggle={() => { setClientOpen(!clientOpen); setProjectOpen(false); setStatusOpen(false); }}
            value={selectedClient?.name} placeholder="Select client">
            {(clients ?? []).map(c => (
              <TouchableOpacity key={c.id} style={[styles.dropItem, clientId === c.id && styles.dropItemActive]}
                onPress={() => { setClientId(c.id); setClientOpen(false); }}>
                <Text style={[styles.dropText, clientId === c.id && { color: Colors.primary, fontWeight: '700' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </Picker>

          <Picker label="Project *" open={projectOpen} onToggle={() => { setProjectOpen(!projectOpen); setClientOpen(false); setStatusOpen(false); }}
            value={selectedProject?.title} placeholder="Select project">
            {(projects ?? []).map(p => (
              <TouchableOpacity key={p.id} style={[styles.dropItem, projectId === p.id && styles.dropItemActive]}
                onPress={() => { setProjectId(p.id); setProjectOpen(false); }}>
                <Text style={[styles.dropText, projectId === p.id && { color: Colors.primary, fontWeight: '700' }]}>{p.title}</Text>
              </TouchableOpacity>
            ))}
          </Picker>

          <Picker label="Status" open={statusOpen} onToggle={() => { setStatusOpen(!statusOpen); setClientOpen(false); setProjectOpen(false); }}
            value={INVOICE_STATUS_LABELS[status]} placeholder="Select status">
            {Object.entries(INVOICE_STATUS_LABELS).map(([key, label]) => (
              <TouchableOpacity key={key} style={[styles.dropItem, status === key && styles.dropItemActive]}
                onPress={() => { setStatus(key); setStatusOpen(false); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.dot, { backgroundColor: STATUS_CONFIG[key]?.dot }]} />
                  <Text style={[styles.dropText, status === key && { color: Colors.primary, fontWeight: '700' }]}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Picker>

          {/* Line items */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <Text style={[styles.label, { marginTop: 0 }]}>Line items</Text>
            <TouchableOpacity onPress={addItem} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 13 }}>+ Add item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, i) => (
            <View key={i} style={styles.lineItem}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput style={[INPUT, { flex: 1 }]} value={item.description}
                  onChangeText={v => setItem(i, 'description', v)}
                  placeholder="Description" placeholderTextColor="#9CA3AF" underlineColorAndroid="transparent" />
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(i)} style={{ padding: 8, justifyContent: 'center' }}>
                    <Text style={{ color: Colors.danger, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput style={[INPUT, { flex: 1, textAlign: 'center' }]} value={item.quantity}
                  onChangeText={v => setItem(i, 'quantity', v)}
                  placeholder="Qty" placeholderTextColor="#9CA3AF"
                  keyboardType="numeric" underlineColorAndroid="transparent" />
                <TextInput style={[INPUT, { flex: 2 }]} value={item.unit_price}
                  onChangeText={v => setItem(i, 'unit_price', v)}
                  placeholder="Unit price (₹)" placeholderTextColor="#9CA3AF"
                  keyboardType="numeric" underlineColorAndroid="transparent" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary, minWidth: 60, textAlign: 'right' }}>
                  {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                </Text>
              </View>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.totalLabel}>Tax (%)</Text>
                <TextInput style={[INPUT, { width: 60, paddingVertical: 6, textAlign: 'center', fontSize: 13 }]}
                  value={taxPercent} onChangeText={setTaxPercent}
                  keyboardType="numeric" underlineColorAndroid="transparent" />
              </View>
              <Text style={styles.totalValue}>{formatCurrency(taxAmount)}</Text>
            </View>
            <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#E0E0E0', marginTop: 6, paddingTop: 10 }]}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1A2E' }}>Total</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.primary }}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Amount paid (₹)</Text>
              <TextInput style={[INPUT, { width: 100, paddingVertical: 6, textAlign: 'right', fontSize: 13 }]}
                value={amountPaid} onChangeText={setAmountPaid}
                keyboardType="numeric" underlineColorAndroid="transparent" />
            </View>
            {balance > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: Colors.danger }]}>Balance due</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.danger }}>{formatCurrency(balance)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[INPUT, { height: 80, textAlignVertical: 'top' }]}
            value={notes} onChangeText={setNotes}
            placeholder="Payment terms, bank details..." placeholderTextColor="#9CA3AF"
            multiline underlineColorAndroid="transparent" />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
const FILTERS = [
  { key: null, label: 'All' }, { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' }, { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

export default function InvoicesScreen() {
  const [filter,      setFilter]      = useState(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [shareTarget, setShareTarget] = useState(null);

  const { data: invoices, isLoading, refetch, isRefetching } = useInvoices();

  const filtered = (invoices ?? []).filter(inv => !filter || inv.status === filter);

  const totalInvoiced = filtered.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalPaid     = filtered.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
  const totalBalance  = filtered.reduce((s, i) => s + (i.balance ?? 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={String(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!isLoading && filtered.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Invoiced</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatCurrency(totalInvoiced)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Collected</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatCurrency(totalPaid)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>{formatCurrency(totalBalance)}</Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>{[1,2,3].map(i => <View key={i} style={styles.skeleton} />)}</View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🧾</Text>
          <Text style={styles.emptyTitle}>No invoices yet</Text>
          <Text style={styles.emptyMsg}>Tap + to create your first invoice</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.emptyBtnText}>Create invoice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <InvoiceCard
              invoice={item}
              onPress={() => { setSelected(item); setModalOpen(true); }}
              onShare={setShareTarget}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { setSelected(null); setModalOpen(true); }} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <InvoiceModal
        visible={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        invoice={selected}
      />
      <ShareSheet
        visible={!!shareTarget}
        onClose={() => setShareTarget(null)}
        invoice={shareTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  chip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' },
  chipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:    { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  summaryRow:  { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel:{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  summaryValue:{ fontSize: 15, fontWeight: '800' },
  summaryDivider: { width: 0.5, backgroundColor: '#E0E0E0' },
  card:        { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 10, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardNo:      { fontSize: 15, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  cardClient:  { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 1 },
  cardProject: { fontSize: 12, color: Colors.textMuted },
  cardTotal:   { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  divider:     { height: 0.5, backgroundColor: '#E0E0E0', marginBottom: 10 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMeta:    { fontSize: 12, color: Colors.textMuted, flex: 1 },
  shareBtn:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.primary + '12' },
  shareBtnText:{ fontSize: 12, color: Colors.primary, fontWeight: '700' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  badgeText:   { fontSize: 11, fontWeight: '600' },
  skeleton:    { height: 100, backgroundColor: '#E0E0E0', borderRadius: 14, opacity: 0.5 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptyMsg:    { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn:    { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  fab:         { position: 'absolute', bottom: 80, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabIcon:     { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  modalClose:  { padding: 4, width: 32 },
  closeText:   { fontSize: 18, color: Colors.textSecondary },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  saveBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBody:   { flex: 1, padding: 16 },
  label:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  picker:      { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { fontSize: 15, color: '#1A1A2E' },
  pickerPlaceholder: { fontSize: 15, color: '#9CA3AF' },
  pickerArrow: { fontSize: 12, color: Colors.textMuted },
  dropdown:    { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropItem:    { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dropItemActive: { backgroundColor: '#EFF6FF' },
  dropText:    { fontSize: 15, color: '#1A1A2E' },
  lineItem:    { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  totalsBox:   { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginVertical: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  totalLabel:  { fontSize: 13, color: Colors.textSecondary },
  totalValue:  { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
});
