import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import esriRequest from "@arcgis/core/request";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

import Search from "@arcgis/core/widgets/Search";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import Measurement from "@arcgis/core/widgets/Measurement";
import Print from "@arcgis/core/widgets/Print";
import Expand from "@arcgis/core/widgets/Expand";
import LayerList from "@arcgis/core/widgets/LayerList";
import Legend from "@arcgis/core/widgets/Legend";
import Compass from "@arcgis/core/widgets/Compass";
import Home from "@arcgis/core/widgets/Home";
import Zoom from "@arcgis/core/widgets/Zoom";

import { PRINT_SERVICE_URL } from "../../config/constants";
import { ArcGISItem } from "../../types";

export function initializeMap(container: HTMLDivElement): { map: Map, view: MapView } {
    const map = new Map({ basemap: "topo-vector" });
    const view = new MapView({
        container: container,
        map: map,
        center: [-74.08175, 4.60971],
        zoom: 8,
        padding: { left: 360 },
        ui: { components: ["attribution"] }
    });

    // [CORRECCIÓN] Prevenimos duplicados visuales del widget de búsqueda.
    // React StrictMode en desarrollo puede ejecutar esta función dos veces.
    // Al inyectarse en un div externo al ciclo de vida del mapa, debemos limpiarlo manualmente.
    const searchContainer = document.getElementById("search-widget-container");
    if (searchContainer) {
        searchContainer.innerHTML = ""; // Limpiamos el HTML residual del montaje anterior
    }

    // Instanciamos el widget directamente sin asignarlo a una constante
    new Search({ view: view, container: "search-widget-container" });
    
    view.when(() => {
        const basemapGallery = new BasemapGallery({ view: view });
        const print = new Print({ view: view, printServiceUrl: PRINT_SERVICE_URL });
        const measurement = new Measurement({ view: view });
        const layerListWidget = new LayerList({ view: view });
        const legendWidget = new Legend({ view: view });
        const zoom = new Zoom({ view: view });
        const compass = new Compass({ view: view });
        const home = new Home({ view: view });

        view.ui.add(new Expand({ view: view, content: basemapGallery, expandIcon: "basemap" }), "top-right");
        view.ui.add(new Expand({ view: view, content: print, expandIcon: "print" }), "top-right");
        view.ui.add(measurement, "bottom-right");
        view.ui.add(new Expand({ view: view, content: layerListWidget, expandIcon: "layers" }), "top-left");
        view.ui.add(new Expand({ view: view, content: legendWidget, expandIcon: "legend" }), "top-left");
        view.ui.add(zoom, "top-left");
        view.ui.add(compass, "top-left");
        view.ui.add(home, "top-left");
    });

    return { map, view };
}

// Función auxiliar para hacer zoom de forma robusta a los datos reales
async function focusOnLayers(view: MapView, layers: FeatureLayer[]) {
    if (!layers || layers.length === 0) return;

    // Iteramos sobre las capas añadidas para intentar obtener el extent exacto de sus features
    for (const layer of layers) {
        try {
            await layer.when(); // Aseguramos que la capa esté inicializada
            
            // queryExtent() le pide al servidor la caja envolvente (bounding box) real de los datos
            const extentResponse = await layer.queryExtent();
            
            // Verificamos si la consulta devolvió resultados y un extent válido
            if (extentResponse && extentResponse.count > 0 && extentResponse.extent) {
                view.goTo(extentResponse.extent);
                return; // Zoom exitoso, salimos de la función
            }
        } catch (error) {
            console.warn(`No se pudo calcular el extent exacto para la capa ${layer.title}`);
        }
    }

    // Fallback: Si el queryExtent() falló en todas las capas (o no tienen datos),
    // aplicamos el fullExtent de la primera capa de forma segura
    const firstLayer = layers[0];
    if (firstLayer && firstLayer.fullExtent) {
        view.goTo(firstLayer.fullExtent);
    }
}

// Lógica de ArcGIS: Añade capas o hace zoom si ya existen
export async function addLayerToMap(map: Map, view: MapView, item: ArcGISItem) {
    // 1. Verificar si la capa ya existe
    const existingLayersCollection = map.layers.filter(lyr => (lyr as any).groupId === item.id);
    if (existingLayersCollection.length > 0) {
        // Obtenemos las capas existentes y aplicamos el zoom robusto
        const existingLayers = existingLayersCollection.toArray() as FeatureLayer[];
        focusOnLayers(view, existingLayers);
        return;
    }

    // 2. Inspeccionar servicio para añadir sub-capas si existen
    try {
        const serviceInfo = await esriRequest(item.url, { query: { f: "json" }, responseType: "json" });
        if (serviceInfo.data.layers && serviceInfo.data.layers.length > 0) {
            const layersToAdd = serviceInfo.data.layers.map((layerInfo: any) => {
                const fl = new FeatureLayer({
                    url: `${item.url}/${layerInfo.id}`,
                    title: layerInfo.name,
                    id: `${item.id}_${layerInfo.id}`
                });
                (fl as any).groupId = item.id;
                return fl;
            });
            map.addMany(layersToAdd);
            
            // Usar la nueva función para enfocar las subcapas
            focusOnLayers(view, layersToAdd);
        } else {
            const singleLayer = new FeatureLayer({
                url: item.url,
                id: item.id,
                title: item.title
            });
            (singleLayer as any).groupId = item.id;
            map.add(singleLayer);

            // Usar la nueva función para enfocar la capa única
            focusOnLayers(view, [singleLayer]);
        }
    } catch (err) {
        console.error("Error al añadir la capa:", err);
    }
}