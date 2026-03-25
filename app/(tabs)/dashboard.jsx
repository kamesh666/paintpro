import { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, FontSize } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

const formatCurrency = (amount) => {
  if (!amount) return '₹0';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
  if (amount >= 1000)   return '₹' + (amount / 1000).toFixed(1) + 'K';
  return '₹' + Number(amount).toFixed(0);
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function DashboardScreen() {
  const router  = useRouter();
  const profile = useAuthStore((s) => s.profile);

  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const [projectsRes, labourLogsRes, weeklyRes, invoicesRes] = await Promise.all([
        supabase.from('projects').select('id, status, total_value'),
        supabase.from('labour_logs').select('amount, is_paid'),
        supabase.from('weekly_sheets').select('gross_amount, advance_paid'),
        supabase.from('invoices').select('id, status, total, amount_paid, balance'),
      ]);

      const projects    = projectsRes.data    ?? [];
      const labourLogs  = labourLogsRes.data  ?? [];
      const weeklySheets= weeklyRes.data      ?? [];
      const invoices    = invoicesRes.data    ?? [];

      const totalRevenue = projects.reduce((s, p) => s + (Number(p.total_value) || 0), 0);

      // Labour logs: total + unpaid
      const labourLogTotal   = labourLogs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const labourLogUnpaid  = labourLogs.filter(l => !l.is_paid).reduce((s, l) => s + (Number(l.amount) || 0), 0);

      // Weekly sheets: total earned + balance due (advance not yet paid)
      const weeklyEarned     = weeklySheets.reduce((s, w) => s + (Number(w.gross_amount) || 0), 0);
      const weeklyBalanceDue = weeklySheets.reduce((s, w) => s + Math.max(Number(w.gross_amount || 0) - Number(w.advance_paid || 0), 0), 0);

      // Combined labour cost (use whichever is greater — avoid double counting)
      // If both systems used: weekly sheets is primary, labour logs is supplementary
      const totalLabourCost = Math.max(labourLogTotal, weeklyEarned);
      const pendingLabour   = Math.max(labourLogUnpaid, weeklyBalanceDue);

      const estimatedProfit = totalRevenue - totalLabourCost;

      setStats({
        activeProjects:   projects.filter(p => p.status === 'active').length,
        totalProjects:    projects.length,
        totalRevenue,
        totalLabourCost,
        pendingLabour,
        labourLogTotal,
        weeklyEarned,
        weeklyBalanceDue,
        unpaidInvoices:   invoices.filter(i => i.status !== 'paid').length,
        totalBalance:     invoices.reduce((s, i) => s + (Number(i.balance) || 0), 0),
        estimatedProfit,
      });
    } catch (e) {
      console.log('Dashboard fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  const StatCard = ({ icon, label, value, color, route }) => (
    <TouchableOpacity
      style={[styles.statCard, { borderTopColor: color }]}
      onPress={() => router.push(route)}
      activeOpacity={0.8}
    >
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {loading ? '—' : value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const QuickBtn = ({ icon, label, color, route }) => (
    <TouchableOpacity
      style={styles.quickBtn}
      onPress={() => router.push(route)}
      activeOpacity={0.8}
    >
      <View style={[styles.quickIcon, { backgroundColor: color + '18' }]}>
        <Text style={styles.quickIconText}>{icon}</Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Greeting ── */}
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{profile?.name ?? 'there'} 👋</Text>
          <Text style={styles.headerSub}>Here's your business at a glance</Text>
        </View>
        <TouchableOpacity style={styles.avatarWrap} onPress={() => router.push('/profile')} activeOpacity={0.8}>
          <Text style={styles.avatarText}>
            {profile?.name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats ── */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="🎨" label="Active projects" value={stats?.activeProjects ?? 0}       color={Colors.primary} route="/(tabs)/projects" />
        <StatCard icon="₹"  label="Total revenue"   value={formatCurrency(stats?.totalRevenue)} color={Colors.success} route="/(tabs)/invoices" />
        <StatCard icon="📈" label="Est. profit"      value={formatCurrency(Math.max(stats?.estimatedProfit ?? 0, 0))} color={Colors.accent} route="/(tabs)/projects" />
        <StatCard icon="👷" label="Labour due"       value={formatCurrency(stats?.pendingLabour)}   color={Colors.danger} route="/(tabs)/labour" />
      </View>

      {/* ── Alerts ── */}
      {!loading && (stats?.unpaidInvoices > 0 || stats?.pendingLabour > 0) && (
        <>
          <Text style={styles.sectionTitle}>Alerts</Text>
          {stats?.unpaidInvoices > 0 && (
            <TouchableOpacity style={[styles.alertCard, { borderLeftColor: Colors.warning }]} onPress={() => router.push('/(tabs)/invoices')} activeOpacity={0.8}>
              <Text style={styles.alertIcon}>🧾</Text>
              <Text style={styles.alertText}>{stats.unpaidInvoices} unpaid invoice{stats.unpaidInvoices > 1 ? 's' : ''} pending</Text>
              <Text style={styles.alertArrow}>›</Text>
            </TouchableOpacity>
          )}
          {stats?.pendingLabour > 0 && (
            <TouchableOpacity style={[styles.alertCard, { borderLeftColor: Colors.danger }]} onPress={() => router.push('/(tabs)/labour')} activeOpacity={0.8}>
              <Text style={styles.alertIcon}>👷</Text>
              <Text style={styles.alertText}>{formatCurrency(stats.pendingLabour)} in labour wages unpaid (daily + weekly)</Text>
              <Text style={styles.alertArrow}>›</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ── Revenue Breakdown ── */}
      {!loading && (stats?.totalRevenue ?? 0) > 0 && (
        <>
          <Text style={styles.sectionTitle}>Revenue breakdown</Text>
          <View style={styles.chartCard}>
            {[
              { label: 'Total revenue',    value: stats?.totalRevenue,      max: stats?.totalRevenue,  color: Colors.primary },
              { label: 'Estimated profit', value: Math.max(stats?.estimatedProfit ?? 0, 0), max: stats?.totalRevenue, color: Colors.success },
              { label: 'Labour costs',     value: stats?.totalLabourCost,   max: stats?.totalRevenue,  color: Colors.warning },
            ].map(({ label, value, max, color }) => (
              <View key={label} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(((value||0)/(max||1))*100, 100)}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.barValue}>{formatCurrency(value)}</Text>
              </View>
            ))}
            <View style={styles.legend}>
              {[{ color: Colors.primary, label: 'Revenue' }, { color: Colors.success, label: 'Profit' }, { color: Colors.warning, label: 'Labour' }].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* ── Quick Actions ── */}
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.quickGrid}>
        <QuickBtn icon="➕" label="New project"  color={Colors.primary} route="/(tabs)/projects" />
        <QuickBtn icon="👷" label="Log labour"   color={Colors.accent}  route="/(tabs)/labour" />
        <QuickBtn icon="🧾" label="New invoice"  color={Colors.success} route="/(tabs)/invoices" />
        <QuickBtn icon="👤" label="Add client"   color={Colors.info}    route="/(tabs)/clients" />
      </View>

      {/* ── Quick Navigation ── */}
      <Text style={styles.sectionTitle}>More</Text>
      <View style={styles.moreGrid}>
        {[
          { icon: '📊', label: 'Reports',    route: '/reports',       color: Colors.primary },
          { icon: '📆', label: 'Weekly',     route: '/weekly-labour', color: Colors.accent  },
          { icon: '👤', label: 'Profile',    route: '/profile',       color: Colors.info    },
        ].map(item => (
          <TouchableOpacity key={item.route}
            style={styles.moreBtn}
            onPress={() => router.push(item.route)}
            activeOpacity={0.8}>
            <View style={[styles.moreBtnIcon, { backgroundColor: item.color + '18' }]}>
              <Text style={{ fontSize: 22 }}>{item.icon}</Text>
            </View>
            <Text style={styles.moreBtnLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Empty state ── */}
      {!loading && !stats?.totalRevenue && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎨</Text>
          <Text style={styles.emptyTitle}>Welcome to PaintPro!</Text>
          <Text style={styles.emptyMsg}>Start by adding your first client and project. Your stats will appear here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/projects')} activeOpacity={0.8}>
            <Text style={styles.emptyBtnText}>Create first project</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content:   { padding: Spacing.md },

  headerCard: {
    backgroundColor: Colors.primary, borderRadius: 16,
    padding: Spacing.lg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg,
  },
  greeting:   { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  userName:   { fontSize: FontSize.xxl, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSub:  { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)' },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700', color: '#fff' },

  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.sm },

  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: {
    flex: 1, minWidth: '46%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: Spacing.md, borderTopWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statIcon:     { fontSize: 18 },
  statValue:    { fontSize: FontSize.xl, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  statLabel:    { fontSize: FontSize.xs, color: Colors.textSecondary },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: Spacing.md,
    borderLeftWidth: 4, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  alertIcon:  { fontSize: 16 },
  alertText:  { flex: 1, fontSize: FontSize.sm, color: '#1A1A2E' },
  alertArrow: { fontSize: 18, color: Colors.textMuted },

  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  barLabel:  { fontSize: FontSize.xs, color: Colors.textSecondary, width: 90 },
  barTrack:  { flex: 1, height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: 'hidden' },
  barFill:   { height: 8, borderRadius: 4 },
  barValue:  { fontSize: FontSize.xs, fontWeight: '600', color: '#1A1A2E', width: 72, textAlign: 'right' },
  legend:    { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, justifyContent: 'center' },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText:{ fontSize: FontSize.xs, color: Colors.textSecondary },

  quickGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  quickBtn:  {
    flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingVertical: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  quickIcon:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickIconText: { fontSize: 20 },
  quickLabel:    { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textAlign: 'center' },

  moreGrid:     { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  moreBtn:      { flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: Spacing.md, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 },
  moreBtnIcon:  { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moreBtnLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  empty:       { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyIcon:   { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle:  { fontSize: FontSize.xl, fontWeight: '700', color: '#1A1A2E', marginBottom: Spacing.sm },
  emptyMsg:    { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
  emptyBtn:    { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 2, borderRadius: 10 },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: FontSize.md },
});
