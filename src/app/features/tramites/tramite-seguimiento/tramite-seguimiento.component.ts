import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentoService } from '../../../core/services/documento.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Tramite, Documento } from '../../../shared/models';
import { FormularioDinamicoComponent } from '../../../shared/components/formulario-dinamico/formulario-dinamico.component';

@Component({
  selector: 'app-tramite-seguimiento',
  imports: [RouterLink, FormsModule, SlicePipe, FormularioDinamicoComponent],
  templateUrl: './tramite-seguimiento.component.html',
  styleUrl: './tramite-seguimiento.component.css'
})
export class TramiteSeguimientoComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private docService = inject(DocumentoService);

  tramites = signal<Tramite[]>([]);
  totalPages = signal(1);
  currentPage = signal(0);
  loading = signal(true);
  error = signal('');
  filtroEstado = '';

  tramiteDocsAbierto = signal<string | null>(null);
  tramiteHistorialAbierto = signal<string | null>(null);
  docsDelTramite = signal<Documento[]>([]);
  cargandoDocsTramite = signal(false);
  actividadActiva = signal<any | null>(null);
  subiendoDocCliente = signal(false);
  errorSubidaCliente = signal('');
  generandoReporte = signal<string | null>(null);
  errorReporte = signal('');

  datosFormularioActiva: Record<string, any> = {};
  guardandoFormularioActiva = signal(false);
  errorFormularioActiva = signal('');
  exitoFormularioActiva = signal(false);

  readonly estados = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'RECHAZADO', 'CANCELADO'];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string | number> = { page: this.currentPage(), size: 10 };
    if (this.filtroEstado) params['estado'] = this.filtroEstado;

    const role = this.auth.getUserRole();
    const endpoint = role === 'CLIENTE' ? '/tramites/mis-tramites' : '/tramites';

    this.api.get<any>(endpoint, params).subscribe({
      next: res => {
        const content = Array.isArray(res) ? res : (res.content || []);
        const total = res.totalElements || content.length;
        const size = 10;
        this.tramites.set(content);
        this.totalPages.set(Math.max(1, Math.ceil(total / size)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar trámites');
        this.loading.set(false);
      }
    });
  }

  cambiarEstado(tramiteId: string, estado: string) {
    this.api.patch<Tramite>(`/tramites/${tramiteId}/estado`, { estado, comentario: '' }).subscribe({
      next: updated => this.tramites.update(list => list.map(t => t.id === updated.id ? updated : t)),
      error: () => this.error.set('Error al cambiar estado')
    });
  }

  eliminarTramite(id: string) {
    if (!confirm('¿Eliminar este trámite permanentemente?')) return;
    this.api.delete<void>(`/tramites/${id}`).subscribe({
      next: () => this.tramites.update(list => list.filter(t => t.id !== id)),
      error: () => this.error.set('Error al eliminar trámite')
    });
  }

  prevPage() { if (this.currentPage() > 0) { this.currentPage.update(p => p - 1); this.load(); } }
  nextPage() { if (this.currentPage() < this.totalPages() - 1) { this.currentPage.update(p => p + 1); this.load(); } }

  toggleHistorial(tramiteId: string, event: Event): void {
    event.stopPropagation();
    this.tramiteHistorialAbierto.set(this.tramiteHistorialAbierto() === tramiteId ? null : tramiteId);
  }

  iconoHistorialTramite(tipo: string): string {
    const iconos: Record<string, string> = {
      CREADO: '🆕', ASIGNADO: '👤', ESTADO_CAMBIADO: '🔁', ACTIVIDAD_AVANZO: '➡️',
    };
    return iconos[tipo] ?? '📋';
  }

  toggleDocsTramite(tramiteId: string, event: Event): void {
    event.stopPropagation();
    if (this.tramiteDocsAbierto() === tramiteId) {
      this.tramiteDocsAbierto.set(null);
      this.docsDelTramite.set([]);
      this.actividadActiva.set(null);
      this.errorSubidaCliente.set('');
      this.errorFormularioActiva.set('');
      return;
    }
    this.tramiteDocsAbierto.set(tramiteId);
    this.docsDelTramite.set([]);
    this.actividadActiva.set(null);
    this.errorSubidaCliente.set('');
    this.errorFormularioActiva.set('');
    this.cargandoDocsTramite.set(true);

    this.docService.getByTramite(tramiteId).subscribe({
      next: docs => { this.docsDelTramite.set(docs); this.cargandoDocsTramite.set(false); },
      error: () => this.cargandoDocsTramite.set(false),
    });

    if (this.auth.getUserRole() === 'CLIENTE') {
      this.cargarActividadActiva(tramiteId);
    }
  }

  /** Busca la actividad activa (pendiente/en proceso) del trámite para que el
   *  cliente pueda completar su formulario en pasos intermedios, no solo el
   *  paso inicial. Usa /actividades/tramite/{id} (lista completa con
   *  formularioDefinicion y datosFormulario), en vez de los campos
   *  `actividades`/`pasos` que Tramite no expone en /tramites/{id}. */
  private cargarActividadActiva(tramiteId: string): void {
    this.api.get<any[]>(`/actividades/tramite/${tramiteId}`).subscribe({
      next: actividades => {
        const activa = (actividades ?? [])
          .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
          .find((a: any) => a.estado === 'EN_PROCESO' || a.estado === 'PENDIENTE') ?? null;
        this.actividadActiva.set(activa);
        this.inicializarDatosFormularioActiva(activa);
      },
      error: () => {}
    });
  }

  private inicializarDatosFormularioActiva(actividad: any): void {
    this.datosFormularioActiva = {};
    if (!actividad?.formularioDefinicion) return;
    actividad.formularioDefinicion.forEach((c: any) => {
      if (c.tipo === 'LABEL') return;
      if (c.tipo === 'GRID') { this.datosFormularioActiva[c.id] = actividad.datosFormulario?.[c.id] ?? []; return; }
      this.datosFormularioActiva[c.id] = actividad.datosFormulario?.[c.id]
        ?? ((c.tipo === 'CHECKBOX' || c.tipo === 'BUTTON') ? false : '');
    });
  }

  tieneCampoFile(actividad: any): boolean {
    return !!actividad?.formularioDefinicion?.some((c: any) => c.tipo === 'FILE');
  }

  completarFormularioActiva(): void {
    const a = this.actividadActiva();
    if (!a) return;
    const camposRequeridos = (a.formularioDefinicion ?? []).filter((c: any) => c.requerido && c.tipo !== 'LABEL');
    for (const campo of camposRequeridos) {
      const val = this.datosFormularioActiva[campo.id];
      const faltante = campo.tipo === 'GRID'
        ? !Array.isArray(val) || val.length === 0
        : campo.tipo === 'BUTTON'
          ? val !== true
          : (val === '' || val === null || val === undefined);
      if (faltante) {
        this.errorFormularioActiva.set(`El campo "${campo.etiqueta}" es requerido`);
        return;
      }
    }
    this.errorFormularioActiva.set('');
    this.guardandoFormularioActiva.set(true);
    this.api.patch<any>(`/actividades/${a.id}/formulario`, this.datosFormularioActiva).subscribe({
      next: () => {
        this.guardandoFormularioActiva.set(false);
        this.exitoFormularioActiva.set(true);
        setTimeout(() => this.exitoFormularioActiva.set(false), 2500);
        this.cargarActividadActiva(a.tramiteId);
        this.load();
      },
      error: () => {
        this.errorFormularioActiva.set('Error al guardar el formulario');
        this.guardandoFormularioActiva.set(false);
      }
    });
  }

  generarReporte(t: Tramite, event: Event): void {
    event.stopPropagation();
    this.generandoReporte.set(t.id);
    this.errorReporte.set('');

    this.api.get<any>(`/tramites/${t.id}`).subscribe({
      next: tramiteDetalle => {
        const politicaId: string | null = tramiteDetalle.politicaId ?? null;
        const actividadesIds: string[] = tramiteDetalle.actividadesIds ?? [];

        const politica$ = politicaId
          ? this.api.get<any>(`/politicas/${politicaId}`)
          : of(null);

        const actividades$ = actividadesIds.length > 0
          ? forkJoin(actividadesIds.map((id: string) => this.api.get<any>(`/actividades/${id}`)))
          : of([]);

        const solicitante$ = this.api.get<any>(`/usuarios/${tramiteDetalle.usuarioSolicitanteId}`)
          .pipe(catchError(() => of(null)));

        forkJoin({ politica: politica$, actividades: actividades$, solicitante: solicitante$ }).subscribe({
          next: ({ politica, actividades, solicitante }: any) => {
            const actividadesMapeadas = (actividades ?? []).map((a: any) => ({
              nombre: a.nombre ?? 'Actividad',
              estado: a.estado ?? 'PENDIENTE',
              departamento: a.nombreDepartamento ?? a.departamento ?? null,
              responsable: a.responsableId ?? null,
              datosFormulario: a.datosFormulario ?? null,
            }));

            const payload = {
              tramiteId: t.id,
              titulo: t.titulo ?? 'Sin título',
              estado: t.estado,
              solicitante: solicitante?.username ?? solicitante?.nombre ?? t.usuarioSolicitanteId,
              fechaInicio: t.fechaInicio,
              fechaFin: (t as any).fechaFin ?? null,
              actividades: actividadesMapeadas,
              politicaNombre: politica?.nombre ?? null,
            };

            this.api.generarReporte(payload).subscribe({
              next: (res: any) => {
                if (res.pdf) {
                  const bytes = Uint8Array.from(atob(res.pdf), c => c.charCodeAt(0));
                  const blob = new Blob([bytes], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `reporte-${t.id.slice(-6)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
                if (res.audio) {
                  const audioBytes = Uint8Array.from(atob(res.audio), c => c.charCodeAt(0));
                  const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const audio = new Audio(audioUrl);
                  audio.play();
                  audio.onended = () => URL.revokeObjectURL(audioUrl);
                }
                this.generandoReporte.set(null);
              },
              error: () => {
                this.errorReporte.set('Error al generar reporte');
                this.generandoReporte.set(null);
              }
            });
          },
          error: () => {
            this.errorReporte.set('Error al cargar datos');
            this.generandoReporte.set(null);
          }
        });
      },
      error: () => {
        this.errorReporte.set('Error al cargar trámite');
        this.generandoReporte.set(null);
      }
    });
  }

  subirDocCliente(event: Event, tramiteId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const activa = this.actividadActiva();
    this.subiendoDocCliente.set(true);
    this.errorSubidaCliente.set('');
    this.docService.upload(file, undefined, tramiteId, activa?.id ?? undefined).subscribe({
      next: doc => {
        this.docsDelTramite.update(docs => [...docs, doc]);
        this.subiendoDocCliente.set(false);
        input.value = '';
      },
      error: () => {
        this.errorSubidaCliente.set('Error al subir el documento');
        this.subiendoDocCliente.set(false);
      }
    });
  }
}
