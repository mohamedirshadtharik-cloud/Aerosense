/**
 * AeroSense - History Data Logic
 */

const AQI_LEVELS = [
    { max: 50,  color: 'var(--aqi-good)', label: 'Good' },
    { max: 100, color: 'var(--aqi-moderate)', label: 'Moderate' },
    { max: 150, color: 'var(--aqi-unhealthy-sensitive)', label: 'Unhealthy for Sensitive Groups' },
    { max: 200, color: 'var(--aqi-unhealthy)', label: 'Unhealthy' },
    { max: 300, color: 'var(--aqi-very-unhealthy)', label: 'Very Unhealthy' },
    { max: 500, color: 'var(--aqi-hazardous)', label: 'Hazardous' }
];

let localAqiData = [];

function getAqiDefinition(value) {
    for (let level of AQI_LEVELS) {
        if (value <= level.max) return level;
    }
    return AQI_LEVELS[AQI_LEVELS.length - 1];
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch Master Dataset
    try {
        const response = await fetch('assets/data/aqi_data.json');
        localAqiData = await response.json();
    } catch (err) {
        console.warn("Could not load master dataset for history.");
    }

    // 2. Setup default dates in filters
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('startDate').valueAsDate = lastWeek;

    // 3. Generate and Render Mock Data Table
    function renderHistoryTable(days) {
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';
        
        if (!localAqiData.length) {
            tbody.innerHTML = '<tr><td colspan="7">Loading data...</td></tr>';
            return;
        }

        // Pick a default city for history context (e.g. Delhi or search result)
        const cityMatch = localAqiData.find(c => c.city === "Delhi") || localAqiData[0];
        
        let totalAqi = 0;
        let maxAqi = 0;
        let goodDaysCount = 0;
        let baseAqi = cityMatch.AQI; 
        
        for (let i = 0; i < days; i++) {
            const dateStr = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });
            
            for(let j = 0; j < 3; j++) {
                const timeStr = j === 0 ? "8:00 AM" : j === 1 ? "2:00 PM" : "8:00 PM";
                
                // Random walk around the base city AQI
                const dailyAqi = Math.max(10, Math.min(500, baseAqi + (Math.random() - 0.45) * 60));
                const aqi = Math.round(dailyAqi);
                
                totalAqi += aqi;
                if(aqi > maxAqi) maxAqi = aqi;
                if(j===1 && aqi <= 50) goodDaysCount++; 
                
                const def = getAqiDefinition(aqi);
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${dateStr} <span style="color: var(--text-muted); font-size: 0.8em; margin-left: 8px;">${timeStr}</span></td>
                    <td><i class="fa-solid fa-location-dot" style="color: var(--accent-blue);"></i> ${cityMatch.city}, ${cityMatch.state}</td>
                    <td style="font-weight: 700; font-size: 1.1rem;">${aqi}</td>
                    <td>
                        <span class="status-badge" style="background-color: ${def.color}22; color: ${def.color}; border: 1px solid ${def.color}44;">${def.label}</span>
                    </td>
                    <td>${(aqi * 0.25).toFixed(1)}</td>
                    <td>${(aqi * 0.45).toFixed(1)}</td>
                    <td>${(aqi * 0.7).toFixed(1)}</td>
                `;
                tbody.appendChild(tr);
            }
        }
        
        const avg = Math.round(totalAqi / (days * 3));
        const avgDef = getAqiDefinition(avg);
        const maxDef = getAqiDefinition(maxAqi);
        
        const elAvg = document.getElementById('avgAqi');
        elAvg.textContent = avg;
        elAvg.style.color = avgDef.color;
        
        const elMax = document.getElementById('maxAqi');
        elMax.textContent = maxAqi;
        elMax.style.color = maxDef.color;
        
        document.getElementById('goodDays').textContent = `${goodDaysCount} / ${days}`;
    }

    // Initial load
    renderHistoryTable(parseInt(document.getElementById('rangeFilter').value));
    
    // Interactions
    document.getElementById('rangeFilter').addEventListener('change', (e) => {
        renderHistoryTable(parseInt(e.target.value));
    });
    
    document.getElementById('btnExport').addEventListener('click', () => {
        const btn = document.getElementById('btnExport');
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--aqi-good);"></i>';
        setTimeout(() => {
            alert(`Exported history for ${localAqiData[0].city} to air_quality_history.csv`);
            btn.innerHTML = '<i class="fa-solid fa-download"></i>';
        }, 1000);
    });
});

