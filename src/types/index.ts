// --- TIPOS ACTUALES DE LA APLICACIÓN (INTACTOS PARA COMPATIBILIDAD) ---

// Definición de las propiedades que nos interesan de un elemento de ArcGIS Online
export interface ArcGISItem {
    id: string;
    title: string;
    type: string;
    thumbnail?: string;
    snippet?: string;
    description?: string;
    url: string;
}

// Estructura para almacenar los datos procesados del catálogo actual
export interface CatalogData {
    featureServices: ArcGISItem[];
    // Mapa que asocia el nombre base del servicio con el ID de su Geodatabase de descarga
    gdbIdLookup: Map<string, string>;
}

// Interfaz para manejar la respuesta del servicio diferenciando errores de respuestas vacías
export interface CatalogResponse {
    data: CatalogData | null;
    error: boolean;
}

// Interfaz para el trigger que fuerza actualizaciones en el mapa
export interface LayerTrigger {
    item: ArcGISItem;
    timestamp: number;
}


// --- NUEVOS TIPOS: FASE PREPARATORIA PARA RESOLUCIÓN DE RECURSOS ---

// Definición estricta de los tipos técnicos de recursos que la arquitectura va a agrupar
export type ResourceType = "Feature Service" | "Vector Tile Service" | "File Geodatabase";

// Estructura de un "Dataset Lógico" que agrupa bajo un mismo concepto de negocio
// los diferentes recursos técnicos que estén disponibles en ArcGIS Online.
export interface LogicalDataset {
    // Identificador base único del dataset (ej. el nombre del servicio sin sufijos _gdb o _vt)
    baseId: string;
    
    // Metadatos consolidados para renderizar en la UI de la tarjeta y el detalle.
    // Generalmente se heredarán del recurso principal disponible (ej. Feature Service).
    title: string;
    snippet?: string;
    description?: string;
    thumbnail?: string;

    // Slots opcionales para almacenar la referencia al recurso técnico específico
    // si el servicio fue encontrado durante la consulta a ArcGIS Online.
    featureService?: ArcGISItem;
    vectorTile?: ArcGISItem;
    fileGeodatabase?: ArcGISItem;
}