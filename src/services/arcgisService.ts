import esriRequest from "@arcgis/core/request";
import { SEARCH_QUERY_URL } from "../config/constants";
import { CatalogResponse, ArcGISItem } from "../types";

// Consulta los ítems del grupo de ArcGIS Online
export async function fetchCatalogItems(): Promise<CatalogResponse> {
    try {
        const response = await esriRequest(SEARCH_QUERY_URL, { responseType: "json" });
        const allItems: ArcGISItem[] = response.data.results;
        
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

        return { data: { featureServices, gdbIdLookup }, error: false };
    } catch (error) {
        console.error("Error al buscar ítems en ArcGIS Online:", error);
        return { data: null, error: true };
    }
}