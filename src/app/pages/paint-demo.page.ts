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
        } @else if (mobileView() === 'tasks') {
          <div class="mt-5 space-y-3">
            <p class="text-xs text-slate-400">Selecciona una tarea asignada.</p>
            @for (task of workerTasks(); track task.order.id + task.stage.id) {
              <button
                class="w-full rounded-2xl bg-white p-4 text-left shadow-lg"
                type="button"
                (click)="selectTask(task.order.id, task.stage.id)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <strong class="text-sm"
                      >{{ task.order.number }} · {{ task.order.vehicle }}</strong
                    >
                    <div class="mt-1 text-xs text-slate-500">{{ task.stage.name }}</div>
                  </div>
                  <span class="badge-info">{{ task.stage.status }}</span>
                </div>
                <div class="mt-3 text-[11px] text-slate-500">
                  {{ task.order.brand }} {{ task.order.model }} · vence
                  {{ task.order.dueDate | date: 'dd/MM' }}
                </div>
              </button>
            }
          </div>
        } @else if (selectedOrder(); as order) {
          @let process = selectedStage();
          <div class="mt-5 rounded-3xl bg-white p-5 shadow-xl">
            <button
              type="button"
              class="mb-3 flex items-center gap-1 text-xs font-extrabold text-slate-500"
              (click)="mobileView.set('tasks')"
            >
              <span appLucide="ChevronLeft" [iconSize]="16"></span>Mis tareas
            </button>
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs font-extrabold text-[var(--fraespa-green-dark)]">
                  {{ order.number }} · {{ process?.name }}
                </div>
                <h2 class="mt-1 text-lg font-black">{{ order.vehicle }} · {{ order.model }}</h2>
              </div>
              <span class="badge-warning">{{ process?.status }}</span>
            </div>
            <div class="mt-3 text-xs text-slate-500">
              Asignados: {{ process?.assignedWorkers?.join(', ') || process?.owner }}
            </div>

            @if (mobileView() === 'detail') {
              <div class="mt-4 grid gap-2">
                @if (!['En ejecución', 'Pausado', 'En revisión'].includes(process?.status || '')) {
                  <button class="mobile-action-primary" type="button" (click)="startProcess()">
                    <span appLucide="Play"></span>Iniciar proceso
                  </button>
                }
                @if (process?.status === 'En ejecución') {
                  <button class="mobile-action" type="button" (click)="pauseProcess()">
                    <span appLucide="Pause"></span>Pausar proceso
                  </button>
                }
                @if (process?.status === 'Pausado') {
                  <button class="mobile-action-primary" type="button" (click)="resumeProcess()">
                    <span appLucide="Play"></span>Reanudar proceso
                  </button>
                }
                <button class="mobile-action" type="button" (click)="openRecipe()">
                  <span appLucide="ListChecks"></span>Consultar receta
                </button>
                <button class="mobile-action" type="button" (click)="mobileView.set('status')">
                  <span appLucide="Inbox"></span>Estado de solicitudes
                </button>
                <button
                  class="mobile-action"
                  type="button"
                  (click)="requestFinish()"
                  [disabled]="process?.status !== 'En ejecución'"
                >
                  <span appLucide="Flag"></span>Solicitar finalizar
                </button>
              </div>
            } @else if (mobileView() === 'recipe' || mobileView() === 'request') {
              <div class="mt-4 space-y-3">
                @for (line of recipeLines(); track line.productId) {
                  @let item = product(line.productId);
                  @let summary = materialSummary(line.productId);
                  <label class="block rounded-xl border border-slate-200 p-3">
                    <div class="flex items-start gap-3">
                      <input
                        type="checkbox"
                        class="mt-1 h-5 w-5"
                        [(ngModel)]="requestDrafts[line.productId].selected"
                      />
                      <div class="min-w-0 flex-1">
                        <strong class="block text-sm">{{ item?.description }}</strong>
                        <div class="mt-1 text-[11px] text-slate-500">
                          Plan {{ line.estimatedQty }} {{ item?.unit }} · entregado proceso
                          {{ summary.delivered }} · solicitado {{ summary.requested }}
                        </div>
                      </div>
                    </div>
                    @if (requestDrafts[line.productId].selected) {
                      <input
                        class="field mt-3 text-lg"
                        type="number"
                        min="0.01"
                        step="0.01"
                        [(ngModel)]="requestDrafts[line.productId].quantity"
                      />
                    }
                  </label>
                }
                <button
                  class="w-full rounded-xl border border-dashed border-slate-300 p-3 text-xs font-extrabold"
                  type="button"
                  (click)="showExtraMaterial.set(!showExtraMaterial())"
                >
                  + Agregar material
                </button>
                @if (showExtraMaterial()) {
                  <div class="rounded-xl bg-slate-50 p-3">
                    <select class="field" [(ngModel)]="extraProductId">
                      @for (item of additionalProducts(); track item.id) {
                        <option [value]="item.id">{{ item.description }}</option>
                      }</select
                    ><input
                      class="field mt-2"
                      type="number"
                      min="0.01"
                      step="0.01"
                      [(ngModel)]="extraQuantity"
                    />
                  </div>
                }
                <textarea
                  class="field"
                  rows="2"
                  [(ngModel)]="requestReason"
                  placeholder="Justificación si supera la receta o agrega material"
                ></textarea>
                <button
                  class="mobile-action-primary"
                  type="button"
                  (click)="submitMaterialRequest()"
                >
                  <span appLucide="Send"></span>Enviar solicitud
                </button>
              </div>
            } @else if (mobileView() === 'status') {
              <div class="mt-4 space-y-3">
                @for (request of workerRequests(); track request.id) {
                  <article class="rounded-xl bg-slate-50 p-3">
                    <div class="flex justify-between gap-2">
                      <strong class="text-xs">{{ request.stage }}</strong
                      ><span class="badge-info">{{ request.status }}</span>
                    </div>
                    <div class="mt-2 text-[11px] text-slate-500">
                      {{ request.lines.length }} material(es) · aprobación
                      {{ request.approval.status }}
                    </div>
                  </article>
                } @empty {
                  <p class="text-xs text-slate-500">Todavía no hay solicitudes.</p>
                }
              </div>
            }
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
              <h2 class="panel-title">Recorrido de validación</h2>
              <p class="mt-1 text-xs text-slate-500">
                Las acciones comparten el mismo estado local y pueden repetirse al restaurar el
                escenario.
              </p>
            </div>
            <span class="badge-info">{{ completedSteps() }}/11 pasos</span>
          </div>
          <div class="flex gap-2 overflow-x-auto border-b border-slate-100 p-4">
            @for (label of demoSteps; track $index) {
              <span
                class="whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-extrabold"
                [class.bg-emerald-100]="stepDone($index + 1)"
                [class.text-emerald-800]="stepDone($index + 1)"
                [class.bg-slate-100]="!stepDone($index + 1)"
                [class.text-slate-500]="!stepDone($index + 1)"
                >{{ $index + 1 }}. {{ label }}</span
              >
            }
          </div>
          <div class="grid gap-4 p-5 xl:grid-cols-3">
            <article class="rounded-2xl border border-slate-200 p-4">
              <div class="eyebrow">Antonella · Bandeja</div>
              <h3 class="mt-1 font-black">Solicitud activa</h3>
              @if (activeRequest(); as request) {
                <div class="mt-3 flex items-center justify-between">
                  <strong>{{ request.requester }} · {{ request.stage }}</strong
                  ><span class="badge-warning">{{ request.status }}</span>
                </div>
                <div class="mt-3 space-y-2">
                  @for (line of request.lines; track line.id) {
                    <div class="rounded-lg bg-slate-50 p-2 text-xs">
                      <strong>{{ product(line.productId)?.description }}</strong>
                      <div class="mt-1 text-slate-500">
                        Solicita {{ line.requestedQuantity }} · autorizado
                        {{ line.authorizedQuantity }} · entregado {{ line.deliveredQuantity }}
                      </div>
                    </div>
                  }
                </div>
                <p class="mt-3 text-xs text-slate-500">
                  {{ request.excessJustification || request.note }}
                </p>
              } @else {
                <p class="mt-4 text-xs text-slate-500">
                  Jhony debe enviar una solicitud desde la vista móvil.
                </p>
              }
            </article>
            <article class="rounded-2xl border border-slate-200 p-4">
              <div class="eyebrow">Supervisor</div>
              <h3 class="mt-1 font-black">Autorizar exceso</h3>
              @if (activeRequest(); as request) {
                @if (request.status === 'En revisión') {
                  <div class="mt-3 space-y-2">
                    @for (line of request.lines; track line.id) {
                      <label class="block text-xs"
                        ><span class="field-label"
                          >Autorizar {{ product(line.productId)?.code }}</span
                        ><input
                          class="field"
                          type="number"
                          min="0"
                          [max]="line.requestedQuantity"
                          step="0.01"
                          [(ngModel)]="approvalAmounts[line.id]"
                      /></label>
                    }
                  </div>
                  <textarea
                    class="field mt-3"
                    rows="2"
                    [(ngModel)]="approvalReason"
                    placeholder="Motivo de supervisión"
                  ></textarea>
                  <div class="mt-3 grid grid-cols-2 gap-2">
                    <button class="btn-primary" type="button" (click)="approveRequest(false)">
                      Aprobar</button
                    ><button class="btn-secondary" type="button" (click)="approveRequest(true)">
                      Parcial</button
                    ><button class="btn-danger col-span-2" type="button" (click)="rejectRequest()">
                      Rechazar
                    </button>
                  </div>
                } @else {
                  <div class="mt-4 rounded-xl bg-slate-50 p-3 text-xs">
                    <strong>{{ request.approval.status }}</strong>
                    <div class="mt-1 text-slate-500">
                      {{ request.approval.supervisor }} · {{ request.approval.reason }}
                    </div>
                  </div>
                }
              } @else {
                <p class="mt-4 text-xs text-slate-500">Sin solicitud para revisar.</p>
              }
            </article>
            <article class="rounded-2xl border border-slate-200 p-4">
              <div class="eyebrow">Antonella · Despacho</div>
              <h3 class="mt-1 font-black">Vale e inventario</h3>
              @if (activeRequest(); as request) {
                <button
                  class="btn-primary mt-4 w-full"
                  type="button"
                  (click)="dispatchActiveRequest()"
                  [disabled]="!['Pendiente', 'Parcial'].includes(request.status)"
                >
                  <span appLucide="PackageCheck"></span>Entregar autorizado
                </button>
                @if (lastVoucherNumber()) {
                  <div class="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
                    <strong>{{ lastVoucherNumber() }} generado</strong>
                    <div class="mt-1">El inventario se actualizó una sola vez.</div>
                  </div>
                }
              } @else {
                <p class="mt-4 text-xs text-slate-500">
                  La entrega se habilita después de la autorización.
                </p>
              }
              <button
                class="btn-secondary mt-3 w-full"
                type="button"
                (click)="registerDemoReturn()"
                [disabled]="!store.state().paintMixes.length || !!demoReturnId()"
              >
                <span appLucide="Undo2"></span
                >{{ demoReturnId() ? 'Devolución registrada' : 'Registrar devolución parcial' }}
              </button>
            </article>
          </div>
          <div class="border-t border-slate-100 p-5">
            <div class="flex items-center justify-between">
              <div>
                <div class="eyebrow">Supervisor · avance e historial</div>
                <h3 class="mt-1 font-black">
                  {{ selectedOrder()?.number || 'OT-125' }} · {{ selectedStage()?.progress || 0 }}%
                </h3>
              </div>
              <span class="badge-info"
                >{{ store.state().processEvents.length }} eventos de proceso</span
              >
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-2">
              @for (event of store.state().processEvents.slice(0, 6); track event.id) {
                <div class="rounded-xl bg-slate-50 p-3 text-xs">
                  <strong>{{ event.worker }} · {{ event.action }}</strong>
                  <div class="mt-1 text-slate-500">
                    {{ event.createdAt | date: 'dd/MM HH:mm' }} ·
                    {{ event.note || selectedStage()?.name }}
                  </div>
                </div>
              } @empty {
                <p class="text-xs text-slate-500">
                  El historial aparecerá al iniciar el proceso móvil.
                </p>
              }
            </div>
          </div>
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
                      <th class="p-3">Incorporado</th>
                      <th class="p-3">Saldo entregado</th>
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
                        <td class="p-3 font-bold">
                          {{ incorporated(component) | number: '1.1-1' }} g
                        </td>
                        <td class="p-3">
                          <strong
                            >{{ deliveredBalance(component) | number: '1.0-3' }}
                            {{ item?.unit }}</strong
                          >
                          <div class="text-[10px] text-slate-500">antes de esta mezcla</div>
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
                      <td colspan="5" class="p-3 text-right text-lg font-black">
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
  readonly workerSignedIn = computed(() => !!this.store.state().workerSession);
  readonly workerRequestId = signal('');
  readonly mobileView = signal<'tasks' | 'detail' | 'recipe' | 'request' | 'status'>('tasks');
  readonly showExtraMaterial = signal(false);
  readonly recipeViewed = signal(false);
  readonly lastVoucherNumber = signal('');
  readonly demoReturnId = signal('');
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
  readonly workerTasks = computed(() =>
    this.store
      .state()
      .workOrders.flatMap((order) =>
        order.stages
          .filter((stage) => (stage.assignedWorkers ?? [stage.owner]).includes('Jhony'))
          .map((stage) => ({ order, stage })),
      ),
  );
  readonly selectedOrder = computed(() =>
    this.store
      .state()
      .workOrders.find(
        (order) => order.id === this.store.state().workerSession?.selectedWorkOrderId,
      ),
  );
  readonly selectedStage = computed(() =>
    this.selectedOrder()?.stages.find(
      (stage) => stage.id === this.store.state().workerSession?.selectedStageId,
    ),
  );
  readonly recipeLines = computed(() => {
    const order = this.selectedOrder();
    const stage = this.selectedStage();
    return order && stage ? this.store.recipeFor(order.id, stage.id) : [];
  });
  readonly workerRequests = computed(() =>
    this.store
      .state()
      .requests.filter(
        (request) =>
          request.requester === 'Jhony' &&
          (!this.selectedOrder() || request.workOrderId === this.selectedOrder()?.id),
      ),
  );
  readonly activeRequest = computed(() => {
    const id = this.workerRequestId();
    return this.store.state().requests.find((request) => request.id === id);
  });
  readonly additionalProducts = computed(() => {
    const recipeIds = new Set(this.recipeLines().map((line) => line.productId));
    return this.store
      .state()
      .products.filter((item) => !recipeIds.has(item.id))
      .slice(0, 30);
  });
  readonly completedSteps = computed(
    () => this.demoSteps.filter((_, index) => this.stepDone(index + 1)).length,
  );
  mappingDrafts: ColorProMapping[] = structuredClone(this.store.state().colorProMappings);
  requestDrafts: Record<string, { selected: boolean; quantity: number }> = {};
  approvalAmounts: Record<string, number> = {};
  pin = '4085';
  pauseReason = 'Cambio de cabina';
  requestReason = 'Superficie adicional detectada durante el trabajo.';
  extraProductId = 'PQM0034';
  extraQuantity = 0.1;
  approvalReason = 'Exceso verificado por el encargado de taller.';
  ofReference = 'OF-408A5-DEMO';
  workOrderId = 'ot-125';
  stage = 'Pintura';
  colorCode = 'Red - 408A5';
  preparer = 'Antonella';
  batch = 'MIX-408A5-001';
  observations = 'Fórmula de 1 litro revisada contra captura ColorPro.';
  clp = formatClp;
  readonly demoSteps = [
    'Iniciar proceso',
    'Consultar receta',
    'Solicitar materiales',
    'Recibir en bodega',
    'Autorizar exceso',
    'Entregar material',
    'Generar vale',
    'Actualizar inventario',
    'Registrar mezcla',
    'Registrar devolución',
    'Consultar historial',
  ];

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
    try {
      this.store.identifyWorker('Jhony', this.pin);
      this.show('Bienvenido, Jhony. Selecciona una tarea asignada.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  selectTask(workOrderId: string, stageId: string) {
    try {
      this.store.selectWorkerTask(workOrderId, stageId);
      this.mobileView.set('detail');
      this.requestDrafts = Object.fromEntries(
        this.store.recipeFor(workOrderId, stageId).map((line, index) => [
          line.productId,
          {
            selected: index === 0,
            quantity: index === 0 ? line.estimatedQty + 1 : line.estimatedQty,
          },
        ]),
      );
    } catch (error) {
      this.show(this.message(error));
    }
  }
  startProcess() {
    this.run(() => this.store.startSelectedProcess(), 'Proceso iniciado.');
  }
  pauseProcess() {
    this.run(() => this.store.pauseSelectedProcess(this.pauseReason), 'Proceso pausado.');
  }
  resumeProcess() {
    this.run(() => this.store.resumeSelectedProcess(), 'Proceso reanudado.');
  }
  requestFinish() {
    this.run(
      () => this.store.requestFinishSelectedProcess('Trabajo listo para revisión.'),
      'Finalización enviada a supervisión.',
    );
  }
  openRecipe() {
    this.recipeViewed.set(true);
    this.mobileView.set('recipe');
  }
  materialSummary(productId: string) {
    const order = this.selectedOrder();
    const stage = this.selectedStage();
    return order && stage
      ? this.store.processMaterialSummary(order.id, stage.name, productId)
      : { requested: 0, authorized: 0, delivered: 0, requesters: [] };
  }
  submitMaterialRequest() {
    const order = this.selectedOrder();
    const stage = this.selectedStage();
    if (!order || !stage) return this.show('Selecciona una tarea.');
    try {
      const lines = Object.entries(this.requestDrafts)
        .filter(([, draft]) => draft.selected)
        .map(([productId, draft]) => ({ productId, quantity: Number(draft.quantity) }));
      if (this.showExtraMaterial())
        lines.push({ productId: this.extraProductId, quantity: Number(this.extraQuantity) });
      const requestId = this.store.createRequest({
        workOrderId: order.id,
        requester: 'Jhony',
        receiver: 'Antonella',
        stage: stage.name,
        note: `Solicitud móvil para ${stage.name}.`,
        excessJustification: this.requestReason,
        lines,
      });
      this.workerRequestId.set(requestId);
      const request = this.store.state().requests.find((item) => item.id === requestId);
      this.approvalAmounts = Object.fromEntries(
        (request?.lines ?? []).map((line) => [line.id, line.requestedQuantity]),
      );
      this.mobileView.set('status');
      this.show('Solicitud enviada a bodega.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  approveRequest(partial: boolean) {
    const request = this.activeRequest();
    if (!request) return;
    this.run(
      () =>
        this.store.reviewRequest({
          requestId: request.id,
          supervisor: 'Encargado de taller',
          decision: partial ? 'Aprobar parcialmente' : 'Aprobar',
          authorizedByLine: this.approvalAmounts,
          reason: this.approvalReason,
        }),
      partial ? 'Solicitud aprobada parcialmente.' : 'Solicitud aprobada.',
    );
  }
  rejectRequest() {
    const request = this.activeRequest();
    if (!request) return;
    this.run(
      () =>
        this.store.reviewRequest({
          requestId: request.id,
          supervisor: 'Encargado de taller',
          decision: 'Rechazar',
          authorizedByLine: {},
          reason: this.approvalReason,
        }),
      'Solicitud rechazada.',
    );
  }
  dispatchActiveRequest() {
    const request = this.activeRequest();
    if (!request) return;
    try {
      const voucher = this.store.dispatchRequest(
        request.id,
        request.lines
          .map((line) => ({
            lineId: line.id,
            quantity: Math.max(0, line.authorizedQuantity - line.deliveredQuantity),
          }))
          .filter((line) => line.quantity > 0),
        'Jhony',
        'Entrega física confirmada por Antonella.',
      );
      this.lastVoucherNumber.set(voucher);
      this.show(`${voucher} generado e inventario actualizado.`);
    } catch (error) {
      this.show(this.message(error));
    }
  }
  registerDemoReturn() {
    try {
      const id = this.store.registerLiquidReturnByWeight({
        productId: 'PQM0062',
        workOrderId: 'ot-125',
        voucherReference: 'V-00091',
        grossGrams: 220,
        tareGrams: 120,
        materialState: 'Reutilizable',
        receiver: 'Antonella',
      });
      this.demoReturnId.set(id);
      this.show('Devolución parcial vinculada al saldo exacto del vale.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  stepDone(step: number): boolean {
    const request = this.activeRequest();
    if (step === 1)
      return this.store.state().processEvents.some((event) => event.action === 'Inició');
    if (step === 2) return this.recipeViewed();
    if ([3, 4].includes(step)) return !!request;
    if (step === 5) return !!request && request.approval.status !== 'Pendiente';
    if ([6, 7, 8].includes(step)) return !!this.lastVoucherNumber();
    if (step === 9) return this.store.state().paintMixes.length > 0;
    if (step === 10) return this.store.state().liquidReturns.length > 0;
    if (step === 11) return this.store.state().processEvents.length > 0 && this.stepDone(10);
    return false;
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
      ? ((Number(component.actualGrams || 0) - Number(component.reusableGrams || 0)) /
          mapping.gramsPerInventoryUnit) *
          product.unitCost
      : 0;
  }
  incorporated(component: FormulaDraft) {
    return Math.max(
      0,
      Number(component.actualGrams || 0) -
        Number(component.reusableGrams || 0) -
        Number(component.wasteGrams || 0),
    );
  }
  deliveredBalance(component: FormulaDraft) {
    const mapping = this.mappingFor(component.colorProCode);
    if (!mapping) return 0;
    const delivered = this.store.allocated(this.workOrderId, mapping.productId);
    const consumed = this.store
      .state()
      .paintMixes.filter((mix) => mix.workOrderId === this.workOrderId)
      .flatMap((mix) => mix.components)
      .filter((item) => item.productId === mapping.productId)
      .reduce((sum, item) => sum + item.inventoryQuantity, 0);
    return Math.max(0, delivered - consumed);
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
    this.lastVoucherNumber.set('');
    this.demoReturnId.set('');
    this.recipeViewed.set(false);
    this.mobileView.set('tasks');
    this.requestDrafts = {};
    this.selectPreparation('Concentrada');
    this.extracted.set(false);
    this.show('Escenario de pinturas reiniciado.');
  }
  private run(operation: () => void, success: string) {
    try {
      operation();
      this.show(success);
    } catch (error) {
      this.show(this.message(error));
    }
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 4000);
  }
}
