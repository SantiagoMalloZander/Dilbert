"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { createContact, searchContactsAction } from "@/modules/crm/contacts/actions";
import type { ContactFormInput, ContactSearchResult } from "@/modules/crm/contacts/types";
import { createLead } from "@/modules/crm/leads/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emitGlobalToast } from "@/lib/global-toast";
import { cn } from "@/lib/utils";

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
  assignees: Array<{ id: string; name: string }>;
  isOwner: boolean;
  presetContact?: ContactSearchResult | null;
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

export function LeadFormDialog({
  open,
  onOpenChange,
  pipelines,
  assignees,
  isOwner,
  presetContact,
}: LeadFormDialogProps) {
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
      <DialogContent className="border-[3px] border-[#2A1A0A] bg-background text-foreground sm:max-w-2xl">
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
                <div className="grid gap-3 rounded-2xl border border-[#2A1A0A]/10 bg-card p-4 sm:grid-cols-2">
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
                <div className="space-y-3 rounded-2xl border border-[#2A1A0A]/10 bg-card p-4">
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
                            ? "border-primary bg-primary/10"
                            : "border-[#2A1A0A]/10 bg-white hover:bg-background"
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
                <SelectTrigger className="w-full bg-white">
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
                className="w-full accent-primary"
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
                <SelectTrigger className="w-full bg-white">
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
                <SelectTrigger className="w-full bg-white">
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
                  <SelectTrigger className="w-full bg-white">
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
