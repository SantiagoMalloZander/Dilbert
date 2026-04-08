"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { createContact, searchContactsAction, updateContact } from "@/modules/crm/contacts/actions";
import type {
  ContactDetailRecord,
  ContactFormInput,
  ContactPageData,
  ContactSearchResult,
  ContactSource,
} from "@/modules/crm/contacts/types";
import { createLead } from "@/modules/crm/leads/actions";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/crm/Breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emitGlobalToast } from "@/lib/global-toast";
import { cn, formatDate } from "@/lib/utils";

const ContactDetailPanel = dynamic(
  () =>
    import("@/components/crm/ContactDetailPanel").then(
      (module) => module.ContactDetailPanel
    ),
  {
    ssr: false,
    loading: () => null,
  }
);

function getSourceLabel(source: ContactSource) {
  switch (source) {
    case "whatsapp":
      return "WhatsApp";
    case "gmail":
      return "Gmail";
    case "instagram":
      return "Instagram";
    case "zoom":
      return "Zoom";
    case "meet":
      return "Meet";
    case "import":
      return "Importado";
    default:
      return "Manual";
  }
}

function useDebouncedSearchParam(
  value: string,
  initialValue: string,
  updateParam: (key: string, value: string | null) => void
) {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (value !== initialValue) {
        updateParam("q", value || null);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [initialValue, updateParam, value]);
}

function validateContactForm(form: ContactFormInput) {
  return {
    firstName: form.firstName.trim() ? "" : "El nombre es obligatorio.",
    lastName: form.lastName.trim() ? "" : "El apellido es obligatorio.",
    email:
      !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
        ? ""
        : "Ingresá un email válido.",
    phone:
      !form.phone || /^[+\d\s()-]{7,20}$/.test(form.phone)
        ? ""
        : "Ingresá un teléfono válido.",
  };
}

function ContactFormDialog({
  open,
  onOpenChange,
  initialContact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContact?: ContactDetailRecord | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ContactFormInput>({
    firstName: initialContact?.firstName || "",
    lastName: initialContact?.lastName || "",
    email: initialContact?.email || "",
    phone: initialContact?.phone || "",
    companyName: initialContact?.companyName || "",
    position: initialContact?.position || "",
  });

  const errors = validateContactForm(form);
  const hasErrors = Object.values(errors).some(Boolean);

  const handleSubmit = async () => {
    if (hasErrors) {
      emitGlobalToast({ tone: "error", text: "Revisá los campos marcados." });
      return;
    }

    const response = initialContact
      ? await updateContact(initialContact.id, form)
      : await createContact(form);

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    emitGlobalToast({
      tone: "success",
      text: initialContact ? "Contacto actualizado." : "Contacto creado.",
    });
    onOpenChange(false);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialContact ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          <DialogDescription>
            Guardá la ficha base del contacto para poder crear oportunidades asociadas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-first-name">Nombre</Label>
            <Input
              id="contact-first-name"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
            />
            {errors.firstName ? <p className="text-xs text-red-600">{errors.firstName}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-last-name">Apellido</Label>
            <Input
              id="contact-last-name"
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
            />
            {errors.lastName ? <p className="text-xs text-red-600">{errors.lastName}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={form.email || ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
            {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Teléfono</Label>
            <Input
              id="contact-phone"
              value={form.phone || ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
            {errors.phone ? <p className="text-xs text-red-600">{errors.phone}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-company">Empresa del contacto</Label>
            <Input
              id="contact-company"
              value={form.companyName || ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, companyName: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-position">Cargo</Label>
            <Input
              id="contact-position"
              value={form.position || ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, position: event.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isPending || hasErrors} onClick={handleSubmit}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar contacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadFormDialog({
  open,
  onOpenChange,
  pipelines,
  assignees,
  isOwner,
  presetContact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: ContactPageData["leadForm"]["pipelines"];
  assignees: ContactPageData["assignees"];
  isOwner: boolean;
  presetContact?: ContactSearchResult | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createInlineContact, setCreateInlineContact] = useState(!presetContact);
  const [query, setQuery] = useState(presetContact?.fullName || "");
  const [searchResults, setSearchResults] = useState<ContactSearchResult[]>(
    presetContact ? [presetContact] : []
  );
  const [selectedContact, setSelectedContact] = useState<ContactSearchResult | null>(presetContact || null);
  const [form, setForm] = useState({
    title: "",
    value: "",
    currency: "ARS",
    probability: 30,
    expectedCloseDate: "",
    pipelineId: pipelines[0]?.id || "",
    stageId: pipelines[0]?.stages[0]?.id || "",
    assignedTo: assignees[0]?.id || "",
  });
  const [inlineContact, setInlineContact] = useState<ContactFormInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    position: "",
  });

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === form.pipelineId) || pipelines[0],
    [form.pipelineId, pipelines]
  );

  useEffect(() => {
    if (!open || createInlineContact) {
      return;
    }

    const normalized = query.trim();
    if (!normalized) {
      return;
    }

    const handle = window.setTimeout(async () => {
      const response = await searchContactsAction(normalized);
      if (response.error) {
        emitGlobalToast({ tone: "error", text: response.error });
        return;
      }
      setSearchResults(response.data || []);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [createInlineContact, open, presetContact, query]);

  const inlineErrors = validateContactForm(inlineContact);
  const stageOptions = selectedPipeline?.stages || [];

  const handlePipelineChange = (pipelineId: string | null) => {
    const nextPipelineId = pipelineId || pipelines[0]?.id || "";
    const pipeline = pipelines.find((item) => item.id === nextPipelineId) || null;
    setForm((current) => ({
      ...current,
      pipelineId: nextPipelineId,
      stageId: pipeline?.stages[0]?.id || "",
    }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      emitGlobalToast({ tone: "error", text: "El lead necesita un título." });
      return;
    }

    let contactId = selectedContact?.id || null;

    if (createInlineContact) {
      const hasInlineErrors = Object.values(inlineErrors).some(Boolean);
      if (hasInlineErrors) {
        emitGlobalToast({ tone: "error", text: "Revisá los datos del contacto inline." });
        return;
      }

      const contactResponse = await createContact(inlineContact);
      if (contactResponse.error || !contactResponse.data) {
        emitGlobalToast({
          tone: "error",
          text: contactResponse.error || "No pudimos crear el contacto inline.",
        });
        return;
      }

      contactId = contactResponse.data.id;
    }

    if (!contactId) {
      emitGlobalToast({ tone: "error", text: "Seleccioná un contacto." });
      return;
    }

    const response = await createLead({
      title: form.title,
      contactId,
      value: form.value.trim() ? Number(form.value) : null,
      currency: form.currency,
      probability: form.probability,
      expectedCloseDate: form.expectedCloseDate || null,
      pipelineId: form.pipelineId,
      stageId: form.stageId,
      assignedTo: isOwner ? form.assignedTo || null : null,
      source: "manual",
    });

    if (response.error) {
      emitGlobalToast({ tone: "error", text: response.error });
      return;
    }

    emitGlobalToast({ tone: "success", text: "Lead creado." });
    onOpenChange(false);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-[#2A1A0A] bg-[#F5F0E8] text-[#1A1A1A] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>
            Creá una oportunidad nueva y vinculala a un contacto existente o nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-title">Título</Label>
              <Input
                id="lead-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Contacto</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCreateInlineContact((current) => {
                      const nextValue = !current;
                      if (nextValue) {
                        setSelectedContact(null);
                      } else {
                        setSearchResults(presetContact ? [presetContact] : []);
                      }
                      return nextValue;
                    })
                  }
                >
                  {createInlineContact ? "Elegir existente" : "Crear inline"}
                </Button>
              </div>

              {createInlineContact ? (
                <div className="grid gap-3 rounded-2xl border border-[#2A1A0A]/10 bg-[#F5F0E8]/70 p-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Input
                      placeholder="Nombre"
                      value={inlineContact.firstName}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.firstName ? (
                      <p className="text-xs text-red-600">{inlineErrors.firstName}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Apellido"
                      value={inlineContact.lastName}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.lastName ? (
                      <p className="text-xs text-red-600">{inlineErrors.lastName}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={inlineContact.email || ""}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.email ? (
                      <p className="text-xs text-red-600">{inlineErrors.email}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Teléfono"
                      value={inlineContact.phone || ""}
                      onChange={(event) =>
                        setInlineContact((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                    {inlineErrors.phone ? (
                      <p className="text-xs text-red-600">{inlineErrors.phone}</p>
                    ) : null}
                  </div>
                  <Input
                    placeholder="Empresa del contacto"
                    value={inlineContact.companyName || ""}
                    onChange={(event) =>
                      setInlineContact((current) => ({
                        ...current,
                        companyName: event.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Cargo"
                    value={inlineContact.position || ""}
                    onChange={(event) =>
                      setInlineContact((current) => ({
                        ...current,
                        position: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-[#2A1A0A]/10 bg-[#F5F0E8]/70 p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Buscá por nombre, email o empresa"
                      value={query}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setQuery(nextValue);
                        setSelectedContact(null);
                        if (!nextValue.trim()) {
                          setSearchResults(presetContact ? [presetContact] : []);
                        }
                      }}
                    />
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {searchResults.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setSelectedContact(contact);
                          setQuery(contact.fullName);
                        }}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                          selectedContact?.id === contact.id
                            ? "border-[#D4420A] bg-[#D4420A]/10"
                            : "border-[#2A1A0A]/10 bg-[#F5F0E8] hover:bg-[#F5F0E8]"
                        )}
                      >
                        <p className="font-medium">{contact.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.email || "Sin email"} · {contact.companyName || "Sin empresa"}
                        </p>
                      </button>
                    ))}
                    {query && searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No encontramos contactos con esa búsqueda.</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-value">Valor</Label>
              <Input
                id="lead-value"
                type="number"
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({ ...current, value: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select
                value={form.currency}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, currency: value || "ARS" }))
                }
              >
                <SelectTrigger className="w-full bg-[#F5F0E8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="lead-probability">Probabilidad</Label>
                <span className="text-sm font-medium">{form.probability}%</span>
              </div>
              <input
                id="lead-probability"
                type="range"
                min="0"
                max="100"
                value={form.probability}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    probability: Number(event.target.value),
                  }))
                }
                className="w-full accent-[#D4420A]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-close-date">Fecha de cierre</Label>
              <Input
                id="lead-close-date"
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedCloseDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Pipeline</Label>
              <Select value={form.pipelineId} onValueChange={handlePipelineChange}>
                <SelectTrigger className="w-full bg-[#F5F0E8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage inicial</Label>
              <Select
                value={form.stageId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, stageId: value || current.stageId }))
                }
              >
                <SelectTrigger className="w-full bg-[#F5F0E8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isOwner ? (
              <div className="space-y-2">
                <Label>Vendedor asignado</Label>
                <Select
                  value={form.assignedTo}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, assignedTo: value || current.assignedTo }))
                  }
                >
                  <SelectTrigger className="w-full bg-[#F5F0E8]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactTable({ data }: { data: ContactPageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryValue, setQueryValue] = useState(data.filters.query || "");
  const [contactFormState, setContactFormState] = useState<{
    open: boolean;
    contact?: ContactDetailRecord | null;
  }>({ open: false, contact: null });
  const [leadFormPreset, setLeadFormPreset] = useState<ContactSearchResult | null>(null);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pagination.pageSize));

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    if (key !== "contact") {
      params.delete("page");
    }

    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  useDebouncedSearchParam(queryValue, data.filters.query || "", updateParam);

  const openContact = (contactId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("contact", contactId);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const closeContact = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("contact");
    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <>
      <div className="mb-6">
        <Breadcrumbs items={[{ label: "Contactos", href: "/app/crm/contacts" }]} />
      </div>
      <div className="space-y-6">
        <div className="rounded-[30px] border border-[#2A1A0A]/15 bg-background p-6 text-foreground shadow-hard">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D4420A]/20 bg-[#D4420A]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Contactos CRM
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Base de contactos</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Buscá, filtrá y abrí el detalle de cada contacto sin salir del flujo comercial.
                </p>
              </div>
            </div>

            {data.currentUser.canCreateContact ? (
              <Button onClick={() => setContactFormState({ open: true, contact: null })}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo contacto
              </Button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_0.8fr_auto]">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={queryValue}
                  onChange={(event) => setQueryValue(event.target.value)}
                  placeholder="Nombre, email o empresa"
                  className="border-[#2A1A0A]/15 bg-[#F5F0E8] pl-9 text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Fuente</Label>
              <Select
                value={data.filters.source || "all"}
                onValueChange={(value) => updateParam("source", value)}
              >
                <SelectTrigger className="w-full border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {data.sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {getSourceLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] px-4 py-3 text-right">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Contactos</p>
                <p className="mt-1 text-2xl font-semibold">{data.total}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#2A1A0A]/15 bg-background p-4 text-foreground shadow-hard">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A1A0A]/10 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nombre</TableHead>
                <TableHead className="text-muted-foreground">Empresa</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Teléfono</TableHead>
                <TableHead className="text-muted-foreground">Leads activos</TableHead>
                <TableHead className="text-muted-foreground">Source</TableHead>
                <TableHead className="text-muted-foreground">Fecha de creación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contacts.length === 0 ? (
                <TableRow className="border-[#2A1A0A]/10">
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No encontramos contactos con esos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                data.contacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer border-[#2A1A0A]/10 text-foreground hover:bg-[#F5F0E8]"
                    onClick={() => openContact(contact.id)}
                  >
                    <TableCell className="font-medium">{contact.fullName}</TableCell>
                    <TableCell>{contact.companyName || "Sin empresa"}</TableCell>
                    <TableCell>{contact.email || "Sin email"}</TableCell>
                    <TableCell>{contact.phone || "Sin teléfono"}</TableCell>
                    <TableCell>{contact.activeLeadCount}</TableCell>
                    <TableCell>
                      <Badge className="border border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground">
                        {getSourceLabel(contact.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(contact.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Página {data.pagination.page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || data.pagination.page <= 1}
                className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground"
                onClick={() => updateParam("page", String(data.pagination.page - 1))}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || data.pagination.page >= totalPages}
                className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground"
                onClick={() => updateParam("page", String(data.pagination.page + 1))}
              >
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ContactDetailPanel
        contact={data.selectedContact}
        canEdit={data.currentUser.canCreateContact}
        canCreateLead={data.currentUser.canCreateLead}
        onClose={closeContact}
        onEdit={() => setContactFormState({ open: true, contact: data.selectedContact })}
        onCreateLead={(contact) => setLeadFormPreset(contact)}
      />

      <ContactFormDialog
        key={contactFormState.contact?.id || "new-contact"}
        open={contactFormState.open}
        onOpenChange={(open) => setContactFormState((current) => ({ ...current, open }))}
        initialContact={contactFormState.contact}
      />

      <LeadFormDialog
        key={leadFormPreset?.id || "new-lead"}
        open={Boolean(leadFormPreset)}
        onOpenChange={(open) => {
          if (!open) {
            setLeadFormPreset(null);
          }
        }}
        pipelines={data.leadForm.pipelines}
        assignees={data.assignees}
        isOwner={data.currentUser.role === "owner"}
        presetContact={leadFormPreset}
      />
    </>
  );
}

export function ContactTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[#2A1A0A]/15 bg-background p-6">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded-full bg-[#F5F0E8]/8" />
            <div className="h-10 w-72 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-[#F5F0E8]/8" />
          </div>
          <div className="flex items-end justify-end">
            <div className="h-10 w-40 animate-pulse rounded-full bg-[#F5F0E8]/8" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_0.8fr_auto]">
          <div className="h-12 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
          <div className="h-12 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
          <div className="h-12 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
        </div>
      </div>
      <div className="rounded-[28px] border border-[#2A1A0A]/15 bg-background p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-[#F5F0E8]/8" />
          ))}
        </div>
      </div>
    </div>
  );
}
