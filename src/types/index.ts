// --- TIPOS ACTUALES DE LA APLICACIÓN (INTACTOS PARA COMPATIBILIDAD) ---

export interface ArcGISItem {
    id: string;
    title: string;
    type: string;
    thumbnail?: string;
    snippet?: string;
    description?: string;
    url: string;
}

export interface CatalogData {
    featureServices: ArcGISItem[];
    gdbIdLookup: Map<string, string>;
    logicalDatasets?: LogicalDataset[];
}

export interface CatalogResponse {
    data: CatalogData | null;
    error: boolean;
}

export interface LayerTrigger {
    item: ArcGISItem;
    timestamp: number;
}

// --- NUEVOS TIPOS: FASE PREPARATORIA PARA RESOLUCIÓN DE RECURSOS ---
export type ResourceType = "Feature Service" | "Vector Tile Service" | "File Geodatabase";

export interface LogicalDataset {
    baseId: string;
    title: string;
    snippet?: string;
    description?: string;
    thumbnail?: string;
    featureService?: ArcGISItem;
    vectorTile?: ArcGISItem;
    fileGeodatabase?: ArcGISItem;
}

// [NUEVO] Interfaz para empaquetar y transferir los widgets nativos hacia React
export interface MapWidgets {
    layerList: __esri.LayerList;
    legend: __esri.Legend;
    basemapGallery: __esri.BasemapGallery;
    print: __esri.Print;
    measurement: __esri.Measurement;
    sketch: __esri.Sketch;
}