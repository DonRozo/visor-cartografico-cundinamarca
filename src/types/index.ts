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

// Estructura para almacenar los datos procesados del catálogo
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