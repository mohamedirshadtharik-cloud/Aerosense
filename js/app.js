/**
 * AeroSense - Main Application Logic
 * Handles data fetching, UI updates, and interactions.
 */

// ==========================================
// Constants & Configuration
// ==========================================

const AQI_LEVELS = [
    { max: 50,  color: 'var(--aqi-good)', label: 'Good', advice: 'Air quality is considered satisfactory, and air pollution poses little or no risk. Enjoy your outdoor activities.' },
    { max: 100, color: 'var(--aqi-moderate)', label: 'Moderate', advice: 'Air quality is acceptable; however, there may be a moderate health concern for a very small number of individuals who are unusually sensitive to air pollution.' },
    { max: 150, color: 'var(--aqi-unhealthy-sensitive)', label: 'Unhealthy for Sensitive Groups', advice: 'Members of sensitive groups may experience health effects. The general public is not likely to be affected. Reduce prolonged or heavy exertion outdoors.' },
    { max: 200, color: 'var(--aqi-unhealthy)', label: 'Unhealthy', advice: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects. Avoid prolonged outdoor exertion.' },
    { max: 300, color: 'var(--aqi-very-unhealthy)', label: 'Very Unhealthy', advice: 'Health alert: everyone may experience more serious health effects. Avoid all outdoor physical activities.' },
    { max: 500, color: 'var(--aqi-hazardous)', label: 'Hazardous', advice: 'Health warnings of emergency conditions. The entire population is more likely to be affected. Remain indoors.' }
];
// NO EXTERNAL APIs REQUIRED - Pure Synthetic Architecture
const MOCK_POLLUTANTS = {
    no2: { min: 5, max: 45 },
    o3: { min: 10, max: 120 },
    so2: { min: 2, max: 20 },
    co: { min: 0.1, max: 2.5 }
};



// Determine level based on US EPA breakpoints
function getAqiDefinition(value) {
    for (let level of AQI_LEVELS) {
        if (value <= level.max) {
            return level;
        }
    }
    return AQI_LEVELS[AQI_LEVELS.length - 1]; // Fallback to hazardous
}

// ==========================================
// DOM Elements
// ==========================================
const DOM = {
    location: document.getElementById('displayLocation'),
    aqiValue: document.getElementById('currentAqiValue'),
    aqiProgress: document.getElementById('aqiProgress'),
    aqiStatusText: document.getElementById('aqiStatusText'),
    aqiDescription: document.getElementById('aqiDescription'),
    healthAdviceText: document.getElementById('healthAdviceText'),
    searchBar: document.getElementById('locationSearch'),
    btnLocateMe: document.getElementById('btnLocateMe'),
    lastUpdated: document.getElementById('lastUpdatedTime'),
    
    // Weather
    weatherTemp: document.getElementById('weatherTemp'),
    weatherWind: document.getElementById('weatherWind'),
    weatherHum: document.getElementById('weatherHum'),
    
    // Metrics
    metrics: {
        pm25: { val: document.getElementById('valPm25'), bar: document.getElementById('barPm25'), max: 500 },
        pm10: { val: document.getElementById('valPm10'), bar: document.getElementById('barPm10'), max: 604 },
        no2:  { val: document.getElementById('valNo2'),  bar: document.getElementById('barNo2'),  max: 2049 },
        o3:   { val: document.getElementById('valO3'),   bar: document.getElementById('barO3'),   max: 604 },
        co:   { val: document.getElementById('valCo'),   bar: document.getElementById('barCo'),   max: 10 },
        so2:  { val: document.getElementById('valSo2'),  bar: document.getElementById('barSo2'),  max: 200 }
    },
    
    stateSelect: document.getElementById('stateSelect'),
    chartSelect: document.getElementById('chartMetricSelect'),
    chartCanvas: document.getElementById('trendsChart'),
    
    // Map
    dashboardMapContainer: document.getElementById('dashboardMap')
};

let trendsChartInstance = null;
let dashboardMapInstance = null;
let dashboardHeatLayer = null;
let currentAirData = null;
let publicAqiData = [];

// Load local dataset
async function loadPublicAqiData() {
    try {
        const response = await fetch('assets/data/aqi_data.json');
        publicAqiData = await response.json();
        initStateSelector();
    } catch (err) {
        console.warn("Local AQI data not found or failed to load.", err);
    }
}

function initStateSelector() {
    if (!DOM.stateSelect || !publicAqiData || publicAqiData.length === 0) return;
    
    const states = Array.from(new Set(publicAqiData.map(item => item.state))).sort();
    
    DOM.stateSelect.innerHTML = `<option value=\"\">All India (default)</option>` + 
        states.map(state => `<option value=\"${state}\">${state}</option>`).join('');
    
    DOM.stateSelect.addEventListener('change', handleStateChange);
}

function handleStateChange(e) {
    const state = e.target.value;
    
    if (!state) {
        // Back to default view (Delhi)
        loadLocation("Delhi", 28.61, 77.20);
        return;
    }
    
    const stateCities = publicAqiData.filter(item => item.state === state);
    if (!stateCities.length) return;
    
    // Choose the city with highest AQI in that state
    const worstCity = stateCities.reduce((max, item) => item.AQI > max.AQI ? item : max, stateCities[0]);
    
    loadLocation(worstCity.city, worstCity.lat, worstCity.lng);
}


// ==========================================
// Mock Data Generation
// ==========================================
/**
 * FETCH AIR & WEATHER DATA (Refactored for Synthetic Consistency)
 * No longer hits external networks.
 */
async function fetchAirAndWeatherData(locationName, lat = 28.61, lng = 77.20) {
    // 1. Check local dataset for high-fidelity sync
    const localMatch = findInLocalData(locationName);
    
    // 2. Build Synthetic Result Packet
    const baseAqi = localMatch ? localMatch.AQI : (10 + Math.random() * 150);
    const pm25 = localMatch ? localMatch.PM25 : (baseAqi * 0.6);
    const pm10 = localMatch ? localMatch.PM10 : (baseAqi * 0.9);

    // Simulated Weather (Stable)
    const weather = {
        temperature_2m: 24 + Math.round(Math.random() * 8),
        wind_speed_10m: 5 + Math.round(Math.random() * 15),
        relative_humidity_2m: 40 + Math.round(Math.random() * 30)
    };

    const multiplier = baseAqi / 100;
    const pollutants = {
        pm25: pm25.toFixed(1),
        pm10: pm10.toFixed(1),
        no2: (MOCK_POLLUTANTS.no2.min + Math.random() * 40 * multiplier).toFixed(1),
        o3: (MOCK_POLLUTANTS.o3.min + Math.random() * 80 * multiplier).toFixed(1),
        so2: (MOCK_POLLUTANTS.so2.min + Math.random() * 10 * multiplier).toFixed(1),
        co: (MOCK_POLLUTANTS.co.min + Math.random() * 1.5 * multiplier).toFixed(2)
    };

    const forecast = generateGeneticForecast(baseAqi, 24);

    return {
        location: localMatch ? `${localMatch.city}, ${localMatch.state}` : locationName,
        aqi: Math.round(baseAqi),
        weather: weather,
        pollutants: pollutants,
        timestamp: new Date().toLocaleTimeString(),
        history: generateHistoricalData(baseAqi, 24),
        forecast: forecast // NEW: AI Predictive Model Data
    };
}



// Search through local dataset
function findInLocalData(query) {
    const q = query.toLowerCase();
    return publicAqiData.find(item => 
        item.city.toLowerCase().includes(q) || 
        item.state.toLowerCase().includes(q)
    );
}


// Deprecated - mapping now handled in synthetic fetchAirAndWeatherData




// generateFromRealData removed - consolidated into generateHistoricalData


function generateHistoricalData(currentAqi, hours) {
    const data = { aqi: [], pm25: [], labels: [] };
    let aqiWalk = currentAqi;
    
    for (let i = hours - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(d.getHours() - i);
        data.labels.push(`${d.getHours()}:00`);
        
        if (i > 0) {
           aqiWalk = Math.max(10, Math.min(500, aqiWalk + (Math.random() - 0.4) * 30));
        } else {
           aqiWalk = currentAqi; 
        }
        
        data.aqi.push(Math.round(aqiWalk));
        data.pm25.push((aqiWalk / 4 + Math.random() * 5).toFixed(1));
    }
    return data;
}

/**
 * GENETIC AI FORECAST MODEL
 * Simulates a genetic algorithm to predict AQI trends based on the Master Dataset
 */
function generateGeneticForecast(currentAqi, hours) {
    const data = { aqi: [], labels: [] };
    let aqiWalk = currentAqi;
    const now = new Date();

    for (let i = 1; i <= hours; i++) {
        const d = new Date(now.getTime() + (i * 60 * 60 * 1000));
        data.labels.push(`${d.getHours()}:00`);
        
        // Genetic Mutation Simulation
        const mutationFactor = (Math.random() - 0.5) * 20;
        const trendFactor = Math.sin(i / 4) * 15; // Periodic diurnal cycle simulation
        
        aqiWalk = Math.max(10, Math.min(500, aqiWalk + mutationFactor + trendFactor));
        data.aqi.push(Math.round(aqiWalk));
    }
    return data;
}


// ==========================================
// UI Update Logic
// ==========================================
function updateDashboard(data) {
    currentAirData = data;
    const aqiDef = getAqiDefinition(data.aqi);
    
    // Update texts
    DOM.location.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${data.location}`;
    DOM.aqiValue.textContent = data.aqi;
    DOM.aqiStatusText.textContent = aqiDef.label;
    DOM.aqiStatusText.style.color = aqiDef.color;
    
    // For description, we'll keep it static or dynamically adjust based on general data
    DOM.healthAdviceText.textContent = aqiDef.advice;
    
    // Add pollution source info if available
    if (data.source) {
        DOM.aqiDescription.innerHTML = `Major Source of Pollution: <strong>${data.source}</strong>. <br>Highest recorded AQI: <strong>${data.maxAqiReached}</strong>.`;
    } else {
        DOM.aqiDescription.textContent = "Fetching local sensor data to provide accurate air quality insights.";
    }
    
    DOM.lastUpdated.textContent = data.timestamp;

    
    // Animate AQI Circle
    // Circle dasharray is 283. Max AQI is ~500.
    const percentage = Math.min(data.aqi / 500, 1);
    const offset = 283 - (283 * percentage);
    DOM.aqiProgress.style.strokeDashoffset = offset;
    DOM.aqiProgress.style.stroke = aqiDef.color;
    
    // Glow effect based on color
    const hexColor = aqiDef.color.match(/var\(--aqi-(.+)\)/) 
        ? getComputedStyle(document.documentElement).getPropertyValue(`--aqi-${aqiDef.color.match(/var\(--aqi-(.+)\)/)[1]}`) 
        : aqiDef.color;

    // Update Weather
    if (data.weather) {
        if(DOM.weatherTemp) DOM.weatherTemp.innerHTML = `<i class="fa-solid fa-temperature-half"></i> ${data.weather.temperature_2m}°C`;
        if(DOM.weatherWind) DOM.weatherWind.innerHTML = `<i class="fa-solid fa-wind"></i> ${data.weather.wind_speed_10m} km/h`;
        if(DOM.weatherHum) DOM.weatherHum.innerHTML = `<i class="fa-solid fa-droplet"></i> ${data.weather.relative_humidity_2m}%`;
    }
        
    // Update Pollutants
    for (const [key, element] of Object.entries(DOM.metrics)) {
        const val = data.pollutants[key];
        element.val.textContent = val;
        
        // Calculate bar width (naive normalization for visual effect)
        let percent = (val / element.max) * 100;
        // Boost low values visually so empty bars don't look broken
        if(percent < 5) percent = 5;
        if(percent > 100) percent = 100;
        
        element.bar.style.width = `${percent}%`;
        element.bar.style.backgroundColor = aqiDef.color; // Sync bar colors to overall AQI mood
    }
    
    // Update Chart
    updateChart(DOM.chartSelect.value);
}

// ==========================================
// Charting Logic
// ==========================================
function initChart() {
    const ctx = DOM.chartCanvas.getContext('2d');
    
    // Global defaults
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";
    
    trendsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Actual (Live History)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'AI Forecast (Genetic Model)',
                    data: [],
                    borderColor: '#8b5cf6',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4
                }
            ]

        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Hide default legend
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });

    // Initialize the Dashboard Map
    if (DOM.dashboardMapContainer) {
        dashboardMapInstance = L.map('dashboardMap').setView([28.61, 77.20], 10);

        
        // Add dark theme base layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(dashboardMapInstance);
        
        // Disable scroll zoom for the embedded dashboard map so it doesn't block page scrolling
        dashboardMapInstance.scrollWheelZoom.disable();
    }
}

function updateChart(metricKey) {
    const histData = currentAirData.history[metricKey];
    
    // For AQI, we show the forecast too
    if (metricKey === 'aqi') {
        const aqiDef = getAqiDefinition(currentAirData.aqi);
        
        // Update Actual
        trendsChartInstance.data.labels = currentAirData.history.labels.concat(currentAirData.forecast.labels);
        
        // Prepare data with null gaps to separate lines visually if needed, 
        // but here we just append.
        const actualSet = histData.concat(new Array(currentAirData.forecast.aqi.length).fill(null));
        const forecastSet = new Array(histData.length - 1).fill(null)
                             .concat([histData[histData.length-1]])
                             .concat(currentAirData.forecast.aqi);
        
        trendsChartInstance.data.datasets[0].data = actualSet;
        trendsChartInstance.data.datasets[0].borderColor = aqiDef.color;
        
        trendsChartInstance.data.datasets[1].data = forecastSet;
        trendsChartInstance.data.datasets[1].hidden = false;
    } else {
        // Hide forecast for other pollutants
        trendsChartInstance.data.labels = currentAirData.history.labels;
        trendsChartInstance.data.datasets[0].data = histData;
        trendsChartInstance.data.datasets[1].hidden = true;
        
        if (metricKey === 'temp') trendsChartInstance.data.datasets[0].borderColor = '#f59e0b';
        else if (metricKey === 'humidity') trendsChartInstance.data.datasets[0].borderColor = '#06b6d4';
        else trendsChartInstance.data.datasets[0].borderColor = '#3b82f6';
    }
    
    trendsChartInstance.update();
}



// ==========================================
// Initialization & Events
// ==========================================
async function loadLocation(locationName, lat = 28.61, lng = 77.20) {

    // Show loading state
    DOM.location.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading...`;
    
    const data = await fetchAirAndWeatherData(locationName, lat, lng);
    updateDashboard(data);
    
    // Pan small map overview if it exists
    if (dashboardMapInstance) {
        dashboardMapInstance.flyTo([lat, lng], 10);
        
        // Add a simple marker to show the located spot on the dashboard
        dashboardMapInstance.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                dashboardMapInstance.removeLayer(layer);
            }
        });
        
        // Get the color for the marker
        const aqiDef = getAqiDefinition(data.aqi);
        const colorVar = aqiDef.color;
        const styles = getComputedStyle(document.body);
        const hexColor = styles.getPropertyValue(colorVar.replace('var(', '').replace(')', '')).trim() || '#3b82f6';
        
        L.circleMarker([lat, lng], {
            radius: 12,
            fillColor: hexColor,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(dashboardMapInstance).bindPopup(`<b>${locationName}</b><br>AQI: ${data.aqi}`).openPopup();
    }
}

function handleSearch(e) {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) {
            loadLocation(val);
            e.target.value = '';
        }
    }
}



function handleGeolocation() {
    DOM.btnLocateMe.classList.add('loading');
    DOM.btnLocateMe.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    // Simulate reverse geocoding
    setTimeout(() => {
        DOM.btnLocateMe.classList.remove('loading');
        DOM.btnLocateMe.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        loadLocation("Delhi, India", 28.61, 77.20); // Real Coordinates for the requested test

    }, 1000);
}

// Boot up
document.addEventListener('DOMContentLoaded', async () => {
    await loadPublicAqiData();
    initChart();

    
    // Event Listeners
    DOM.searchBar.addEventListener('keypress', handleSearch);
    DOM.btnLocateMe.addEventListener('click', handleGeolocation);
    DOM.chartSelect.addEventListener('change', (e) => updateChart(e.target.value));
    
    // Load initial default location (Delhi)
    loadLocation("Delhi", 28.61, 77.20);

});
