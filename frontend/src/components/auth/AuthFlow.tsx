"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";
import {
  finalizeRegistrationAction,
  lookupEmailAction,
  prepareOauthFlowAction,
  requestRegistrationOtpAction,
  syncExistingUserAccessAction,
} from "@/modules/auth/actions";
import type { AuthOtpType, AuthStep } from "@/modules/auth/types";
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
  if (!message) {
    return "No pude iniciar sesión en este momento.";
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "La contraseña es incorrecta.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Primero verificá tu email con el código que te mandamos.";
  }

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
  const [joinToken] = useState(initialJoinToken);
  const [otpType, setOtpType] = useState<AuthOtpType>(initialOtpType);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    "email" | "password" | "otp" | "register" | "google" | "microsoft" | null
  >(null);

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(STORAGE_KEY);
    if (savedPreference !== null) {
      setRememberMe(savedPreference === "1");
    }
  }, []);

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
    if (oauthMessage) {
      setGlobalMessage(oauthMessage);
    }
  }, [oauthError, revoked, timeout]);

  const subtitle = useMemo(() => {
    switch (step) {
      case "login":
        return "Ingresá tu contraseña o continuá con tu proveedor corporativo.";
      case "register":
        return "Completá tu nombre y contraseña, o continuá con Google o Microsoft.";
      case "otp":
        return `Te enviamos un código de 6 dígitos a ${email}.`;
      default:
        return "Ingresá tu email para continuar.";
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
      setStep(result.exists ? "login" : "register");
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setPasswordError(getLoginErrorMessage(error.message));
        return;
      }

      const synced = await syncExistingUserAccessAction({
        email,
        joinToken: joinToken || undefined,
      });

      router.push(synced.redirectTo);
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setGlobalMessage("No pude iniciar sesión en este momento.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRequestOtp() {
    resetErrors();

    if (!fullName.trim()) {
      setNameError("Ingresá tu nombre completo.");
      return;
    }

    if (!PASSWORD_RULE.test(password)) {
      setPasswordError(
        "La contraseña debe tener al menos 8 caracteres, 1 número y 1 carácter especial."
      );
      return;
    }

    setLoadingAction("register");
    try {
      const result = await requestRegistrationOtpAction({
        email,
        fullName,
        password,
        joinToken: joinToken || undefined,
      });

      setOtp("");
      setOtpType(result.otpType);
      setStep("otp");
      router.replace(
        `/app/?step=otp&email=${encodeURIComponent(email)}&otp_type=${encodeURIComponent(result.otpType)}${
          joinToken ? `&join=${encodeURIComponent(joinToken)}` : ""
        }`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "No pude enviar el código.";
      if (message.toLowerCase().includes("email")) {
        setEmailError(message);
      } else if (message.toLowerCase().includes("contraseña")) {
        setPasswordError(message);
      } else {
        setGlobalMessage(message);
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleVerifyOtp() {
    resetErrors();

    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Ingresá el código de 6 dígitos.");
      return;
    }

    setLoadingAction("otp");
    persistRememberPreference();

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: otpType,
      });

      if (error) {
        setOtpError("El código es incorrecto o venció. Pedí uno nuevo.");
        return;
      }

      const result = await finalizeRegistrationAction({
        email,
        joinToken: joinToken || undefined,
      });

      router.push(result.redirectTo);
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setGlobalMessage("No pude verificar el código ahora.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleOauth(provider: "google" | "microsoft", mode: "login" | "register") {
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
        mode,
        remember: rememberMe,
        joinToken: joinToken || undefined,
      });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "google" ? "google" : "azure",
        options: {
          redirectTo: `${window.location.origin}/app/auth/callback`,
        },
      });

      if (error) {
        setGlobalMessage("No pude iniciar el flujo OAuth. Probá de nuevo.");
      }
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setGlobalMessage("No pude iniciar el flujo OAuth.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-6 py-10 text-[#F4F4F5]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center">
            <div className="font-heading text-4xl tracking-wide text-[#F97316]">DILBERT.</div>
            <p className="mt-4 text-sm text-white/60">{subtitle}</p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111111] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            {globalMessage ? (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#F97316]/25 bg-[#F97316]/10 p-4 text-sm text-[#FED7AA]">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{globalMessage}</p>
              </div>
            ) : null}

            {step !== "email" ? (
              <button
                type="button"
                onClick={goBackToEmail}
                className="mb-5 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
            ) : null}

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white/80">
                  Ingresá tu email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={step !== "email" || loadingAction !== null}
                    className="h-12 rounded-2xl border-white/10 bg-[#171717] pl-10 text-white placeholder:text-white/30"
                    placeholder="tu@empresa.com"
                  />
                </div>
                {emailError ? <p className="text-sm text-[#FB923C]">{emailError}</p> : null}
              </div>

              {step === "register" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="full-name" className="text-sm font-medium text-white/80">
                      Nombre completo
                    </Label>
                    <Input
                      id="full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                      className="h-12 rounded-2xl border-white/10 bg-[#171717] text-white placeholder:text-white/30"
                      placeholder="Tu nombre"
                    />
                    {nameError ? <p className="text-sm text-[#FB923C]">{nameError}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium text-white/80">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <Input
                        id="register-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-12 rounded-2xl border-white/10 bg-[#171717] pl-10 text-white placeholder:text-white/30"
                        placeholder="Creá una contraseña segura"
                      />
                    </div>
                    <p className="text-xs text-white/40">
                      Mínimo 8 caracteres, 1 número y 1 carácter especial.
                    </p>
                    {passwordError ? <p className="text-sm text-[#FB923C]">{passwordError}</p> : null}
                  </div>
                </>
              ) : null}

              {step === "login" ? (
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium text-white/80">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 rounded-2xl border-white/10 bg-[#171717] pl-10 text-white placeholder:text-white/30"
                      placeholder="Ingresá tu contraseña"
                    />
                  </div>
                  {passwordError ? <p className="text-sm text-[#FB923C]">{passwordError}</p> : null}
                </div>
              ) : null}

              {step === "otp" ? (
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm font-medium text-white/80">
                    Código de verificación
                  </Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-12 rounded-2xl border-white/10 bg-[#171717] text-center text-lg tracking-[0.35em] text-white"
                    placeholder="000000"
                  />
                  {otpError ? <p className="text-sm text-[#FB923C]">{otpError}</p> : null}
                </div>
              ) : null}

              {step !== "email" ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                  />
                  <Label htmlFor="remember-me" className="cursor-pointer text-sm text-white/75">
                    Recordarme
                  </Label>
                </div>
              ) : null}

              {step === "email" ? (
                <Button
                  type="button"
                  onClick={handleEmailContinue}
                  disabled={loadingAction !== null}
                  className="h-12 w-full rounded-2xl bg-[#F97316] text-sm font-semibold text-black hover:bg-[#FB923C]"
                >
                  {loadingAction === "email" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continuar
                </Button>
              ) : null}

              {step === "login" ? (
                <Button
                  type="button"
                  onClick={handlePasswordLogin}
                  disabled={loadingAction !== null}
                  className="h-12 w-full rounded-2xl bg-[#F97316] text-sm font-semibold text-black hover:bg-[#FB923C]"
                >
                  {loadingAction === "password" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continuar
                </Button>
              ) : null}

              {step === "register" ? (
                <Button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loadingAction !== null}
                  className="h-12 w-full rounded-2xl bg-[#F97316] text-sm font-semibold text-black hover:bg-[#FB923C]"
                >
                  {loadingAction === "register" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continuar
                </Button>
              ) : null}

              {step === "otp" ? (
                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loadingAction !== null}
                  className="h-12 w-full rounded-2xl bg-[#F97316] text-sm font-semibold text-black hover:bg-[#FB923C]"
                >
                  {loadingAction === "otp" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verificar código
                </Button>
              ) : null}

              {step === "login" || step === "register" ? (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOauth("google", step === "login" ? "login" : "register")}
                    disabled={loadingAction !== null || !googleReady}
                    className="h-12 w-full rounded-2xl border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    {loadingAction === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continuar con Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      handleOauth("microsoft", step === "login" ? "login" : "register")
                    }
                    disabled={loadingAction !== null || !microsoftReady}
                    className="h-12 w-full rounded-2xl border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    {loadingAction === "microsoft" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continuar con Microsoft
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
