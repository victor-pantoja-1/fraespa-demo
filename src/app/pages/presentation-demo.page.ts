import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-presentation-demo-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    <section class="presentation-hero">
      <div>
        <div class="eyebrow text-[#9cdb80]">Modo presentación · datos ficticios</div>
        <h1 class="mt-2 text-3xl font-black text-white">
          Del expediente a la entrega del vehículo
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Una sola sesión local conecta a Jhony, supervisión y Antonella. La comunicación entre
          dispositivos físicos requerirá un backend productivo.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          class="btn-secondary"
          type="button"
          (click)="mode.set(mode() === 'guided' ? 'free' : 'guided')"
        >
          <span appLucide="Route"></span
          >{{ mode() === 'guided' ? 'Cambiar a modo libre' : 'Cambiar a modo guiado' }}</button
        ><button class="btn-danger" type="button" (click)="askRestore()">
          <span appLucide="RotateCcw"></span>Restaurar escenario
        </button>
      </div>
    </section>

    @if (confirmRestore()) {
      <section
        class="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <strong>¿Restaurar el escenario de presentación?</strong>
          <p class="mt-1 text-xs text-red-800">
            Se eliminan solo los cambios locales de la demo. No se modifican documentos originales.
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" type="button" (click)="confirmRestore.set(false)">
            Cancelar</button
          ><button class="btn-danger" type="button" (click)="restore()">Sí, restaurar</button>
        </div>
      </section>
    }

    @if (mode() === 'guided') {
      <section class="panel mt-6 overflow-hidden">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Asistente guiado</div>
            <h2 class="panel-title">Paso {{ guideStep() }} de 15 · {{ steps[guideStep() - 1] }}</h2>
          </div>
          <span class="badge-info">{{ completedCount() }}/15 completados</span>
        </div>
        <div class="flex gap-2 overflow-x-auto border-b border-slate-100 p-4">
          @for (label of steps; track $index) {
            <button
              type="button"
              class="whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-black"
              [class.bg-emerald-100]="stepDone($index + 1)"
              [class.text-emerald-800]="stepDone($index + 1)"
              [class.bg-slate-100]="!stepDone($index + 1)"
              [class.text-slate-500]="!stepDone($index + 1)"
              (click)="goToStep($index + 1)"
            >
              {{ $index + 1 }}. {{ label }}
            </button>
          }
        </div>
        <div class="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-sm font-bold text-slate-800">{{ instruction() }}</p>
            <p class="mt-1 text-xs text-slate-500">
              Todos los valores de resultado se calculan desde DemoStore.
            </p>
          </div>
          <button
            class="btn-primary min-w-56"
            type="button"
            (click)="executeStep()"
            [disabled]="stepDone(guideStep())"
          >
            <span appLucide="PlayCircle"></span
            >{{ stepDone(guideStep()) ? 'Paso completado' : actionLabel() }}
          </button>
        </div>
      </section>
    }

    <section class="mt-6 grid gap-5 2xl:grid-cols-[370px_1fr_1fr]">
      <article class="phone-frame">
        <div class="flex items-center justify-between text-white">
          <div>
            <div class="text-[10px] font-black uppercase tracking-[.2em] text-[#8bd56a]">
              FRAESPA móvil
            </div>
            <h2 class="mt-1 text-xl font-black">
              {{ workerSession() ? 'Hola, Jhony' : 'Acceso de trabajador' }}
            </h2>
          </div>
          <span class="rounded-full bg-white/10 px-3 py-2 text-xs font-black">JH</span>
        </div>
        <div class="mt-5 rounded-3xl bg-slate-100 p-4">
          @if (!workerSession()) {
            <div class="rounded-2xl bg-white p-4">
              <div class="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
                Identidad fija: Jhony
              </div>
              <div class="mt-3 field text-center text-lg tracking-[.4em]">4085</div>
              <button class="mobile-action-primary mt-3" type="button" (click)="runStep(5)">
                <span appLucide="LogIn"></span>Ingresar
              </button>
            </div>
          } @else if (!selectedStage()) {
            <div>
              <h3 class="font-black">Mis tareas</h3>
              <button
                class="mt-3 w-full rounded-2xl bg-white p-4 text-left shadow-sm"
                type="button"
                (click)="runStep(6)"
              >
                <div class="flex justify-between">
                  <div>
                    <div class="text-xs font-black text-emerald-700">OT-125 · ABCD45</div>
                    <strong class="mt-1 block">Lijado</strong>
                  </div>
                  <span class="badge-info">Asignada</span>
                </div>
                <p class="mt-2 text-xs text-slate-500">OF-491 · Transportes ABC</p>
              </button>
            </div>
          } @else {
            <div class="rounded-2xl bg-white p-4">
              <div class="flex justify-between gap-2">
                <div>
                  <div class="text-xs font-black text-emerald-700">OT-125 · ABCD45</div>
                  <h3 class="mt-1 text-lg font-black">{{ selectedStage()?.name }}</h3>
                </div>
                <span class="badge-warning h-fit">{{ selectedStage()?.status }}</span>
              </div>
              <p class="mt-2 text-xs text-slate-500">Bahía 3 · Entrega 30/11</p>
              <div class="mt-4 grid gap-2">
                @if (!processStarted()) {
                  <button class="mobile-action-primary" type="button" (click)="runStep(7)">
                    <span appLucide="Play"></span>Iniciar proceso
                  </button>
                }
                <button class="mobile-action" type="button" (click)="runStep(8)">
                  <span appLucide="ListChecks"></span>Consultar receta
                </button>
                @if (recipeViewed()) {
                  <div class="rounded-xl border border-slate-200 p-3">
                    <strong class="text-sm">Lijas orbital P-120</strong>
                    <p class="mt-1 text-[11px] text-slate-500">
                      Plan 10 UN · entregado {{ processSummary().delivered }} · solicitado
                      {{ processSummary().requested }}
                    </p>
                    <div class="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-2">
                      <span class="text-xs font-bold">Cantidad a solicitar</span
                      ><strong class="text-lg">12</strong>
                    </div>
                    <p class="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-bold text-amber-900">
                      Estás solicitando más de lo planificado.
                    </p>
                    <button
                      class="mobile-action-primary mt-3"
                      type="button"
                      (click)="runStep(9)"
                      [disabled]="!!activeRequest()"
                    >
                      <span appLucide="Send"></span
                      >{{ activeRequest() ? 'Solicitud enviada' : 'Enviar solicitud' }}
                    </button>
                  </div>
                }
                <button
                  class="mobile-action"
                  type="button"
                  (click)="finishFromPhone()"
                  [disabled]="!canRequestFinish()"
                >
                  <span appLucide="Flag"></span>Solicitar finalizar
                </button>
              </div>
            </div>
          }
        </div>
      </article>

      <article class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Supervisor</div>
            <h2 class="panel-title">Excepciones y avance</h2>
          </div>
          <span class="badge-info">{{ order()?.progress || 0 }}% OT</span>
        </div>
        <div class="p-5">
          @if (activeRequest(); as request) {
            <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div class="flex justify-between gap-2">
                <div>
                  <strong>Exceso de receta</strong>
                  <p class="mt-1 text-xs text-amber-900">Jhony · Lijado · superficie adicional</p>
                </div>
                <span class="badge-warning">{{ request.approval.status }}</span>
              </div>
              <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-white p-3">
                  <span class="field-label">Plan</span><strong>10 UN</strong>
                </div>
                <div class="rounded-xl bg-white p-3">
                  <span class="field-label">Entregado</span
                  ><strong>{{ processSummary().delivered }} UN</strong>
                </div>
                <div class="rounded-xl bg-white p-3">
                  <span class="field-label">Solicita</span><strong>12 UN</strong>
                </div>
              </div>
              <p class="mt-3 text-xs text-amber-900">Stock disponible: {{ p120Stock() }} UN</p>
              @if (request.status === 'En revisión') {
                <div class="mt-4 grid grid-cols-2 gap-2">
                  <button class="btn-primary" type="button" (click)="runStep(10)">Aprobar 12</button
                  ><button class="btn-secondary" type="button" (click)="approvePartial()">
                    Aprobar parcial</button
                  ><button class="btn-danger col-span-2" type="button" (click)="reject()">
                    Rechazar
                  </button>
                </div>
              } @else {
                <div class="mt-4 rounded-xl bg-white p-3 text-xs">
                  <strong>{{ request.approval.status }}</strong>
                  <p class="mt-1 text-slate-500">
                    {{ request.approval.supervisor }} · {{ request.approval.reason }}
                  </p>
                </div>
              }
            </div>
          } @else {
            <div class="rounded-2xl bg-slate-50 p-5 text-center">
              <span appLucide="ShieldCheck" class="mx-auto text-slate-400" [iconSize]="34"></span>
              <p class="mt-3 text-sm font-bold">Sin excesos pendientes</p>
              <p class="mt-1 text-xs text-slate-500">
                La solicitud de Jhony aparecerá en tiempo real.
              </p>
            </div>
          }
          <div class="mt-5">
            <div class="flex items-center justify-between">
              <h3 class="font-black">Procesos de OT-125</h3>
              <span class="text-xs text-slate-500">avance ponderado</span>
            </div>
            <div class="mt-3 space-y-2">
              @for (process of order()?.stages || []; track process.id) {
                <div class="rounded-xl bg-slate-50 p-3">
                  <div class="flex justify-between text-xs">
                    <strong>{{ process.name }}</strong
                    ><span>{{ process.status }} · {{ process.progress }}%</span>
                  </div>
                  <div class="progress-track mt-2">
                    <div class="progress-fill" [style.width.%]="process.progress"></div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </article>

      <article class="panel overflow-hidden">
        <div class="panel-header">
          <div>
            <div class="eyebrow">Antonella · Bodega</div>
            <h2 class="panel-title">Bandeja y entrega</h2>
          </div>
          <span class="badge-info">Stock P-120: {{ p120Stock() }}</span>
        </div>
        <div class="p-5">
          @if (activeRequest(); as request) {
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="flex justify-between gap-2">
                <div>
                  <strong>Jhony · {{ request.stage }}</strong>
                  <p class="mt-1 text-xs text-slate-500">
                    Transportes ABC · ABCD45 · OF-491 · OT-125
                  </p>
                </div>
                <span class="badge-info">{{ request.status }}</span>
              </div>
              <div class="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                <strong>Lijas orbital P-120</strong>
                <div class="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>Solicita <b class="text-slate-900">12</b></span
                  ><span
                    >Autorizado
                    <b class="text-slate-900">{{ request.lines[0].authorizedQuantity }}</b></span
                  ><span
                    >Entregado
                    <b class="text-slate-900">{{ request.lines[0].deliveredQuantity }}</b></span
                  >
                </div>
              </div>
              @if (request.approval.status === 'Pendiente') {
                <p class="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">
                  Esperando autorización. El despacho está bloqueado.
                </p>
              } @else if (!voucherNumber()) {
                <label class="mt-4 block"
                  ><span class="field-label">Cantidad a entregar físicamente</span
                  ><input
                    class="field text-lg font-black"
                    type="number"
                    min="0"
                    max="12"
                    [(ngModel)]="deliveryQuantity" /></label
                ><button class="btn-primary mt-3 w-full" type="button" (click)="runStep(12)">
                  <span appLucide="PackageCheck"></span>Confirmar entrega y generar vale
                </button>
              } @else {
                <div class="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-900">
                  <strong>{{ voucherNumber() }} emitido</strong>
                  <p class="mt-1 text-xs">
                    8 UN entregadas · 4 UN pendientes · stock descontado una vez.
                  </p>
                </div>
              }
            </div>
          } @else {
            <div class="rounded-2xl bg-slate-50 p-5 text-center">
              <span appLucide="Inbox" class="mx-auto text-slate-400" [iconSize]="34"></span>
              <p class="mt-3 text-sm font-bold">Bandeja sincronizada</p>
              <p class="mt-1 text-xs text-slate-500">La solicitud móvil aparecerá aquí.</p>
            </div>
          }
          <div class="mt-5 grid grid-cols-3 gap-3 text-center">
            <div class="rounded-xl bg-slate-950 p-3 text-white">
              <span class="text-[10px] uppercase text-slate-400">Corte local</span
              ><strong class="mt-1 block text-xl">{{ p120Stock() }}</strong>
            </div>
            <div class="rounded-xl bg-slate-100 p-3">
              <span class="text-[10px] uppercase text-slate-500">Entregado</span
              ><strong class="mt-1 block text-xl">{{ processSummary().delivered }}</strong>
            </div>
            <div class="rounded-xl bg-slate-100 p-3">
              <span class="text-[10px] uppercase text-slate-500">Pendiente</span
              ><strong class="mt-1 block text-xl">{{ pendingDelivery() }}</strong>
            </div>
          </div>
          <a class="btn-secondary mt-4 w-full" routerLink="/bodega"
            ><span appLucide="ExternalLink"></span>Abrir bandeja completa</a
          >
        </div>
      </article>
    </section>

    <section class="panel mt-6">
      <div class="panel-header">
        <div>
          <div class="eyebrow">Expediente y trazabilidad</div>
          <h2 class="panel-title">
            {{ workFile()?.code || 'Expediente aún no creado' }} ·
            {{ workFile()?.ofReference || 'OF-491' }}
          </h2>
        </div>
        <span class="badge-info">{{ order()?.status || 'Sin OT vinculada' }}</span>
      </div>
      <div class="grid gap-4 p-5 lg:grid-cols-4">
        <div><span class="field-label">Cliente</span><strong>Transportes ABC</strong></div>
        <div>
          <span class="field-label">Unidades</span
          ><strong>{{ workFile()?.units?.length || 0 }}</strong>
        </div>
        <div>
          <span class="field-label">Ubicación</span
          ><strong>{{ order()?.physicalArea || 'Por asignar' }}</strong>
        </div>
        <div>
          <span class="field-label">Vale</span><strong>{{ voucherNumber() || 'Pendiente' }}</strong>
        </div>
      </div>
      <div class="border-t border-slate-100 p-5">
        <h3 class="font-black">Historial reciente</h3>
        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          @for (event of store.state().audit.slice(0, 9); track event.id) {
            <div class="rounded-xl bg-slate-50 p-3 text-xs">
              <strong>{{ event.title }}</strong>
              <p class="mt-1 text-slate-500">{{ event.detail }}</p>
            </div>
          }
        </div>
      </div>
    </section>
    @if (toast()) {
      <div class="toast-message">{{ toast() }}</div>
    }
  `,
})
export class PresentationDemoPage {
  readonly store = inject(DemoStore);
  readonly mode = signal<'guided' | 'free'>('guided');
  readonly guideStep = signal(1);
  readonly confirmRestore = signal(false);
  readonly recipeViewed = signal(false);
  readonly prepared = signal(false);
  readonly fileId = signal('');
  readonly requestId = signal('');
  readonly voucherNumber = signal('');
  readonly toast = signal('');
  deliveryQuantity = 8;
  readonly steps = [
    'Crear expediente',
    'Registrar segunda unidad',
    'Crear OT',
    'Asignar procesos y trabajadores',
    'Iniciar sesión como trabajador',
    'Consultar tareas',
    'Iniciar trabajo',
    'Consultar receta',
    'Solicitar materiales',
    'Autorizar exceso',
    'Preparar entrega',
    'Generar vale',
    'Mostrar descuento de inventario',
    'Finalizar y validar procesos',
    'Entregar unidad',
  ];
  readonly workFile = computed(() =>
    this.store.state().workFiles.find((file) => file.id === this.fileId()),
  );
  readonly order = computed(() => this.store.order('ot-125'));
  readonly workerSession = computed(() => this.store.state().workerSession);
  readonly selectedStage = computed(() =>
    this.order()?.stages.find((stage) => stage.id === this.workerSession()?.selectedStageId),
  );
  readonly activeRequest = computed(() =>
    this.store.state().requests.find((request) => request.id === this.requestId()),
  );
  readonly p120Stock = computed(() => this.store.stock('DIS0011'));
  readonly processStarted = computed(() =>
    this.store
      .state()
      .processEvents.some((event) => event.workOrderId === 'ot-125' && event.action === 'Inició'),
  );
  readonly processSummary = computed(() =>
    this.store.processMaterialSummary('ot-125', this.selectedStage()?.name || 'Lijado', 'DIS0011'),
  );
  readonly pendingDelivery = computed(() => {
    const line = this.activeRequest()?.lines[0];
    return line ? Math.max(0, line.authorizedQuantity - line.deliveredQuantity) : 0;
  });
  readonly completedCount = computed(
    () => this.steps.filter((_, index) => this.stepDone(index + 1)).length,
  );
  readonly canRequestFinish = computed(
    () => this.selectedStage()?.status === 'En ejecución' && this.pendingDelivery() === 0,
  );

  stepDone(step: number): boolean {
    const file = this.workFile();
    const request = this.activeRequest();
    if (step === 1) return !!file;
    if (step === 2) return (file?.units.length ?? 0) >= 2;
    if (step === 3) return this.order()?.workFileId === file?.id;
    if (step === 4)
      return (
        this.order()?.stages.find((stage) => stage.id === 's3')?.name === 'Lijado' &&
        this.order()?.materialPlan.some(
          (line) => line.productId === 'DIS0011' && line.estimatedQty === 10,
        ) === true
      );
    if (step === 5) return !!this.workerSession();
    if (step === 6) return this.workerSession()?.selectedStageId === 's3';
    if (step === 7) return this.processStarted();
    if (step === 8) return this.recipeViewed();
    if (step === 9) return !!request;
    if (step === 10) return !!request && request.approval.status !== 'Pendiente';
    if (step === 11) return this.prepared();
    if (step === 12) return !!this.voucherNumber();
    if (step === 13) return !!this.voucherNumber() && this.p120Stock() === 112;
    if (step === 14) return this.order()?.status === 'Terminada';
    if (step === 15) return this.order()?.status === 'Entregada';
    return false;
  }
  instruction(): string {
    return [
      'Crea el expediente interno sin reutilizar la OF como clave.',
      'Agrega la segunda unidad del proyecto Transportes ABC.',
      'Vincula la unidad ABCD45 con OT-125.',
      'Configura lijado, receta y asignación de Jhony.',
      'Identifica a Jhony con el PIN demostrativo 4085.',
      'Abre únicamente la tarea de lijado asignada.',
      'Registra fecha y hora de inicio.',
      'Muestra la receta P-120 planificada en 10 unidades.',
      'Solicita 12 unidades y registra la justificación.',
      'El encargado de taller autoriza el exceso.',
      'Antonella prepara una entrega parcial de 8 unidades.',
      'Confirma la entrega física y genera el vale.',
      'Comprueba el stock operativo: 120 → 112.',
      'Cierra el saldo con motivo y valida procesos.',
      'Registra la entrega final de la unidad.',
    ][this.guideStep() - 1];
  }
  actionLabel(): string {
    return [
      'Crear expediente',
      'Agregar unidad',
      'Vincular OT-125',
      'Planificar OT',
      'Ingresar como Jhony',
      'Abrir tarea',
      'Iniciar lijado',
      'Ver receta',
      'Enviar solicitud',
      'Aprobar 12',
      'Preparar 8',
      'Entregar 8',
      'Comprobar stock',
      'Validar procesos',
      'Entregar unidad',
    ][this.guideStep() - 1];
  }
  goToStep(step: number) {
    if (step === 1 || this.stepDone(step - 1)) this.guideStep.set(step);
  }
  executeStep() {
    this.runStep(this.guideStep());
  }
  runStep(step: number) {
    try {
      if (step === 1) this.createFile();
      else if (step === 2) this.addUnit();
      else if (step === 3) this.linkOrder();
      else if (step === 4) this.store.configurePresentationOrder('ot-125');
      else if (step === 5) this.store.identifyWorker('Jhony', '4085');
      else if (step === 6) this.store.selectWorkerTask('ot-125', 's3');
      else if (step === 7) this.store.startSelectedProcess();
      else if (step === 8) this.recipeViewed.set(true);
      else if (step === 9) this.createRequest();
      else if (step === 10) this.approve();
      else if (step === 11) this.prepared.set(true);
      else if (step === 12) this.dispatch();
      else if (step === 13) {
        if (this.p120Stock() !== 112)
          throw new Error('El stock operativo no coincide con 112 unidades.');
      } else if (step === 14) this.finishAndValidate();
      else if (step === 15) this.store.deliverWorkOrder('ot-125', 'Encargado de taller');
      this.show(`${this.steps[step - 1]} completado.`);
      if (step === this.guideStep() && step < 15) this.guideStep.set(step + 1);
    } catch (error) {
      this.show(this.message(error));
    }
  }
  createFile() {
    const id = this.store.createWorkFile({
      client: 'Transportes ABC',
      ofReference: 'OF-491',
      quoteReference: 'COT-2026-491',
      service: 'Reparación y pintura',
      dueDate: '2026-11-30',
      manager: 'Encargado de taller',
      observations: 'Escenario ficticio para validación comercial.',
      units: [
        {
          licensePlate: 'ABCD45',
          vehicle: 'Bus de dos pisos',
          brand: 'Marcopolo',
          model: 'Paradiso G7',
          service: 'Reparación y pintura',
        },
      ],
    });
    this.fileId.set(id);
  }
  addUnit() {
    this.store.addWorkFileUnit(this.fileId(), {
      licensePlate: 'EFGH67',
      vehicle: 'Bus interurbano',
      brand: 'Marcopolo',
      model: 'Viaggio 1050',
      service: 'Diseño y pintura',
    });
  }
  linkOrder() {
    const unit = this.workFile()?.units.find((item) => item.licensePlate === 'ABCD45');
    if (!unit) throw new Error('Primero registra la unidad ABCD45.');
    this.store.linkExistingOrderToWorkFile(this.fileId(), unit.id, 'ot-125');
  }
  createRequest() {
    const id = this.store.createRequest({
      workOrderId: 'ot-125',
      requester: 'Jhony',
      receiver: 'Antonella',
      stage: 'Lijado',
      lines: [{ productId: 'DIS0011', quantity: 12 }],
      note: 'Solicitud móvil de receta.',
      excessJustification: 'Superficie adicional.',
    });
    this.requestId.set(id);
  }
  approve() {
    const request = this.activeRequest();
    if (!request) throw new Error('No hay solicitud para aprobar.');
    this.store.reviewRequest({
      requestId: request.id,
      supervisor: 'Encargado de taller',
      decision: 'Aprobar',
      authorizedByLine: {},
      reason: 'Superficie adicional verificada.',
    });
  }
  approvePartial() {
    const request = this.activeRequest();
    if (!request) return;
    const line = request.lines[0];
    try {
      this.store.reviewRequest({
        requestId: request.id,
        supervisor: 'Encargado de taller',
        decision: 'Aprobar parcialmente',
        authorizedByLine: { [line.id]: 8 },
        reason: 'Se autoriza una primera entrega controlada.',
      });
      this.show('Aprobación parcial registrada.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  reject() {
    const request = this.activeRequest();
    if (!request) return;
    try {
      this.store.reviewRequest({
        requestId: request.id,
        supervisor: 'Encargado de taller',
        decision: 'Rechazar',
        authorizedByLine: {},
        reason: 'Exceso no justificado.',
      });
      this.show('Solicitud rechazada.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  dispatch() {
    const request = this.activeRequest();
    const line = request?.lines[0];
    if (!request || !line) throw new Error('No hay solicitud autorizada.');
    const voucher = this.store.dispatchRequest(
      request.id,
      [{ lineId: line.id, quantity: Number(this.deliveryQuantity) }],
      'Jhony',
      'Entrega parcial física confirmada por Antonella.',
    );
    this.voucherNumber.set(voucher);
  }
  finishAndValidate() {
    const request = this.activeRequest();
    const line = request?.lines[0];
    if (!request || !line) throw new Error('No existe la solicitud principal.');
    if (request.status === 'Parcial')
      this.store.closeRequestBalance(
        request.id,
        line.id,
        'Saldo no requerido para terminar el trabajo; cierre validado por supervisión.',
      );
    if (this.selectedStage()?.status === 'En ejecución')
      this.store.requestFinishSelectedProcess('Lijado terminado y listo para control.');
    this.store.validatePresentationOrder('ot-125', 'Encargado de taller');
  }
  finishFromPhone() {
    try {
      this.store.requestFinishSelectedProcess('Proceso listo para validación.');
      this.show('Finalización enviada a supervisión.');
    } catch (error) {
      this.show(this.message(error));
    }
  }
  askRestore() {
    this.confirmRestore.set(true);
  }
  restore() {
    this.store.restoreDemo();
    this.fileId.set('');
    this.requestId.set('');
    this.voucherNumber.set('');
    this.recipeViewed.set(false);
    this.prepared.set(false);
    this.deliveryQuantity = 8;
    this.guideStep.set(1);
    this.confirmRestore.set(false);
    this.show('Escenario restaurado. Puedes repetir el recorrido.');
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3500);
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
}
