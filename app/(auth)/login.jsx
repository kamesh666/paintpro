import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, HelperText, TextInput } from "react-native-paper";
import { z } from "zod";
import { Colors, FontSize, Spacing } from "../../constants/colors";
import { useAuthStore } from "../../store/authStore";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    setServerError("");
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : error.message,
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoIcon}>🎨</Text>
          </View>
          <Text style={styles.appName}>PaintPro</Text>
          <Text style={styles.tagline}>Business Tracker</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to your account</Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <TextInput
                  label="Email address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  error={!!errors.email}
                  left={<TextInput.Icon icon="email-outline" />}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  style={styles.input}
                />
                {errors.email && (
                  <HelperText type="error">{errors.email.message}</HelperText>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <TextInput
                  label="Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  mode="outlined"
                  secureTextEntry={!showPass}
                  error={!!errors.password}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={showPass ? "eye-off-outline" : "eye-outline"}
                      onPress={() => setShowPass(!showPass)}
                    />
                  }
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  style={styles.input}
                />
                {errors.password && (
                  <HelperText type="error">
                    {errors.password.message}
                  </HelperText>
                )}
              </View>
            )}
          />

          {serverError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {serverError}</Text>
            </View>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            disabled={loading}
            contentStyle={styles.btnContent}
            style={styles.btn}
            buttonColor={Colors.primary}
            labelStyle={styles.btnLabel}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.7}
          >
            <Text style={styles.registerText}>
              Don't have an account?{" "}
              <Text style={styles.registerLink}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>PaintPro © {new Date().getFullYear()}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  header: { alignItems: "center", paddingTop: 64, paddingBottom: Spacing.xl },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  logoIcon: { fontSize: 36 },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  fieldWrap: { marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surface, fontSize: FontSize.md },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  errorText: { color: Colors.danger, fontSize: FontSize.sm },
  btn: { borderRadius: 12, marginTop: Spacing.sm },
  btnContent: { height: 52 },
  btnLabel: { fontSize: FontSize.md, fontWeight: "700", letterSpacing: 0.5 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    paddingHorizontal: Spacing.sm,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  registerBtn: { alignItems: "center", paddingVertical: Spacing.xs },
  registerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  registerLink: { color: Colors.primary, fontWeight: "700" },
  footer: {
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
    fontSize: FontSize.xs,
    marginTop: Spacing.xl,
  },
});
