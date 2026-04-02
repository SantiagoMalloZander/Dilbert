"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Loader2,
  Shield,
  UserMinus,
  Users,
} from "lucide-react";
import type { AdminCompanyRecord } from "@/lib/workspace-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const APP_ADMIN_API_BASE = "/app/api/admin";

type FlashMessage = {
  tone: "success" | "error";
  text: string;
} | null;

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
  }).format(new Date(dateString));
}

function getStatusLabel(status: AdminCompanyRecord["status"]) {
  return status === "active" ? "Activa" : "Inactiva";
}

export function AdminPanel({
  companies,
}: {
  companies: AdminCompanyRecord[];
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<FlashMessage>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [vendorLimitDrafts, setVendorLimitDrafts] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    companyName: "",
    ownerEmail: "",
    ownerName: "",
    vendorLimit: "5",
  });

  useEffect(() => {
    setVendorLimitDrafts(
      Object.fromEntries(companies.map((company) => [company.id, String(company.vendorLimit)]))
    );
  }, [companies]);

  const adminStats = useMemo(() => {
    const activeCompanies = companies.filter((company) => company.status === "active").length;
    const totalVendorSlots = companies.reduce((total, company) => total + company.vendorLimit, 0);
    const activeVendors = companies.reduce((total, company) => total + company.activeVendors, 0);

    return {
      totalCompanies: companies.length,
      activeCompanies,
      totalVendorSlots,
      activeVendors,
    };
  }, [companies]);

  function setFormValue(field: keyof typeof createForm, value: string) {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCreateCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFlashMessage(null);
    setActionKey("create-company");

    try {
      const response = await fetch(`${APP_ADMIN_API_BASE}/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: createForm.companyName,
          ownerEmail: createForm.ownerEmail,
          ownerName: createForm.ownerName,
          vendorLimit: createForm.vendorLimit,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude crear la empresa.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: "Empresa creada. El owner ya recibió su mail de acceso.",
      });
      setCreateForm({
        companyName: "",
        ownerEmail: "",
        ownerName: "",
        vendorLimit: "5",
      });
      setIsCreateOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setFlashMessage({
        tone: "error",
        text: "No pude crear la empresa.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleImpersonation(companyId: string) {
    setFlashMessage(null);
    setActionKey(`impersonate:${companyId}`);

    try {
      const response = await fetch(`${APP_ADMIN_API_BASE}/impersonation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude entrar como owner.",
        });
        return;
      }

      startTransition(() => {
        router.push("/app/crm");
        router.refresh();
      });
    } catch {
      setFlashMessage({
        tone: "error",
        text: "No pude entrar como owner.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleDeactivateCompany(company: AdminCompanyRecord) {
    if (
      !window.confirm(
        `Vas a dar de baja ${company.name} y pasar todos sus vendedores a analyst.`
      )
    ) {
      return;
    }

    setFlashMessage(null);
    setActionKey(`company-off:${company.id}`);

    try {
      const response = await fetch(`${APP_ADMIN_API_BASE}/companies/${company.id}/deactivate`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude dar de baja la empresa.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: `${company.name} quedó inactiva y sin vendedores activos.`,
      });
      startTransition(() => router.refresh());
    } catch {
      setFlashMessage({
        tone: "error",
        text: "No pude dar de baja la empresa.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleVendorLimitSave(company: AdminCompanyRecord) {
    setFlashMessage(null);
    setActionKey(`vendor-limit:${company.id}`);

    try {
      const response = await fetch(
        `${APP_ADMIN_API_BASE}/companies/${company.id}/vendor-limit`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vendorLimit: vendorLimitDrafts[company.id],
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude actualizar el límite.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: `Actualicé el límite de vendedores para ${company.name}.`,
      });
      startTransition(() => router.refresh());
    } catch {
      setFlashMessage({
        tone: "error",
        text: "No pude actualizar el límite.",
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleVendorDeactivation(company: AdminCompanyRecord, vendorId: string) {
    if (!window.confirm("Este vendedor va a pasar a analyst y va a liberar el slot.")) {
      return;
    }

    setFlashMessage(null);
    setActionKey(`vendor-off:${vendorId}`);

    try {
      const response = await fetch(
        `${APP_ADMIN_API_BASE}/companies/${company.id}/vendors/${vendorId}/deactivate`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setFlashMessage({
          tone: "error",
          text: data.error || "No pude dar de baja al vendedor.",
        });
        return;
      }

      setFlashMessage({
        tone: "success",
        text: `El vendedor quedó dado de baja en ${company.name}.`,
      });
      startTransition(() => router.refresh());
    } catch {
      setFlashMessage({
        tone: "error",
        text: "No pude dar de baja al vendedor.",
      });
    } finally {
      setActionKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge>Solo dilbert@gmail.com</Badge>
          <h2 className="text-3xl font-semibold tracking-tight">Panel de administración</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Alta de empresas, provisioning de owners, control de límites comerciales e
            impersonación segura por empresa.
          </p>
        </div>

        <Button size="lg" onClick={() => setIsCreateOpen(true)}>
          Crear empresa
        </Button>
      </div>

      {flashMessage ? (
        <div
          className={`rounded-[24px] border px-4 py-3 text-sm ${
            flashMessage.tone === "success"
              ? "border-primary/25 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive-foreground"
          }`}
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="bg-card/90">
          <CardHeader className="pb-3">
            <CardDescription>Total empresas</CardDescription>
            <CardTitle>{adminStats.totalCompanies}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/90">
          <CardHeader className="pb-3">
            <CardDescription>Empresas activas</CardDescription>
            <CardTitle>{adminStats.activeCompanies}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/90">
          <CardHeader className="pb-3">
            <CardDescription>Vendedores activos</CardDescription>
            <CardTitle>{adminStats.activeVendors}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/90">
          <CardHeader className="pb-3">
            <CardDescription>Slots comerciales</CardDescription>
            <CardTitle>{adminStats.totalVendorSlots}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle>Lista de empresas</CardTitle>
          <CardDescription>
            Estado actual de cada workspace y acciones rápidas de administración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-[22px] border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Vendedores</th>
                  <th className="px-4 py-3 font-medium">Usuarios</th>
                  <th className="px-4 py-3 font-medium">Creación</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-t border-white/10">
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Owner: {company.owner?.email || "sin owner asignado"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {company.activeVendors} / {company.vendorLimit}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{company.totalUsers}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={company.status === "active" ? "default" : "secondary"}>
                        {getStatusLabel(company.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleImpersonation(company.id)}
                          disabled={actionKey !== null}
                        >
                          {actionKey === `impersonate:${company.id}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          Acceder como Owner
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivateCompany(company)}
                          disabled={company.status === "inactive" || actionKey !== null}
                        >
                          {actionKey === `company-off:${company.id}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Shield className="mr-2 h-4 w-4" />
                          )}
                          Dar de baja
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {companies.map((company) => (
          <Card key={company.id} className="bg-card/90">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Building2 className="h-3.5 w-3.5" />
                    {company.name}
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {company.activeVendors} vendedores activos de {company.vendorLimit}
                    </CardTitle>
                    <CardDescription>
                      Owner: {company.owner?.name || "Sin owner"} · {company.owner?.email || "sin email"}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={company.status === "active" ? "default" : "secondary"}>
                  {getStatusLabel(company.status)}
                </Badge>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  Límite de vendedores
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="number"
                    min={Math.max(company.activeVendors, 1)}
                    value={vendorLimitDrafts[company.id] || ""}
                    onChange={(event) =>
                      setVendorLimitDrafts((current) => ({
                        ...current,
                        [company.id]: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-background"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => handleVendorLimitSave(company)}
                    disabled={actionKey !== null}
                  >
                    {actionKey === `vendor-limit:${company.id}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Guardar límite
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  No podés bajar el límite por debajo de los vendedores hoy activos.
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="rounded-[22px] border border-white/10">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-medium">Vendedores de la empresa</p>
                  <Badge variant="secondary">{company.vendors.length}</Badge>
                </div>

                {company.vendors.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    Esta empresa no tiene vendedores activos.
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {company.vendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{vendor.name}</p>
                          <p className="text-sm text-muted-foreground">{vendor.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Alta: {formatDate(vendor.createdAt)}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVendorDeactivation(company, vendor.id)}
                          disabled={actionKey !== null}
                        >
                          {actionKey === `vendor-off:${vendor.id}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="mr-2 h-4 w-4" />
                          )}
                          Dar de baja vendedor
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04070d]/80 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-[#0b1220] shadow-panel">
            <form onSubmit={handleCreateCompany}>
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Nueva empresa</p>
                <h3 className="mt-2 text-2xl font-semibold">Crear empresa y owner</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Se crea la empresa, el usuario owner en Supabase Auth, su fila en `users`
                  y el mail de acceso por Resend.
                </p>
              </div>

              <div className="grid gap-4 px-6 py-5">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nombre de empresa</Label>
                  <Input
                    id="company-name"
                    value={createForm.companyName}
                    onChange={(event) => setFormValue("companyName", event.target.value)}
                    className="border-white/10 bg-background"
                    placeholder="Acme CRM"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="owner-name">Nombre del Owner</Label>
                    <Input
                      id="owner-name"
                      value={createForm.ownerName}
                      onChange={(event) => setFormValue("ownerName", event.target.value)}
                      className="border-white/10 bg-background"
                      placeholder="María Pérez"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-email">Email del Owner</Label>
                    <Input
                      id="owner-email"
                      type="email"
                      value={createForm.ownerEmail}
                      onChange={(event) => setFormValue("ownerEmail", event.target.value)}
                      className="border-white/10 bg-background"
                      placeholder="owner@empresa.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor-limit">Límite de vendedores</Label>
                  <Input
                    id="vendor-limit"
                    type="number"
                    min={1}
                    value={createForm.vendorLimit}
                    onChange={(event) => setFormValue("vendorLimit", event.target.value)}
                    className="border-white/10 bg-background"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={actionKey !== null}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={actionKey !== null}>
                  {actionKey === "create-company" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Crear empresa
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
