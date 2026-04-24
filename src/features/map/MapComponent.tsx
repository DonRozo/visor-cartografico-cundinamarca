import React, { useEffect, useRef, useState } from 'react';
import { initializeMap, addLayerToMap, addLocalGeoJSON } from './mapLogic';
import { LayerTrigger, MapWidgets } from '../../types';
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import { PRINT_SERVICE_URL } from '../../config/constants';

interface MapComponentProps {
    layerTrigger: LayerTrigger | null;
}

type ActivePanel = 'tools' | 'layers' | 'legend' | 'basemap' | 'info' | null;

const MapComponent: React.FC<MapComponentProps> = ({ layerTrigger }) => {
    const mapDiv = useRef<HTMLDivElement>(null);
    const mapRef = useRef<WebMap | null>(null);
    const viewRef = useRef<MapView | null>(null);
    const widgetsRef = useRef<MapWidgets | null>(null);

    // Contenedores del DOM para incrustar los widgets nativos
    const layerListRef = useRef<HTMLDivElement>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const basemapRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const sketchRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);

    // Estados de UI custom
    const [activePanel, setActivePanel] = useState<ActivePanel>(null);
    const [zoomPreFn, setZoomPreFn] = useState<() => void>(() => {});
    const [zoomHomeFn, setZoomHomeFn] = useState<() => void>(() => {});
    const [shareMessage, setShareMessage] = useState<string>("");

    useEffect(() => {
        // Variables para manejo de memoria y listeners responsive
        let resizeTimeout: ReturnType<typeof setTimeout>;
        let resizeObserver: ResizeObserver | null = null;

        // Lógica centralizada para forzar repintado del mapa en móvil.
        const forceMapResize = () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (viewRef.current) {
                    requestAnimationFrame(() => {
                        if (viewRef.current) {
                            viewRef.current.resize(); 
                            viewRef.current.requestRender(); 
                        }
                    });
                }
            }, 150); 
        };

        if (mapDiv.current && !mapRef.current) {
            const { map, view, widgets, zoomPre, zoomHome } = initializeMap(mapDiv.current);
            mapRef.current = map;
            viewRef.current = view;
            widgetsRef.current = widgets;
            setZoomPreFn(() => zoomPre);
            setZoomHomeFn(() => zoomHome);

            // Montamos los widgets en los refs tan pronto inicialicen
            if (layerListRef.current) widgets.layerList.container = layerListRef.current;
            if (legendRef.current) widgets.legend.container = legendRef.current;
            if (basemapRef.current) widgets.basemapGallery.container = basemapRef.current;
            if (printRef.current && PRINT_SERVICE_URL) widgets.print.container = printRef.current;
            if (sketchRef.current) widgets.sketch.container = sketchRef.current;
            if (measureRef.current) widgets.measurement.container = measureRef.current;

            // --- [INICIO EVENTOS RESPONSIVE] ---
            setTimeout(forceMapResize, 300);
            setTimeout(forceMapResize, 800); 

            window.addEventListener('resize', forceMapResize);
            window.addEventListener('orientationchange', forceMapResize);

            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', forceMapResize);
            }

            resizeObserver = new ResizeObserver(() => {
                forceMapResize();
            });
            resizeObserver.observe(mapDiv.current);
            // --- [FIN EVENTOS RESPONSIVE] ---
        }
        
        return () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            window.removeEventListener('resize', forceMapResize);
            window.removeEventListener('orientationchange', forceMapResize);
            
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', forceMapResize);
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
            }

            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (layerTrigger && mapRef.current && viewRef.current) {
            addLayerToMap(mapRef.current, viewRef.current, layerTrigger.item);
        }
    }, [layerTrigger]);

    const togglePanel = (panel: ActivePanel) => {
        setActivePanel(prev => prev === panel ? null : panel);
    };

    // Funciones del Contenedor Inferior (Navegación)
    const handleZoomIn = () => viewRef.current?.goTo({ zoom: viewRef.current.zoom + 1 });
    const handleZoomOut = () => viewRef.current?.goTo({ zoom: viewRef.current.zoom - 1 });

    // Herramientas Específicas
    const handleMeasure = (type: "distance" | "area") => {
        if (widgetsRef.current) widgetsRef.current.measurement.activeTool = type;
    };
    const handleClearMeasure = () => {
        if (widgetsRef.current) widgetsRef.current.measurement.clear();
    };
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && mapRef.current && viewRef.current) {
            addLocalGeoJSON(mapRef.current, viewRef.current, file);
            alert("Capa GeoJSON importada correctamente.");
        }
    };

    const handleShare = () => {
        const view = viewRef.current;
        // [CORRECCIÓN QUIRÚRGICA] Casteamos explícitamente a 'any' para silenciar el 
        // falso positivo del linter de TypeScript, ya que en tiempo de ejecución 
        // las propiedades longitude y latitude sí existen.
        const center: any = view?.center;
        
        if (view && center && center.longitude != null && center.latitude != null) {
            const lon = center.longitude.toFixed(5);
            const lat = center.latitude.toFixed(5);
            const z = Math.round(view.zoom || 8); 
            
            const shareUrl = `${window.location.origin}${window.location.pathname}?lon=${lon}&lat=${lat}&z=${z}`;
            navigator.clipboard.writeText(shareUrl);
            setShareMessage("¡Enlace copiado al portapapeles!");
            setTimeout(() => setShareMessage(""), 3000);
        } else {
            setShareMessage("Obteniendo coordenadas, intente de nuevo...");
            setTimeout(() => setShareMessage(""), 3000);
        }
    };

    // SVGs Limpios para los botones sin usar librerías
    const IconTools = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>;
    const IconLayers = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>;
    const IconLegend = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
    const IconBasemap = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="21"></line></svg>;
    const IconInfo = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
    
    const IconPlus = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
    const IconMinus = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
    const IconUndo = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>;
    const IconHome = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;

    return (
        <div className="map-component-root" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Div del mapa de ArcGIS */}
            <div id="viewDiv" ref={mapDiv} style={{ flex: 1, width: '100%', position: 'relative' }}></div>

            {/* CONTENEDOR SUPERIOR DERECHO (HERRAMIENTAS) */}
            <div className="map-toolbar top-right">
                <button className={`toolbar-btn ${activePanel === 'tools' ? 'active' : ''}`} onClick={() => togglePanel('tools')} title="Herramientas"><IconTools /></button>
                <button className={`toolbar-btn ${activePanel === 'layers' ? 'active' : ''}`} onClick={() => togglePanel('layers')} title="Capas"><IconLayers /></button>
                <button className={`toolbar-btn ${activePanel === 'legend' ? 'active' : ''}`} onClick={() => togglePanel('legend')} title="Leyenda"><IconLegend /></button>
                <button className={`toolbar-btn ${activePanel === 'basemap' ? 'active' : ''}`} onClick={() => togglePanel('basemap')} title="Mapa Base"><IconBasemap /></button>
                <button className={`toolbar-btn ${activePanel === 'info' ? 'active' : ''}`} onClick={() => togglePanel('info')} title="Información"><IconInfo /></button>
            </div>

            {/* CONTENEDOR INFERIOR DERECHO (NAVEGACIÓN) */}
            <div className="map-toolbar bottom-right">
                <button className="toolbar-btn" onClick={handleZoomIn} title="Acercar"><IconPlus /></button>
                <button className="toolbar-btn" onClick={handleZoomOut} title="Alejar"><IconMinus /></button>
                <button className="toolbar-btn" onClick={zoomPreFn} title="Vista anterior"><IconUndo /></button>
                <button className="toolbar-btn" onClick={zoomHomeFn} title="Vista inicial"><IconHome /></button>
            </div>

            {/* PANELES COLAPSABLES (Ocultos con CSS para proteger el ciclo de vida del DOM) */}
            <div className={`map-panel floating-panel ${activePanel === 'tools' ? 'visible' : 'hidden'}`}>
                <h3>Herramientas</h3>
                <div className="tool-section">
                    <h4>Imprimir Mapa</h4>
                    {PRINT_SERVICE_URL ? <div ref={printRef}></div> : <p className="panel-msg">Servicio de impresión no configurado.</p>}
                </div>
                <div className="tool-section">
                    <h4>Importar Datos (GeoJSON)</h4>
                    <input type="file" accept=".geojson,.json" onChange={handleFileUpload} className="file-input" />
                </div>
                <div className="tool-section">
                    <h4>Medición</h4>
                    <div className="measure-btns">
                        <button className="pill-button secondary small" onClick={() => handleMeasure("distance")}>Distancia</button>
                        <button className="pill-button secondary small" onClick={() => handleMeasure("area")}>Área</button>
                        <button className="pill-button secondary small" onClick={handleClearMeasure}>Limpiar</button>
                    </div>
                    <div ref={measureRef} className="measure-container"></div>
                </div>
                <div className="tool-section">
                    <h4>Dibujo</h4>
                    <div ref={sketchRef}></div>
                </div>
                <div className="tool-section">
                    <h4>Compartir</h4>
                    <button className="pill-button" onClick={handleShare}>Copiar Enlace del Mapa</button>
                    {shareMessage && <p className="panel-msg success">{shareMessage}</p>}
                </div>
            </div>

            {/* Panel: Capas */}
            <div className={`map-panel floating-panel ${activePanel === 'layers' ? 'visible' : 'hidden'}`}>
                <h3>Capas Operativas</h3>
                <div ref={layerListRef}></div>
            </div>

            {/* Panel: Leyenda */}
            <div className={`map-panel floating-panel ${activePanel === 'legend' ? 'visible' : 'hidden'}`}>
                <h3>Leyenda Cartográfica</h3>
                <div ref={legendRef}></div>
            </div>

            {/* Panel: Mapa Base */}
            <div className={`map-panel floating-panel ${activePanel === 'basemap' ? 'visible' : 'hidden'}`}>
                <h3>Mapa Base</h3>
                <div ref={basemapRef}></div>
            </div>

            {/* Panel: Información */}
            <div className={`map-panel floating-panel ${activePanel === 'info' ? 'visible' : 'hidden'}`}>
                <h3>Información del Visor</h3>
                <p className="panel-msg">
                    <strong>Visor Geográfico de Cundinamarca</strong><br/><br/>
                    Esta herramienta permite explorar la cartografía oficial del departamento.
                    El catálogo de la izquierda está conectado dinámicamente con los servicios operativos 
                    oficiales de la plataforma institucional.
                </p>
            </div>
        </div>
    );
};

export default MapComponent;