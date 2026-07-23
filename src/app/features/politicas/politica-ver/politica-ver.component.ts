import { Component, OnInit, OnDestroy, AfterViewInit, signal, inject, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ColaboracionService } from '../../../core/services/colaboracion.service';
import { Subscription } from 'rxjs';

interface DiagramNode { id: string; type: string; label: string; x: number; y: number; lane: string; }
interface DiagramConnection { from: string; to: string; }
interface DiagramLane { id: string; nombre: string; color: string; departamentoId?: string; }
interface DiagramData { lanes: DiagramLane[]; nodes: DiagramNode[]; connections: DiagramConnection[]; }

const LANE_HEIGHT = 160;

const LANE_COLORS = [
  'rgba(59,130,246,0.24)',
  'rgba(34,197,94,0.24)',
  'rgba(245,158,11,0.24)',
  'rgba(168,85,247,0.24)',
  'rgba(244,63,94,0.24)',
  'rgba(6,182,212,0.24)',
];

@Component({
  selector: 'app-politica-ver',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="ver-page">
  <div class="ver-header">
    <a routerLink="/politicas" class="btn-back">← Volver a Políticas</a>
    <div class="ver-title">
      <h1>{{ nombre() }}</h1>
      @if (descripcion()) { <span class="ver-desc">{{ descripcion() }}</span> }
    </div>
    <div class="ws-status">
      <span class="dot" [class.online]="colab.connected()"></span>
      {{ colab.connected() ? 'Colaboración activa' : 'Solo lectura' }}
    </div>
  </div>
  @if (error()) { <div class="error-bar">{{ error() }}</div> }
  @if (loading()) {
    <p class="loading-msg">Cargando diagrama...</p>
  } @else {
    <div class="canvas-wrap" #canvasWrap>
      <div class="diag-canvas" [style.height.px]="canvasHeight()">
        <svg class="svg-layer" #svgLayer [attr.height]="canvasHeight()"></svg>
        @for (lane of lanes(); track lane.id; let i = $index) {
          <div class="lane"
            [style.top.px]="i * LANE_HEIGHT"
            [style.height.px]="LANE_HEIGHT"
            [style.background]="lane.color">
            <div class="lane-label-wrap">
              <span class="lane-label">{{ lane.nombre }}</span>
            </div>
          </div>
        }
        @for (node of nodes(); track node.id) {
          <div [class]="'node node-' + node.type"
               [style.left.px]="node.x"
               [style.top.px]="node.y">
            @if (node.type === 'decision') {
              <span class="decision-label">{{ node.label || '?' }}</span>
            } @else if (node.type === 'fork' || node.type === 'join') {
              <span class="forkjoin-label">{{ node.type === 'fork' ? 'FORK' : 'JOIN' }}</span>
            } @else if (node.type !== 'inicio' && node.type !== 'fin') {
              {{ node.label }}
            }
          </div>
        }
      </div>
    </div>
  }
</div>
  `,
  styles: [`
.ver-page { display:flex; flex-direction:column; height:100vh; overflow:hidden; font-family:var(--font-sans,sans-serif); }
.ver-header { display:flex; align-items:center; gap:12px; padding:10px 16px; background:var(--color-primary-500); color:#fff; flex-wrap:wrap; }
.ver-title { flex:1; display:flex; flex-direction:column; gap:2px; }
.ver-title h1 { margin:0; font-size:15px; font-weight:500; color:#fff; }
.ver-desc { font-size:12px; opacity:0.75; }
.btn-back { color:#fff; text-decoration:none; font-size:13px; opacity:0.8; white-space:nowrap; }
.ws-status { display:flex; align-items:center; gap:6px; font-size:0.82rem; opacity:0.85; }
.dot { width:8px; height:8px; border-radius:50%; background:var(--color-border); }
.dot.online { background:var(--color-success); }
.error-bar { background:var(--color-error-bg); color:var(--color-error); padding:6px 16px; font-size:13px; }
.loading-msg { padding:40px; text-align:center; color:var(--color-text-tertiary); }
.canvas-wrap { flex:1; overflow:auto; background:var(--color-bg-page); }
.diag-canvas { position:relative; width:1100px; }
.svg-layer { position:absolute; top:0; left:0; width:100%; pointer-events:none; z-index:5; }
.lane { position:absolute; left:0; right:0; border-bottom:1px solid var(--color-border); box-sizing:border-box; }
.lane-label-wrap { position:absolute; left:0; top:0; width:90px; height:100%; display:flex; align-items:center; justify-content:center; border-right:1px solid var(--color-border); padding:4px; }
.lane-label { font-size:11px; font-weight:500; color:var(--color-text-primary); text-align:center; word-break:break-word; }
.node { position:absolute; display:flex; align-items:center; justify-content:center; text-align:center; font-size:11px; font-weight:500; z-index:10; user-select:none; }
.node-inicio { width:32px; height:32px; border-radius:50%; background:var(--color-success); color:#fff; }
.node-fin { width:32px; height:32px; border-radius:50%; background:var(--color-primary-700); border:3px solid var(--color-border); }
.node-actividad { width:120px; height:44px; border-radius:8px; background:var(--color-surface); border:1.5px solid var(--color-primary-500); color:var(--color-primary-600); padding:4px 8px; word-break:break-word; }
.node-decision { width:56px; height:56px; background:var(--color-surface); border:1.5px solid var(--color-warning); transform:rotate(45deg); }
.node-fork, .node-join { width:90px; height:16px; background:var(--color-primary-700); border-radius:2px; }
.forkjoin-label { color:#fff; font-size:9px; letter-spacing:1px; font-weight:700; }
.decision-label { display:block; transform:rotate(-45deg); font-size:10px; color:var(--color-warning-dark); }
  `]
})
export class PoliticaVerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('svgLayer') svgLayerRef!: ElementRef<SVGElement>;

  private route = inject(ActivatedRoute);
  protected colab = inject(ColaboracionService);

  readonly LANE_HEIGHT = LANE_HEIGHT;

  nombre = signal('');
  descripcion = signal('');
  loading = signal(true);
  error = signal('');
  lanes = signal<DiagramLane[]>([]);
  nodes = signal<DiagramNode[]>([]);
  connections = signal<DiagramConnection[]>([]);

  private politicaId: string | null = null;
  private sub?: Subscription;

  canvasHeight() { return this.lanes().length * LANE_HEIGHT; }

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    const id = this.route.snapshot.paramMap.get('id');

    if (token) {
      this.colab.obtenerPorToken(token).subscribe({
        next: p => { this.cargarDiagrama(p); this.conectarColab(p.id); },
        error: () => { this.error.set('Enlace inválido o expirado'); this.loading.set(false); }
      });
    } else if (id) {
      this.politicaId = id;
      this.colab['api'].get<any>(`/politicas/${id}`).subscribe({
        next: p => { this.cargarDiagrama(p); this.conectarColab(id); },
        error: () => { this.error.set('Error al cargar política'); this.loading.set(false); }
      });
    }
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderConnections(), 200);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.colab.desconectar();
  }

  private cargarDiagrama(p: any) {
    this.nombre.set(p.nombre);
    this.descripcion.set(p.descripcion || '');
    if (p.diagramJson) {
      try {
        const data: DiagramData = JSON.parse(p.diagramJson);
        this.lanes.set((data.lanes ?? []).map((l, i) => ({ ...l, color: LANE_COLORS[i % LANE_COLORS.length] })));
        this.nodes.set(data.nodes ?? []);
        this.connections.set(data.connections ?? []);
      } catch {}
    }
    this.loading.set(false);
    setTimeout(() => this.renderConnections(), 100);
  }

  private conectarColab(id: string) {
    this.politicaId = id;
    this.colab.conectar(id);
    this.sub = this.colab.cambios$.subscribe(data => {
      if (data.lanes) this.lanes.set(data.lanes);
      if (data.nodes) this.nodes.set(data.nodes);
      if (data.connections) this.connections.set(data.connections);
      setTimeout(() => this.renderConnections(), 50);
    });
  }

  private renderConnections() {
    const svg = this.svgLayerRef?.nativeElement;
    if (!svg) return;
    const nodes = this.nodes();
    const getW = (n: DiagramNode) => n.type === 'actividad' ? 120 : n.type === 'decision' ? 56 : (n.type === 'fork' || n.type === 'join') ? 90 : 32;
    const getH = (n: DiagramNode) => n.type === 'actividad' ? 44 : n.type === 'decision' ? 56 : (n.type === 'fork' || n.type === 'join') ? 16 : 32;
    svg.innerHTML = '<defs><marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--color-primary-500)"/></marker></defs>';
    this.connections().forEach(c => {
      const fn = nodes.find(n => n.id === c.from);
      const tn = nodes.find(n => n.id === c.to);
      if (!fn || !tn) return;
      const x1 = fn.x + getW(fn) / 2, y1 = fn.y + getH(fn) / 2;
      const x2 = tn.x + getW(tn) / 2, y2 = tn.y + getH(tn) / 2;
      const mx = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute('stroke', 'var(--color-primary-500)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#arr)');
      svg.appendChild(path);
    });
  }
}
