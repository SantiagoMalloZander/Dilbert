"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, Loader2, Mail, ShieldAlert } from "lucide-react";
import {
  applySessionPreference,
  clearSessionTrackingCookies,
  writeLastActivity,
} from "@/lib/workspace-activity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthStep = "email" | "login" | "register" | "otp";

type AuthScreenProps = {
  googleReady: boolean;
  microsoftReady: boolean;
  timeout?: boolean;
  initialEmail?: string;
  initialStep?: AuthStep;
  pendingAccess?: boolean;
  oauthError?: string;
  initialJoinToken?: string;
  revoked?: boolean;
};

const STORAGE_KEY = "dilbert-remember-preference";
const PASSWORD_RULE = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const APP_AUTH_API_BASE = "/app/api/auth";
const SUPER_ADMIN_EMAIL = "dilbert@gmail.com";

function getPostLoginPath(email: string) {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL ? "/app/admin" : "/app/crm";
}

function mapOauthErrorToMessage(errorCode?: string) {
  switch (errorCode) {
    case "email_mismatch":
      return "La cuenta de Google o Microsoft no coincide con el email que ingresaste.";
    case "not_registered":
      return "Ese email todavía no tiene acceso. Completá el registro o pedile a tu empresa que te habilite.";
    case "missing_intent":
      return "No pude continuar el flujo OAuth. Volvé a intentarlo.";
    default:
      return null;
  }
}

function mapCredentialError(errorCode?: string | null) {
  switch (errorCode) {
    case "INVALID_CREDENTIALS":
    case "CredentialsSignin":
      return "La contraseña es incorrecta.";
    case "MISSING_CREDENTIALS":
      return "Completá tu contraseña para continuar.";
    case "REGISTRATION_SESSION_INVALID":
      return "La sesión de registro venció. Volvé a pedir el código.";
    default:
      return "No pude iniciar sesión en este momento.";
  }
}

export function AuthScreen({
  googleReady,
  microsoftReady,
  timeout = false,
  initialEmail = "",
  initialStep = "email",
  pendingAccess = false,
  oauthError,
  initialJoinToken = "",
  revoked = false,
}: AuthScreenProps) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>(() => {
    if (pendingAccess && initialEmail && initialStep === "email") {
      return "login";
    }

    return initialStep;
  });
  const [email, setEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [joinToken] = useState(initialJoinToken);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    "email" | "password" | "otp" | "google" | "microsoft" | null
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

    if (pendingAccess) {
      setGlobalMessage(
        "Tu empresa todavía no te habilitó el acceso. Compartiles este mail y pediles que te agreguen en el Centro de Usuarios."
      );
      return;
    }

    if (revoked) {
      setGlobalMessage("Tu acceso fue revocado. Si necesitás volver a entrar, pedile a tu empresa que te habilite otra vez.");
      return;
    }

    const oauthMessage = mapOauthErrorToMessage(oauthError);
    if (oauthMessage) {
      setGlobalMessage(oauthMessage);
    }
  }, [oauthError, pendingAccess, revoked, timeout]);

  const canUseOauth = googleReady || microsoftReady;
  const subtitle = useMemo(() => {
    switch (step) {
      case "login":
        return "Ingresá tu contraseña o continuá con tu proveedor corporativo.";
      case "register":
        return "Creá tu acceso. Si preferís, podés continuar con Google o Microsoft.";
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

  function goToEmailStep() {
    resetErrors();
    clearSessionTrackingCookies();
    setPassword("");
    setOtp("");
    setStep("email");
    router.replace("/app/");
  }

  async function handleEmailContinue() {
    resetErrors();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError("Ingresá tu email.");
      return;
    }

    setLoadingAction("email");
    try {
      const response = await fetch(`${APP_AUTH_API_BASE}/email-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json();

      if (!response.ok) {
        setEmailError(data.error || "No pude validar tu email.");
        return;
      }

      setEmail(normalizedEmail);
      setStep(data.exists ? "login" : "register");
    } catch {
      setEmailError("No pude validar tu email.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePasswordLogin() {
    resetErrors();
    if (!password) {
      setPasswordError("Ingresá tu contraseña.");
      return;
    }

    setLoadingAction("password");
    persistRememberPreference();

    const result = await signIn("credentials", {
      email,
      password,
      joinToken: joinToken || undefined,
      redirect: false,
      callbackUrl: getPostLoginPath(email),
    });

    if (result?.error) {
      const message = mapCredentialError(result.error);
      if (result.error === "INVALID_CREDENTIALS" || result.error === "CredentialsSignin") {
        setPasswordError(message);
      } else {
        setGlobalMessage(message);
      }
      setLoadingAction(null);
      return;
    }

    router.push(getPostLoginPath(email));
  }

  async function handleRequestOtp() {
    resetErrors();

    if (!fullName.trim()) {
      setNameError("Ingresá tu nombre completo.");
      return;
    }

    if (!PASSWORD_RULE.test(password)) {
      setPasswordError(
        "La contraseña debe tener al menos 1 número, 1 carácter especial y 8 caracteres."
      );
      return;
    }

    setLoadingAction("password");
    try {
      const response = await fetch(`${APP_AUTH_API_BASE}/register/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          password,
          joinToken: joinToken || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("email")) {
          setEmailError(data.error);
        } else if (data.error?.includes("contraseña")) {
          setPasswordError(data.error);
        } else {
          setGlobalMessage(data.error || "No pude enviarte el código.");
        }
        return;
      }

      setStep("otp");
      const nextStepUrl = new URLSearchParams({
        step: "otp",
        email,
      });
      if (joinToken) {
        nextStepUrl.set("join", joinToken);
      }
      router.replace(`/app/?${nextStepUrl.toString()}`);
      setGlobalMessage("Te mandamos un código de 6 dígitos por email.");
    } catch {
      setGlobalMessage("No pude enviarte el código.");
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
    try {
      const response = await fetch(`${APP_AUTH_API_BASE}/register/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          joinToken: joinToken || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setOtpError(data.error || "No pude validar el código.");
        return;
      }

      if (data.status === "pending_access") {
        persistRememberPreference();
        const signInResult = await signIn("registration-token", {
          token: data.sessionToken,
          redirect: false,
          callbackUrl: getPostLoginPath(email),
        });

        if (signInResult?.error) {
          setGlobalMessage(mapCredentialError(signInResult.error));
          return;
        }

        router.push("/app/pending-access");
        return;
      }

      persistRememberPreference();
      const signInResult = await signIn("registration-token", {
        token: data.sessionToken,
        redirect: false,
        callbackUrl: getPostLoginPath(email),
      });

      if (signInResult?.error) {
        setGlobalMessage(mapCredentialError(signInResult.error));
        return;
      }

      router.push(getPostLoginPath(email));
    } catch {
      setOtpError("No pude validar el código.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleOauth(provider: "google" | "azure-ad", mode: "login" | "register") {
    resetErrors();

    if (!email.trim()) {
      setEmailError("Ingresá tu email antes de continuar.");
      return;
    }

    setLoadingAction(provider === "google" ? "google" : "microsoft");
    try {
      const response = await fetch(`${APP_AUTH_API_BASE}/oauth/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          mode,
          remember: rememberMe,
          joinToken: joinToken || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setGlobalMessage(data.error || "No pude iniciar el flujo OAuth.");
        setLoadingAction(null);
        return;
      }

      persistRememberPreference();
      await signIn(provider, { callbackUrl: getPostLoginPath(email) });
    } catch {
      setGlobalMessage("No pude iniciar el flujo OAuth.");
      setLoadingAction(null);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b14] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,233,195,0.16),transparent_30%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.16),transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/65">
            Dilbert
          </div>
          <h1 className="text-center text-3xl font-semibold tracking-tight">Acceso a la app</h1>
          <p className="text-center text-sm leading-6 text-white/60">{subtitle}</p>
        </div>

        <Card className="border-white/10 bg-white/5 shadow-panel backdrop-blur">
          <CardContent className="p-6">
            <div
              key={step}
              className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              {globalMessage ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  <div className="flex gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#f0c55b]" />
                    <span>{globalMessage}</span>
                  </div>
                </div>
              ) : null}

              {step !== "email" ? (
                <div className="rounded-2xl border border-white/10 bg-[#0d1524] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Email</p>
                  <p className="mt-1 text-sm font-medium text-white/85">{email}</p>
                </div>
              ) : null}

              {step === "email" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Ingresá tu email</Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nombre@empresa.com"
                      className="border-white/10 bg-[#0d1524] text-white placeholder:text-white/35"
                    />
                    {emailError ? (
                      <p className="text-sm text-[#ff8a8a]">{emailError}</p>
                    ) : null}
                  </div>

                  <Button
                    className="h-11 w-full"
                    onClick={handleEmailContinue}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "email" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continuar
                  </Button>
                </div>
              ) : null}

              {step === "login" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Tu contraseña"
                      className="border-white/10 bg-[#0d1524] text-white placeholder:text-white/35"
                    />
                    {passwordError ? (
                      <p className="text-sm text-[#ff8a8a]">{passwordError}</p>
                    ) : null}
                  </div>

                  <Button
                    className="h-11 w-full"
                    onClick={handlePasswordLogin}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "password" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continuar
                  </Button>

                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      className="h-11 w-full justify-start border border-white/10 bg-[#0d1524] text-white hover:bg-[#111c30]"
                      onClick={() => handleOauth("google", "login")}
                      disabled={!googleReady || loadingAction !== null}
                    >
                      {loadingAction === "google" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      Continuar con Google
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 w-full justify-start border border-white/10 bg-[#0d1524] text-white hover:bg-[#111c30]"
                      onClick={() => handleOauth("azure-ad", "login")}
                      disabled={!microsoftReady || loadingAction !== null}
                    >
                      {loadingAction === "microsoft" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      Continuar con Microsoft
                    </Button>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0d1524] px-4 py-3">
                    <Checkbox
                      id="remember-login"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="remember-login">Recordarme</Label>
                      <p className="text-sm leading-5 text-white/55">
                        30 minutos de inactividad y cierre automático. Si no lo marcás,
                        la sesión también cae al cerrar el navegador.
                      </p>
                    </div>
                  </div>

                  <Button variant="ghost" className="h-10 w-full" onClick={goToEmailStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </div>
              ) : null}

              {step === "register" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Nombre completo</Label>
                    <Input
                      id="full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Tu nombre y apellido"
                      className="border-white/10 bg-[#0d1524] text-white placeholder:text-white/35"
                    />
                    {nameError ? <p className="text-sm text-[#ff8a8a]">{nameError}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Mínimo 1 número y 1 carácter especial"
                      className="border-white/10 bg-[#0d1524] text-white placeholder:text-white/35"
                    />
                    {passwordError ? (
                      <p className="text-sm text-[#ff8a8a]">{passwordError}</p>
                    ) : (
                      <p className="text-sm text-white/45">
                        Usá al menos 8 caracteres, 1 número y 1 carácter especial.
                      </p>
                    )}
                  </div>

                  <Button
                    className="h-11 w-full"
                    onClick={handleRequestOtp}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "password" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continuar
                  </Button>

                  {canUseOauth ? (
                    <div className="space-y-2">
                      <Button
                        variant="secondary"
                        className="h-11 w-full justify-start border border-white/10 bg-[#0d1524] text-white hover:bg-[#111c30]"
                        onClick={() => handleOauth("google", "register")}
                        disabled={!googleReady || loadingAction !== null}
                      >
                        {loadingAction === "google" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="mr-2 h-4 w-4" />
                        )}
                        Continuar con Google
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-11 w-full justify-start border border-white/10 bg-[#0d1524] text-white hover:bg-[#111c30]"
                        onClick={() => handleOauth("azure-ad", "register")}
                        disabled={!microsoftReady || loadingAction !== null}
                      >
                        {loadingAction === "microsoft" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="mr-2 h-4 w-4" />
                        )}
                        Continuar con Microsoft
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0d1524] px-4 py-3">
                    <Checkbox
                      id="remember-register"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="remember-register">Recordarme</Label>
                      <p className="text-sm leading-5 text-white/55">
                        30 minutos de inactividad. Si no lo marcás, la sesión cae al cerrar
                        el navegador.
                      </p>
                    </div>
                  </div>

                  <Button variant="ghost" className="h-10 w-full" onClick={goToEmailStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </div>
              ) : null}

              {step === "otp" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Código de 6 dígitos</Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      className="border-white/10 bg-[#0d1524] text-center font-mono text-lg tracking-[0.4em] text-white placeholder:tracking-normal placeholder:text-white/35"
                    />
                    {otpError ? <p className="text-sm text-[#ff8a8a]">{otpError}</p> : null}
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0d1524] px-4 py-3">
                    <Checkbox
                      id="remember-otp"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="remember-otp">Recordarme</Label>
                      <p className="text-sm leading-5 text-white/55">
                        Conserva la sesión entre aperturas solo si lo marcás.
                      </p>
                    </div>
                  </div>

                  <Button
                    className="h-11 w-full"
                    onClick={handleVerifyOtp}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === "otp" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verificar código
                  </Button>

                  <Button variant="ghost" className="h-10 w-full" onClick={goToEmailStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
