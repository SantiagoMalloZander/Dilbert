# Dilbot Analytics

## Que hace

Dilbot Analytics es el modulo de analisis comercial de Dilbert.

Lee los datos ya cargados en la CRM y arma una vista de inteligencia por cliente para:

- detectar patrones de consumo
- estimar consumo futuro a 30 y 90 dias
- priorizar clientes segun su senal de compra
- abrir un detalle individual por persona con historial comercial e interacciones previas

El sistema es de solo lectura sobre Supabase.
No modifica leads, interacciones, sellers ni companies.

## Que datos usa

El analisis trabaja sobre estas tablas:

- `companies`
- `sellers`
- `leads`
- `interactions`

Las señales que toma del CRM son:

- estado actual del lead
- monto estimado
- producto de interes
- sentimiento
- recencia de la ultima interaccion
- frecuencia de interacciones
- historial de cierres ganados o perdidos

## Como calcula el patron de consumo

El modulo agrupa los leads e interacciones por cliente.
Para cada cliente calcula:

- recencia: cuantos dias pasaron desde la ultima actividad
- cadencia: cada cuanto suele haber contacto
- frecuencia: cuantas interacciones y leads tiene registrados
- senal comercial: segun el estado del lead
- senal conversacional: segun el sentimiento
- senal historica: segun cierres ganados o perdidos
- senal monetaria: segun el monto promedio estimado frente al portfolio

Con esas variables arma:

- `predicted_30d_amount`
- `predicted_90d_amount`
- `predicted_next_purchase_days`
- `purchase_signal`
- `segment_label`

## Indicador de compra

En vez de mostrar solo un porcentaje crudo, la interfaz presenta una senal cualitativa:

- `Muy alta`
- `Alta`
- `Media`
- `Baja`
- `Muy baja`

Esto hace que la lectura sea mas clara para managers y vendedores.

## Arquitectura

### Backend analitico en Python

Archivos principales:

- `bot/analytics.py`
- `bot/analysis_dashboard.py`
- `bot/tests/test_analytics.py`

El motor Python:

- se conecta a Supabase en modo lectura
- arma el reporte analitico
- puede ejecutarse por consola
- puede mostrar una interfaz temporal en Flask

### Frontend productivo en Next.js

Archivos principales:

- `frontend/src/app/analytics/page.tsx`
- `frontend/src/app/analytics/[leadId]/page.tsx`
- `frontend/src/lib/analytics.ts`
- `frontend/src/lib/queries.ts`
- `frontend/src/lib/supabase-server.ts`
- `frontend/src/lib/supabase.ts`

La implementacion de Next.js es la pensada para despliegue en Vercel.

## Como funciona en Next.js

### Dashboard general

Ruta:

- `/analytics`

Muestra:

- clientes analizados
- prediccion total a 30 dias
- prediccion total a 90 dias
- segmentos del portfolio
- ranking de clientes priorizados
- producto dominante por cliente
- senal cualitativa de compra

### Detalle por cliente

Ruta:

- `/analytics/[leadId]`

Muestra:

- resumen del cliente
- indicador de compra cualitativo
- prediccion individual a 30 y 90 dias
- historial comercial
- compras previas cerradas
- interacciones previas
- drivers principales del analisis

## Supabase: anon key vs service key

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Es la clave publica.

Se usa del lado cliente, por ejemplo en paginas React que corren en el navegador.
Debe estar protegida por Row Level Security cuando haya auth real.
Para el demo sirve para lecturas publicas o controladas.

### `SUPABASE_SERVICE_KEY`

Es la clave privada con privilegios elevados.

Se usa solo del lado servidor:

- Next.js server components
- route handlers
- scripts
- bots en Python

Nunca debe exponerse al navegador.

## Que clave usa cada parte

- `frontend/src/lib/supabase.ts`: usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `frontend/src/lib/supabase-server.ts`: usa `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`
- `bot/analytics.py`: usa `SUPABASE_URL` y `SUPABASE_ANALYTICS_KEY` o `SUPABASE_SERVICE_KEY`

## Variables de entorno necesarias

### Frontend

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ANALYTICS_COMPANY_ID`

### Bot Python

- `SUPABASE_URL`
- `SUPABASE_ANALYTICS_KEY` o `SUPABASE_SERVICE_KEY`
- opcionalmente `ANALYTICS_COMPANY_ID`

## Compatibilidad con Vercel

La vista de analytics en Next.js fue armada para correr server-side.
Eso permite:

- ocultar la `service key`
- leer Supabase sin exponer credenciales privadas
- desplegar facilmente en Vercel

Las rutas analiticas fueron marcadas como dinamicas para evitar problemas de prerender con datos del CRM.

## Flujo resumido

1. El bot original procesa conversaciones de Telegram.
2. El CRM guarda leads e interacciones en Supabase.
3. El modulo analitico lee esos datos.
4. Agrupa por cliente.
5. Calcula senales de consumo y predicciones.
6. El dashboard muestra prioridades y detalle individual.

## Limites actuales

- No usa facturacion historica real fuera del CRM.
- La prediccion es operativa, no financiera.
- Funciona sobre los datos existentes de leads e interacciones.
- No escribe resultados en la base.

## Proximo paso recomendado

Integrar esta vista con el dashboard principal y, si el hackathon lo requiere, sumar filtros por vendedor, producto o segmento sin cambiar el principio de solo lectura.
