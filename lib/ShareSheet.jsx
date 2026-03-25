import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../constants/colors';
import { shareInvoicePDF, shareInvoiceWhatsApp } from './shareInvoice';
import { supabase } from './supabase';

export function ShareSheet({ visible, onClose, invoice }) {
  const [loading, setLoading] = useState(null); // 'pdf' | 'whatsapp' | null

  const fetchFullInvoice = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(*), projects(*), invoice_items(*)')
      .eq('id', invoice.id)
      .single();
    return data;
  };

  const handlePDF = async () => {
    setLoading('pdf');
    try {
      const full = await fetchFullInvoice();
      await shareInvoicePDF({
        invoice: full,
        items:   full.invoice_items ?? [],
        client:  full.clients,
        project: full.projects,
      });
    } finally {
      setLoading(null);
      onClose();
    }
  };

  const handleWhatsApp = async () => {
    setLoading('whatsapp');
    try {
      const full = await fetchFullInvoice();
      await shareInvoiceWhatsApp({
        invoice: full,
        client:  full.clients,
      });
    } finally {
      setLoading(null);
      onClose();
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        <Text style={styles.title}>Share invoice</Text>
        <Text style={styles.invoiceNo}>{invoice.invoice_no}</Text>

        <View style={styles.options}>
          {/* PDF Share */}
          <TouchableOpacity
            style={styles.option}
            onPress={handlePDF}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#FCEBEB' }]}>
              {loading === 'pdf'
                ? <ActivityIndicator size="small" color={Colors.danger} />
                : <MaterialCommunityIcons name="file-pdf-box" size={28} color={Colors.danger} />
              }
            </View>
            <Text style={styles.optionLabel}>Share PDF</Text>
            <Text style={styles.optionSub}>WhatsApp, email, any app</Text>
          </TouchableOpacity>

          {/* WhatsApp text */}
          <TouchableOpacity
            style={styles.option}
            onPress={handleWhatsApp}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#E1F5EE' }]}>
              {loading === 'whatsapp'
                ? <ActivityIndicator size="small" color="#25D366" />
                : <MaterialCommunityIcons name="whatsapp" size={28} color="#25D366" />
              }
            </View>
            <Text style={styles.optionLabel}>WhatsApp message</Text>
            <Text style={styles.optionSub}>Send invoice summary as text</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.md,
  },
  title:     { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  invoiceNo: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg },

  options: { gap: Spacing.sm, marginBottom: Spacing.md },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.background, borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  optionIcon:  { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  optionSub:   { fontSize: FontSize.xs, color: Colors.textMuted },

  cancelBtn:  { backgroundColor: Colors.background, borderRadius: 12, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  cancelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
});
