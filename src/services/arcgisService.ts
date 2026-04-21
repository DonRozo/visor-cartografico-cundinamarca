import esriRequest from "@arcgis/core/request";
import { SEARCH_QUERY_URL } from "../config/constants";
// [ADITIVO] Importamos el nuevo tipo LogicalDataset preparado en la fase anterior
import { CatalogResponse, ArcGISItem, LogicalDataset } from "../types";

// [NUEVO] Función auxiliar para agrupar recursos técnicos en Datasets Lógicos.
// Se deja preparada de forma aditiva para la próxima fase de la UI.
export function buildLogicalDatasets(items: ArcGISItem[]): LogicalDataset[] {
    const datasetMap = new Map<string, LogicalDataset>();

    items.forEach(item => {
        let baseName = item.title;
        
        // Heurística conservadora para deducir el nombre base del dataset
        // Eliminamos los sufijos técnicos para agrupar recursos bajo el mismo nombre
        if (item.type === "File Geodatabase" && item.title.endsWith("_gdb")) {
            baseName = item.title.slice(0, -4);
        } else if (item.type === "Vector Tile Service" && item.title.endsWith("_vt")) {
            baseName = item.title.slice(0, -3);
        }

        // Inicializamos el dataset lógico si aún no existe en nuestro diccionario
        if (!datasetMap.has(baseName)) {
            datasetMap.set(baseName, {
                baseId: baseName,
                title: baseName // Título inicial, se sobreescribirá con los metadatos del recurso
            });
        }

        const logicalDataset = datasetMap.get(baseName)!;

        // Asignamos el recurso a su slot correspondiente y heredamos metadatos hacia el grupo
        if (item.type === "Feature Service") {
            logicalDataset.featureService = item;
            // El Feature Service suele tener los metadatos más completos, lo priorizamos
            logicalDataset.title = item.title;
            logicalDataset.snippet = item.snippet || logicalDataset.snippet;
            logicalDataset.description = item.description || logicalDataset.description;
            logicalDataset.thumbnail = item.thumbnail || logicalDataset.thumbnail;
            
        } else if (item.type === "Vector Tile Service") {
            logicalDataset.vectorTile = item;
            // Fallback: si no hay metadatos previos, los tomamos del Vector Tile
            logicalDataset.snippet = logicalDataset.snippet || item.snippet;
            logicalDataset.description = logicalDataset.description || item.description;
            logicalDataset.thumbnail = logicalDataset.thumbnail || item.thumbnail;
            
        } else if (item.type === "File Geodatabase") {
            logicalDataset.fileGeodatabase = item;
            // Las GDBs rara vez tienen metadatos descriptivos limpios, así que solo la enlazamos
        }
    });

    // Retornamos el diccionario convertido en un arreglo limpio de datasets
    return Array.from(datasetMap.values());
}

// Consulta los ítems del grupo de ArcGIS Online
export async function fetchCatalogItems(): Promise<CatalogResponse> {
    try {
        const response = await esriRequest(SEARCH_QUERY_URL, { responseType: "json" });
        const allItems: ArcGISItem[] = response.data.results;
        
        // [ADITIVO] Ejecutamos la agrupación lógica en memoria para validar que funcione.
        // En la siguiente fase, se exportará o se incluirá en el retorno público.
        void buildLogicalDatasets(allItems);
        
        // [COMPATIBILIDAD] Mantenemos la estructura original exacta que App.tsx espera hoy
        const gdbIdLookup = new Map<string, string>();
        const featureServices: ArcGISItem[] = [];

        allItems.forEach(item => {
            // Identificamos las GDBs por su sufijo
            if (item.type === "File Geodatabase" && item.title.endsWith("_gdb")) {
                const baseName = item.title.slice(0, -4);
                gdbIdLookup.set(baseName, item.id);
            }
            if (item.type === "Feature Service") {
                featureServices.push(item);
            }
        });

        // Retornamos estrictamente lo requerido por CatalogResponse para no romper la app pública
        return { data: { featureServices, gdbIdLookup }, error: false };
    } catch (error) {
        console.error("Error al buscar ítems en ArcGIS Online:", error);
        return { data: null, error: true };
    }
}