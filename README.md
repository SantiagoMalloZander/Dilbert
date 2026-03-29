# DILBERT — Guía de Usuario

> Agente IA que convierte conversaciones de ventas en datos CRM. Funciona en Telegram y sincroniza automáticamente con HubSpot.

---

## Acceso al Dashboard

**URL:** https://dilverty.netlify.app

### Cuenta Jurado (hackITBA 2026)
| Campo | Valor |
|-------|-------|
| Usuario | `Jurado@hackitba.edu` |
| Contraseña | `compi` |

### Cuenta Demo (acceso completo)
| Campo | Valor |
|-------|-------|
| Usuario | `demo` |
| Contraseña | `crew` |

---

## Cómo conectarse a Telegram y cargar leads

### Paso 1 — Conectar tu cuenta de Telegram al bot

1. Entrá al dashboard con la cuenta Jurado
2. En el menú lateral, hacé click en **"Canales del bot"**
3. En el card de Telegram, hacé click en **"Abrir QR"**
4. Escaneá el QR con la cámara de tu celular
5. Se abre Telegram — tocá **START**
6. El bot responde confirmando que quedaste registrado

> También podés entrar directamente: https://t.me/Dilbott_bot y mandar `/start`

---

### Paso 2 — Mandar una conversación de ventas al bot

Una vez registrado, mandá al bot el texto de una conversación comercial. Por ejemplo:

```
Hablé con Juan García de Acme S.A., le interesa el software de facturación.
Monto estimado: $5000. Próximo paso: enviar propuesta la semana que viene.
```

Tambien se puede crear un grupo de texto que incluye a Dilbert, un comprador y un vendedor. En el mismo se realiza una transaccion y una vez terminada la misma el bot envia por privado el resumen.

El bot extrae automáticamente:
- Nombre del cliente y empresa
- Producto de interés
- Monto estimado
- Sentimiento y próximos pasos
- Estado del deal

---

### Paso 3 — Ver el lead en el dashboard

1. Entrá a https://dilverty.netlify.app
2. Iniciá sesión con la cuenta Jurado
3. El lead aparece en el **Pipeline** en tiempo real
4. Hacé click en cualquier lead para ver el detalle con todas las interacciones

---

### Paso 4 — Ver el lead en HubSpot

Los leads se sincronizan automáticamente a HubSpot después de ser procesados por el bot.

**Acceso a HubSpot:**
| Campo | Valor |
|-------|-------|
| Usuario | `mzanderconsulting@gmail.com` |
| Contraseña | `Compicompi*(` |
| URL | https://app.hubspot.com |

Cada lead de Dilbert crea en HubSpot:
- Un **Contacto** con el nombre y empresa del cliente
- Un **Deal** con el monto, estado y producto
- Los dos quedan vinculados automáticamente

---

## Grupo de demo en Telegram

También podés probar el bot en un grupo de ventas real:

**Link al grupo demo:** https://t.me/+QVoAdLIwdLpkNDgx



---

## Qué hay en el dashboard

| Sección | Qué hace |
|---------|----------|
| **Pipeline** | Lista todos los leads con estado, monto y fecha |
| **Métricas** | Revenue total, conversión, deals ganados/perdidos |
| **Inteligencia IA** | Análisis predictivo: churn, probabilidad de recompra, forecast |
| **HubSpot** | Estado de la integración y sync manual |
| **Canales del bot** | QR para conectar vendedores nuevos a Telegram |

---

## Flujo completo de datos

```
Vendedor habla con cliente por Telegram
        ↓
Manda el resumen al bot (@Dilbott_bot)
        ↓
GPT-4o extrae: cliente, empresa, monto, producto, sentimiento
        ↓
Lead guardado en Supabase → aparece en el dashboard en tiempo real
        ↓
Lead sincronizado automáticamente → HubSpot (contacto + deal vinculados)
```

---

## Preguntas frecuentes

**¿Qué pasa si mando un mensaje sin haberme registrado?**
El bot te pide que uses `/start` primero para registrarte automáticamente.

**¿Puedo agregar leads manualmente?**
Sí. En el Pipeline, hacé click en **"Agregar lead"** (botón naranja arriba a la derecha).

**¿Qué hace el botón de sync en HubSpot?**
Fuerza una sincronización de todos los leads. Los del bot se sincronizan solos sin necesidad de usarlo.

**¿Los datos son reales?**
Sí. GPT-4o en producción, Supabase en la nube y HubSpot conectado con datos reales.

---

*Dilbert — hackITBA 2026*
