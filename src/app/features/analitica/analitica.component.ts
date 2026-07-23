import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import {
  LucideBarChart3, LucideClock, LucideCircleCheck, LucideOctagonAlert, LucideTriangleAlert,
  LucideBot, LucideTrendingUp, LucideLightbulb, LucideTarget
} from '@lucide/angular';

interface CuelloBotella {
  nombreActividad: string;
  departamento: string;
  actividadesActivas: number;
  duracionPromedioHoras: number;
  esperaPromedioActivasHoras: number;
  indiceCuello: number;
  nivel: 'MEDIO' | 'ALTO';
}

interface Analitica {
  totalTramites: number;
  tramitesPorEstado: Record<string, number>;
  totalActividades: number;
  actividadesPorEstado: Record<string, number>;
  actividadesPorDepartamento: Record<string, number>;
  duracionPromedioHoras: number;
  tramitesUltimos7Dias: number;
  cuellosBotella: CuelloBotella[];
}

interface TFTiempo { tiempo_estimado_horas: number; }
interface TFAnomalia { es_anomalia: boolean; score: number; mensaje: string; }
interface TFExito { probabilidad: number; recomendacion: string; }

interface CuelloBotellaIA { tramite: string; nivel: string; motivo: string; impacto: string; recomendacion: string; }

@Component({
  selector: 'app-analitica',
  standalone: true,
  imports: [
    DecimalPipe, LucideBarChart3, LucideClock, LucideCircleCheck, LucideOctagonAlert, LucideTriangleAlert,
    LucideBot, LucideTrendingUp, LucideLightbulb, LucideTarget
  ],
  templateUrl: './analitica.component.html',
  styleUrl: './analitica.component.css'
})
export class AnaliticaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  error = signal('');
  data = signal<Analitica | null>(null);
  tfTiempo = signal<TFTiempo | null>(null);
  tfAnomalia = signal<TFAnomalia | null>(null);
  tfExito = signal<TFExito | null>(null);
  loadingTF = signal(true);

  cuellosIA = signal<Record<string, CuelloBotellaIA>>({});
  loadingCuellosIA = signal(false);

  readonly estadoColores: Record<string, string> = {
    PENDIENTE:   'var(--color-warning)',
    EN_PROCESO:  'var(--color-info)',
    COMPLETADO:  'var(--color-success)',
    RECHAZADO:   'var(--color-error)',
    CANCELADO:   'var(--color-text-tertiary)',
    OMITIDO:     'var(--color-text-tertiary)',
  };

  ngOnInit() {
    this.api.getAnalitica().subscribe({
      next: (res: any) => {
        this.data.set(res);
        this.loading.set(false);
        this.enriquecerCuellosConIA(res?.cuellosBotella ?? []);
      },
      error: () => {
        this.error.set('Error al cargar analítica. Verifica que tienes permisos de administrador.');
        this.loading.set(false);
      }
    });

    forkJoin({
      tiempo: this.api.predecirTiempoTF({ orden: 2, num_campos: 3, hora: new Date().getHours(), dia: new Date().getDay() }).pipe(catchError(() => of(null))),
      anomalia: this.api.detectarAnomaliaTF({ tiempo_actual: this.data()?.duracionPromedioHoras ?? 4, tiempo_esperado: 4 }).pipe(catchError(() => of(null))),
      exito: this.api.predecirExitoTF({ orden_actual: 2, total_actividades: 4, completadas: this.data()?.totalActividades ?? 0 }).pipe(catchError(() => of(null)))
    }).subscribe(results => {
      if (results.tiempo) this.tfTiempo.set(results.tiempo as TFTiempo);
      if (results.anomalia) this.tfAnomalia.set(results.anomalia as TFAnomalia);
      if (results.exito) this.tfExito.set(results.exito as TFExito);
      this.loadingTF.set(false);
    });
  }

  /** Enriquece los cuellos de botella (ya calculados por el backend Java a
   *  partir de datos reales) con motivos/recomendaciones narrativas del
   *  microservicio de IA. Es una mejora opcional: si el servicio de IA no
   *  está disponible o no tiene API key configurada, la sección de cuellos
   *  de botella sigue mostrando los datos duros igual, sin este enriquecimiento. */
  private enriquecerCuellosConIA(cuellos: CuelloBotella[]): void {
    if (!cuellos.length) return;
    this.loadingCuellosIA.set(true);
    const payload = {
      tramites: cuellos.map(c => ({
        nombre: c.nombreActividad,
        duracion_promedio_horas: c.duracionPromedioHoras,
        cantidad_instancias: c.actividadesActivas,
        tasa_rechazo: 0,
        responsable: c.departamento,
      })),
      periodo_dias: 30,
    };
    this.api.analizarCuellosBotellaIA(payload).subscribe({
      next: (res: any) => {
        const mapa: Record<string, CuelloBotellaIA> = {};
        (res?.cuellos_de_botella ?? []).forEach((c: CuelloBotellaIA) => { mapa[c.tramite] = c; });
        this.cuellosIA.set(mapa);
        this.loadingCuellosIA.set(false);
      },
      error: () => this.loadingCuellosIA.set(false)
    });
  }

  entries(obj: Record<string, number> | undefined): [string, number][] {
    if (!obj) return [];
    return Object.entries(obj);
  }

  maxValue(obj: Record<string, number> | undefined): number {
    if (!obj) return 1;
    return Math.max(...Object.values(obj), 1);
  }

  barWidth(value: number, max: number): number {
    return Math.round((value / max) * 100);
  }

  departamentosCuello(obj: Record<string, number> | undefined): [string, number][] {
    if (!obj) return [];
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }
}
