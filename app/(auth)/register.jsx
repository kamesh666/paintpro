import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, FontSize } from '../../constants/colors';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function RegisterScreen() {
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess]         = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ name, email, password }) => {
    setLoading(true);
    setServerError('');
    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      setServerError(
        error.message.includes('already registered')
          ? 'This email is already registered. Please sign in instead.'
          : error.message
      );
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Account created!</Text>
          <Text style={styles.successMsg}>
            Check your email to confirm your account, then sign in.
          </Text>
          <Button
            mode="contained"
            onPress={() => router.replace('/(auth)/login')}
            buttonColor={Colors.primary}
            contentStyle={{ height: 52 }}
            style={{ borderRadius: 12, marginTop: Spacing.lg }}
            labelStyle={{ fontSize: FontSize.md, fontWeight: '700' }}
          >
            Go to Sign In
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <Text style={styles.logoIcon}>🎨</Text>
          </View>
          <Text style={styles.appName}>PaintPro</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.cardSubtitle}>Fill in your details below</Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <TextInput
                  label="Full name" value={value} onChangeText={onChange} onBlur={onBlur}
                  mode="outlined" autoCapitalize="words" autoComplete="name" error={!!errors.name}
                  left={<TextInput.Icon icon="account-outline" />}
                  outlineColor={Colors.border} activeOutlineColor={Colors.primary} style={styles.input}
                />
                {errors.name && <HelperText type="error">{errors.name.message}</HelperText>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <TextInput
                  label="Email address" value={value} onChangeText={onChange} onBlur={onBlur}
                  mode="outlined" keyboardType="email-address" autoCapitalize="none"
                  autoComplete="email" error={!!errors.email}
                  left={<TextInput.Icon icon="email-outline" />}
                  outlineColor={Colors.border} activeOutlineColor={Colors.primary} style={styles.input}
                />
                {errors.email && <HelperText type="error">{errors.email.message}</HelperText>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <TextInput
                  label="Password" value={value} onChangeText={onChange} onBlur={onBlur}
                  mode="outlined" secureTextEntry={!showPass} error={!!errors.password}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={<TextInput.Icon icon={showPass ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPass(!showPass)} />}
                  outlineColor={Colors.border} activeOutlineColor={Colors.primary} style={styles.input}
                />
                {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <TextInput
                  label="Confirm password" value={value} onChangeText={onChange} onBlur={onBlur}
                  mode="outlined" secureTextEntry={!showConfirm} error={!!errors.confirmPassword}
                  left={<TextInput.Icon icon="lock-check-outline" />}
                  right={<TextInput.Icon icon={showConfirm ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowConfirm(!showConfirm)} />}
                  outlineColor={Colors.border} activeOutlineColor={Colors.primary} style={styles.input}
                />
                {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword.message}</HelperText>}
              </View>
            )}
          />

          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>Password requirements:</Text>
            <Text style={styles.hint}>• Minimum 8 characters</Text>
            <Text style={styles.hint}>• At least one uppercase letter</Text>
            <Text style={styles.hint}>• At least one number</Text>
          </View>

          {serverError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️  {serverError}</Text>
            </View>
          ) : null}

          <Button
            mode="contained" onPress={handleSubmit(onSubmit)} loading={loading} disabled={loading}
            contentStyle={styles.btnContent} style={styles.btn}
            buttonColor={Colors.primary} labelStyle={styles.btnLabel}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>

          <TouchableOpacity style={styles.loginBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>PaintPro © {new Date().getFullYear()}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.primary },
  scroll:           { flexGrow: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  header:           { alignItems: 'center', paddingTop: 48, paddingBottom: Spacing.xl },
  backBtn:          { alignSelf: 'flex-start', paddingVertical: Spacing.xs, paddingHorizontal: 4, marginBottom: Spacing.md },
  backText:         { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.md, fontWeight: '600' },
  logoWrap:         { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  logoIcon:         { fontSize: 32 },
  appName:          { fontSize: FontSize.xxl, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  tagline:          { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  card:             { backgroundColor: Colors.surface, borderRadius: 20, padding: Spacing.lg, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  cardTitle:        { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardSubtitle:     { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  fieldWrap:        { marginBottom: Spacing.sm },
  input:            { backgroundColor: Colors.surface, fontSize: FontSize.md },
  hintBox:          { backgroundColor: '#EFF6FF', borderRadius: 10, padding: Spacing.sm, marginBottom: Spacing.sm },
  hintTitle:        { fontSize: FontSize.sm, fontWeight: '600', color: Colors.info, marginBottom: 4 },
  hint:             { fontSize: FontSize.xs, color: Colors.info, lineHeight: 18 },
  errorBanner:      { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 10, padding: Spacing.sm, marginBottom: Spacing.sm },
  errorText:        { color: Colors.danger, fontSize: FontSize.sm },
  btn:              { borderRadius: 12, marginTop: Spacing.sm },
  btnContent:       { height: 52 },
  btnLabel:         { fontSize: FontSize.md, fontWeight: '700', letterSpacing: 0.5 },
  loginBtn:         { alignItems: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  loginText:        { fontSize: FontSize.md, color: Colors.textSecondary },
  loginLink:        { color: Colors.primary, fontWeight: '700' },
  successContainer: { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  successCard:      { backgroundColor: Colors.surface, borderRadius: 20, padding: Spacing.xl, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  successIcon:      { fontSize: 56, marginBottom: Spacing.md },
  successTitle:     { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  successMsg:       { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  footer:           { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: FontSize.xs, marginTop: Spacing.xl },
});
