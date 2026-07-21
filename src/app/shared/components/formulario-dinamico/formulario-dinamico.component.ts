import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NlpService } from '../../../core/services/nlp.service';
import { CampoFormulario } from '../../models';

/**
 * Renderiza un formulario dinamico a partir de una definicion de campos
 * (CampoFormulario[]) e incluye el bloque "Completar con IA". Componente
 * compartido para no triplicar esta logica entre monitor (funcionario/admin),
 * tramite-iniciar (paso inicial del cliente) y tramite-seguimiento (pasos
 * intermedios del cliente).
 *
 * El objeto `datos` se muta directamente (no se usa two-way binding con
 * evento) porque el padre siempre lo pasa por referencia y ya lo envia tal
 * cual al backend al completar la actividad.
 */
@Component({
  selector: 'app-formulario-dinamico',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './formulario-dinamico.component.html',
  styleUrl: './formulario-dinamico.component.css',
})
export class FormularioDinamicoComponent {
  private nlp = inject(NlpService);

  @Input() campos: CampoFormulario[] = [];
  @Input() datos: Record<string, any> = {};
  @Input() soloLectura = false;
  @Input() mostrarIA = true;
  @Output() datosCambiaron = new EventEmitter<void>();

  descripcionDatosIA = '';
  cargandoDatosIA = signal(false);
  errorDatosIA = signal('');
  exitoDatosIA = signal(false);

  private readonly TIPOS_EXTRAIBLES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX'];

  agregarFilaGrid(campo: CampoFormulario): void {
    if (!this.datos[campo.id]) this.datos[campo.id] = [];
    const fila: Record<string, any> = {};
    (campo.columnas ?? []).forEach(col => fila[col.id] = '');
    this.datos[campo.id].push(fila);
    this.datosCambiaron.emit();
  }

  eliminarFilaGrid(campo: CampoFormulario, index: number): void {
    this.datos[campo.id]?.splice(index, 1);
    this.datosCambiaron.emit();
  }

  onCampoChange(): void {
    this.datosCambiaron.emit();
  }

  completarDatosConIA(): void {
    if (!this.descripcionDatosIA.trim()) return;
    const campos = this.campos
      .filter(c => this.TIPOS_EXTRAIBLES.includes(c.tipo))
      .map(c => ({ id: c.id, etiqueta: c.etiqueta, tipo: c.tipo, opciones: c.opciones }));
    if (campos.length === 0) return;
    this.cargandoDatosIA.set(true);
    this.errorDatosIA.set('');
    this.exitoDatosIA.set(false);
    this.nlp.extraerDatosFormulario(this.descripcionDatosIA, campos).subscribe({
      next: (res: any) => {
        const campoPorId = new Map(campos.map(c => [c.id, c]));
        Object.entries(res.datos ?? {}).forEach(([id, valor]) => {
          const campo = campoPorId.get(id);
          if (!campo) return;
          if (campo.tipo === 'SELECT' && !campo.opciones?.includes(valor as string)) return;
          if (campo.tipo === 'CHECKBOX') { this.datos[id] = valor === true || valor === 'true'; return; }
          this.datos[id] = valor;
        });
        this.cargandoDatosIA.set(false);
        this.exitoDatosIA.set(true);
        this.datosCambiaron.emit();
        setTimeout(() => this.exitoDatosIA.set(false), 2500);
      },
      error: (err: any) => {
        this.errorDatosIA.set(err?.error?.detail ?? 'Error al extraer datos con IA');
        this.cargandoDatosIA.set(false);
      }
    });
  }
}
