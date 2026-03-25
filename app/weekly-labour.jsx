import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, FlatList, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useWeeklySheets, useUpsertWeeklySheet, useDeleteWeeklySheet,
  useProjects, useWorkers,
} from '../hooks/useSupabase';
import { useAuthStore } from '../store/authStore';
import { showPaymentOptions } from '../lib/upiPayment';
import { Colors, Spacing, FontSize } from '../constants/colors';
import { formatCurrency } from '../lib/utils';

const INPUT = {
  backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
  fontSize: 15, color: '#1A1A2E',
};

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMondayOf(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return new Date().toISOString().split('T')[0];
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getWeekDates(weekStart) {
  return DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });
}

function formatWeek(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const s = new Date(weekStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const e = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
}

// ─── Attendance Cell — cycles 0 → 0.5 → 1 → 1.5 ──────────
// 0 = Absent, 0.5 = Half day, 1 = 1 shift, 1.5 = Full day
const SHIFTS    = [0, 0.5, 1, 1.5];
const SHIFT_LBL = ['–', '½', '1', '1½'];
const SHIFT_BG  = ['#F3F4F6', '#FEF3C7', '#DBEAFE', '#D1FAE5'];
const SHIFT_CLR = ['#9CA3AF', '#92400E', '#1E40AF', '#065F46'];

function AttCell({ value, onChange }) {
  const idx = SHIFTS.indexOf(value);
  const i   = idx === -1 ? 0 : idx;
  return (
    <TouchableOpacity
      style={[styles.cell, { backgroundColor: SHIFT_BG[i] }]}
      onPress={() => onChange(SHIFTS[(i + 1) % SHIFTS.length])}
      activeOpacity={0.7}
    >
      <Text style={[styles.cellText, { color: SHIFT_CLR[i] }]}>
        {SHIFT_LBL[i]}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Per-day project selector ─────────────────────────────
function DayProjectRow({ day, dayLabel, date, value, projectId, projects, onAttChange, onProjectChange }) {
  const [open, setOpen] = useState(false);
  const selected = projects?.find(p => p.id === projectId);
  const idx    = SHIFTS.indexOf(value);
  const bgs    = SHIFT_BG;

  return (
    <View style={styles.dayRow}>
      {/* Day label + date */}
      <View style={styles.dayLabelWrap}>
        <Text style={styles.dayName}>{dayLabel}</Text>
        <Text style={styles.dayDate}>{date}</Text>
      </View>

      {/* Attendance cell */}
      <AttCell value={value} onChange={onAttChange} />

      {/* Project picker — only show if present */}
      {value > 0 ? (
        <TouchableOpacity
          style={styles.dayProjectPicker}
          onPress={() => setOpen(!open)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dayProjectText, !selected && { color: '#9CA3AF' }]} numberOfLines={1}>
            {selected?.title ?? 'Select project'}
          </Text>
          <Text style={styles.dayPickerArrow}>{open ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.dayProjectPicker, { backgroundColor: '#F9FAFB' }]}>
          <Text style={{ color: '#D1D5DB', fontSize: 13 }}>Absent</Text>
        </View>
      )}

      {/* Dropdown */}
      {open && value > 0 && (
        <View style={styles.dayDropdown}>
          {(projects ?? []).map(p => (
            <TouchableOpacity key={p.id}
              style={[styles.dayDropItem, projectId === p.id && styles.dayDropItemActive]}
              onPress={() => { onProjectChange(p.id); setOpen(false); }}>
              <Text style={[styles.dayDropText, projectId === p.id && { color: Colors.primary, fontWeight: '700' }]}
                numberOfLines={1}>{p.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Sheet Card ───────────────────────────────────────────
function SheetCard({ sheet, onPress, onDelete, onPay }) {
  const balance = Number(sheet.balance_due ?? 0);
  return (
    <TouchableOpacity style={styles.sheetCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.sheetTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetWorker}>{sheet.worker_name}</Text>
          <Text style={styles.sheetProject} numberOfLines={1}>📋 {sheet.project_title}</Text>
          {sheet.sheet_label ? <Text style={styles.sheetLabel}>🏷 {sheet.sheet_label}</Text> : null}
          <Text style={styles.sheetWeek}>📅 {formatWeek(sheet.week_start)}</Text>
        </View>
        <TouchableOpacity onPress={() => onDelete(sheet.id)} style={styles.deleteBtn}>
          <Text>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Mini attendance */}
      <View style={styles.miniRow}>
        {DAYS.map((d, i) => {
          const val = sheet[d] ?? 0;
          const si  = SHIFTS.indexOf(val);
          const bg  = si !== -1 ? SHIFT_BG[si]  : '#F3F4F6';
          const tc  = si !== -1 ? SHIFT_CLR[si] : '#9CA3AF';
          return (
            <View key={d} style={[styles.miniCell, { backgroundColor: bg }]}>
              <Text style={[styles.miniDay, { color: Colors.textMuted }]}>{DAY_LABELS[i][0]}</Text>
              <Text style={[styles.miniVal, { color: tc }]}>{val === 0 ? '–' : SHIFT_LBL[SHIFTS.indexOf(val)] ?? val}</Text>
            </View>
          );
        })}
      </View>

      {/* Financials */}
      <View style={styles.finRow}>
        <View style={styles.finItem}>
          <Text style={styles.finLabel}>Days</Text>
          <Text style={styles.finValue}>{sheet.total_days}</Text>
        </View>
        <View style={styles.finItem}>
          <Text style={styles.finLabel}>Earned</Text>
          <Text style={[styles.finValue, { color: Colors.primary }]}>{formatCurrency(sheet.gross_amount)}</Text>
        </View>
        <View style={styles.finItem}>
          <Text style={styles.finLabel}>Advance</Text>
          <Text style={[styles.finValue, { color: Colors.warning }]}>{formatCurrency(sheet.advance_paid)}</Text>
        </View>
        <View style={styles.finItem}>
          <Text style={styles.finLabel}>Balance</Text>
          <Text style={[styles.finValue, { color: balance > 0 ? Colors.danger : Colors.success }]}>
            {formatCurrency(Math.abs(balance))}
          </Text>
        </View>
      </View>

      {/* Pay via UPI button */}
      {balance > 0 && onPay && (
        <TouchableOpacity
          style={styles.payUpiBtn}
          onPress={onPay}
          activeOpacity={0.85}
        >
          <Text style={styles.payUpiBtnText}>💸 Pay {formatCurrency(balance)} via UPI</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Sheet Modal ──────────────────────────────────────────
function SheetModal({ visible, onClose, sheet }) {
  const { data: projects } = useProjects();
  const { data: workers }  = useWorkers();
  const upsert  = useUpsertWeeklySheet();
  const profile = useAuthStore((s) => s.profile);
  const isEdit  = !!sheet?.id;

  // Each day has: attendance value + which project
  const defaultDays = () => DAYS.reduce((acc, d) => ({
    ...acc,
    [d]: { value: 0, projectId: '' },
  }), {});

  const [workerId,    setWorkerId]    = useState('');
  const [weekStart,   setWeekStart]   = useState(getMondayOf(new Date()));
  const [dailyRate,   setDailyRate]   = useState('');
  const [days,        setDays]        = useState(defaultDays());
  const [advancePaid, setAdvancePaid] = useState('0');
  const [sheetLabel,  setSheetLabel]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [workerOpen,  setWorkerOpen]  = useState(false);

  // ✅ Reset on open
  useEffect(() => {
    if (visible) {
      setWorkerId  (sheet?.worker_id ?? '');
      setWeekStart (sheet?.week_start ?? getMondayOf(new Date()));
      setDailyRate (sheet?.daily_rate?.toString() ?? '');
      setAdvancePaid(sheet?.advance_paid?.toString() ?? '0');
      setSheetLabel (sheet?.sheet_label ?? '');
      setNotes      (sheet?.notes ?? '');
      setWorkerOpen (false);

      if (sheet) {
        const d = defaultDays();
        DAYS.forEach(day => { d[day] = { value: sheet[day] ?? 0, projectId: sheet.project_id ?? '' }; });
        setDays(d);
      } else {
        setDays(defaultDays());
      }
    }
  }, [visible, sheet]);

  // Auto-fill daily rate from worker
  useEffect(() => {
    if (workerId && !isEdit) {
      const w = workers?.find(w => w.id === workerId);
      if (w) setDailyRate(w.daily_rate?.toString() ?? '');
    }
  }, [workerId, workers]);

  const setDay = (day, key, val) =>
    setDays(prev => ({ ...prev, [day]: { ...prev[day], [key]: val } }));

  const rate      = parseFloat(dailyRate) || 0;
  const totalDays = DAYS.reduce((s, d) => s + (days[d].value ?? 0), 0);
  const grossAmt  = totalDays * rate;
  const advance   = parseFloat(advancePaid) || 0;
  const balance   = grossAmt - advance;

  const selectedWorker = workers?.find(w => w.id === workerId);
  const weekDates      = getWeekDates(weekStart);

  // Group days by project for saving (one sheet per project per worker per week)
  const handleSave = async () => {
    if (!workerId)  { Alert.alert('Required', 'Please select a worker');  return; }
    if (!dailyRate) { Alert.alert('Required', 'Please enter daily rate'); return; }

    // Check all working days have a project assigned
    const missingProject = DAYS.some(d => days[d].value > 0 && !days[d].projectId);
    if (missingProject) {
      Alert.alert('Required', 'Please select a project for each working day');
      return;
    }

    setSaving(true);
    try {
      // Group days by project
      const projectGroups = {};
      DAYS.forEach(day => {
        const { value, projectId } = days[day];
        if (value > 0 && projectId) {
          if (!projectGroups[projectId]) {
            projectGroups[projectId] = { mon:0, tue:0, wed:0, thu:0, fri:0, sat:0, sun:0 };
          }
          projectGroups[projectId][day] = value;
        }
      });

      const projectIds = Object.keys(projectGroups);
      if (projectIds.length === 0) {
        Alert.alert('No attendance', 'Mark at least one working day');
        setSaving(false);
        return;
      }

      // Save one sheet per project
      for (const pid of projectIds) {
        const grp      = projectGroups[pid];
        const grpDays  = DAYS.reduce((s, d) => s + (grp[d] ?? 0), 0);
        const grpGross = grpDays * rate;
        // Split advance proportionally
        const grpAdv   = projectIds.length === 1 ? advance : Math.round((grpDays / totalDays) * advance);
        const proj     = projects?.find(p => p.id === pid);

        await upsert.mutateAsync({
          ...(isEdit && projectIds.length === 1 ? { id: sheet.id } : {}),
          project_id:   pid,
          worker_id:    workerId,
          week_start:   weekStart,
          daily_rate:   rate,
          ...grp,
          advance_paid: grpAdv,
          sheet_label:  sheetLabel || (proj?.title ?? ''),
          notes,
          created_by:   profile?.id,
        });
      }

      onClose();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{isEdit ? 'Edit week' : 'New week'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Worker */}
          <Text style={styles.label}>Worker *</Text>
          <TouchableOpacity style={styles.picker}
            onPress={() => setWorkerOpen(!workerOpen)}>
            <Text style={selectedWorker ? styles.pickerValue : styles.pickerPlaceholder}>
              {selectedWorker?.name ?? 'Select worker'}
            </Text>
            <Text style={styles.pickerArrow}>{workerOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {workerOpen && (
            <View style={styles.dropdown}>
              {(workers ?? []).map(w => (
                <TouchableOpacity key={w.id}
                  style={[styles.dropItem, workerId === w.id && styles.dropItemActive]}
                  onPress={() => { setWorkerId(w.id); setWorkerOpen(false); }}>
                  <Text style={[styles.dropText, workerId === w.id && { color: Colors.primary, fontWeight: '700' }]}>
                    {w.name}
                  </Text>
                  <Text style={styles.dropSub}>₹{w.daily_rate}/day · {w.skill_type}</Text>
                </TouchableOpacity>
              ))}
              {!(workers?.length) && <Text style={styles.dropEmpty}>No workers added yet</Text>}
            </View>
          )}

          {/* Week + Rate row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Week start (Monday)</Text>
              <TextInput style={INPUT} value={weekStart}
                onChangeText={v => setWeekStart(getMondayOf(v) || v)}
                placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation" underlineColorAndroid="transparent" />
              <Text style={styles.weekRange}>{formatWeek(weekStart)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Daily rate (₹) *</Text>
              <TextInput style={INPUT} value={dailyRate} onChangeText={setDailyRate}
                placeholder="e.g. 700" placeholderTextColor="#9CA3AF"
                keyboardType="numeric" underlineColorAndroid="transparent" />
            </View>
          </View>

          {/* Sheet label */}
          <Text style={styles.label}>Sheet label (optional)</Text>
          <TextInput style={INPUT} value={sheetLabel} onChangeText={setSheetLabel}
            placeholder="e.g. Week 1 mixed projects" placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent" />

          {/* Daily attendance + project per day */}
          <Text style={styles.label}>Daily attendance & project</Text>
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              💡 Tap each day cell to cycle: Absent (–) → Half day (½) → 1 Shift → 1½ Shifts (full day).
              Then select the project for each working day.
            </Text>
          </View>

          <View style={styles.attendanceTable}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 56 }]}>Day</Text>
              <Text style={[styles.tableHeaderText, { width: 44 }]}>Att.</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Project</Text>
            </View>

            {DAYS.map((d, i) => (
              <DayProjectRow
                key={d}
                day={d}
                dayLabel={DAY_LABELS[i]}
                date={weekDates[i]}
                value={days[d].value}
                projectId={days[d].projectId}
                projects={projects}
                onAttChange={val => setDay(d, 'value', val)}
                onProjectChange={pid => setDay(d, 'projectId', pid)}
              />
            ))}
          </View>

          {/* Live summary */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total days</Text>
              <Text style={styles.summaryValue}>{totalDays}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gross amount</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatCurrency(grossAmt)}</Text>
            </View>
          </View>

          {/* Advance */}
          <Text style={styles.label}>Total advance paid (₹)</Text>
          <TextInput style={INPUT} value={advancePaid} onChangeText={setAdvancePaid}
            placeholder="0" placeholderTextColor="#9CA3AF"
            keyboardType="numeric" underlineColorAndroid="transparent" />

          {/* Balance */}
          <View style={[styles.balanceBox, { borderColor: balance > 0 ? Colors.danger + '55' : Colors.success + '55' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>Balance due to worker</Text>
              <Text style={styles.balanceSub}>
                {totalDays} days × ₹{rate} – Advance ₹{advance}
              </Text>
            </View>
            <Text style={[styles.balanceValue, { color: balance > 0 ? Colors.danger : Colors.success }]}>
              {formatCurrency(Math.abs(balance))}
            </Text>
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[INPUT, { height: 80, textAlignVertical: 'top' }]}
            value={notes} onChangeText={setNotes}
            placeholder="Any notes for this week..." placeholderTextColor="#9CA3AF"
            multiline underlineColorAndroid="transparent" />

          {/* Multi-project info */}
          {Object.keys(DAYS.reduce((acc, d) => {
            if (days[d].projectId) acc[days[d].projectId] = true;
            return acc;
          }, {})).length > 1 && (
            <View style={styles.multiProjectInfo}>
              <Text style={styles.multiProjectTitle}>📋 Multiple projects detected</Text>
              <Text style={styles.multiProjectText}>
                Separate sheets will be saved per project. Advance will be split proportionally by days worked.
              </Text>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function WeeklyLabourScreen() {
  const router = useRouter();
  const { data: projects } = useProjects();
  const [projectFilter, setProjectFilter] = useState(null);
  const [workerFilter,  setWorkerFilter]  = useState('');
  const [modalOpen,     setModalOpen]     = useState(false);
  const [selected,      setSelected]      = useState(null);

  const { data: sheets, isLoading, refetch, isRefetching } = useWeeklySheets(projectFilter);
  const deleteSheet = useDeleteWeeklySheet();

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this weekly sheet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSheet.mutate(id) },
    ]);
  };

  const filtered = (sheets ?? []).filter(s =>
    !workerFilter || s.worker_name?.toLowerCase().includes(workerFilter.toLowerCase())
  );

  const totalEarned  = filtered.reduce((s, sh) => s + Number(sh.gross_amount ?? 0), 0);
  const totalAdvance = filtered.reduce((s, sh) => s + Number(sh.advance_paid  ?? 0), 0);
  const totalBalance = filtered.reduce((s, sh) => s + Number(sh.balance_due   ?? 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Labour</Text>
        <TouchableOpacity onPress={() => { setSelected(null); setModalOpen(true); }} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Worker search */}
      <View style={styles.searchWrap}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput style={styles.searchInput} value={workerFilter}
          onChangeText={setWorkerFilter}
          placeholder="Search worker..." placeholderTextColor="#9CA3AF"
          underlineColorAndroid="transparent" />
        {workerFilter.length > 0 && (
          <TouchableOpacity onPress={() => setWorkerFilter('')}>
            <Text style={{ color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Project filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44, marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <TouchableOpacity style={[styles.chip, !projectFilter && styles.chipActive]}
          onPress={() => setProjectFilter(null)}>
          <Text style={[styles.chipText, !projectFilter && styles.chipTextActive]}>All projects</Text>
        </TouchableOpacity>
        {(projects ?? []).map(p => (
          <TouchableOpacity key={p.id}
            style={[styles.chip, projectFilter === p.id && styles.chipActive]}
            onPress={() => setProjectFilter(p.id)}>
            <Text style={[styles.chipText, projectFilter === p.id && styles.chipTextActive]} numberOfLines={1}>
              {p.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Totals */}
      {!isLoading && filtered.length > 0 && (
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Earned</Text>
            <Text style={[styles.totalValue, { color: Colors.primary }]}>{formatCurrency(totalEarned)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Advance</Text>
            <Text style={[styles.totalValue, { color: Colors.warning }]}>{formatCurrency(totalAdvance)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Balance</Text>
            <Text style={[styles.totalValue, { color: Colors.danger }]}>{formatCurrency(totalBalance)}</Text>
          </View>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1,2,3].map(i => <View key={i} style={styles.skeleton} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>📆</Text>
          <Text style={styles.emptyTitle}>No weekly sheets yet</Text>
          <Text style={styles.emptyMsg}>Tap "+ New" to log this week's attendance</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => { setSelected(null); setModalOpen(true); }}>
            <Text style={styles.emptyBtnText}>Create first sheet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <SheetCard
              sheet={item}
              onPress={() => { setSelected(item); setModalOpen(true); }}
              onDelete={handleDelete}
              onPay={() => {
                const bal = Number(item.balance_due ?? 0);
                if (bal <= 0) { Alert.alert('Paid', 'No balance due for this week'); return; }
                showPaymentOptions({
                  phoneNumber: null,
                  name: item.worker_name,
                  amount: bal,
                  note: `Weekly salary - ${item.worker_name} - ${item.week_start}`,
                });
              }}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        />
      )}

      <SheetModal
        visible={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        sheet={selected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 48 },
  backBtn:      { padding: 4 },
  backText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  addBtn:       { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D1D5DB', height: 44 },
  searchInput:  { flex: 1, fontSize: 15, color: '#1A1A2E' },

  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' },
  chipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:     { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  totalsRow:    { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  totalItem:    { flex: 1, alignItems: 'center' },
  totalLabel:   { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  totalValue:   { fontSize: 14, fontWeight: '800' },
  totalDivider: { width: 0.5, backgroundColor: '#E0E0E0' },

  sheetCard:    { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  sheetTop:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  sheetWorker:  { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  sheetProject: { fontSize: 13, color: Colors.textSecondary, marginBottom: 1 },
  sheetLabel:   { fontSize: 12, color: Colors.info, marginBottom: 1 },
  sheetWeek:    { fontSize: 12, color: Colors.textMuted },
  deleteBtn:    { padding: 6 },

  miniRow:      { flexDirection: 'row', gap: 4, marginBottom: 10 },
  miniCell:     { flex: 1, borderRadius: 6, paddingVertical: 5, alignItems: 'center' },
  miniDay:      { fontSize: 9, fontWeight: '600', marginBottom: 2 },
  miniVal:      { fontSize: 12, fontWeight: '700' },

  finRow:       { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#F0F0F0', paddingTop: 10 },
  finItem:      { flex: 1, alignItems: 'center' },
  finLabel:     { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  finValue:     { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },

  skeleton:     { height: 160, backgroundColor: '#E0E0E0', borderRadius: 16, opacity: 0.5 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptyMsg:     { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  modalClose:   { padding: 4, width: 32 },
  closeText:    { fontSize: 18, color: Colors.textSecondary },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  saveBtn:      { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBody:    { flex: 1, padding: 16 },

  label:        { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  weekRange:    { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 4 },

  picker:       { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue:  { fontSize: 15, color: '#1A1A2E' },
  pickerPlaceholder: { fontSize: 15, color: '#9CA3AF' },
  pickerArrow:  { fontSize: 12, color: Colors.textMuted },
  dropdown:     { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropItem:     { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dropItemActive: { backgroundColor: '#EFF6FF' },
  dropText:     { fontSize: 15, color: '#1A1A2E' },
  dropSub:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  dropEmpty:    { padding: 16, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  hintBox:      { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 8 },
  hintText:     { fontSize: 12, color: '#1E40AF', lineHeight: 18 },

  attendanceTable: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', marginBottom: 4 },
  tableHeader:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tableHeaderText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  dayRow:       { borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 10 },
  dayLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayName:      { fontSize: 14, fontWeight: '700', color: '#1A1A2E', width: 36 },
  dayDate:      { fontSize: 12, color: Colors.textMuted },

  cell:         { width: 44, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cellText:     { fontSize: 15, fontWeight: '800' },

  dayProjectPicker: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  dayProjectText:   { flex: 1, fontSize: 13, color: '#1A1A2E' },
  dayPickerArrow:   { fontSize: 10, color: Colors.textMuted },
  dayDropdown:  { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, marginTop: 4, overflow: 'hidden', marginBottom: 4 },
  dayDropItem:  { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dayDropItemActive: { backgroundColor: '#EFF6FF' },
  dayDropText:  { fontSize: 14, color: '#1A1A2E' },

  summaryBox:   { flexDirection: 'row', backgroundColor: '#F0F9FF', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#0369A1', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  summaryDivider: { width: 0.5, backgroundColor: '#BAE6FD' },

  balanceBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1.5, gap: 12 },
  balanceLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  balanceSub:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  balanceValue: { fontSize: 22, fontWeight: '800' },

  multiProjectInfo: { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#FDE68A' },
  multiProjectTitle:{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  multiProjectText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
});
