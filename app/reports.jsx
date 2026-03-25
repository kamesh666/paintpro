import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, FontSize } from '../constants/colors';
import { formatCurrency, formatDate } from '../lib/utils';

const BAR_MAX_WIDTH = 220;

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function StatBox({ icon, label, value, color, sub }) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function HBar({ label, value, max, color, formatted }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={styles.hbarRow}>
      <Text style={styles.hbarLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.hbarTrack}>
        <View style={[styles.hbarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.hbarValue}>{formatted ?? formatCurrency(value)}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period,     setPeriod]     = useState('all'); // 'all' | 'month' | 'week'

  const fetchData = async () => {
    try {
      const [
        projectsRes, labourRes, invoicesRes,
        workersRes, weeklyRes,
      ] = await Promise.all([
        supabase.from('projects').select('id, title, status, total_value, created_at, clients(name)'),
        supabase.from('labour_logs').select('amount, is_paid, log_date, workers(name)'),
        supabase.from('invoices').select('total, amount_paid, balance, status, invoice_date, clients(name)'),
        supabase.from('workers').select('id, name, skill_type, daily_rate'),
        supabase.from('weekly_sheets').select('worker_id, gross_amount, advance_paid, total_days, workers(name)'),
      ]);

      const projects = projectsRes.data ?? [];
      const labour   = labourRes.data   ?? [];
      const invoices = invoicesRes.data ?? [];
      const workers  = workersRes.data  ?? [];
      const weekly   = weeklyRes.data   ?? [];

      // ── Project stats ──
      const totalRevenue   = projects.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const doneProjects   = projects.filter(p => p.status === 'completed').length;

      // ── Labour stats (combined: daily logs + weekly sheets) ──
      const labourLogTotal   = labour.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const labourLogUnpaid  = labour.filter(l => !l.is_paid).reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const labourLogPaid    = labourLogTotal - labourLogUnpaid;

      const weeklyEarned     = weekly.reduce((s, w) => s + (Number(w.gross_amount) || 0), 0);
      const weeklyAdvancePaid= weekly.reduce((s, w) => s + (Number(w.advance_paid)  || 0), 0);
      const weeklyBalance    = weeklyEarned - weeklyAdvancePaid;

      // Use whichever system has more data (avoid double counting)
      const totalLabourCost = Math.max(labourLogTotal, weeklyEarned);
      const unpaidLabour    = Math.max(labourLogUnpaid, weeklyBalance);
      const paidLabour      = totalLabourCost - unpaidLabour;

      // ── Invoice stats ──
      const totalInvoiced   = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const totalCollected  = invoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
      const totalOutstanding= invoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
      const paidInvoices    = invoices.filter(i => i.status === 'paid').length;
      const unpaidInvoices  = invoices.filter(i => i.status !== 'paid').length;

      // ── Profit ──
      const estimatedProfit = totalRevenue - totalLabourCost;

      // ── Labour breakdown note ──
      const hasWeeklyData = weeklyEarned > 0;
      const hasDailyData  = labourLogTotal > 0;
      const profitMargin    = totalRevenue > 0 ? ((estimatedProfit / totalRevenue) * 100).toFixed(1) : 0;

      // ── Top projects by value ──
      const topProjects = [...projects]
        .sort((a, b) => (b.total_value ?? 0) - (a.total_value ?? 0))
        .slice(0, 5);

      // ── Worker summary from weekly sheets ──
      const workerMap = {};
      weekly.forEach(w => {
        const id   = w.worker_id;
        const name = w.workers?.name ?? 'Unknown';
        if (!workerMap[id]) workerMap[id] = { name, totalDays: 0, totalEarned: 0, totalAdvance: 0 };
        workerMap[id].totalDays    += Number(w.total_days   || 0);
        workerMap[id].totalEarned  += Number(w.gross_amount || 0);
        workerMap[id].totalAdvance += Number(w.advance_paid || 0);
      });
      const topWorkers = Object.values(workerMap)
        .sort((a, b) => b.totalEarned - a.totalEarned)
        .slice(0, 5);

      // ── Invoice collection rate ──
      const collectionRate = totalInvoiced > 0
        ? ((totalCollected / totalInvoiced) * 100).toFixed(1)
        : 0;

      setData({
        totalRevenue, activeProjects, doneProjects,
        totalLabourCost, unpaidLabour, paidLabour,
        totalInvoiced, totalCollected, totalOutstanding,
        paidInvoices, unpaidInvoices,
        estimatedProfit, profitMargin, collectionRate,
        topProjects, topWorkers,
        totalWorkers: workers.length,
        totalProjects: projects.length,
        totalInvoicesCount: invoices.length,
      });
    } catch (e) {
      console.log('Reports error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          {[1,2,3,4].map(i => <View key={i} style={styles.skeleton} />)}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >

          {/* ── Key Metrics ── */}
          <SectionTitle title="💰 Financial overview" />
          <View style={styles.statsGrid}>
            <StatBox icon="📈" label="Total revenue"   value={formatCurrency(data?.totalRevenue)}    color={Colors.primary} />
            <StatBox icon="✅" label="Est. profit"     value={formatCurrency(data?.estimatedProfit)} color={Colors.success}
              sub={`${data?.profitMargin}% margin`} />
            <StatBox icon="🧾" label="Total invoiced"  value={formatCurrency(data?.totalInvoiced)}   color={Colors.info} />
            <StatBox icon="💵" label="Collected"       value={formatCurrency(data?.totalCollected)}  color={Colors.success}
              sub={`${data?.collectionRate}% rate`} />
          </View>

          {/* ── Outstanding ── */}
          <View style={styles.alertBox}>
            <View style={styles.alertItem}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <View>
                <Text style={styles.alertLabel}>Outstanding invoices</Text>
                <Text style={styles.alertValue}>{formatCurrency(data?.totalOutstanding)}</Text>
              </View>
            </View>
            <View style={styles.alertDivider} />
            <View style={styles.alertItem}>
              <Text style={styles.alertIcon}>👷</Text>
              <View>
                <Text style={styles.alertLabel}>Unpaid labour</Text>
                <Text style={styles.alertValue}>{formatCurrency(data?.unpaidLabour)}</Text>
              </View>
            </View>
          </View>

          {/* ── Project stats ── */}
          <SectionTitle title="🎨 Projects" />
          <View style={styles.card}>
            <View style={styles.inlineStats}>
              <View style={styles.inlineStat}>
                <Text style={styles.inlineValue}>{data?.totalProjects}</Text>
                <Text style={styles.inlineLabel}>Total</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={[styles.inlineValue, { color: Colors.success }]}>{data?.activeProjects}</Text>
                <Text style={styles.inlineLabel}>Active</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={[styles.inlineValue, { color: Colors.info }]}>{data?.doneProjects}</Text>
                <Text style={styles.inlineLabel}>Completed</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={[styles.inlineValue, { color: Colors.textMuted }]}>{data?.totalWorkers}</Text>
                <Text style={styles.inlineLabel}>Workers</Text>
              </View>
            </View>

            {(data?.topProjects ?? []).length > 0 && (
              <>
                <View style={styles.cardDivider} />
                <Text style={styles.cardSubtitle}>Top projects by value</Text>
                {(data?.topProjects ?? []).map((p, i) => (
                  <HBar
                    key={p.id}
                    label={`${i + 1}. ${p.title}`}
                    value={p.total_value ?? 0}
                    max={data?.topProjects[0]?.total_value ?? 1}
                    color={Colors.primary}
                  />
                ))}
              </>
            )}
          </View>

          {/* ── Labour stats ── */}
          <SectionTitle title="👷 Labour costs" />
          <View style={styles.card}>
            <HBar label="Total labour cost" value={data?.totalLabourCost ?? 0} max={data?.totalLabourCost ?? 1} color={Colors.warning} />
            <HBar label="Already paid"      value={data?.paidLabour ?? 0}      max={data?.totalLabourCost ?? 1} color={Colors.success} />
            <HBar label="Still unpaid"      value={data?.unpaidLabour ?? 0}    max={data?.totalLabourCost ?? 1} color={Colors.danger} />

            {(data?.topWorkers ?? []).length > 0 && (
              <>
                <View style={styles.cardDivider} />
                <Text style={styles.cardSubtitle}>Worker earnings (weekly sheets)</Text>
                {(data?.topWorkers ?? []).map((w, i) => (
                  <View key={i} style={styles.workerRow}>
                    <View style={styles.workerAvatar}>
                      <Text style={styles.workerAvatarText}>{w.name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workerName}>{w.name}</Text>
                      <Text style={styles.workerSub}>{w.totalDays} days worked</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.workerEarned}>{formatCurrency(w.totalEarned)}</Text>
                      <Text style={styles.workerAdvance}>Adv: {formatCurrency(w.totalAdvance)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>

          {/* ── Invoice stats ── */}
          <SectionTitle title="🧾 Invoice summary" />
          <View style={styles.card}>
            <View style={styles.inlineStats}>
              <View style={styles.inlineStat}>
                <Text style={styles.inlineValue}>{data?.totalInvoicesCount}</Text>
                <Text style={styles.inlineLabel}>Total</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={[styles.inlineValue, { color: Colors.success }]}>{data?.paidInvoices}</Text>
                <Text style={styles.inlineLabel}>Paid</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={[styles.inlineValue, { color: Colors.danger }]}>{data?.unpaidInvoices}</Text>
                <Text style={styles.inlineLabel}>Unpaid</Text>
              </View>
              <View style={styles.inlineStat}>
                <Text style={[styles.inlineValue, { color: Colors.primary }]}>{data?.collectionRate}%</Text>
                <Text style={styles.inlineLabel}>Collected</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />
            <HBar label="Total invoiced"  value={data?.totalInvoiced ?? 0}   max={data?.totalInvoiced ?? 1} color={Colors.primary} />
            <HBar label="Amount collected"value={data?.totalCollected ?? 0}  max={data?.totalInvoiced ?? 1} color={Colors.success} />
            <HBar label="Outstanding"     value={data?.totalOutstanding ?? 0} max={data?.totalInvoiced ?? 1} color={Colors.danger} />
          </View>

          {/* ── Profit analysis ── */}
          <SectionTitle title="📊 Profit analysis" />
          <View style={styles.profitCard}>
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>Total revenue</Text>
              <Text style={[styles.profitValue, { color: Colors.primary }]}>{formatCurrency(data?.totalRevenue)}</Text>
            </View>
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>− Labour costs</Text>
              <Text style={[styles.profitValue, { color: Colors.danger }]}>− {formatCurrency(data?.totalLabourCost)}</Text>
            </View>
            <View style={[styles.profitRow, styles.profitTotal]}>
              <Text style={styles.profitTotalLabel}>= Estimated profit</Text>
              <Text style={[styles.profitTotalValue, { color: (data?.estimatedProfit ?? 0) >= 0 ? Colors.success : Colors.danger }]}>
                {formatCurrency(data?.estimatedProfit)}
              </Text>
            </View>
            <View style={styles.marginBar}>
              <View style={[styles.marginFill, {
                width: `${Math.min(parseFloat(data?.profitMargin ?? 0), 100)}%`,
                backgroundColor: parseFloat(data?.profitMargin ?? 0) > 20 ? Colors.success : Colors.warning,
              }]} />
            </View>
            <Text style={styles.marginLabel}>Profit margin: {data?.profitMargin}%</Text>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 48 },
  backBtn:      { padding: 4 },
  backText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  loadingWrap:  { padding: 16, gap: 12 },
  skeleton:     { height: 100, backgroundColor: '#E0E0E0', borderRadius: 14, opacity: 0.5 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 8, marginTop: 16 },

  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statBox:      { flex: 1, minWidth: '46%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderTopWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  statIcon:     { fontSize: 20, marginBottom: 6 },
  statValue:    { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLabel:    { fontSize: 11, color: Colors.textSecondary },
  statSub:      { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  alertBox:     { flexDirection: 'row', backgroundColor: '#FFF9F0', borderRadius: 12, padding: 14, marginVertical: 4, borderWidth: 1, borderColor: '#FED7AA' },
  alertItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertDivider: { width: 0.5, backgroundColor: '#FED7AA', marginHorizontal: 8 },
  alertIcon:    { fontSize: 20 },
  alertLabel:   { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  alertValue:   { fontSize: 15, fontWeight: '800', color: Colors.danger },

  card:         { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  cardDivider:  { height: 0.5, backgroundColor: '#F0F0F0', marginVertical: 12 },
  cardSubtitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  inlineStats:  { flexDirection: 'row' },
  inlineStat:   { flex: 1, alignItems: 'center' },
  inlineValue:  { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  inlineLabel:  { fontSize: 11, color: Colors.textMuted },

  hbarRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hbarLabel:    { fontSize: 12, color: Colors.textSecondary, width: 110 },
  hbarTrack:    { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  hbarFill:     { height: 8, borderRadius: 4 },
  hbarValue:    { fontSize: 12, fontWeight: '700', color: '#1A1A2E', width: 68, textAlign: 'right' },

  workerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  workerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  workerAvatarText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  workerName:   { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  workerSub:    { fontSize: 11, color: Colors.textMuted },
  workerEarned: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  workerAdvance:{ fontSize: 11, color: Colors.warning },

  profitCard:   { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  profitRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  profitLabel:  { fontSize: 14, color: Colors.textSecondary },
  profitValue:  { fontSize: 15, fontWeight: '700' },
  profitTotal:  { borderTopWidth: 1, borderTopColor: '#E0E0E0', marginTop: 6, paddingTop: 10 },
  profitTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  profitTotalValue: { fontSize: 18, fontWeight: '800' },
  marginBar:    { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden', marginTop: 12 },
  marginFill:   { height: 10, borderRadius: 5 },
  marginLabel:  { fontSize: 12, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },

  section:      { marginHorizontal: 16, marginTop: 16 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
});
