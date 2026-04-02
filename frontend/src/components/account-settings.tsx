"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  PlugZap,
  ShieldAlert,
  Upload,
} from "lucide-react";
import type { AccountPageData } from "@/lib/workspace-account";
import { emitGlobalToast } from "@/lib/global-toast";
import { clearSessionTrackingCookies } from "@/lib/workspace-activity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACCOUNT_PROFILE_API = "/app/api/account/profile";
const ACCOUNT_AVATAR_API = "/app/api/account/avatar";
const ACCOUNT_PASSWORD_API = "/app/api/account/password";
const ACCOUNT_SESSIONS_API = "/app/api/account/sessions";
const APP_ADMIN_IMPERSONATION_API = "/app/api/admin/impersonation";
const SIGN_OUT_CALLBACK_URL = "/app/";

type ToastState = {
  tone: "success" | "error";
  text: string;
} | null;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
  }).format(new Date(dateString));
}

function getInitials(name: string, email: string) {
  return (name || email || "DU")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function validatePasswordStrength(password: string) {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(password);
}

export function AccountSettings({
  initialData,
}: {
  initialData: AccountPageData;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: initialData.name,
    phone: initialData.phone || "",
    avatarUrl: initialData.avatarUrl,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const passwordChecks = useMemo(
    () => ({
      hasNumber: /\d/.test(passwordForm.newPassword),
      hasSpecial: /[^A-Za-z0-9]/.test(passwordForm.newPassword),
      matches:
        passwordForm.confirmPassword.length > 0 &&
        passwordForm.newPassword === passwordForm.confirmPassword,
    }),
    [passwordForm.confirmPassword, passwordForm.newPassword]
  );

  async function handleThisDeviceSignOut() {
    clearSessionTrackingCookies();
    await fetch(APP_ADMIN_IMPERSONATION_API, { method: "DELETE" }).catch(() => undefined);
    await signOut({ callbackUrl: SIGN_OUT_CALLBACK_URL });
  }

  async function handleAllDevicesSignOut() {
    setActionKey("all-devices");
    setToast(null);

    try {
      const response = await fetch(ACCOUNT_SESSIONS_API, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setToast({
          tone: "error",
          text: data.error || "No pude cerrar las sesiones activas.",
        });
        return;
      }

      clearSessionTrackingCookies();
      await fetch(APP_ADMIN_IMPERSONATION_API, { method: "DELETE" }).catch(() => undefined);
      await signOut({ callbackUrl: SIGN_OUT_CALLBACK_URL });
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setToast({
        tone: "error",
        text: "No pude cerrar las sesiones activas.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: typeof fieldErrors = {};
    if (!profile.name.trim()) {
      nextErrors.name = "Ingresá tu nombre completo.";
    }

    setFieldErrors((current) => ({
      ...current,
      name: nextErrors.name,
    }));

    if (nextErrors.name) {
      return;
    }

    setActionKey("profile");
    setToast(null);

    try {
      const response = await fetch(ACCOUNT_PROFILE_API, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: profile.name,
          phone: profile.phone,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setToast({
          tone: "error",
          text: data.error || "No pude guardar tu perfil.",
        });
        return;
      }

      setToast({
        tone: "success",
        text: "Perfil actualizado.",
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setToast({
        tone: "error",
        text: "No pude guardar tu perfil.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setActionKey("avatar");
    setToast(null);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch(ACCOUNT_AVATAR_API, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setToast({
          tone: "error",
          text: data.error || "No pude subir tu foto.",
        });
        return;
      }

      setProfile((current) => ({
        ...current,
        avatarUrl: data.avatarUrl || current.avatarUrl,
      }));
      setToast({
        tone: "success",
        text: "Foto de perfil actualizada.",
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setToast({
        tone: "error",
        text: "No pude subir tu foto.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handlePasswordSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: typeof fieldErrors = {};
    if (initialData.hasPassword && !passwordForm.currentPassword.trim()) {
      nextErrors.currentPassword = "Ingresá tu contraseña actual.";
    }
    if (!validatePasswordStrength(passwordForm.newPassword)) {
      nextErrors.newPassword =
        "La nueva contraseña necesita al menos 1 número y 1 carácter especial.";
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      nextErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    setFieldErrors((current) => ({
      ...current,
      currentPassword: nextErrors.currentPassword,
      newPassword: nextErrors.newPassword,
      confirmPassword: nextErrors.confirmPassword,
    }));

    if (nextErrors.currentPassword || nextErrors.newPassword || nextErrors.confirmPassword) {
      return;
    }

    setActionKey("password");
    setToast(null);

    try {
      const response = await fetch(ACCOUNT_PASSWORD_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });
      const data = await response.json();

      if (!response.ok) {
        setToast({
          tone: "error",
          text: data.error || "No pude actualizar la contraseña.",
        });
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setFieldErrors((current) => ({
        ...current,
        currentPassword: undefined,
        newPassword: undefined,
        confirmPassword: undefined,
      }));
      setToast({
        tone: "success",
        text: data.message || "Contraseña actualizada.",
      });
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setToast({
        tone: "error",
        text: "No pude actualizar la contraseña.",
      });
    } finally {
      setActionKey(null);
    }
  }

  return (
    <>
      {toast ? (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-panel ${
            toast.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-100"
              : "border-destructive/30 bg-destructive/12 text-destructive"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {toast.text}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle>Info personal</CardTitle>
              <CardDescription>
                Actualizá tu perfil y la información visible dentro del workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleProfileSave}>
                <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-background/50 p-4 sm:flex-row sm:items-center">
                  <Avatar className="h-20 w-20 border border-white/10 bg-primary/10 text-lg text-primary">
                    {profile.avatarUrl ? (
                      <AvatarImage src={profile.avatarUrl} alt={profile.name || initialData.email} />
                    ) : null}
                    <AvatarFallback>{getInitials(profile.name, initialData.email)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-foreground">{profile.name || "Tu perfil"}</p>
                      <p className="text-sm text-muted-foreground">
                        JPG, PNG o WEBP. Máximo 2 MB.
                      </p>
                    </div>
                    <Label
                      htmlFor="avatar-upload"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8"
                    >
                      {actionKey === "avatar" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Cambiar foto
                    </Label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="account-name">Nombre completo</Label>
                    <Input
                      id="account-name"
                      value={profile.name}
                      aria-invalid={fieldErrors.name ? true : undefined}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                    {fieldErrors.name ? (
                      <p className="text-xs text-destructive">{fieldErrors.name}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-phone">Teléfono</Label>
                    <Input
                      id="account-phone"
                      value={profile.phone}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="+54 11 5555 5555"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={initialData.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input value={initialData.companyName} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Input value={initialData.roleLabel} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de alta</Label>
                    <Input value={formatDate(initialData.createdAt)} disabled />
                  </div>
                </div>

                <Button type="submit" disabled={actionKey === "profile"}>
                  {actionKey === "profile" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar cambios
                </Button>
              </form>
            </CardContent>
          </Card>

          {initialData.role === "vendor" ? (
            <Card className="bg-card/90">
              <CardHeader>
                <CardTitle>Mis canales conectados</CardTitle>
                <CardDescription>
                  Estado actual de tus canales y accesos comerciales.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {initialData.channels.map((channel) => (
                  <div
                    key={channel.type}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-background/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{channel.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {channel.connectedAt
                          ? `Conectado el ${formatDate(channel.connectedAt)}`
                          : "Todavía no conectado"}
                      </p>
                    </div>
                    <Badge variant={channel.status === "connected" ? "default" : "outline"}>
                      {channel.status === "connected" ? "Conectado" : "Desconectado"}
                    </Badge>
                  </div>
                ))}

                <Button variant="outline" onClick={() => router.push("/app/integrations")}>
                  <PlugZap className="mr-2 h-4 w-4" />
                  Ir a Integraciones
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle>{initialData.hasPassword ? "Cambiar contraseña" : "Agregar contraseña"}</CardTitle>
              <CardDescription>
                {initialData.oauthOnly
                  ? "Tu cuenta viene solo con OAuth. Podés sumar una contraseña para entrar también por email."
                  : "Para actualizar tu contraseña necesitás confirmar la actual."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordSave}>
                {initialData.hasPassword ? (
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Contraseña actual</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordForm.currentPassword}
                      aria-invalid={fieldErrors.currentPassword ? true : undefined}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }))
                      }
                    />
                    {fieldErrors.currentPassword ? (
                      <p className="text-xs text-destructive">{fieldErrors.currentPassword}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                    No necesitás contraseña actual porque tu cuenta hoy depende de OAuth.
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordForm.newPassword}
                    aria-invalid={fieldErrors.newPassword ? true : undefined}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                  {fieldErrors.newPassword ? (
                    <p className="text-xs text-destructive">{fieldErrors.newPassword}</p>
                  ) : null}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className={passwordChecks.hasNumber ? "text-emerald-300" : undefined}>
                      Debe incluir al menos 1 número
                    </p>
                    <p className={passwordChecks.hasSpecial ? "text-emerald-300" : undefined}>
                      Debe incluir al menos 1 carácter especial
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                  {fieldErrors.confirmPassword ? (
                    <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
                  ) : null}
                </div>

                <Button type="submit" disabled={actionKey === "password"}>
                  {actionKey === "password" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {initialData.hasPassword ? "Actualizar contraseña" : "Agregar contraseña"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-destructive/20 bg-card/90">
            <CardHeader>
              <CardTitle>Cerrar sesión</CardTitle>
              <CardDescription>
                Controlá las sesiones activas sobre tu cuenta y este dispositivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-background/50 p-4 text-sm text-muted-foreground">
                Si cerrás sesión en todos los dispositivos, las sesiones activas del workspace se
                invalidan y cada equipo va a tener que volver a autenticarse.
              </div>

              <Button variant="outline" onClick={handleThisDeviceSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión en este dispositivo
              </Button>

              <Button
                variant="destructive"
                onClick={handleAllDevicesSignOut}
                disabled={actionKey === "all-devices"}
              >
                {actionKey === "all-devices" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="mr-2 h-4 w-4" />
                )}
                Cerrar sesión en todos los dispositivos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
