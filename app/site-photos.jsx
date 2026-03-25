import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, StatusBar, RefreshControl, ActivityIndicator,
  TextInput, Modal, ScrollView, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Colors, Spacing, FontSize } from '../constants/colors';
import { formatDate } from '../lib/utils';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

export default function SitePhotosScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams();
  const profile = useAuthStore((s) => s.profile);

  const projectId    = params.projectId;
  const projectTitle = params.projectTitle ?? 'Site Photos';

  const [photos,     setPhotos]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [uploading,  setUploading]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState(null); // full screen view
  const [caption,    setCaption]    = useState('');

  const fetchPhotos = async () => {
    try {
      let q = supabase
        .from('project_photos')
        .select('*')
        .order('uploaded_at', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      setPhotos(data ?? []);
    } catch (e) {
      console.log('Photos fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPhotos(); }, [projectId]);

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload site photos.');
      return false;
    }
    return true;
  };

  const uploadAsset = async (asset) => {
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext      = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const folder   = projectId ?? 'general';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array  = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('project-photos')
      .upload(fileName, uint8Array, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from('project-photos')
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase.from('project_photos').insert({
      project_id:  projectId ?? null,
      storage_url: publicUrl,
      caption:     caption || null,
      uploaded_by: profile?.id,
    });

    if (dbError) throw new Error(dbError.message);
    return publicUrl;
  };

  const pickAndUpload = async () => {
    const ok = await requestPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.75,
      allowsEditing: false,
      exif: false,
    });

    if (result.canceled) return;

    setUploading(true);
    let successCount = 0;
    const errors = [];

    for (const asset of result.assets) {
      try {
        await uploadAsset(asset);
        successCount++;
      } catch (e) {
        console.log('Upload error:', e.message);
        errors.push(e.message);
      }
    }

    setUploading(false);
    setCaption('');

    if (successCount > 0) {
      Alert.alert('Uploaded', `${successCount} photo${successCount > 1 ? 's' : ''} uploaded successfully`);
      fetchPhotos();
    } else {
      Alert.alert('Upload failed', errors[0] ?? 'Unknown error. Check bucket policies in Supabase.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });

    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = { ...result.assets[0], mimeType: 'image/jpeg' };
      await uploadAsset(asset);
      Alert.alert('Saved', 'Photo uploaded successfully');
      fetchPhotos();
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (photo) => {
    Alert.alert('Delete photo', 'Remove this photo permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('project_photos').delete().eq('id', photo.id);
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
            setSelected(null);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Site Photos</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{projectTitle}</Text>
        </View>
        <Text style={styles.photoCount}>{photos.length} photos</Text>
      </View>

      {/* Upload actions */}
      <View style={styles.uploadRow}>
        <TextInput
          style={styles.captionInput}
          value={caption}
          onChangeText={setCaption}
          placeholder="Caption (optional)"
          placeholderTextColor="#9CA3AF"
          underlineColorAndroid="transparent"
        />
        <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto} disabled={uploading}>
          <Text style={styles.uploadBtnText}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUpload} disabled={uploading}>
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.uploadBtnText}>📁 Upload</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Storage notice */}
      <View style={styles.noticeBanner}>
        <Text style={styles.noticeText}>
          📦 Requires "project-photos" bucket set to <Text style={{ fontWeight: '700' }}>Public</Text> in Supabase Storage
        </Text>
      </View>

      {/* Photo grid */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>📷</Text>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptyMsg}>Upload site photos to document your work progress</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={pickAndUpload}>
            <Text style={styles.emptyBtnText}>Upload first photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPhotos(); }} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.photoWrap}
              onPress={() => setSelected(item)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: item.storage_url }}
                style={styles.photo}
                resizeMode="cover"
              />
              {item.caption ? (
                <View style={styles.captionWrap}>
                  <Text style={styles.captionText} numberOfLines={1}>{item.caption}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Full screen photo modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.fullscreenWrap}>
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setSelected(null)}>
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </TouchableOpacity>

          {selected && (
            <>
              <Image
                source={{ uri: selected.storage_url }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <View style={styles.fullscreenInfo}>
                {selected.caption ? (
                  <Text style={styles.fullscreenCaption}>{selected.caption}</Text>
                ) : null}
                <Text style={styles.fullscreenDate}>
                  📅 {formatDate(selected.uploaded_at)}
                </Text>
                <TouchableOpacity
                  style={styles.deletePhotoBtn}
                  onPress={() => handleDelete(selected)}
                >
                  <Text style={styles.deletePhotoBtnText}>🗑 Delete photo</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 48, gap: 10 },
  backBtn:      { padding: 4 },
  backText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:    { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  photoCount:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },

  uploadRow:    { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  captionInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1A1A2E' },
  cameraBtn:    { backgroundColor: Colors.primary + 'CC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  uploadBtn:    { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  uploadBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  noticeBanner: { backgroundColor: '#FFF9E6', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#FED7AA' },
  noticeText:   { fontSize: 11, color: '#92400E' },

  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: Colors.textSecondary },

  grid:         { padding: 12, paddingBottom: 60 },
  photoWrap:    { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E0E0E0' },
  photo:        { width: '100%', height: '100%' },
  captionWrap:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4 },
  captionText:  { color: '#fff', fontSize: 9, fontWeight: '500' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptyMsg:     { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  fullscreenWrap:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  fullscreenClose:     { position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  fullscreenCloseText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fullscreenImage:     { width: '100%', height: '70%' },
  fullscreenInfo:      { padding: 20 },
  fullscreenCaption:   { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  fullscreenDate:      { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 },
  deletePhotoBtn:      { backgroundColor: Colors.danger + '22', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.danger + '44' },
  deletePhotoBtnText:  { color: Colors.danger, fontWeight: '700', fontSize: 14 },
});
