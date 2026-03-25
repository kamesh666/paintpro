import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Switch, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import {
  registerForPushNotifications,
  scheduleDailyLabourReminder,
  scheduleWeeklyPaymentReminder,
  cancelAllNotifications,
  checkAndNotifyUnpaidBalances,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, FontSize } from '../constants/colors';

const INPUT = {
  backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
  fontSize: 15, color: '#1A1A2E',
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, value, onPress, icon, danger, last }) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Text style={styles.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({ label, icon, value, onChange, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#D1D5DB', true: Colors.primary + '88' }}
        thumbColor={value ? Colors.primary : '#F3F4F6'}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const router  = useRouter();
  const { profile, signOut, fetchProfile, session } = useAuthStore();

  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState('');
  const [phone,     setPhone]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifInvoice, setNotifInvoice] = useState(true);

  useEffect(() => {
    setName (profile?.name  ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() })
        .eq('id', session?.user?.id);
      if (error) throw error;
      await fetchProfile(session?.user?.id, session?.user);
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleChangePassword = async () => {
    Alert.alert(
      'Change password',
      'A password reset link will be sent to your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send link',
          onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(
              session?.user?.email ?? ''
            );
            if (error) Alert.alert('Error', error.message);
            else Alert.alert('Sent', 'Check your email for the reset link.');
          },
        },
      ]
    );
  };

  const handleEnableNotifications = async () => {
    const token = await registerForPushNotifications();
    if (token) {
      await scheduleDailyLabourReminder();
      await scheduleWeeklyPaymentReminder();
      Alert.alert('Notifications enabled', 'Daily labour reminder at 8 AM\nWeekly payment reminder on Mondays');
    } else {
      Alert.alert('Permission denied', 'Enable notifications in your device settings.');
    }
  };

  const handleTestNotification = async () => {
    await checkAndNotifyUnpaidBalances();
    Alert.alert('Done', 'Checked for unpaid balances — notification sent if any found.');
  };

  const handleDisableNotifications = async () => {
    await cancelAllNotifications();
    Alert.alert('Disabled', 'All scheduled notifications cancelled.');
  };

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <TouchableOpacity
          onPress={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          style={styles.editBtn}
        >
          <Text style={styles.editBtnText}>{saving ? 'Saving...' : editing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'Your name'}</Text>
          <Text style={styles.profileEmail}>{session?.user?.email ?? ''}</Text>
          <View style={[styles.roleBadge, profile?.role === 'admin' && styles.roleBadgeAdmin]}>
            <Text style={[styles.roleText, profile?.role === 'admin' && styles.roleTextAdmin]}>
              {profile?.role === 'admin' ? '👑 Admin' : '👤 Staff'}
            </Text>
          </View>
        </View>

        {/* Edit profile */}
        {editing && (
          <Section title="Edit profile">
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput style={[INPUT, { marginBottom: 12 }]}
              value={name} onChangeText={setName}
              placeholder="Your name" placeholderTextColor="#9CA3AF"
              autoCapitalize="words" underlineColorAndroid="transparent" />
            <Text style={styles.fieldLabel}>Phone number</Text>
            <TextInput style={INPUT}
              value={phone} onChangeText={setPhone}
              placeholder="Your phone number" placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad" underlineColorAndroid="transparent" />
          </Section>
        )}

        {/* Account */}
        <Section title="Account">
          <Row icon="📧" label="Email" value={session?.user?.email} last />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row icon="🔔" label="Enable notifications" onPress={handleEnableNotifications} />
          <Row icon="🧪" label="Test — check unpaid balances" onPress={handleTestNotification} />
          <Row icon="🔕" label="Disable all notifications" onPress={handleDisableNotifications} danger last />
        </Section>

        {/* Quick links */}
        <Section title="Quick links">
          <Row icon="📊" label="Reports & analytics" onPress={() => router.push('/reports')} />
          <Row icon="📆" label="Weekly labour tracker" onPress={() => router.push('/weekly-labour')} />
          <Row icon="📷" label="Site photos"        onPress={() => router.push('/site-photos')} />
          <Row icon="🧾" label="Material costs"       onPress={() => router.push('/material-costs')} />
          <Row icon="💰" label="Client payments"      onPress={() => router.push('/client-payments')} />
          <Row icon="📋" label="Worker payslips"      onPress={() => router.push('/payslip')} />
          <Row icon="📄" label="Quotations"           onPress={() => router.push('/quotation')} last />
        </Section>

        {/* App info */}
        <Section title="About">
          <Row icon="🎨" label="App name" value="PaintPro" />
          <Row icon="📱" label="Version" value="1.0.0" />
          <Row icon="🏗️" label="Built with" value="Expo + Supabase" last />
        </Section>

        {/* Security */}
        <Section title="Security">
          <Row icon="🔑" label="Change password" onPress={handleChangePassword} />
          <Row icon="🚪" label="Sign out" onPress={handleSignOut} danger last />
        </Section>

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
  editBtn:      { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  editBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  avatarSection:{ alignItems: 'center', paddingVertical: 28, backgroundColor: Colors.primary, paddingBottom: 32 },
  avatarWrap:   { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText:   { fontSize: 30, fontWeight: '800', color: '#fff' },
  profileName:  { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  roleBadge:    { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleBadgeAdmin: { backgroundColor: Colors.accent + '33' },
  roleText:     { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  roleTextAdmin:{ color: Colors.accentLight ?? '#F9C05A' },

  section:      { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingLeft: 4 },
  sectionCard:  { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },

  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  rowIcon:      { fontSize: 18, width: 28 },
  rowLabel:     { flex: 1, fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  rowValue:     { fontSize: 13, color: Colors.textSecondary, maxWidth: 160 },
  rowArrow:     { fontSize: 18, color: '#D1D5DB' },

  fieldLabel:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
});
