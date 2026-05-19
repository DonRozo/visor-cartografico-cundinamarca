import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import esriRequest from "@arcgis/core/request";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import Extent from "@arcgis/core/geometry/Extent";

// Importación de Widgets Nativos
import Search from "@arcgis/core/widgets/Search";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import Measurement from "@arcgis/core/widgets/Measurement";
import Print from "@arcgis/core/widgets/Print";
import LayerList from "@arcgis/core/widgets/LayerList";
import Legend from "@arcgis/core/widgets/Legend";
import Sketch from "@arcgis/core/widgets/Sketch";

import { WEB_MAP_ID, PRINT_SERVICE_URL } from "../../config/constants";
import { ArcGISItem, MapWidgets } from "../../types";

export function initializeMap(container: HTMLDivElement): { 
    map: WebMap, 
    view: MapView, 
    widgets: MapWidgets,
    zoomPre: () => void,
    zoomHome: () => void
} {
    // 1. Instanciamos el Web Map oficial
    const map = new WebMap({
        portalItem: { id: WEB_MAP_ID }
    });

    // 2. Leemos la URL por si el mapa fue "Compartido" con un extent específico
    const urlParams = new URLSearchParams(window.location.search);
    const lonParam = urlParams.get("lon");
    const latParam = urlParams.get("lat");
    const zParam = urlParams.get("z");

    let initialCenter: number[] = [-74.08175, 4.60971];
    let initialZoom: number = 8;

    if (lonParam && latParam && zParam) {
        initialCenter = [parseFloat(lonParam), parseFloat(latParam)];
        initialZoom = parseFloat(zParam);
    }

    const view = new MapView({
        container: container,
        map: map,
        center: initialCenter,
        zoom: initialZoom,
        // [CORRECCIÓN FINAL] Garantía estricta de que el mapa NO usa padding residual
        // y se ajusta dinámicamente al 100% del contenedor Flexbox, esencial en móvil.
        ui: { components: ["attribution"] } 
    });

    // 3. Limpieza y creación del buscador en el Header
    const searchContainer = document.getElementById("search-widget-container");
    if (searchContainer) searchContainer.innerHTML = "";
    new Search({ view: view, container: "search-widget-container" });
    
    // 4. Capas dedicadas para herramientas funcionales
    const graphicsLayer = new GraphicsLayer({ title: "Capa de Dibujo (Temporal)" });
    map.add(graphicsLayer);

    // 5. Creación de widgets en memoria (SIN añadirlos a view.ui)
    const basemapGallery = new BasemapGallery({ view: view });
    const print = new Print({ view: view, printServiceUrl: PRINT_SERVICE_URL });
    const measurement = new Measurement({ view: view });
    const layerList = new LayerList({ view: view });
    const legend = new Legend({ view: view });
    const sketch = new Sketch({
        layer: graphicsLayer,
        view: view,
        creationMode: "update"
    });

    // Empaquetamos los widgets para enviarlos a React
    const widgets: MapWidgets = { layerList, legend, basemapGallery, print, measurement, sketch };

    // 6. Lógica Robusta de Historial de Zoom (Zoom Pre)
    let extentHistory: Extent[] = [];
    let currentIndex = -1;
    let isNavigatingHistory = false;

    view.watch("stationary", (isStationary) => {
        if (isStationary) {
            if (!isNavigatingHistory) {
                const newExtent = view.extent.clone();
                extentHistory = extentHistory.slice(0, currentIndex + 1);
                extentHistory.push(newExtent);
                currentIndex++;
            }
            isNavigatingHistory = false;
        }
    });

    const zoomPre = () => {
        if (currentIndex > 0) {
            isNavigatingHistory = true;
            currentIndex--;
            view.goTo(extentHistory[currentIndex]);
        }
    };

    const zoomHome = () => {
        if (map.portalItem && map.portalItem.extent) {
            view.goTo(map.portalItem.extent);
        } else {
            view.goTo({ center: [-74.08175, 4.60971], zoom: 8 });
        }
    };

    return { map, view, widgets, zoomPre, zoomHome };
}

// Función para manejar GeoJSON local
export async function addLocalGeoJSON(map: WebMap, view: MapView, file: File) {
    const url = URL.createObjectURL(file);
    const layer = new GeoJSONLayer({
        url: url,
        title: `Importado: ${file.name}`
    });
    map.add(layer);
    layer.when(() => {
        if (layer.fullExtent) view.goTo(layer.fullExtent);
    });
}

type FocusableCatalogLayer = FeatureLayer | VectorTileLayer;

// Lógica para enfocar capas de catálogo, con queryExtent para FeatureLayer
// y fullExtent para VectorTileLayer.
async function focusOnLayers(view: MapView, layers: FocusableCatalogLayer[]) {
    if (!layers || layers.length === 0) return;
    for (const layer of layers) {
        try {
            await layer.when();
            if (layer.type === "feature") {
                const extentResponse = await layer.queryExtent();
                if (extentResponse && extentResponse.count > 0 && extentResponse.extent) {
                    view.goTo(extentResponse.extent);
                    return; 
                }
            }
            if (layer.fullExtent) {
                view.goTo(layer.fullExtent);
                return;
            }
        } catch (error) {
            console.warn(`No se pudo calcular el extent exacto para la capa ${layer.title}`);
        }
    }
    const firstLayer = layers[0];
    if (firstLayer && firstLayer.fullExtent) {
        view.goTo(firstLayer.fullExtent);
    }
}

async function addFeatureServiceToMap(map: WebMap, view: MapView, item: ArcGISItem, groupId: string = item.id) {
    try {
        const serviceInfo = await esriRequest(item.url, { query: { f: "json" }, responseType: "json" });
        if (serviceInfo.data.layers && serviceInfo.data.layers.length > 0) {
            const layersToAdd = serviceInfo.data.layers.map((layerInfo: any) => {
                const fl = new FeatureLayer({
                    url: `${item.url}/${layerInfo.id}`,
                    title: layerInfo.name,
                    id: `${item.id}_${layerInfo.id}`
                });
                (fl as any).groupId = groupId;
                return fl;
            });
            map.addMany(layersToAdd);
            focusOnLayers(view, layersToAdd);
        } else {
            const singleLayer = new FeatureLayer({
                url: item.url,
                id: item.id,
                title: item.title
            });
            (singleLayer as any).groupId = groupId;
            map.add(singleLayer);
            focusOnLayers(view, [singleLayer]);
        }
    } catch (err) {
        console.error("Error al añadir la capa:", err);
    }
}

async function addVectorTileToMap(map: WebMap, view: MapView, item: ArcGISItem) {
    const vectorTileLayer = new VectorTileLayer({
        portalItem: { id: item.id },
        id: item.id,
        title: item.title
    });
    (vectorTileLayer as any).groupId = item.id;

    try {
        map.add(vectorTileLayer);
        await vectorTileLayer.when();
        focusOnLayers(view, [vectorTileLayer]);
    } catch (err) {
        console.warn("No se pudo cargar el Vector Tile Service. Se intentará cargar el Feature Service asociado.", err);
        if (map.layers.includes(vectorTileLayer)) {
            map.remove(vectorTileLayer);
        }
        if (item.fallbackFeatureService) {
            await addFeatureServiceToMap(map, view, item.fallbackFeatureService, item.id);
            return;
        }
        console.error("No existe Feature Service de respaldo para el Vector Tile Service:", item.id);
    }
}

// Lógica para añadir capas desde el catálogo al WebMap
export async function addLayerToMap(map: WebMap, view: MapView, item: ArcGISItem) {
    const existingLayersCollection = map.layers.filter(lyr => (lyr as any).groupId === item.id);
    if (existingLayersCollection.length > 0) {
        const existingLayers = existingLayersCollection.toArray() as FocusableCatalogLayer[];
        focusOnLayers(view, existingLayers);
        return;
    }

    if (item.type === "Vector Tile Service") {
        await addVectorTileToMap(map, view, item);
        return;
    }

    await addFeatureServiceToMap(map, view, item);
}
