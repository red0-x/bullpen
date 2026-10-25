import { useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { errorText } from "@/src/api";
import { makeStyles, useTheme } from "@/src/theme";
import { Btn, Card, Field, H, Icon, Mascot, Notice, T } from "@/src/ui";

export default function Login() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { user, login, register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const [mode, setMode] = useState(params.mode === "register" ? "register" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;
  const isReg = mode === "register";
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (isReg) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView style={s.root} bottomOffset={24} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 20 }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} style={s.back} testID="login-back-button" hitSlop={6}>
        <Icon name="arrow-left" size={20} color={colors.brand} />
      </Pressable>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Mascot pose="glove" size={150} framed />
        <H size={34} style={{ textAlign: "center" }}>Always a backup in the bullpen.</H>
      </View>
      <Card testID="auth-form" style={{ gap: 14, padding: 20 }}>
        <View>
          <H size={26}>{isReg ? "Make your bench" : "Welcome back"}</H>
          <T muted>{isReg ? "Create a host account in seconds." : "Log in to see your properties."}</T>
        </View>
        {isReg && <Field label="Your name" value={form.name} onChangeText={set("name")} autoComplete="name" testID="register-name-input" />}
        <Field label="Email" value={form.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="login-email-input" />
        <Field label="Password" value={form.password} onChangeText={set("password")} secureTextEntry autoComplete={isReg ? "new-password" : "current-password"} testID="login-password-input" onSubmitEditing={submit} />
        {isReg && <T size={12} muted>At least 8 characters.</T>}
        {!!error && <Notice testID="auth-error">{error}</Notice>}
        <Btn label={isReg ? "Create account" : "Log in"} busy={busy} onPress={submit}
          disabled={!form.email || !form.password || (isReg && !form.name)} testID="login-submit-button" />
        <Btn variant="link" label={isReg ? "Already have an account? Log in" : "New here? Create an account"}
          onPress={() => { setMode(isReg ? "login" : "register"); setError(""); }} testID="auth-toggle-mode-button" />
      </Card>
      <T size={13} muted style={{ textAlign: "center" }}>For hosts with 1 to 5 rentals.</T>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
}));
