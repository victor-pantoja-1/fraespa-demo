import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Role } from './domain/models';
import { DemoStore } from './services/demo-store.service';
import { LucideIconDirective } from './shared/lucide-icon.directive';

interface NavItem { label: string; icon: string; route: string; }

@Component({ selector: 'app-root', imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, LucideIconDirective], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  readonly store = inject(DemoStore);
  private readonly router = inject(Router);
  readonly sidebarOpen = signal(false);
  readonly notificationOpen = signal(false);
  readonly guideStep = signal(-1);
  readonly pageTitle = signal('Dashboard gerencial');
  readonly search = signal('');
  readonly roles: Role[] = ['Administrador', 'Gerente', 'Jefe de taller', 'Bodeguero', 'Trabajador', 'Compras'];
  readonly mainNav: NavItem[] = [
    { label: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard' },
    { label: 'Órdenes de trabajo', icon: 'ClipboardList', route: '/ordenes' },
    { label: 'Bodega y vales', icon: 'Warehouse', route: '/bodega' },
    { label: 'Inventario', icon: 'PackageSearch', route: '/inventario' },
    { label: 'Producción', icon: 'ChartGantt', route: '/produccion' },
    { label: 'Rentabilidad', icon: 'BadgeDollarSign', route: '/rentabilidad' },
  ];
  readonly secondaryNav: NavItem[] = [
    { label: 'Clientes y acuerdos', icon: 'Handshake', route: '/comercial' },
    { label: 'Histórico e informes', icon: 'FileChartColumn', route: '/informes' },
    { label: 'Centro de sincronización', icon: 'RefreshCw', route: '/sincronizacion' },
  ];
  readonly notifications = computed(() => this.store.state().audit.slice(0, 6));
  readonly guide = [
    { title: '1. Acuerdo comercial', text: 'Revisa la cotización aprobada por $3.000.000 netos antes del ingreso.', route: '/comercial' },
    { title: '2. Recepción', text: 'Confirma el ingreso ING-2026-0088 para la unidad ABCD45.', route: '/comercial' },
    { title: '3. Orden de trabajo', text: 'Abre OT-125 y revisa alcance, fechas y presupuesto inicial.', route: '/ordenes/ot-125' },
    { title: '4. Asignación', text: 'Comprueba que Jhony está asignado a preparación y lijado.', route: '/ordenes/ot-125' },
    { title: '5. Plan de materiales', text: 'Consulta cantidades previstas y entregadas por material.', route: '/ordenes/ot-125' },
    { title: '6. Solicitud', text: 'Abre la solicitud pendiente de 5 lijas P-120.', route: '/bodega' },
    { title: '7. Vale', text: 'Confirma el despacho y genera un vale imprimible.', route: '/bodega' },
    { title: '8. Exceso', text: 'Observa la alerta: el despacho supera el plan de 10 lijas.', route: '/bodega' },
    { title: '9. Devolución y transferencia', text: 'Prueba devolver o transferir material sin duplicar stock.', route: '/bodega' },
    { title: '10. Control económico', text: 'Verifica cómo cambió el costo y el margen proyectado.', route: '/rentabilidad' },
    { title: '11. Producción', text: 'Registra horas y actualiza el avance físico.', route: '/produccion' },
    { title: '12. Resultado final', text: 'Compara una OT rentable con otra que terminó con pérdida.', route: '/rentabilidad' },
  ];

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      this.sidebarOpen.set(false);
      const match = [...this.mainNav, ...this.secondaryNav].find((item) => this.router.url.startsWith(item.route));
      this.pageTitle.set(match?.label ?? 'FRAESPA');
    });
  }

  changeRole(role: Role): void { this.store.setRole(role); }
  startGuide(): void { this.guideStep.set(0); void this.router.navigateByUrl(this.guide[0].route); }
  stopGuide(): void { this.guideStep.set(-1); }
  moveGuide(delta: number): void {
    const next = this.guideStep() + delta;
    if (next < 0 || next >= this.guide.length) { this.stopGuide(); return; }
    this.guideStep.set(next);
    void this.router.navigateByUrl(this.guide[next].route);
  }
}
