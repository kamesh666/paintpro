import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, TextInput, StatusBar, RefreshControl,
  Alert, Linking,
} from 'react-native';
import { useClients, useUpsertClient } from '../../hooks/useSupabase';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, FontSize } from '../../constants/colors';

const INPUT = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 10,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  color: '#1A1A2E',
};

function Avatar({ name, size = 44 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const palette = ['#1E3A5F', '#27AE60', '#F4A020', '#2980B9', '#8E44AD', '#E74C3C'];
  const color   = palette[(name?.charCodeAt(0) ?? 0) % palette.length];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.avatarText, { color, fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function ClientCard({ client, onPress, onCall, onWhatsApp }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        <Avatar name={client.name} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{client.name}</Text>
          {client.phone   ? <Text style={styles.cardSub} numberOfLines={1}>📞 {client.phone}</Text>   : null}
          {client.address ? <Text style={styles.cardSub} numberOfLines={1}>📍 {client.address}</Text> : null}
        </View>
      </View>
      <View style={styles.cardActions}>
        {client.phone && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onCall(client.phone)}>
              <Text style={styles.actionIcon}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onWhatsApp(client.phone)}>
              <Text style={styles.actionIcon}>💬</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function ClientModal({ visible, onClose, client }) {
  const upsert  = useUpsertClient();
  const profile = useAuthStore((s) => s.profile);
  const isEdit  = !!client?.id;

  // ✅ KEY FIX: useEffect resets form whenever client changes
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');
  const [address, setAddress] = useState('');
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (visible) {
      setName   (client?.name    ?? '');
      setPhone  (client?.phone   ?? '');
      setEmail  (client?.email   ?? '');
      setAddress(client?.address ?? '');
      setNotes  (client?.notes   ?? '');
    }
  }, [visible, client]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Client name is required'); return; }
    setSaving(true);
    try {
      await upsert.mutateAsync({
        ...(isEdit ? { id: client.id } : {}),
        name:       name.trim(),
        phone:      phone.trim(),
        email:      email.trim(),
        address:    address.trim(),
        notes:      notes.trim(),
        created_by: profile?.id,
      });
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
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{isEdit ? 'Edit client' : 'New client'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.avatarPreview}>
            <Avatar name={name || 'New'} size={72} />
          </View>

          <Text style={styles.label}>Full name *</Text>
          <TextInput style={INPUT} value={name} onChangeText={setName}
            placeholder="e.g. Rajesh Kumar" placeholderTextColor="#9CA3AF"
            autoCapitalize="words" underlineColorAndroid="transparent" />

          <Text style={styles.label}>Phone number</Text>
          <TextInput style={INPUT} value={phone} onChangeText={setPhone}
            placeholder="e.g. 9876543210" placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad" underlineColorAndroid="transparent" />

          <Text style={styles.label}>Email address</Text>
          <TextInput style={INPUT} value={email} onChangeText={setEmail}
            placeholder="e.g. raj@gmail.com" placeholderTextColor="#9CA3AF"
            keyboardType="email-address" autoCapitalize="none" underlineColorAndroid="transparent" />

          <Text style={styles.label}>Address</Text>
          <TextInput style={INPUT} value={address} onChangeText={setAddress}
            placeholder="e.g. Tiruppur, Tamil Nadu" placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent" />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[INPUT, { height: 88, textAlignVertical: 'top' }]}
            value={notes} onChangeText={setNotes}
            placeholder="Any additional notes..." placeholderTextColor="#9CA3AF"
            multiline underlineColorAndroid="transparent" />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ClientsScreen() {
  const [search,     setSearch]     = useState('');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [selected,   setSelected]   = useState(null);

  const { data: clients, isLoading, refetch, isRefetching } = useClients();

  const filtered = (clients ?? []).filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit   = (c)  => { setSelected(c);   setModalOpen(true); };

  const handleCall = (phone) =>
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Could not open phone'));

  const handleWhatsApp = (phone) => {
    const n = phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${n.startsWith('91') ? n : '91' + n}`)
      .catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search clients..." placeholderTextColor="#9CA3AF"
          underlineColorAndroid="transparent" />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: Colors.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isLoading && filtered.length > 0 && (
        <Text style={styles.countText}>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</Text>
      )}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          {[1,2,3].map(i => <View key={i} style={styles.skeleton} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>{search ? 'No clients found' : 'No clients yet'}</Text>
          <Text style={styles.emptyMsg}>{search ? 'Try a different search' : 'Tap + to add your first client'}</Text>
          {!search && (
            <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
              <Text style={styles.emptyBtnText}>Add client</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ClientCard client={item} onPress={() => openEdit(item)}
              onCall={handleCall} onWhatsApp={handleWhatsApp} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <ClientModal visible={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} client={selected} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D1D5DB', height: 46 },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E' },
  countText:   { paddingHorizontal: 16, marginBottom: 8, fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  list:        { padding: 16, paddingTop: 0, paddingBottom: 100 },
  card:        { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  cardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardInfo:    { flex: 1 },
  cardName:    { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  cardSub:     { fontSize: 12, color: Colors.textSecondary, marginBottom: 1 },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { padding: 8, borderRadius: 8, backgroundColor: Colors.background },
  actionIcon:  { fontSize: 14 },
  avatar:      { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText:  { fontWeight: '700' },
  loadingWrap: { padding: 16, gap: 10 },
  skeleton:    { height: 80, backgroundColor: '#E0E0E0', borderRadius: 14, opacity: 0.5 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:   { fontSize: 52, marginBottom: 16 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptyMsg:    { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn:    { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  fab:         { position: 'absolute', bottom: 80, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabIcon:     { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  modalClose:  { padding: 4, width: 32 },
  modalCloseText: { fontSize: 18, color: Colors.textSecondary },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  saveBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBody:   { flex: 1, padding: 16 },
  avatarPreview: { alignItems: 'center', paddingVertical: 20 },
  label:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
});
