# Configurar Google Calendar para demos de Dilbert

## Qué hace
Las rutas `/api/availability` y `/api/book` usan la Google Calendar API para:
- Consultar la disponibilidad real del calendario antes de mostrar slots
- Crear el evento automáticamente con los datos del lead cuando confirma la demo
- Invitar al visitante al evento (recibe email con el calendar invite)

## Pasos

### 1. Crear un proyecto en Google Cloud Console
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear nuevo proyecto (ej: `dilbert-demos`)
3. Habilitar la **Google Calendar API**: Menú → APIs & Services → Library → buscar "Google Calendar API" → Enable

### 2. Crear Service Account
1. Menú → IAM & Admin → Service Accounts → Create Service Account
2. Nombre: `dilbert-demo-bot`
3. Rol: no es necesario asignar roles de GCP
4. Crear y continuar
5. En la lista de Service Accounts, hacer click en la que creaste
6. Pestaña **Keys** → Add Key → JSON → se descarga un archivo `proyecto-xxx.json`

### 3. Extraer las credenciales del JSON
Del archivo descargado, necesitás:
- `client_email` → va a `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → va a `GOOGLE_PRIVATE_KEY`

El `private_key` tiene saltos de línea reales (`\n`). En Netlify env vars, pegarlo **con comillas dobles**:
```
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

### 4. Compartir el calendario con la Service Account
1. Abrir Google Calendar en el navegador
2. Ir al calendario donde querés que se creen los eventos de demo (puede ser tu calendar principal o uno dedicado)
3. Configuración del calendario (ícono de engranaje) → "Share with specific people"
4. Agregar el email de la Service Account (`dilbert-demo-bot@proyecto.iam.gserviceaccount.com`)
5. Permiso: **"Make changes to events"**

### 5. Obtener el Calendar ID
En la configuración del calendario → "Integrate calendar" → Calendar ID.  
Para el calendario principal es simplemente tu email (ej: `martín@gmail.com`).

### 6. Configurar variables de entorno

**En desarrollo** (`.env.local`):
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=dilbert-demo-bot@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=tu-email@gmail.com
```

**En Netlify**: Site Settings → Environment Variables → agregar las tres variables.

### 7. Configurar Resend (emails)
1. Crear cuenta en [resend.com](https://resend.com)
2. Agregar y verificar tu dominio
3. Crear API Key → copiar a `RESEND_API_KEY`
4. `RESEND_FROM_EMAIL` debe usar el dominio verificado (ej: `Dilbert <demos@dilbert.ai>`)
5. `TEAM_NOTIFICATION_EMAIL` = email del equipo que recibe cada notificación de demo nueva

---

## Degradación graceful
Si las variables de Google Calendar **no están configuradas**, el sistema:
- `/api/availability` → devuelve todos los slots de 9:00 a 18:00 sin filtrar ocupados
- `/api/book` → confirma la demo sin crear el evento en Calendar

Si `RESEND_API_KEY` no está configurada, no se envían emails pero la demo igual queda registrada.

---

## Flujo completo
1. Visitante hace click en "Agendar tu demo"
2. Llena formulario (nombre, empresa, email, teléfono, equipo)
3. Elige fecha en el calendario (solo L-V)
4. Elige horario (slots de 30 min, 9:00-18:00 Buenos Aires)
5. Confirma → `POST /api/book`
6. Se crea evento en Google Calendar con datos del lead en la descripción
7. Visitante recibe email de confirmación con fecha/hora y link al evento
8. Equipo recibe email de notificación con todos los datos del lead
