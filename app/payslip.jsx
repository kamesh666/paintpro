import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, StatusBar, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { showPaymentOptions } from '../lib/upiPayment';
import { useWorkers } from '../hooks/useSupabase';
import { Colors, Spacing, FontSize } from '../constants/colors';
import { formatCurrency, formatDate } from '../lib/utils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Get all week start dates (Mondays) that fall within a given month
function getWeekStartsInMonth(year, month) {
  const starts = [];
  // Go back up to 6 days before month start to catch Mondays
  const d = new Date(year, month, 1);
  // First Monday on or before month start
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  // Collect all Mondays until end of month
  const monthEnd = new Date(year, month + 1, 0);
  while (d <= monthEnd) {
    starts.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 7);
  }
  return starts;
}

const generatePayslipHTML = (worker, sheets, monthLabel) => {
  const totalDays    = sheets.reduce((s, sh) => s + Number(sh.total_days   || 0), 0);
  const totalEarned  = sheets.reduce((s, sh) => s + Number(sh.gross_amount || 0), 0);
  const totalAdvance = sheets.reduce((s, sh) => s + Number(sh.advance_paid || 0), 0);
  const netBalance   = sheets.reduce((s, sh) => s + Number(sh.balance_due  || 0), 0);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 36px; color: #1A1A2E; font-size: 13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .brand  { font-size:26px; font-weight:900; color:#1E3A5F; }
  .brand-sub { font-size:11px; color:#6B7280; letter-spacing:2px; text-transform:uppercase; margin-top:2px; }
  .divider { height:3px; background:#1E3A5F; margin:14px 0; border-radius:2px; }
  .worker-box { background:#F8FAFC; border-radius:10px; padding:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; }
  .w-name  { font-size:22px; font-weight:800; color:#1A1A2E; }
  .w-info  { font-size:12px; color:#6B7280; margin-top:4px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; font-size:12px; }
  th { background:#1E3A5F; color:#fff; padding:9px 10px; text-align:left; }
  th:not(:first-child) { text-align:right; }
  td { padding:9px 10px; border-bottom:1px solid #F0F0F0; }
  td:not(:first-child) { text-align:right; }
  tr:nth-child(even) td { background:#FAFAFA; }
  .total-row td { font-weight:800; background:#F0F9FF; border-top:2px solid #1E3A5F; }
  .net-box { background:#1E3A5F; color:#fff; border-radius:12px; padding:20px 24px; display:flex; justify-content:space-between; align-items:center; margin-top:16px; }
  .net-lbl { font-size:14px; opacity:0.75; }
  .net-val { font-size:34px; font-weight:900; }
  .sign-row { display:flex; justify-content:space-between; margin-top:40px; }
  .sign-box { text-align:center; width:40%; }
  .sign-line { border-top:1px solid #1A1A2E; padding-top:6px; font-size:11px; color:#6B7280; }
  .footer { text-align:center; font-size:10px; color:#9CA3AF; border-top:1px solid #E0E0E0; padding-top:14px; margin-top:24px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">🎨 PaintPro</div>
      <div class="brand-sub">Painting Contractor</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:17px;font-weight:800;color:#1E3A5F">${monthLabel}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:2px;letter-spacing:1px;text-transform:uppercase">Salary Slip</div>
    </div>
  </div>
  <div class="divider"></div>

  <div class="worker-box">
    <div>
      <div class="w-name">${worker.name}</div>
      <div class="w-info">${worker.skill_type ?? 'Worker'} &nbsp;·&nbsp; ₹${worker.daily_rate} per shift</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#6B7280">Generated on</div>
      <div style="font-size:13px;font-weight:700">${new Date().toLocaleDateString('en-IN')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Week starting</th>
        <th>Project</th>
        <th>Shifts</th>
        <th>Rate/shift</th>
        <th>Gross</th>
        <th>Advance</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      ${sheets.map(s => `
        <tr>
          <td>${formatDate(s.week_start)}</td>
          <td>${s.project_title ?? '—'}</td>
          <td>${s.total_days}</td>
          <td>₹${Number(s.daily_rate || 0).toLocaleString('en-IN')}</td>
          <td>₹${Number(s.gross_amount || 0).toLocaleString('en-IN')}</td>
          <td>₹${Number(s.advance_paid || 0).toLocaleString('en-IN')}</td>
          <td style="color:${Number(s.balance_due||0)>0?'#DC2626':'#065F46'}">
            ₹${Math.abs(Number(s.balance_due || 0)).toLocaleString('en-IN')}
          </td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td>${totalDays}</td>
        <td>—</td>
        <td>₹${totalEarned.toLocaleString('en-IN')}</td>
        <td>₹${totalAdvance.toLocaleString('en-IN')}</td>
        <td>₹${Math.abs(netBalance).toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <div class="net-box">
    <div>
      <div class="net-lbl">Net balance due to worker</div>
      <div style="font-size:11px;opacity:0.6;margin-top:2px">
        ${totalDays} shifts × ₹${worker.daily_rate} = ₹${totalEarned.toLocaleString('en-IN')} − Advance ₹${totalAdvance.toLocaleString('en-IN')}
      </div>
    </div>
    <div class="net-val">₹${Math.abs(netBalance).toLocaleString('en-IN')}</div>
  </div>

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line">Worker signature</div></div>
    <div class="sign-box"><div class="sign-line">Employer signature & stamp</div></div>
  </div>

  <div class="footer">
    PaintPro Business Tracker &nbsp;·&nbsp; Salary Slip &nbsp;·&nbsp; ${worker.name} &nbsp;·&nbsp; ${monthLabel}
  </div>
</body>
</html>`;
};

export default function PayslipScreen() {
  const router = useRouter();
  const { data: workers, isLoading: wLoading } = useWorkers();
  const now = new Date();

  const [selWorker,  setSelWorker]  = useState(null);
  const [selYear,    setSelYear]    = useState(now.getFullYear());
  const [selMonth,   setSelMonth]   = useState(now.getMonth());
  const [sheets,     setSheets]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);

  const monthLabel = `${MONTHS[selMonth]} ${selYear}`;

  // ✅ Fetch sheets for selected worker + month using date range
  const fetchSheets = async () => {
    if (!selWorker) { setSheets([]); return; }
    setLoading(true);
    try {
      // Use a wide date range — from 7 days before month start to last day of month
      // This catches any Monday that has days falling in the selected month
      const monthStart = new Date(selYear, selMonth, 1);
      const monthEnd   = new Date(selYear, selMonth + 1, 0);

      // Go back 6 days to catch Mondays from previous month covering this month
      const rangeStart = new Date(monthStart);
      rangeStart.setDate(rangeStart.getDate() - 6);
      const rangeStartStr = rangeStart.toISOString().split('T')[0];
      const rangeEndStr   = monthEnd.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('weekly_sheet_summary')
        .select('*')
        .eq('worker_id', selWorker.id)
        .gte('week_start', rangeStartStr)
        .lte('week_start', rangeEndStr)
        .order('week_start', { ascending: true });

      if (error) throw error;
      setSheets(data ?? []);
    } catch (e) {
      console.log('Payslip error:', e.message);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSheets(); }, [selWorker?.id, selYear, selMonth]);

  const totalDays    = sheets.reduce((s, sh) => s + Number(sh.total_days   || 0), 0);
  const totalEarned  = sheets.reduce((s, sh) => s + Number(sh.gross_amount || 0), 0);
  const totalAdvance = sheets.reduce((s, sh) => s + Number(sh.advance_paid || 0), 0);
  const netBalance   = sheets.reduce((s, sh) => s + Number(sh.balance_due  || 0), 0);

  const handleGenerate = async () => {
    if (!selWorker)        { Alert.alert('Select worker', 'Please select a worker first'); return; }
    if (sheets.length === 0) { Alert.alert('No data', `No weekly sheets found for ${selWorker.name} in ${monthLabel}`); return; }
    setGenerating(true);
    try {
      const html = generatePayslipHTML(selWorker, sheets, monthLabel);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Salary Slip - ${selWorker.name} - ${monthLabel}`,
      });
    } catch (e) {
      Alert.alert('Error generating payslip', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Worker Payslip</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Step 1: Select Worker ── */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>① Select worker</Text>
          {wLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.workerGrid}>
              {(workers ?? []).map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.workerCard, selWorker?.id === w.id && styles.workerCardActive]}
                  onPress={() => setSelWorker(w)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.workerAvatar, selWorker?.id === w.id && { backgroundColor: Colors.primary }]}>
                    <Text style={[styles.workerAvatarText, selWorker?.id === w.id && { color: '#fff' }]}>
                      {w.name?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <Text style={[styles.workerName, selWorker?.id === w.id && { color: Colors.primary }]}
                    numberOfLines={1}>{w.name}</Text>
                  <Text style={styles.workerRate}>₹{w.daily_rate}/shift</Text>
                  <Text style={styles.workerSkill}>{w.skill_type}</Text>
                </TouchableOpacity>
              ))}
              {!(workers?.length) && (
                <Text style={styles.noWorkers}>No workers added yet. Add workers in Labour tab.</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Step 2: Select Period ── */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>② Select pay period</Text>

          {/* Year */}
          <View style={styles.yearRow}>
            {years.map(y => (
              <TouchableOpacity key={y}
                style={[styles.yearChip, selYear === y && styles.yearChipActive]}
                onPress={() => setSelYear(y)}>
                <Text style={[styles.yearChipText, selYear === y && styles.yearChipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Month */}
          <View style={styles.monthGrid}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity key={m}
                style={[styles.monthChip, selMonth === i && styles.monthChipActive]}
                onPress={() => setSelMonth(i)}>
                <Text style={[styles.monthChipText, selMonth === i && styles.monthChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Step 3: Summary ── */}
        {selWorker && (
          <View style={styles.section}>
            <Text style={styles.stepLabel}>③ Summary — {selWorker.name} · {monthLabel}</Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.loadingText}>Loading attendance data...</Text>
              </View>
            ) : sheets.length === 0 ? (
              <View style={styles.noDataBox}>
                <Text style={styles.noDataIcon}>📭</Text>
                <Text style={styles.noDataTitle}>No data for {monthLabel}</Text>
                <Text style={styles.noDataMsg}>
                  No weekly sheets found for {selWorker.name} in {monthLabel}.{`\n\n`}
                  Make sure the week start date of your weekly sheet falls in {monthLabel} or the last week of the previous month.
                </Text>
              </View>
            ) : (
              <>
                {/* Stats row */}
                <View style={styles.statsCard}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{totalDays}</Text>
                    <Text style={styles.statLabel}>Total shifts</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: Colors.primary }]}>{formatCurrency(totalEarned)}</Text>
                    <Text style={styles.statLabel}>Gross earned</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: Colors.warning }]}>{formatCurrency(totalAdvance)}</Text>
                    <Text style={styles.statLabel}>Advance paid</Text>
                  </View>
                </View>

                {/* Net balance */}
                <View style={[styles.netBox, { borderColor: netBalance > 0 ? Colors.danger + '55' : Colors.success + '55' }]}>
                  <View>
                    <Text style={styles.netLabel}>Net balance due</Text>
                    <Text style={styles.netSub}>{totalDays} shifts × ₹{selWorker.daily_rate} − Advance</Text>
                  </View>
                  <Text style={[styles.netValue, { color: netBalance > 0 ? Colors.danger : Colors.success }]}>
                    {formatCurrency(Math.abs(netBalance))}
                  </Text>
                </View>

                {/* Weekly breakdown */}
                <Text style={styles.breakdownTitle}>Weekly breakdown</Text>
                {sheets.map((sh, i) => (
                  <View key={sh.id} style={styles.weekRow}>
                    <View style={styles.weekLeft}>
                      <Text style={styles.weekDate}>📅 {formatDate(sh.week_start)}</Text>
                      <Text style={styles.weekProject} numberOfLines={1}>📋 {sh.project_title ?? '—'}</Text>
                    </View>
                    <View style={styles.weekRight}>
                      <View style={styles.weekMiniRow}>
                        <Text style={styles.weekMiniLabel}>Shifts</Text>
                        <Text style={styles.weekMiniValue}>{sh.total_days}</Text>
                      </View>
                      <View style={styles.weekMiniRow}>
                        <Text style={styles.weekMiniLabel}>Earned</Text>
                        <Text style={[styles.weekMiniValue, { color: Colors.primary }]}>{formatCurrency(sh.gross_amount)}</Text>
                      </View>
                      <View style={styles.weekMiniRow}>
                        <Text style={styles.weekMiniLabel}>Advance</Text>
                        <Text style={[styles.weekMiniValue, { color: Colors.warning }]}>{formatCurrency(sh.advance_paid)}</Text>
                      </View>
                      <View style={styles.weekMiniRow}>
                        <Text style={styles.weekMiniLabel}>Balance</Text>
                        <Text style={[styles.weekMiniValue, {
                          color: Number(sh.balance_due || 0) > 0 ? Colors.danger : Colors.success
                        }]}>{formatCurrency(Math.abs(sh.balance_due || 0))}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Generate Button ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity
            style={[
              styles.generateBtn,
              (!selWorker || sheets.length === 0 || generating) && { opacity: 0.45 },
            ]}
            onPress={handleGenerate}
            disabled={!selWorker || sheets.length === 0 || generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.generateBtnText}>Generating PDF...</Text>
              </>
            ) : (
              <Text style={styles.generateBtnText}>🖨  Generate & Share PDF Payslip</Text>
            )}
          </TouchableOpacity>

          {!selWorker && (
            <Text style={styles.generateHint}>Select a worker above to generate payslip</Text>
          )}
          {selWorker && sheets.length === 0 && !loading && (
            <Text style={styles.generateHint}>No data found for {selWorker.name} in {monthLabel}</Text>
          )}

          {/* UPI Pay button */}
          {selWorker && netBalance > 0 && sheets.length > 0 && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => showPaymentOptions({
                phoneNumber: selWorker.phone,
                name:        selWorker.name,
                amount:      netBalance,
                note:        `Salary - ${selWorker.name} - ${monthLabel}`,
              })}
              activeOpacity={0.85}
            >
              <Text style={styles.payBtnText}>💸  Pay ₹{Math.abs(netBalance).toLocaleString('en-IN')} via UPI</Text>
              <Text style={styles.payBtnSub}>GPay · PhonePe · Paytm · Any UPI app</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 48 },
  backBtn:      { padding: 4 },
  backText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle:  { color: '#fff', fontSize: 18, fontWeight: '700' },

  section:      { backgroundColor: '#FFFFFF', margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  stepLabel:    { fontSize: 13, fontWeight: '800', color: Colors.primary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  workerGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  workerCard:   { width: '47%', backgroundColor: Colors.background, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0' },
  workerCardActive: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  workerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  workerAvatarText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  workerName:   { fontSize: 14, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 2 },
  workerRate:   { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  workerSkill:  { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },
  noWorkers:    { fontSize: 14, color: Colors.textMuted, padding: 16, textAlign: 'center' },

  yearRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  yearChip:     { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  yearChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearChipText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  yearChipTextActive: { color: '#fff', fontWeight: '800' },

  monthGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip:    { width: '23%', paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  monthChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthChipText:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  monthChipTextActive: { color: '#fff', fontWeight: '700' },

  loadingBox:   { alignItems: 'center', paddingVertical: 24, gap: 10 },
  loadingText:  { fontSize: 13, color: Colors.textSecondary },

  noDataBox:    { alignItems: 'center', paddingVertical: 24 },
  noDataIcon:   { fontSize: 40, marginBottom: 10 },
  noDataTitle:  { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  noDataMsg:    { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  statsCard:    { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 12 },
  statItem:     { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 3 },
  statLabel:    { fontSize: 10, color: Colors.textMuted },
  statDivider:  { width: 0.5, backgroundColor: '#E0E0E0' },

  netBox:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1.5 },
  netLabel:     { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  netSub:       { fontSize: 11, color: Colors.textMuted },
  netValue:     { fontSize: 24, fontWeight: '900' },

  breakdownTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  weekRow:      { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: '#F0F0F0' },
  weekLeft:     { flex: 1, justifyContent: 'center' },
  weekDate:     { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  weekProject:  { fontSize: 12, color: Colors.textSecondary },
  weekRight:    { alignItems: 'flex-end', gap: 2 },
  weekMiniRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  weekMiniLabel:{ fontSize: 11, color: Colors.textMuted, width: 50, textAlign: 'right' },
  weekMiniValue:{ fontSize: 12, fontWeight: '700', color: '#1A1A2E', width: 72, textAlign: 'right' },

  generateBtn:  { backgroundColor: Colors.primary, borderRadius: 14, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  payBtn:       { backgroundColor: '#059669', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 10 },
  payBtnText:   { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 3 },
  payBtnSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  generateHint: { textAlign: 'center', fontSize: 13, color: Colors.textMuted, marginTop: 8 },
});
