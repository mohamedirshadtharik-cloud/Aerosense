/**
 * AeroSense - District-Wise AQI Logic
 * Pan-India Coverage
 */
"use strict";


// INDIA_LOCATIONS now managed via assets/data/aqi_data.json



const NINJAS_API_KEY = "YOUR_API_KEY"; // User to provide or replace
let localAqiData = [];



function getStatusInfo(aqi) {
    if (aqi <= 50) return { label: 'Good', color: '#10b981' };
    if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
    if (aqi <= 150) return { label: 'Unhealthy for SG', color: '#f97316' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: '#8b5cf6' };
    return { label: 'Hazardous', color: '#881337' };
}

async function fetchDistrictData(locObj) {
    const city = locObj.city;
    const state = locObj.state;
    
    // Check local dataset first for high-fidelity sync
    const localMatch = localAqiData.find(d => d.city.toLowerCase() === city.toLowerCase());
    
    if (localMatch) {
        const aqi = localMatch.AQI;
        const multiplier = aqi / 100;
        return { 
            city, 
            state, 
            aqi: aqi, 
            pm25: localMatch.PM25, 
            pm10: localMatch.PM10, 
            co: (0.5 * multiplier + Math.random() * 1.5).toFixed(1), // CO simulated as it's missing in aqi_data.json
            status: getStatusInfo(aqi) 
        };
    }

    // Fallback for missing cities
    return { city, state, aqi: "N/A", pm25: "N/A", pm10: "N/A", co: "N/A", status: getStatusInfo(0) };
}

// Deprecated - API logic removed

// Fallback to OpenAQ removed for Pure Synthetic Architecture




async function loadDistrictAQI() {
    const btn = document.getElementById('btnLoadData');
    const tbody = document.querySelector("#aqiTable tbody");

    // Use localAqiData as the source of truth for the table
    const targetLocations = localAqiData.length > 0 ? localAqiData : [
        { city: "Delhi", state: "Delhi" }, { city: "Mumbai", state: "Maharashtra" }
    ];

    const results = await Promise.all(targetLocations.map(loc => fetchDistrictData(loc)));

    tbody.innerHTML = "";
    results.forEach(res => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${res.city}</strong></td>
            <td><span style="color:var(--text-secondary); font-size: 0.85rem;">${res.state}</span></td>
            <td class="aqi-val" style="color:${res.status.color}">${res.aqi}</td>
            <td>${res.pm25}</td>
            <td>${res.pm10}</td>
            <td>${res.co}</td>
            <td><span class="status-badge" style="background:${res.status.color}22; color:${res.status.color}; border: 1px solid ${res.status.color}44;">${res.status.label}</span></td>
        `;
        tbody.appendChild(row);
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Reload National Data';


}

document.addEventListener('DOMContentLoaded', async () => {
    // Load local dataset for fallbacks
    try {
        const response = await fetch('assets/data/aqi_data.json');
        localAqiData = await response.json();
    } catch (err) {
        console.warn("Local AQI dataset not found in districts view.", err);
    }

    document.getElementById('btnLoadData').addEventListener('click', loadDistrictAQI);
    // Auto-load on first visit
    loadDistrictAQI();
});

