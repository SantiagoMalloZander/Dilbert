"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import {
  createCompanyAsOwnerAction,
  lookupEmailAction,
  prepareOauthFlowAction,
  registerEmployeeAction,
  requestRegistrationOtpAction,
  syncExistingUserAccessAction,
} from "@/modules/auth/actions";
import type { AuthIntent, AuthOtpType, AuthStep } from "@/modules/auth/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  applySessionPreference,
  clearSessionTrackingCookies,
  writeLastActivity,
} from "@/lib/workspace-activity";
import { emitGlobalToast } from "@/lib/global-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFlowProps = {
  googleReady: boolean;
  microsoftReady: boolean;
  timeout?: boolean;
  initialEmail?: string;
  initialStep?: AuthStep;
  initialJoinToken?: string;
  initialOtpType?: AuthOtpType;
  oauthError?: string;
  revoked?: boolean;
};

const STORAGE_KEY = "dilbert-remember-preference";
const PASSWORD_RULE = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function getOAuthErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case "email_mismatch":
      return "La cuenta de Google o Microsoft no coincide con el email que ingresaste.";
    case "missing_intent":
      return "No pude completar el flujo OAuth. Volvé a intentarlo.";
    default:
      return null;
  }
}

function getLoginErrorMessage(message?: string) {
  if (!message) return "No pude iniciar sesión en este momento.";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "La contraseña es incorrecta.";
  return "No pude iniciar sesión en este momento.";
}

export function AuthFlow({
  googleReady,
  microsoftReady,
  timeout = false,
  initialEmail = "",
  initialStep = "email",
  initialJoinToken = "",
  initialOtpType = "signup",
  oauthError,
  revoked = false,
}: AuthFlowProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [inviteCode, setInviteCode] = useState(initialJoinToken);
  const [joinToken] = useState(initialJoinToken);
  const [intent, setIntent] = useState<AuthIntent>("login");
  const [otpType, setOtpType] = useState<AuthOtpType>(initialOtpType);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    "email" | "password" | "otp" | "owner" | "employee" | "resend" | "google" | "microsoft" | null
  >(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(STORAGE_KEY);
    if (savedPreference !== null) setRememberMe(savedPreference === "1");
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (timeout) {
      setGlobalMessage("Tu sesión anterior se cerró por 30 minutos de inactividad.");
      return;
    }
    if (revoked) {
      setGlobalMessage(
        "Tu acceso fue revocado. Si necesitás volver a entrar, pedile a tu empresa que te habilite otra vez."
      );
      return;
    }
    const oauthMessage = getOAuthErrorMessage(oauthError);
    if (oauthMessage) setGlobalMessage(oauthMessage);
  }, [oauthError, revoked, timeout]);

  const heading = useMemo(() => {
    switch (step) {
      case "login":
        return { title: "Hola de nuevo", subtitle: "Ingresá tu contraseña para entrar." };
      case "choose":
        return { title: "¿Cómo querés entrar?", subtitle: "Elegí una opción para empezar." };
      case "register-owner":
        return { title: "Creá tu inmobiliaria", subtitle: "Datos básicos y empezás. Sin tarjeta para probar." };
      case "register-employee":
        return { title: "Sumate a tu equipo", subtitle: "Creá tu acceso para entrar al CRM de tu inmobiliaria." };
      case "otp":
        return { title: "Revisá tu email", subtitle: `Te enviamos un código a ${email}.` };
      default:
        return { title: "Entrá a Dilbert", subtitle: "Tu CRM inmobiliario con IA. Ingresá tu email para continuar." };
    }
  }, [email, step]);

  function persistRememberPreference() {
    window.localStorage.setItem(STORAGE_KEY, rememberMe ? "1" : "0");
    applySessionPreference(rememberMe);
    writeLastActivity();
  }

  function resetErrors() {
    setEmailError(null);
    setNameError(null);
    setCompanyError(null);
    setPasswordError(null);
    setOtpError(null);
    setGlobalMessage(null);
  }

  function goBackToEmail() {
    resetErrors();
    clearSessionTrackingCookies();
    setPassword("");
    setOtp("");
    setStep("email");
    router.replace("/app/");
  }

  async function handleEmailContinue() {
    resetErrors();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setEmailError("Ingresá tu email.");
      return;
    }

    setLoadingAction("email");
    try {
      const result = await lookupEmailAction({ email: normalized });
      setEmail(result.email);

      if (result.verified) {
        // Fully registered account → password.
        setStep("login");
      } else if (result.preAuthorized) {
        // Owner/admin already assigned them a company → just create their access.
        setStep("register-employee");
      } else {
        // Brand-new (or half-finished) → let them pick owner vs employee.
        setStep("choose");
      }
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "No pude validar tu email.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePasswordLogin() {
    resetErrors();
    if (!password.trim()) {
      setPasswordError("Ingresá tu contraseña.");
      return;
    }

    setLoadingAction("password");
    persistRememberPreference();

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Unverified email → send the code and jump to verification.
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setLoadingAction("otp");
          try {
            const { error: otpError } = await supabase.auth.signInWithOtp({ email });
            if (otpError) throw otpError;
            setOtp("");
            setOtpType("magiclink");
            setIntent("login");
            setStep("otp");
          } catch (otpErr) {
            setGlobalMessage(
              otpErr instanceof Error ? otpErr.message : "No pude enviar el código de verificación."
            );
          } finally {
            setLoadingAction(null);
          }
          return;
        }
        setPasswordError(getLoginErrorMessage(error.message));
        return;
      }

      const synced = await syncExistingUserAccessAction({
        email,
        joinToken: joinToken || undefined,
      });
      router.push(synced.redirectTo);
    } catch {
      emitGlobalToast({ tone: "error", text: "Falló la conexión. Probá de nuevo en unos segundos." });
      setGlobalMessage("No pude iniciar sesión en este momento.");
    } finally {
      setLoadingAction(null);
    }
  }

  /** Shared OTP issuing for both owner and employee registration. */
  async function sendRegistrationOtp(nextIntent: AuthIntent) {
    const result = await requestRegistrationOtpAction({
      email,
      fullName,
      password,
      joinToken: joinToken || undefined,
    });
    setOtp("");
    setOtpType(result.otpType);
    setIntent(nextIntent);
    setStep("otp");
  }

  async function handleOwnerSubmit() {
    resetErrors();
    if (fullName.trim().length < 2) return setNameError("Ingresá tu nombre.");
    if (companyName.trim().length < 2) return setCompanyError("Ingresá el nombre de tu inmobiliaria.");
    if (!PASSWORD_RULE.test(password)) {
      return setPasswordError("Mínimo 8 caracteres, con un número y un símbolo.");
    }

    setLoadingAction("owner");
    try {
      await sendRegistrationOtp("owner");
    } catch (error) {
      handleRegisterError(error);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleEmployeeSubmit() {
    resetErrors();
    if (fullName.trim().length < 2) return setNameError("Ingresá tu nombre.");
    if (!PASSWORD_RULE.test(password)) {
      return setPasswordError("Mínimo 8 caracteres, con un número y un símbolo.");
    }

    setLoadingAction("employee");
    try {
      await sendRegistrationOtp("employee");
    } catch (error) {
      handleRegisterError(error);
    } finally {
      setLoadingAction(null);
    }
  }

  function handleRegisterError(error: unknown) {
    const message = error instanceof Error ? error.message : "No pude enviar el código.";
    if (message.toLowerCase().includes("iniciá sesión")) {
      setGlobalMessage(message);
      setStep("login");
    } else if (message.toLowerCase().includes("email")) {
      setEmailError(message);
    } else {
      setGlobalMessage(message);
    }
  }

  async function handleResendOtp() {
    if (loadingAction !== null || resendCooldown > 0) return;
    resetErrors();
    setLoadingAction("resend");
    try {
      if (otpType === "magiclink" && intent === "login") {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
      } else {
        await requestRegistrationOtpAction({
          email,
          fullName: fullName.trim() || "Nuevo usuario",
          password,
          joinToken: joinToken || undefined,
        });
      }
      setResendCooldown(30);
      emitGlobalToast({ tone: "success", text: `Te reenviamos un código nuevo a ${email}.` });
    } catch (error) {
      emitGlobalToast({
        tone: "error",
        text: error instanceof Error ? error.message : "No pude reenviar el código.",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleVerifyOtp() {
    resetErrors();
    if (!/^\d{6,8}$/.test(otp)) {
      setOtpError("Ingresá el código de 6 a 8 dígitos.");
      return;
    }

    setLoadingAction("otp");
    persistRememberPreference();

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: otpType });
      if (error) {
        setOtpError("El código es incorrecto o venció. Pedí uno nuevo.");
        return;
      }

      let redirectTo: string;
      if (intent === "owner") {
        const res = await createCompanyAsOwnerAction({
          email,
          companyName,
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
        });
        redirectTo = res.redirectTo;
      } else if (intent === "employee") {
        const res = await registerEmployeeAction({
          email,
          joinToken: inviteCode.trim() || joinToken || undefined,
        });
        redirectTo = res.redirectTo;
      } else {
        const res = await syncExistingUserAccessAction({ email, joinToken: joinToken || undefined });
        redirectTo = res.redirectTo;
      }

      router.push(redirectTo);
    } catch (error) {
      setGlobalMessage(
        error instanceof Error ? error.message : "No pude completar tu acceso. Probá de nuevo."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleOauth(provider: "google" | "microsoft") {
    resetErrors();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setEmailError("Ingresá tu email.");
      setStep("email");
      return;
    }

    setLoadingAction(provider);
    try {
      window.localStorage.setItem(STORAGE_KEY, rememberMe ? "1" : "0");
      applySessionPreference(rememberMe);
      writeLastActivity();

      await prepareOauthFlowAction({
        email: normalized,
        mode: step === "login" ? "login" : "register",
        remember: rememberMe,
        joinToken: joinToken || undefined,
      });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "google" ? "google" : "azure",
        options: { redirectTo: `${window.location.origin}/app/auth/callback` },
      });
      if (error) setGlobalMessage("No pude iniciar el flujo OAuth. Probá de nuevo.");
    } catch {
      emitGlobalToast({ tone: "error", text: "Falló la conexión. Probá de nuevo en unos segundos." });
      setGlobalMessage("No pude iniciar el flujo OAuth.");
    } finally {
      setLoadingAction(null);
    }
  }

  const primaryButtonClass =
    "h-11 w-full rounded-xl bg-[#D4420A] text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#B93708] active:scale-[0.985] disabled:opacity-60";
  const inputClass =
    "h-11 rounded-xl border-border bg-card text-[15px] text-foreground shadow-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[#D4420A]/30";

  function onEnter(action: () => void) {
    return (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && loadingAction === null) {
        event.preventDefault();
        action();
      }
    };
  }

  const showOauth = step === "login" || step === "register-employee";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(55%_100%_at_50%_0%,rgba(212,66,10,0.07),transparent_70%)]"
      />

      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="font-heading text-2xl font-bold tracking-tight text-[#D4420A]">DILBERT.</div>
          <h1 className="mt-7 text-[26px] font-semibold tracking-tight">{heading.title}</h1>
          <p className="mx-auto mt-2 max-w-[320px] text-sm leading-relaxed text-muted-foreground">
            {heading.subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-7">
          {globalMessage ? (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#D4420A]/20 bg-[#D4420A]/[0.06] p-3.5 text-sm leading-relaxed text-[#8a2c06] animate-in fade-in duration-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{globalMessage}</p>
            </div>
          ) : null}

          <div key={step} className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {/* Email field / locked email pill */}
            {step === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={onEnter(handleEmailContinue)}
                    disabled={loadingAction !== null}
                    className={`${inputClass} pl-10`}
                    placeholder="tu@inmobiliaria.com"
                  />
                </div>
                {emailError ? <p className="text-sm text-[#C0392B]">{emailError}</p> : null}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={goBackToEmail}
                  className="shrink-0 text-sm font-medium text-[#D4420A] transition-colors hover:text-[#B93708]"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* ── Choose: owner (primary) vs employee (secondary) ── */}
            {step === "choose" ? (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    resetErrors();
                    setStep("register-owner");
                  }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-[#D4420A]/25 bg-[#D4420A]/[0.04] p-5 text-left transition-all hover:border-[#D4420A]/50 hover:bg-[#D4420A]/[0.07] active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D4420A] text-white">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">Crear cuenta nueva</p>
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      Soy dueño de una inmobiliaria y quiero abrir mi espacio.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#D4420A] transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetErrors();
                    setStep("register-employee");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <UserPlus className="h-4 w-4" />
                  Me invitó mi inmobiliaria · entrar como empleado
                </button>
              </div>
            ) : null}

            {/* ── Owner registration ── */}
            {step === "register-owner" ? (
              <>
                <Field label="Tu nombre" error={nameError}>
                  <Input
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                    placeholder="Nombre y apellido"
                  />
                </Field>
                <Field label="Nombre de la inmobiliaria" error={companyError}>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={inputClass}
                    placeholder="Ej: Demarco Inmuebles"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Teléfono" optional>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      className={inputClass}
                      placeholder="+54 9 11…"
                    />
                  </Field>
                  <Field label="Ciudad" optional>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputClass}
                      placeholder="Ciudad / zona"
                    />
                  </Field>
                </div>
                <Field label="Contraseña" error={passwordError} hint="Mínimo 8 caracteres, con un número y un símbolo.">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    onEnter={() => handleOwnerSubmit()}
                    inputClass={inputClass}
                    placeholder="Creá una contraseña segura"
                  />
                </Field>
                <Button type="button" onClick={handleOwnerSubmit} disabled={loadingAction !== null} className={primaryButtonClass}>
                  {loadingAction === "owner" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Crear mi inmobiliaria
                </Button>
              </>
            ) : null}

            {/* ── Employee registration ── */}
            {step === "register-employee" ? (
              <>
                <Field label="Tu nombre" error={nameError}>
                  <Input
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                    placeholder="Nombre y apellido"
                  />
                </Field>
                <Field label="Contraseña" error={passwordError} hint="Mínimo 8 caracteres, con un número y un símbolo.">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    onEnter={() => handleEmployeeSubmit()}
                    inputClass={inputClass}
                    placeholder="Creá una contraseña segura"
                  />
                </Field>
                <Field label="Código de invitación" optional hint="Si tu inmobiliaria te pasó un código, pegalo acá.">
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className={inputClass}
                    placeholder="Opcional"
                  />
                </Field>
                <Button type="button" onClick={handleEmployeeSubmit} disabled={loadingAction !== null} className={primaryButtonClass}>
                  {loadingAction === "employee" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Crear mi acceso
                </Button>
              </>
            ) : null}

            {/* ── Login (password) ── */}
            {step === "login" ? (
              <>
                <Field label="Contraseña" error={passwordError}>
                  <PasswordInput
                    autoFocus
                    value={password}
                    onChange={setPassword}
                    onEnter={() => handlePasswordLogin()}
                    inputClass={inputClass}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                  />
                </Field>
                <Button type="button" onClick={handlePasswordLogin} disabled={loadingAction !== null} className={primaryButtonClass}>
                  {loadingAction === "password" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
              </>
            ) : null}

            {/* ── OTP ── */}
            {step === "otp" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm font-medium text-foreground">
                    Código de verificación
                  </Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    onKeyDown={onEnter(handleVerifyOtp)}
                    className={`${inputClass} h-13 text-center text-2xl font-semibold tracking-[0.4em]`}
                    placeholder="······"
                  />
                  {otpError ? <p className="text-sm text-[#C0392B]">{otpError}</p> : null}
                </div>
                <Button type="button" onClick={handleVerifyOtp} disabled={loadingAction !== null} className={primaryButtonClass}>
                  {loadingAction === "otp" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verificar y entrar
                </Button>
                <div className="pt-1 text-center text-sm text-muted-foreground">
                  ¿No te llegó?{" "}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loadingAction !== null || resendCooldown > 0}
                    className="inline-flex items-center gap-1.5 font-medium text-[#D4420A] transition-all hover:text-[#B93708] active:scale-95 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:text-muted-foreground"
                  >
                    {loadingAction === "resend" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Enviando…
                      </>
                    ) : resendCooldown > 0 ? (
                      `Reenviar en ${resendCooldown}s`
                    ) : (
                      "Reenviar código"
                    )}
                  </button>
                </div>
              </>
            ) : null}

            {/* Continuar (email step) */}
            {step === "email" ? (
              <Button type="button" onClick={handleEmailContinue} disabled={loadingAction !== null} className={primaryButtonClass}>
                {loadingAction === "email" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continuar
              </Button>
            ) : null}

            {/* Remember me */}
            {step === "login" || step === "register-owner" || step === "register-employee" ? (
              <label
                htmlFor="remember-me"
                className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm text-muted-foreground"
              >
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                />
                Mantener la sesión iniciada
              </label>
            ) : null}

            {/* OAuth */}
            {showOauth ? (
              <>
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">o</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOauth("google")}
                    disabled={loadingAction !== null || !googleReady}
                    className="h-11 w-full rounded-xl border-border bg-card text-sm font-medium text-foreground transition-all hover:bg-muted/60 active:scale-[0.985]"
                  >
                    {loadingAction === "google" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleLogo className="mr-2 h-4 w-4" />
                    )}
                    Continuar con Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOauth("microsoft")}
                    disabled={loadingAction !== null || !microsoftReady}
                    className="h-11 w-full rounded-xl border-border bg-card text-sm font-medium text-foreground transition-all hover:bg-muted/60 active:scale-[0.985]"
                  >
                    {loadingAction === "microsoft" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MicrosoftLogo className="mr-2 h-4 w-4" />
                    )}
                    Continuar con Microsoft
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <p className="mt-7 text-center text-xs leading-relaxed text-muted-foreground/80">
          Datos protegidos y cifrados. Cancelás cuando quieras.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  hint,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  error?: string | null;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
        {label}
        {optional ? <span className="text-xs font-normal text-muted-foreground">(opcional)</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-[#C0392B]">{error}</p> : null}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  onEnter,
  inputClass,
  placeholder,
  autoFocus,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  inputClass: string;
  placeholder: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
      <Input
        type="password"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        className={`${inputClass} pl-10`}
        placeholder={placeholder}
      />
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.27-2.09 3.56-5.17 3.56-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.16 7.16 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10.4" height="10.4" fill="#F25022" />
      <rect x="12.6" y="1" width="10.4" height="10.4" fill="#7FBA00" />
      <rect x="1" y="12.6" width="10.4" height="10.4" fill="#00A4EF" />
      <rect x="12.6" y="12.6" width="10.4" height="10.4" fill="#FFB900" />
    </svg>
  );
}
