import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatClp } from '../domain/calculations';
import { ColorProMapping, PaintPreparation } from '../domain/models';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

interface FormulaDraft {
  colorProCode: string;
  recommendedGrams: number;
  actualGrams: number;
  reusableGrams: number;
  wasteGrams: number;
}

const FORMULAS: Record<PaintPreparation, Array<[string, number]>> = {
  Concentrada: [
    ['2246', 495.9],
    ['3200', 67],
    ['2236', 409.2],
  ],
  Diluida: [
    ['2246', 318.2],
    ['3200', 43],
    ['2236', 262.6],
    ['THINNER W', 311.8],
  ],
};

@Component({
  selector: 'app-paint-demo-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    <section class="paint-hero">
      <div>
        <div class="eyebrow text-[#9cdb80]">Escenario demostrativo de pinturas</div>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-white">
          ColorPro → mezcla → trazabilidad
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Validación del flujo con Antonella. La captura de fórmula es simulada y no existe
          integración directa con ColorPro ni Softland.
        </p>
      </div>
      <div class="mt-5 grid gap-2 sm:grid-cols-3 lg:mt-0">
        <div class="hero-metric"><strong>1 L</strong><span>volumen objetivo</span></div>
        <div class="hero-metric">
          <strong>{{ store.state().paintMixes.length }}</strong
          ><span>mezclas confirmadas</span>
        </div>
        <div class="hero-metric">
          <strong>{{ pendingMappings() }}</strong
          ><span>mapeos pendientes</span>
        </div>
      </div>
    </section>

    <section
      class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <div class="flex gap-3">
        <span appLucide="TriangleAlert" class="mt-0.5 shrink-0"></span>
        <div>
          <strong>Control de fuente.</strong> El “Valor de venta” visible en ColorPro no se usa como
          costo FRAESPA. El costo de esta pantalla se calcula con productos y costos del inventario.
          El archivo se llama “al 06-11-2026”, pero su encabezado interno informa 30/11/2026; el
          corte debe validarse antes de una conciliación real.
        </div>
      </div>
    </section>

    <section class="mt-6 grid gap-6 2xl:grid-cols-[360px_1fr]">
      <aside class="mobile-demo-shell">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs font-black uppercase tracking-widest text-slate-400">
              Vista móvil
            </div>
            <div class="mt-1 text-lg font-black text-white">Jhony · Mis tareas</div>
          </div>
          <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white"
            >Demo local</span
          >
        </div>
        @if (!workerSignedIn()) {
          <form class="mt-6 rounded-2xl bg-white p-5" (ngSubmit)="signInWorker()">
            <label
              ><span class="field-label">Trabajador</span
              ><input class="field" value="Jhony" disabled
            /></label>
            <label class="mt-4 block"
              ><span class="field-label">PIN demostrativo</span
              ><input class="field" inputmode="numeric" maxlength="4" [(ngModel)]="pin" name="pin"
            /></label>
            <button class="btn-primary mt-4 w-full">Ingresar a la demo</button>
            <p class="mt-3 text-[11px] leading-4 text-slate-500">
              El PIN solo demuestra el recorrido. No representa autenticación productiva.
            </p>
          </form>
        } @else {
          <div class="mt-6 rounded-3xl bg-white p-5 shadow-xl">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs font-extrabold text-[var(--fraespa-green-dark)]">
                  OT-125 · Pintura
                </div>
                <h2 class="mt-1 text-lg font-black">ABCD45 · Paradiso G7</h2>
              </div>
              <span class="badge-warning">En ejecución</span>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-xl bg-slate-50 p-3">
                <span class="text-slate-500">Referencia OF</span
                ><strong class="mt-1 block">OF-408A5-DEMO</strong>
              </div>
              <div class="rounded-xl bg-slate-50 p-3">
                <span class="text-slate-500">Ubicación</span
                ><strong class="mt-1 block">Cabina pintura 1</strong>
              </div>
            </div>
            <div
              class="mt-4 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-600"
            >
              <strong class="block text-slate-900">Receta del proceso</strong>Solo muestra los
              componentes asignados a pintura. Jhony no necesita conocer códigos Softland.
            </div>
            <div class="mt-4 grid gap-2">
              <button class="btn-primary w-full" type="button">
                <span appLucide="Play"></span>Iniciar trabajo
              </button>
              <button
                class="btn-secondary w-full"
                type="button"
                (click)="requestPaintMaterials()"
                [disabled]="!!workerRequestId()"
              >
                <span appLucide="PackagePlus"></span
                >{{ workerRequestId() ? 'Solicitud enviada' : 'Solicitar materiales' }}
              </button>
              <button class="btn-secondary w-full" type="button">
                <span appLucide="Pause"></span>Pausar
              </button>
            </div>
          </div>
        }
      </aside>

      <div class="space-y-6">
        <section class="grid gap-4 md:grid-cols-3">
          <article class="stat-card">
            <div class="stat-icon brand-soft"><span appLucide="Inbox"></span></div>
            <div class="stat-value">{{ store.pendingRequests().length }}</div>
            <div class="stat-label">Solicitudes en bandeja de Antonella</div>
          </article>
          <article class="stat-card">
            <div class="stat-icon bg-sky-50 text-sky-700">
              <span appLucide="ReceiptText"></span>
            </div>
            <div class="stat-value">V-00102</div>
            <div class="stat-label">Vale ya entregado a estación</div>
          </article>
          <article class="stat-card">
            <div class="stat-icon bg-amber-50 text-amber-700"><span appLucide="Scale"></span></div>
            <div class="stat-value">{{ formulaTotal() | number: '1.1-1' }} g</div>
            <div class="stat-label">Fórmula activa para 1 litro</div>
          </article>
        </section>

        <section class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Preparación de pintura</h2>
              <p class="mt-1 text-xs text-slate-500">
                Antonella revisa la extracción simulada, corrige pesos y confirma un solo preparado.
              </p>
            </div>
            <div class="flex gap-2">
              <a routerLink="/bodega" class="btn-secondary">Ver bandeja</a
              ><button class="btn-secondary" type="button" (click)="resetScenario()">
                <span appLucide="RotateCcw"></span>Reiniciar
              </button>
            </div>
          </div>
          <div class="grid gap-6 p-5 xl:grid-cols-[.82fr_1.18fr]">
            <div class="space-y-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <label
                  ><span class="field-label">Referencia OF (Softland)</span
                  ><input class="field" [(ngModel)]="ofReference"
                /></label>
                <label
                  ><span class="field-label">Orden de trabajo</span
                  ><select class="field" [(ngModel)]="workOrderId">
                    @for (order of paintOrders(); track order.id) {
                      <option [value]="order.id">{{ order.number }} · {{ order.vehicle }}</option>
                    }
                  </select></label
                >
                <label
                  ><span class="field-label">Proceso</span
                  ><select class="field" [(ngModel)]="stage">
                    <option>Pintura</option>
                    <option>Preparación de base</option>
                    <option>Barniz</option>
                  </select></label
                >
                <label
                  ><span class="field-label">Código de color</span
                  ><input class="field" [(ngModel)]="colorCode"
                /></label>
              </div>
              <div>
                <span class="field-label">Preparación elegida</span>
                <div class="grid grid-cols-2 gap-2">
                  @for (option of preparations; track option) {
                    <button
                      type="button"
                      class="operation-tab"
                      [class.operation-tab-active]="preparation() === option"
                      (click)="selectPreparation(option)"
                    >
                      {{ option
                      }}<small>{{
                        option === 'Concentrada' ? 'Sin diluir' : 'Con Thinner W'
                      }}</small>
                    </button>
                  }
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Son alternativas del mismo color. Solo la variante seleccionada participa en esta
                  mezcla.
                </p>
              </div>
              <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                <img
                  class="h-56 w-full object-cover opacity-90"
                  [src]="imagePreview() || formulaImage()"
                  alt="Fotografía de la fórmula Red 408A5 en ColorPro"
                />
                <div
                  class="flex flex-wrap items-center justify-between gap-3 p-3 text-xs text-white"
                >
                  <span>{{ imageName() || 'Ejemplo real preconfigurado' }}</span>
                  <label
                    class="cursor-pointer rounded-lg bg-white/10 px-3 py-2 font-extrabold hover:bg-white/20"
                    >Adjuntar captura<input
                      type="file"
                      class="hidden"
                      accept="image/*"
                      (change)="loadImage($event)"
                  /></label>
                </div>
              </div>
              <button type="button" class="btn-primary w-full" (click)="simulateExtraction()">
                <span appLucide="ScanText"></span>Simular lectura de la captura
              </button>
              <p class="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <strong>Alcance:</strong> la demo carga los datos preconfigurados de las
                fotografías. No realiza OCR real ni consulta ColorPro.
              </p>
            </div>

            <div>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="font-black">Componentes detectados</h3>
                  <p class="text-xs text-slate-500">
                    Recomendado por ColorPro vs. peso real confirmado.
                  </p>
                </div>
                <span class="badge-info">{{
                  extracted() ? 'Extracción simulada lista' : 'Pendiente de simular'
                }}</span>
              </div>
              <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full min-w-[720px] text-left text-sm">
                  <thead class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th class="p-3">ColorPro</th>
                      <th class="p-3">Softland</th>
                      <th class="p-3">Recomendado</th>
                      <th class="p-3">Peso real</th>
                      <th class="p-3">Sobrante</th>
                      <th class="p-3">Pérdida</th>
                      <th class="p-3 text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (component of formula(); track component.colorProCode) {
                      @let mapping = mappingFor(component.colorProCode);
                      @let item = product(mapping?.productId || '');
                      <tr class="border-t border-slate-100">
                        <td class="p-3 font-black">{{ component.colorProCode }}</td>
                        <td class="p-3">
                          <div class="font-bold">{{ item?.code || 'Sin mapear' }}</div>
                          <div class="max-w-52 text-[11px] text-slate-500">
                            {{ item?.description }}
                          </div>
                        </td>
                        <td class="p-3">{{ component.recommendedGrams | number: '1.1-1' }} g</td>
                        <td class="p-2">
                          <input
                            class="field w-28"
                            type="number"
                            min="0.1"
                            step="0.1"
                            [(ngModel)]="component.actualGrams"
                          />
                        </td>
                        <td class="p-2">
                          <input
                            class="field w-24"
                            type="number"
                            min="0"
                            step="0.1"
                            [(ngModel)]="component.reusableGrams"
                          />
                        </td>
                        <td class="p-2">
                          <input
                            class="field w-24"
                            type="number"
                            min="0"
                            step="0.1"
                            [(ngModel)]="component.wasteGrams"
                          />
                        </td>
                        <td class="p-3 text-right font-extrabold">
                          {{ clp(componentCost(component)) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot class="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td colspan="3" class="p-3 font-black">Costo desde inventario</td>
                      <td class="p-3 font-black">{{ actualTotal() | number: '1.1-1' }} g</td>
                      <td colspan="3" class="p-3 text-right text-lg font-black">
                        {{ clp(totalCost()) }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <label
                  ><span class="field-label">Preparador</span
                  ><input class="field" [(ngModel)]="preparer"
                /></label>
                <label
                  ><span class="field-label">Lote de mezcla</span
                  ><input class="field" [(ngModel)]="batch"
                /></label>
              </div>
              <label class="mt-4 block"
                ><span class="field-label">Observaciones</span
                ><textarea class="field" rows="2" [(ngModel)]="observations"></textarea>
              </label>
              <div
                class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"
              >
                <strong>Antiduplicación:</strong> el vale V-00102 ya descontó stock al entregar
                material. Al confirmar, la mezcla consume ese saldo de estación y solo crea un nuevo
                despacho si falta una fracción.
              </div>
              <button
                class="btn-primary mt-4 w-full"
                type="button"
                (click)="confirmMix()"
                [disabled]="!extracted()"
              >
                <span appLucide="BadgeCheck"></span>Confirmar consumo y costo
              </button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Relación ColorPro ↔ Softland</h2>
              <p class="mt-1 text-xs text-slate-500">
                Los códigos no se asumen iguales. Cada equivalencia y conversión puede revisarse.
              </p>
            </div>
            <span class="badge-warning">Configuración de demo</span>
          </div>
          <div class="table-shell">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ColorPro</th>
                  <th>Producto Softland</th>
                  <th>g por unidad inventario</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (draft of mappingDrafts; track draft.colorProCode) {
                  <tr>
                    <td class="font-black">{{ draft.colorProCode }}</td>
                    <td>
                      <select class="field min-w-64" [(ngModel)]="draft.productId">
                        @for (item of paintProducts(); track item.id) {
                          <option [value]="item.id">
                            {{ item.code }} · {{ item.description }}
                          </option>
                        }
                      </select>
                    </td>
                    <td>
                      <input
                        class="field w-36"
                        type="number"
                        min="1"
                        [(ngModel)]="draft.gramsPerInventoryUnit"
                      />
                    </td>
                    <td>
                      <select class="field min-w-48" [(ngModel)]="draft.status">
                        <option>Validada para demo</option>
                        <option>Pendiente de validación</option>
                      </select>
                    </td>
                    <td>
                      <button class="btn-secondary" type="button" (click)="saveMapping(draft)">
                        Guardar
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (store.state().paintMixes.length) {
          <section class="panel p-5">
            <h2 class="panel-title">Mezclas confirmadas</h2>
            <div class="mt-4 grid gap-3 lg:grid-cols-2">
              @for (mix of store.state().paintMixes; track mix.id) {
                <article class="rounded-xl border border-slate-200 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <strong>{{ mix.batch }} · {{ mix.colorCode }}</strong>
                      <div class="mt-1 text-xs text-slate-500">
                        {{ mix.preparation }} · {{ mix.components.length }} componentes ·
                        {{ mix.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                      </div>
                    </div>
                    <span [class]="mix.pendingReconciliation ? 'badge-warning' : 'badge-success'">{{
                      mix.pendingReconciliation ? 'Pendiente de validar' : 'Conciliable'
                    }}</span>
                  </div>
                  <div class="mt-3 text-lg font-black">{{ clp(mix.inventoryCost) }}</div>
                  <div class="mt-1 text-xs text-slate-500">
                    Costo calculado desde inventario. Valor de venta ColorPro excluido.
                  </div>
                </article>
              }
            </div>
          </section>
        }
      </div>
    </section>

    @if (toast()) {
      <div
        class="fixed bottom-24 right-5 z-[90] max-w-sm rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl lg:bottom-6"
      >
        {{ toast() }}
      </div>
    }
  `,
  styles: [
    `
      .paint-hero {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 1.5rem;
        overflow: hidden;
        border-radius: 1.5rem;
        padding: 1.5rem;
        background:
          radial-gradient(circle at 85% 10%, rgba(91, 187, 48, 0.24), transparent 32%), #121516;
      }
      .hero-metric {
        min-width: 120px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.06);
        padding: 0.9rem;
        color: white;
      }
      .hero-metric strong,
      .hero-metric span {
        display: block;
      }
      .hero-metric strong {
        font-size: 1.25rem;
      }
      .hero-metric span {
        margin-top: 0.2rem;
        font-size: 0.68rem;
        color: #b7c0c6;
      }
      .mobile-demo-shell {
        border-radius: 2rem;
        padding: 1.25rem;
        background: #0b0d0e;
        box-shadow: 0 24px 60px rgba(11, 13, 14, 0.18);
        align-self: start;
      }
      @media (min-width: 1024px) {
        .paint-hero {
          flex-direction: row;
          align-items: center;
          padding: 2rem;
        }
        .paint-hero > div:last-child {
          display: grid;
        }
      }
    `,
  ],
})
export class PaintDemoPage {
  readonly store = inject(DemoStore);
  readonly preparations: PaintPreparation[] = ['Concentrada', 'Diluida'];
  readonly preparation = signal<PaintPreparation>('Concentrada');
  readonly formula = signal<FormulaDraft[]>(this.createFormula('Concentrada'));
  readonly extracted = signal(false);
  readonly workerSignedIn = signal(false);
  readonly workerRequestId = signal('');
  readonly imagePreview = signal('');
  readonly imageName = signal('');
  readonly toast = signal('');
  readonly paintOrders = computed(() =>
    this.store
      .state()
      .workOrders.filter((order) =>
        order.stages.some((stage) => stage.name.toLowerCase().includes('pintura')),
      ),
  );
  readonly paintProducts = computed(() =>
    this.store
      .state()
      .products.filter((item) => ['Pinturas', 'Diluyentes'].includes(item.category)),
  );
  readonly pendingMappings = computed(
    () =>
      this.store
        .state()
        .colorProMappings.filter((item) => item.status === 'Pendiente de validación').length,
  );
  mappingDrafts: ColorProMapping[] = structuredClone(this.store.state().colorProMappings);
  pin = '4085';
  ofReference = 'OF-408A5-DEMO';
  workOrderId = 'ot-125';
  stage = 'Pintura';
  colorCode = 'Red - 408A5';
  preparer = 'Antonella';
  batch = 'MIX-408A5-001';
  observations = 'Fórmula de 1 litro revisada contra captura ColorPro.';
  clp = formatClp;

  private createFormula(type: PaintPreparation): FormulaDraft[] {
    return FORMULAS[type].map(([colorProCode, grams]) => ({
      colorProCode,
      recommendedGrams: grams,
      actualGrams: grams,
      reusableGrams: 0,
      wasteGrams: 0,
    }));
  }
  signInWorker() {
    if (this.pin !== '4085') return this.show('PIN demostrativo incorrecto. Usa 4085.');
    this.workerSignedIn.set(true);
  }
  requestPaintMaterials() {
    try {
      const requestId = this.store.createRequest({
        workOrderId: 'ot-125',
        requester: 'Jhony',
        receiver: 'Antonella',
        stage: 'Pintura',
        note: 'Materiales para mezcla Red - 408A5.',
        excessJustification: 'Componentes agregados al escenario demostrativo de ColorPro.',
        lines: [
          { productId: 'PQM0126', quantity: 0.5 },
          { productId: 'PQM0167', quantity: 0.07 },
          { productId: 'PQM0125', quantity: 0.41 },
        ],
      });
      this.workerRequestId.set(requestId);
      this.show('Solicitud enviada. Ya aparece en la bandeja de Antonella de esta sesión.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  selectPreparation(type: PaintPreparation) {
    this.preparation.set(type);
    this.formula.set(this.createFormula(type));
    this.extracted.set(false);
    this.imagePreview.set('');
    this.imageName.set('');
    this.batch = type === 'Concentrada' ? 'MIX-408A5-001' : 'MIX-408A5-002';
  }
  formulaImage() {
    return this.preparation() === 'Concentrada'
      ? '/assets/colorpro/red-408a5-concentrada.png'
      : '/assets/colorpro/red-408a5-diluida.png';
  }
  loadImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(String(reader.result));
    reader.readAsDataURL(file);
  }
  simulateExtraction() {
    this.formula.set(this.createFormula(this.preparation()));
    this.extracted.set(true);
    this.show('Extracción simulada cargada. Revisa y ajusta los pesos antes de confirmar.');
  }
  mappingFor(code: string) {
    return this.store.state().colorProMappings.find((item) => item.colorProCode === code);
  }
  product(id: string) {
    return this.store.product(id);
  }
  formulaTotal() {
    return this.formula().reduce((sum, item) => sum + item.recommendedGrams, 0);
  }
  actualTotal() {
    return this.formula().reduce((sum, item) => sum + Number(item.actualGrams || 0), 0);
  }
  componentCost(component: FormulaDraft) {
    const mapping = this.mappingFor(component.colorProCode);
    const product = mapping ? this.product(mapping.productId) : undefined;
    return mapping && product
      ? (Number(component.actualGrams || 0) / mapping.gramsPerInventoryUnit) * product.unitCost
      : 0;
  }
  totalCost() {
    return this.formula().reduce((sum, item) => sum + this.componentCost(item), 0);
  }
  saveMapping(draft: ColorProMapping) {
    try {
      this.store.updateColorProMapping(
        draft.colorProCode,
        draft.productId,
        Number(draft.gramsPerInventoryUnit),
        draft.status,
      );
      this.show(`Mapeo ${draft.colorProCode} guardado.`);
    } catch (error) {
      this.show(this.message(error));
    }
  }
  confirmMix() {
    try {
      const before = Object.fromEntries(
        this.formula().map((item) => {
          const mapping = this.mappingFor(item.colorProCode);
          return [item.colorProCode, mapping ? this.store.stock(mapping.productId) : 0];
        }),
      );
      this.store.confirmPaintMix({
        workOrderId: this.workOrderId,
        ofReference: this.ofReference,
        stage: this.stage,
        colorCode: this.colorCode,
        preparation: this.preparation(),
        attachmentPath: this.imageName() || this.formulaImage(),
        components: this.formula().map((item) => ({
          ...item,
          actualGrams: Number(item.actualGrams),
          reusableGrams: Number(item.reusableGrams),
          wasteGrams: Number(item.wasteGrams),
        })),
        preparer: this.preparer,
        batch: this.batch,
        observations: this.observations,
      });
      const changed = this.formula().some((item) => {
        const mapping = this.mappingFor(item.colorProCode);
        return mapping && this.store.stock(mapping.productId) !== before[item.colorProCode];
      });
      this.show(
        changed
          ? 'Mezcla confirmada. Solo se descontó la fracción que faltaba entregar.'
          : 'Mezcla confirmada sin un segundo descuento: se consumió el saldo ya entregado.',
      );
    } catch (error) {
      this.show(this.message(error));
    }
  }
  resetScenario() {
    this.store.restoreDemo();
    this.mappingDrafts = structuredClone(this.store.state().colorProMappings);
    this.workerRequestId.set('');
    this.selectPreparation('Concentrada');
    this.extracted.set(false);
    this.show('Escenario de pinturas reiniciado.');
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 4000);
  }
}
