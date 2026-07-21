export type Rol = 'ADMIN' | 'FUNCIONARIO' | 'CLIENTE';

export type EstadoTramite = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'RECHAZADO' | 'CANCELADO';

export interface Usuario {
  id: string;
  username: string;
  email: string;
  roles: string[];
  activo: boolean;
  fechaCreacion?: string;
  departamentoId?: string;
  nombreDepartamento?: string;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export type TipoCampoFormulario =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'FILE'
  | 'LABEL' | 'BUTTON' | 'GRID' | 'DECISION';

export interface ColumnaGrid {
  id: string;
  etiqueta: string;
  tipo: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  opciones?: string[];
}

export interface CampoFormulario {
  id: string;
  etiqueta: string;
  tipo: TipoCampoFormulario;
  requerido: boolean;
  opciones?: string[];
  valor?: string;
  columnas?: ColumnaGrid[]; // solo para tipo GRID
}

export interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface PasoWorkflow {
  orden: number;
  nombre: string;
  descripcion: string;
  rolRequerido: string;
  departamentoId?: string;
  nombreDepartamento?: string;
  obligatorio: boolean;
  formulario?: CampoFormulario[];
}

export interface PrivilegiosPN {
  verDocumentos: string[];
  subirDocumentos: string[];
  eliminarDocumentos: string[];
  aprobar: string[];
}

export interface Politica {
  id: string;
  nombre: string;
  descripcion: string;
  pasos: PasoWorkflow[];
  activa: boolean;
  creadoPor?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  diagramJson?: string;
  privilegios?: PrivilegiosPN;
}

export interface Tramite {
  id: string;
  titulo: string;
  descripcion: string;
  politicaId: string;
  usuarioSolicitanteId: string;
  usuarioAsignadoId?: string;
  estado: EstadoTramite;
  datos?: Record<string, any>;
  comentarios?: string;
  actividadesIds?: string[];
  fechaInicio: string;
  fechaFin?: string;
  fechaActualizacion?: string;
  historial?: EntradaHistorialTramite[];
}

export interface EntradaHistorialTramite {
  tipo: string;
  autorId?: string;
  descripcion: string;
  fecha: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiError {
  status: number;
  mensaje: string;
  timestamp: string;
}

export interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  url: string;
  gcsPath: string;
  size: number;
  subidoPor: string;
  politicaId?: string;
  tramiteId?: string;
  actividadId?: string;
  fechaSubida: string;
  version?: number;
  documentoRaizId?: string;
  vigente?: boolean;
}
