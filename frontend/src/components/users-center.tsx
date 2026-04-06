"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Link2,
  Loader2,
  RefreshCcw,
  UserPlus,
  UserX,
} from "lucide-react";
import type {
  CompanyUserRecord,
  InviteLinkRecord,
} from "@/lib/workspace-users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { emitGlobalToast } from "@/lib/global-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRoleLabel, type AppRole } from "@/lib/workspace-roles";

const USERS_API_BASE = "/app/api/users";

type FlashMessage = {
  tone: "success" | "error";
  text: string;
} | null;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
  }).format(new Date(dateString));
}

function getInitials(name: string, email: string) {
  const source = name || email;
  return source
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getStateLabel(state: CompanyUserRecord["state"]) {
  return state === "active" ? "Activo" : "Pendiente";
}

export function UsersCenter({
  companyId,
  users,
  vendorLimit,
  activeVendors,
  inviteLink,
}: {
  companyId: string;
  users: CompanyUserRecord[];
  vendorLimit: number;
  activeVendors: number;
  inviteLink: InviteLinkRecord;
}) {
  const router = useRouter();
  const [flashMessage, setFlashMessage] = useState<FlashMessage>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    email: "",
    role: "analyst" as "analyst" | "vendor",
  });

  const summary = useMemo(
    () => ({
      totalUsers: users.length,
      pendingUsers: users.filter((user) => user.state === "pending").length,
    }),
    [users]
  );

  async function handleCopyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setFlashMessage({
        tone: "success",
        text: "Link copiado al portapapeles.",
      });
    } catch {
      setFlashMessage({
        tone: "error",
        text: "No pude copiar el link.",
      });
    }
  }

  async function handleRegenerateInviteLink() {
    setFlashMessage(null);
    setActionKey("regenerate-link");

    try {
      const response = await fetch(`${USERS_API_BASE}/invite-link`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude regenerar el link.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: "Generé un link nuevo y dejé inválido el anterior.",
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({
        tone: "error",
        text: "No pude regenerar el link.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleAddUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFlashMessage(null);
    setActionKey("add-user");

    try {
      const response = await fetch(USERS_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addForm),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude agregar el usuario.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: `Email de acceso enviado a ${addForm.email}`,
      });
      setAddForm({
        email: "",
        role: "analyst",
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({
        tone: "error",
        text: "No pude agregar el usuario.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleRoleChange(user: CompanyUserRecord, nextRole: AppRole) {
    if (nextRole === user.role || nextRole === "owner") {
      return;
    }

    setFlashMessage(null);
    setActionKey(`role:${user.email}`);

    try {
      const response = await fetch(`${USERS_API_BASE}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          role: nextRole,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude actualizar el rol.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: `Actualicé el rol de ${user.email}.`,
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({
        tone: "error",
        text: "No pude actualizar el rol.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleRevokeAccess(user: CompanyUserRecord) {
    if (!window.confirm(`Vas a quitarle acceso a ${user.email}.`)) {
      return;
    }

    setFlashMessage(null);
    setActionKey(`revoke:${user.email}`);

    try {
      const response = await fetch(`${USERS_API_BASE}/access`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude quitar el acceso.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: `Le quité el acceso a ${user.email}.`,
      });
      startTransition(() => router.refresh());
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "Falló la conexión de red. Probá de nuevo en unos segundos.",
      });
      setFlashMessage({
        tone: "error",
        text: "No pude quitar el acceso.",
      });
    } finally {
      setActionKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {flashMessage ? (
        <div
          className={
            flashMessage.tone === "success"
              ? "rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
              : "rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          }
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>Usuarios de la empresa</CardTitle>
            <CardDescription>
              {summary.totalUsers} usuarios registrados en este workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">
                {activeVendors} / {vendorLimit} Vendedores
              </Badge>
              <Badge variant="secondary">{summary.pendingUsers} Pendientes</Badge>
              <Badge variant="secondary">{companyId}</Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isBusy = actionKey === `role:${user.email}` || actionKey === `revoke:${user.email}`;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-white/10">
                            <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.canManage ? (
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user, value as "analyst" | "vendor")
                            }
                            disabled={isBusy}
                          >
                            <SelectTrigger className="min-w-32 border-white/10 bg-background/60 text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="analyst">Analista</SelectItem>
                              <SelectItem value="vendor">Vendedor</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge>{getRoleLabel(user.role)}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.state === "active" ? "secondary" : "outline"}>
                          {getStateLabel(user.state)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.joinedAt)}</TableCell>
                      <TableCell className="text-right">
                        {user.canManage ? (
                          <Button
                            variant="ghost"
                            className="text-red-200 hover:text-red-100"
                            onClick={() => handleRevokeAccess(user)}
                            disabled={isBusy}
                          >
                            {actionKey === `revoke:${user.email}` ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <UserX className="mr-2 h-4 w-4" />
                            )}
                            Quitar acceso
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Owner</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle>Agregar usuario</CardTitle>
              <CardDescription>
                Registralo en `authorized_emails`. El aviso se lo mandás vos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAddUser}>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    placeholder="nombre@empresa.com"
                    value={addForm.email}
                    onChange={(event) =>
                      setAddForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className="border-white/10 bg-background/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-role">Rol</Label>
                  <Select
                    value={addForm.role}
                    onValueChange={(value) =>
                      setAddForm((current) => ({
                        ...current,
                        role: value as "analyst" | "vendor",
                      }))
                    }
                  >
                    <SelectTrigger
                      id="user-role"
                      className="w-full border-white/10 bg-background/60 text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analyst">Analista</SelectItem>
                      <SelectItem value="vendor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" type="submit" disabled={actionKey === "add-user"}>
                  {actionKey === "add-user" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Agregar usuario
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle>Link de acceso compartible</CardTitle>
              <CardDescription>
                Este link expira en {inviteLink.hoursRemaining} horas y se regenera cada 24 horas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                  Link actual
                </div>
                <p className="break-all text-sm text-foreground">{inviteLink.url}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" className="flex-1" onClick={handleCopyInviteLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRegenerateInviteLink}
                  disabled={actionKey === "regenerate-link"}
                >
                  {actionKey === "regenerate-link" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Regenerar link ahora
                </Button>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                Si alguien entra con ese link y todavía no estaba autorizado, al completar el
                registro queda agregado automaticamente como <strong>Analista</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
