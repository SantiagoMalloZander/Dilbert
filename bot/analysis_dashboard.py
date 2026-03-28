import os

from flask import Flask, jsonify, render_template_string, request

from analytics import DEFAULT_COMPANY_ID, build_company_report


app = Flask(__name__)


TEMPLATE = """
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dilbot Analytics</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  </head>
  <body class="min-h-screen bg-slate-950 text-slate-50">
    <main class="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <header class="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40">
        <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-cyan-300">Dilbot analytics</p>
            <h1 class="text-3xl font-semibold">Prediccion de consumo por cliente</h1>
            <p class="mt-2 max-w-3xl text-sm text-slate-300">
              Lectura pura sobre la CRM. No escribe ni modifica datos en Supabase.
            </p>
          </div>
          <form class="flex flex-col gap-2 md:w-[30rem]">
            <label class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400" for="company_id">
              Company ID
            </label>
            <div class="flex gap-2">
              <input
                id="company_id"
                name="company_id"
                value="{{ company_id }}"
                class="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm outline-none ring-0"
              />
              <button class="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">
                Analizar
              </button>
            </div>
          </form>
        </div>
      </header>

      {% if error %}
      <section class="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-100">
        <p class="font-semibold">No se pudo generar el analisis.</p>
        <p class="mt-2 break-words">{{ error }}</p>
        <p class="mt-3 text-red-200/80">
          Verifica SUPABASE_URL y una credencial de lectura en SUPABASE_ANALYTICS_KEY o SUPABASE_SERVICE_KEY.
        </p>
      </section>
      {% endif %}

      {% if report %}
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Clientes</p>
          <p class="mt-3 text-3xl font-semibold">{{ report.summary.total_clients }}</p>
          <p class="mt-2 text-sm text-slate-300">{{ report.summary.total_interactions }} interacciones leidas</p>
        </article>
        <article class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Prediccion 30 dias</p>
          <p class="mt-3 text-3xl font-semibold">{{ report.summary.predicted_30d_revenue }}</p>
          <p class="mt-2 text-sm text-slate-300">Ingresos estimados del portfolio activo</p>
        </article>
        <article class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Prediccion 90 dias</p>
          <p class="mt-3 text-3xl font-semibold">{{ report.summary.predicted_90d_revenue }}</p>
          <p class="mt-2 text-sm text-slate-300">Con expansion basada en cadencia historica</p>
        </article>
        <article class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Probabilidad media</p>
          <p class="mt-3 text-3xl font-semibold">{{ report.summary.average_purchase_probability_30d }}</p>
          <p class="mt-2 text-sm text-slate-300">Promedio de compra esperada a 30 dias</p>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <article class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Ranking de clientes</p>
              <h2 class="mt-2 text-xl font-semibold">{{ report.summary.company_name }}</h2>
            </div>
            <a
              href="/api/analysis?company_id={{ company_id }}"
              class="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200"
            >
              Ver JSON
            </a>
          </div>

          <div class="mt-5 overflow-x-auto">
            <table class="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead class="text-slate-400">
                <tr>
                  <th class="py-3 pr-4">Cliente</th>
                  <th class="py-3 pr-4">Segmento</th>
                  <th class="py-3 pr-4">Prob. 30d</th>
                  <th class="py-3 pr-4">Pred. 30d</th>
                  <th class="py-3 pr-4">Proxima compra</th>
                  <th class="py-3 pr-4">Producto</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-slate-200">
                {% for client in report.clients %}
                <tr class="align-top">
                  <td class="py-4 pr-4">
                    <p class="font-medium">{{ client.client_name }}</p>
                    <p class="text-xs text-slate-400">{{ client.client_company }}</p>
                  </td>
                  <td class="py-4 pr-4">{{ client.segment_label }}</td>
                  <td class="py-4 pr-4">{{ client.purchase_probability_30d }}</td>
                  <td class="py-4 pr-4">
                    {{ client.predicted_30d_amount }} {{ client.dominant_currency }}
                  </td>
                  <td class="py-4 pr-4">{{ client.predicted_next_purchase_days }} dias</td>
                  <td class="py-4 pr-4">{{ client.dominant_product }}</td>
                </tr>
                <tr>
                  <td colspan="6" class="pb-4 pr-4 text-xs text-slate-400">
                    {{ client.top_drivers | join(" | ") }}
                  </td>
                </tr>
                {% endfor %}
              </tbody>
            </table>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Lecturas principales</p>

          <div class="mt-4 space-y-4">
            <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p class="text-sm font-semibold">Segmentos</p>
              <ul class="mt-3 space-y-2 text-sm text-slate-300">
                {% for segment, count in report.summary.segment_breakdown.items() %}
                <li class="flex items-center justify-between">
                  <span>{{ segment }}</span>
                  <span class="font-medium text-slate-50">{{ count }}</span>
                </li>
                {% endfor %}
              </ul>
            </div>

            <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p class="text-sm font-semibold">Productos dominantes</p>
              <ul class="mt-3 space-y-2 text-sm text-slate-300">
                {% for item in report.summary.top_products %}
                <li class="flex items-center justify-between">
                  <span>{{ item.product }}</span>
                  <span class="font-medium text-slate-50">{{ item.clients }} clientes</span>
                </li>
                {% endfor %}
                {% if not report.summary.top_products %}
                <li>No hay productos suficientes para inferir patron.</li>
                {% endif %}
              </ul>
            </div>

            <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p class="font-semibold text-slate-50">Como se predice</p>
              <p class="mt-3">
                El score combina estado del lead, sentimiento, recencia, frecuencia de interaccion y monto estimado.
              </p>
              <p class="mt-2">
                No usa escritura en base y no reemplaza una serie historica de facturacion; es una prediccion operativa sobre la CRM actual.
              </p>
            </div>
          </div>
        </article>
      </section>
      {% endif %}
    </main>
  </body>
</html>
"""


def _resolve_company_id() -> str:
    requested = request.args.get("company_id", "").strip()
    return requested or os.getenv("ANALYTICS_COMPANY_ID", DEFAULT_COMPANY_ID)


@app.get("/api/analysis")
def api_analysis():
    company_id = _resolve_company_id()
    report = build_company_report(company_id)
    return jsonify(report)


@app.get("/")
def dashboard():
    company_id = _resolve_company_id()
    try:
        report = build_company_report(company_id)
        return render_template_string(
            TEMPLATE,
            report=report,
            company_id=company_id,
            error=None,
        )
    except Exception as exc:
        return render_template_string(
            TEMPLATE,
            report=None,
            company_id=company_id,
            error=str(exc),
        )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
