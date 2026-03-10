/**
 * AeroSense - AQI Heatmap
 * Generates a LIVE heat overlay from real OpenAQ data
 * + GPS + Major Indian cities
 */


document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // 1. Map setup
    // =============================================
    const map = L.map('aqiMap').setView([20.5937, 78.9629], 5);


    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Heat layer instance (kept global so we can rebuild it)
    let heatLayer = null;

    // AQI gradient colour stops matching our UI palette
    const AQI_GRADIENT = {
        0.0: '#10b981', // Good     (0–50)
        0.2: '#f59e0b', // Moderate (51–100)
        0.4: '#f97316', // USG      (101–150)
        0.6: '#ef4444', // Unhealthy(151–200)
        0.8: '#8b5cf6', // Very     (201–300)
        1.0: '#7f1d1d'  // Hazardous(301+)
    };

    const MAX_AQI = 300; // normalisation ceiling for heat intensity

    // =============================================
    // Master Synthetic Dataset Placeholder
    // =============================================
    let masterSyntheticData = [];

    // =============================================
    // Indian city coordinates (fallback seeds)
    // =============================================
    const INDIA_CITIES = [

        { name: 'Delhi',      lat: 28.6139, lng: 77.2090 },
        { name: 'Mumbai',     lat: 19.0760, lng: 72.8777 },
        { name: 'Kolkata',    lat: 22.5726, lng: 88.3639 },
        { name: 'Bangalore',  lat: 12.9716, lng: 77.5946 },
        { name: 'Hyderabad',  lat: 17.3850, lng: 78.4867 },
        { name: 'Chennai',    lat: 13.0827, lng: 80.2707 },
        { name: 'Ahmedabad',  lat: 23.0225, lng: 72.5714 },
        { name: 'Pune',       lat: 18.5204, lng: 73.8567 },
        { name: 'Jaipur',     lat: 26.9124, lng: 75.7873 },
        { name: 'Lucknow',    lat: 26.8467, lng: 80.9462 }
    ];

    // =============================================
    // Helpers
    // =============================================
    function getAQIColor(aqi) {
        if (aqi <= 50)  return '#10b981';
        if (aqi <= 100) return '#f59e0b';
        if (aqi <= 150) return '#f97316';
        if (aqi <= 200) return '#ef4444';
        if (aqi <= 300) return '#8b5cf6';
        return '#881337';
    }

    function getAQILabel(aqi) {
        if (aqi <= 50)  return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    }

    // =============================================
    // UI Message
    // =============================================
    let msgAdded = false;
    function showMsg(html) {
        const el = document.getElementById('loadingIndicator');
        if (el) { el.innerHTML = html; return; }
        if (msgAdded) return;
        const ctrl = L.control({ position: 'topleft' });
        ctrl.onAdd = () => {
            const div = L.DomUtil.create('div');
            div.id = 'loadingIndicator';
            div.style.cssText = 'background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);color:#fff;padding:10px 16px;border-radius:10px;font-family:Outfit,sans-serif;font-size:0.85rem;border:1px solid rgba(255,255,255,0.1);max-width:340px;line-height:1.6;';
            div.innerHTML = html;
            return div;
        };
        ctrl.addTo(map);
        msgAdded = true;
    }

    // =============================================
    // Build / rebuild the heat layer
    // =============================================
    function buildHeatLayer(points) {
        if (heatLayer) map.removeLayer(heatLayer);
        // points = [[lat, lng, intensity], ...]
        heatLayer = L.heatLayer(points, {
            radius: 40,
            blur: 30,
            maxZoom: 12,
            max: 1.0,
            gradient: AQI_GRADIENT
        }).addTo(map);
    }

    // =============================================
    // Plot a circle marker
    // =============================================
    function plotMarker(lat, lng, value, stationName, city, param, unit) {
        const color = getAQIColor(value);
        const label = getAQILabel(value);
        L.circleMarker([lat, lng], {
            radius: 11,
            fillColor: color,
            color: '#0f172a',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(map).bindPopup(`
            <div style="font-family:'Outfit',sans-serif;min-width:190px;line-height:1.4;">
                <div style="font-size:1rem;font-weight:700;margin-bottom:3px;">${stationName || city}</div>
                <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:10px;">${city}</div>
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <div style="width:13px;height:13px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex-shrink:0;"></div>
                    <span style="font-weight:700;font-size:1.2rem;">${value.toFixed(1)} <span style="font-size:0.78rem;font-weight:400;color:#94a3b8;">${unit || 'µg/m³'}</span></span>
                </div>
                <div style="font-size:0.78rem;padding:4px 12px;border-radius:999px;background:${color}22;color:${color};display:inline-block;font-weight:700;">${label}</div>
                <div style="font-size:0.72rem;color:#64748b;margin-top:8px;">Parameter: <b>${(param||'AQI').toUpperCase()}</b></div>
            </div>
        `, { className: 'aq-popup' });
    }

    // Ghost city marker (no OpenAQ data)
    function plotGhost(lat, lng, city) {
        L.circleMarker([lat, lng], {
            radius: 7, fillColor: '#334155', color: '#475569',
            weight: 1.5, opacity: 0.6, fillOpacity: 0.4
        }).addTo(map).bindPopup(`<b>${city}</b><br><span style="color:#64748b;font-size:0.8rem;">No OpenAQ station nearby</span>`);
    }

    // =============================================
    // Extract best pollutant value from measurements
    // =============================================
    function bestValue(measurements) {
        const pm25 = measurements.find(m => m.parameter === 'pm25');
        const pm10 = measurements.find(m => m.parameter === 'pm10');
        const any  = measurements[0];
        const m    = pm25 || pm10 || any;
        return m ? m.value : null;
    }

    // =============================================
    // Fetch helpers
    // =============================================
    async function fetchCity(name) {
        try {
            const r = await fetch(`https://api.openaq.org/v2/latest?city=${encodeURIComponent(name)}&limit=20`);
            const d = await r.json();
            return d.results || [];
        } catch { return []; }
    }

    async function fetchByCoords(lat, lng, radius = 50000) {
        try {
            // First try a tighter radius for accuracy
            let r = await fetch(`https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=20000&limit=10`);
            let d = await r.json();
            if (d.results && d.results.length > 0) return d.results;

            // Fallback to larger radius
            r = await fetch(`https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=${radius}&limit=20`);
            d = await r.json();
            return d.results || [];
        } catch { return []; }
    }


    // =============================================
    // Process results → heat points + markers
    // =============================================
    function processResults(results) {
        const heatPts = [];
        results.forEach(station => {
            if (!station.coordinates || station.coordinates.latitude == null) return;
            const lat = station.coordinates.latitude;
            const lng = station.coordinates.longitude;
            const val = bestValue(station.measurements);
            if (val == null || val < 0) return;

            // Normalised intensity 0–1
            const intensity = Math.min(val / MAX_AQI, 1.0);
            heatPts.push([lat, lng, intensity]);

            // Also add circle marker
            const pm  = station.measurements.find(m => m.parameter === 'pm25') || station.measurements[0];
            if (pm) plotMarker(lat, lng, pm.value, station.location, station.city, pm.parameter, pm.unit);
        });
        return heatPts;
    }

    // =============================================
    // Update station cards & chart
    // =============================================
    function updateStationList(allResults) {
        const list = document.getElementById('stationList');
        if (!list) return;
        list.innerHTML = '';
        const valid = allResults.filter(s => s.coordinates && s.measurements.length > 0).slice(0, 16);
        if (!valid.length) { list.innerHTML = '<li class="station-item" style="color:var(--text-muted);">No live data available.</li>'; return; }
        valid.forEach(station => {
            const pm = station.measurements.find(m => m.parameter === 'pm25') || station.measurements[0];
            if (!pm || pm.value == null || pm.value < 0) return;
            const v = Math.round(pm.value);
            const color = getAQIColor(v);
            const label = getAQILabel(v);
            const pm25m = station.measurements.find(m => m.parameter === 'pm25');
            const pm10m = station.measurements.find(m => m.parameter === 'pm10');
            const li = document.createElement('li');
            li.className = 'station-item';
            li.innerHTML = `
                <div class="station-item-name">${station.location || 'Station'}</div>
                <div class="station-item-aqi" style="color:${color};">${v} <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400;">${pm.unit||'µg/m³'}</span></div>
                <div class="station-item-sub">${pm25m?`PM2.5: <b>${Math.round(pm25m.value)}</b>`:''}${pm10m?` &nbsp;|&nbsp; PM10: <b>${Math.round(pm10m.value)}</b>`:''}</div>
                <span class="station-badge" style="background:${color}22;color:${color};">${label}</span>`;
            list.appendChild(li);
        });
    }

    let trendChartInst = null;
    function updateChart(allResults) {
        const canvas = document.getElementById('trendChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const valid = allResults.filter(s => s.measurements.length > 0).slice(0, 10);
        const labels   = valid.map(s => (s.city||s.location||'').substring(0,16));
        const pm25vals = valid.map(s => { const m = s.measurements.find(m=>m.parameter==='pm25'); return m ? Math.max(0,Math.round(m.value)) : null; });
        const pm10vals = valid.map(s => { const m = s.measurements.find(m=>m.parameter==='pm10'); return m ? Math.max(0,Math.round(m.value)) : null; });
        if (trendChartInst) trendChartInst.destroy();
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";
        trendChartInst = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets: [
                { label:'PM2.5', data:pm25vals, backgroundColor:'rgba(249,115,22,0.7)', borderColor:'#f97316', borderWidth:1, borderRadius:6 },
                { label:'PM10',  data:pm10vals, backgroundColor:'rgba(139,92,246,0.7)', borderColor:'#8b5cf6', borderWidth:1, borderRadius:6 }
            ]},
            options: { responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{position:'top'}, tooltip:{backgroundColor:'rgba(15,23,42,0.95)',titleColor:'#f8fafc',bodyColor:'#f8fafc',borderColor:'rgba(255,255,255,0.1)',borderWidth:1} },
                scales:{ y:{beginAtZero:true,grid:{color:'rgba(255,255,255,0.05)'}}, x:{grid:{display:false}} } }
        });
    }

    // =============================================
    // Clear markers (except tile layer)
    // =============================================
    function clearMarkers() {
        map.eachLayer(layer => {
            if (layer instanceof L.CircleMarker || layer instanceof L.Marker) map.removeLayer(layer);
        });
    }

    // =============================================
    // MAIN: Load GPS + National Synthetic Data
    // =============================================
    async function loadAll() {
        clearMarkers();
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        showMsg('<i class="fa-solid fa-satellite fa-spin"></i> Loading National AQI Registry...');
        
        // 1. Fetch Master Synthetic Dataset
        if (masterSyntheticData.length === 0) {
            try {
                const resp = await fetch('assets/data/aqi_data.json');
                masterSyntheticData = await resp.json();
            } catch (err) {
                console.warn("Failed to load master synthetic data for heatmap.", err);
            }
        }

        const allHeatPts = [];
        const allResults = [];

        // 2. Process Synthetic Data (The ONLY source now)
        masterSyntheticData.forEach(city => {
            if (city.lat && city.lng) {
                const intensity = Math.min(city.AQI / MAX_AQI, 1.0);
                allHeatPts.push([city.lat, city.lng, intensity]);
                
                // Plot Marker
                plotMarker(city.lat, city.lng, city.AQI, city.city, city.city, 'AQI', 'µg/m³');

                allResults.push({
                    location: city.city,
                    city: city.city,
                    coordinates: { latitude: city.lat, longitude: city.lng },
                    measurements: [
                        { parameter: 'pm25', value: city.PM25, unit: 'µg/m³' },
                        { parameter: 'pm10', value: city.PM10, unit: 'µg/m³' }
                    ]
                });
            }
        });

        // 3. Update UI components
        if (allHeatPts.length > 0) buildHeatLayer(allHeatPts);
        updateStationList(allResults);
        updateChart(allResults);

        showMsg(`
            <b>National AQI Registry Active</b><br/>
            Visualizing <b>${masterSyntheticData.length}</b> monitored nodes across India.<br/>
            <span style="color:var(--aqi-good)">●</span> All data sourced from internal master registry.
        `);

        // Center map showing India coverage
        const bounds = L.latLngBounds([[8, 68], [37, 97]]);
        map.fitBounds(bounds, { padding: [30, 30] });
    }


    // =============================================
    // Search bar (Refactored for local lookup)
    // =============================================
    const searchBar = document.getElementById('mapSearch');
    const locateBtn = document.getElementById('btnLocateMe');

    searchBar.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && e.target.value.trim() !== '') {
            const city = e.target.value.trim().toLowerCase();
            e.target.value = '';
            
            const match = masterSyntheticData.find(c => c.city.toLowerCase().includes(city) || c.state.toLowerCase().includes(city));
            
            if (match) {
                map.flyTo([match.lat, match.lng], 11);
                showMsg(`Focused on <b>${match.city}</b> (${match.state}). AQI: <b>${match.AQI}</b>`);
            } else {
                showMsg(`<i class="fa-solid fa-circle-info" style="color:#f59e0b"></i> "<b>${city}</b>" not found in local registry.`);
            }
        }
    });

    locateBtn.addEventListener('click', () => {
        locateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        loadAll().finally(() => { locateBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>'; });
    });

    // =============================================
    // Boot
    // =============================================
    loadAll();

});
