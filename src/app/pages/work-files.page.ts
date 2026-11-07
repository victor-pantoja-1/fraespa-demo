import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoStore } from '../services/demo-store.service';
import { LucideIconDirective } from '../shared/lucide-icon.directive';

@Component({
  selector: 'app-work-files-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideIconDirective],
  template: `
    <section class="page-heading">
      <div>
        <div class="eyebrow">Gestión de proyectos</div>
        <h1>Expedientes de trabajo</h1>
        <p>
          Una referencia interna independiente de la OF, con sus unidades y órdenes relacionadas.
        </p>
      </div>
      <button class="btn-primary" type="button" (click)="formOpen.set(!formOpen())">
        <span appLucide="FolderPlus"></span>Nuevo expediente de trabajo
      </button>
    </section>

    @if (formOpen()) {
      <form class="panel mt-6 p-5" (ngSubmit)="createFile()">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label
            ><span class="field-label">Cliente</span
            ><input class="field" [(ngModel)]="client" name="client" required
          /></label>
          <label
            ><span class="field-label">Referencia OF</span
            ><input class="field" [(ngModel)]="ofReference" name="of" required
          /></label>
          <label
            ><span class="field-label">Cotización relacionada</span
            ><input class="field" [(ngModel)]="quoteReference" name="quote"
          /></label>
          <label
            ><span class="field-label">Responsable</span
            ><input class="field" [(ngModel)]="manager" name="manager" required
          /></label>
          <label class="md:col-span-2"
            ><span class="field-label">Servicio contratado</span
            ><input class="field" [(ngModel)]="service" name="service" required
          /></label>
          <label
            ><span class="field-label">Entrega prevista</span
            ><input class="field" type="date" [(ngModel)]="dueDate" name="due" required
          /></label>
          <label
            ><span class="field-label">Patente primera unidad</span
            ><input class="field" [(ngModel)]="plate" name="plate" required
          /></label>
          <label
            ><span class="field-label">Tipo de unidad</span
            ><input class="field" [(ngModel)]="vehicle" name="vehicle" required
          /></label>
          <label
            ><span class="field-label">Marca</span
            ><input class="field" [(ngModel)]="brand" name="brand"
          /></label>
          <label
            ><span class="field-label">Modelo</span
            ><input class="field" [(ngModel)]="model" name="model"
          /></label>
          <label class="md:col-span-2 xl:col-span-4"
            ><span class="field-label">Observaciones</span
            ><textarea
              class="field"
              rows="2"
              [(ngModel)]="observations"
              name="observations"
            ></textarea>
          </label>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button class="btn-secondary" type="button" (click)="formOpen.set(false)">Cancelar</button
          ><button class="btn-primary">Crear expediente</button>
        </div>
      </form>
    }

    <section class="mt-6 grid gap-5 xl:grid-cols-2">
      @for (file of files(); track file.id) {
        <article class="panel overflow-hidden">
          <div class="panel-header">
            <div>
              <div class="eyebrow">{{ file.code }} · {{ file.ofReference }}</div>
              <h2 class="panel-title">{{ file.client }}</h2>
              <p class="mt-1 text-xs text-slate-500">{{ file.service }}</p>
            </div>
            <span class="badge-info">{{ file.status }}</span>
          </div>
          <div class="grid gap-3 p-5 sm:grid-cols-3">
            <div>
              <span class="field-label">Responsable</span
              ><strong class="text-sm">{{ file.manager }}</strong>
            </div>
            <div>
              <span class="field-label">Entrega prevista</span
              ><strong class="text-sm">{{ file.dueDate | date: 'dd/MM/yyyy' }}</strong>
            </div>
            <div>
              <span class="field-label">Unidades</span
              ><strong class="text-sm">{{ file.units.length }}</strong>
            </div>
          </div>
          <div class="border-t border-slate-100 p-5">
            @for (unit of file.units; track unit.id) {
              <div
                class="mb-3 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <strong>{{ unit.licensePlate }} · {{ unit.vehicle }}</strong>
                  <div class="mt-1 text-xs text-slate-500">
                    {{ unit.brand }} {{ unit.model }} · {{ unit.service }}
                  </div>
                </div>
                @if (unit.workOrderId) {
                  <a class="btn-secondary" [routerLink]="['/ordenes', unit.workOrderId]"
                    >Abrir OT</a
                  >
                } @else {
                  <button class="btn-primary" type="button" (click)="createOrder(file.id, unit.id)">
                    Crear OT
                  </button>
                }
              </div>
            }
          </div>
        </article>
      } @empty {
        <div class="panel p-10 text-center xl:col-span-2">
          <span appLucide="FolderOpen" class="mx-auto text-slate-400" [iconSize]="42"></span>
          <h2 class="mt-3 font-black">Aún no hay expedientes</h2>
          <p class="mt-1 text-sm text-slate-500">
            Crea el primero sin reutilizar la OF como identificador interno.
          </p>
        </div>
      }
    </section>
    @if (toast()) {
      <div class="toast-message">{{ toast() }}</div>
    }
  `,
})
export class WorkFilesPage {
  readonly store = inject(DemoStore);
  readonly files = computed(() => this.store.state().workFiles);
  readonly formOpen = signal(false);
  readonly toast = signal('');
  client = 'Transportes ABC';
  ofReference = 'OF-491';
  quoteReference = 'COT-2026-491';
  manager = 'Encargado de taller';
  service = 'Reparación y pintura';
  dueDate = '2026-11-30';
  plate = 'ABCD45';
  vehicle = 'Bus de dos pisos';
  brand = 'Marcopolo';
  model = 'Paradiso G7';
  observations = 'Datos ficticios para validar el flujo operativo con FRAESPA.';

  createFile() {
    try {
      const id = this.store.createWorkFile({
        client: this.client,
        ofReference: this.ofReference,
        quoteReference: this.quoteReference,
        service: this.service,
        dueDate: this.dueDate,
        manager: this.manager,
        observations: this.observations,
        units: [
          {
            licensePlate: this.plate,
            vehicle: this.vehicle,
            brand: this.brand,
            model: this.model,
            service: this.service,
          },
        ],
      });
      this.formOpen.set(false);
      this.show(
        `Expediente ${this.store.state().workFiles.find((file) => file.id === id)?.code} creado.`,
      );
    } catch (error) {
      this.show(this.message(error));
    }
  }

  createOrder(workFileId: string, unitId: string) {
    try {
      const id = this.store.createWorkOrderForWorkFileUnit({
        workFileId,
        unitId,
        physicalArea: 'Patio de producción',
        processes: [
          { name: 'Lijado', workers: ['Jhony', 'Miguel'], weight: 30 },
          { name: 'Pintura', workers: ['Carlos'], weight: 45 },
          { name: 'Control de calidad', workers: ['Supervisor'], weight: 25 },
        ],
        materialPlan: [
          { productId: 'DIS0011', estimatedQty: 10, processIndex: 0 },
          { productId: 'PNT0102', estimatedQty: 12, processIndex: 1 },
        ],
      });
      this.show(`${this.store.order(id)?.number} creada con procesos y recetas.`);
    } catch (error) {
      this.show(this.message(error));
    }
  }
  private show(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(''), 3500);
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  }
}
