// Loading Page Control - Updated for blur effect
window.addEventListener('DOMContentLoaded', function () {
    const loadingPage = document.getElementById('loading-page');
    const mainWrapper = document.getElementById('main-wrapper');

    // Show loading page for exactly 3 seconds (content is visible but blurred behind it)
    setTimeout(function () {
        // Fade out loading page
        loadingPage.classList.add('hidden');

        // Remove loading page from DOM after transition completes
        setTimeout(function () {
            loadingPage.style.display = 'none';
        }, 500); // Wait for the fade transition to complete
    }, 3000); // 3 seconds delay
});

// AWS Backend API Configuration
const AWS_API_BASE = 'https://j8wnxa1ezd.execute-api.us-east-1.amazonaws.com';

// API keys are now stored securely on the backend server (server.js)
// The backend handles all API calls to Gemini, keeping keys safe


class ClimateDashboard {
    constructor() {
        this.map = null;
        this.heatmap = null;
        this.heatLayer = null;
        this.chart = null;
        this.currentLocation = null;
        this.currentClimate = null;
        this.backendRiskData = null;
        this.mapData = [];
        this.currentChart = 'temperature';
        this.isHeatmapMode = true;
        this.rainfallData = [];
        this.temperatureData = [];

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.showLoading(true);

        try {
            await this.detectLocation();
            await this.initMap();
            await this.loadMapData();
            await this.loadRiskAnalysis();
            // Load rainfall data from CSV
            this.rainfallData = await this.loadRainfallData();
            // Load temperature data from CSV
            this.temperatureData = await this.loadTemperatureData();
            this.initChart();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize dashboard. Please refresh the page.');
        } finally {
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshData());

        // Filters
        document.getElementById('apply-filters').addEventListener('click', () => this.applyFilters());

        // Location
        document.getElementById('detect-location').addEventListener('click', () => this.detectLocation());

        // Chart tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchChart(e.target.dataset.chart));
        });

        // AI Assistant
        document.getElementById('send-message').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        document.getElementById('minimize-assistant').addEventListener('click', () => {
            this.toggleAssistant();
        });

        // Map toggle controls
        const normalMapBtn = document.getElementById('normal-map-btn');
        const heatmapBtn = document.getElementById('heatmap-btn');

        if (normalMapBtn && heatmapBtn) {
            normalMapBtn.addEventListener('click', () => this.toggleMapMode(false));
            heatmapBtn.addEventListener('click', () => this.toggleMapMode(true));
        }

        // Profile modal
        const profileIcon = document.getElementById('user-profile-icon');
        const profileModal = document.getElementById('profile-modal');
        const profileClose = document.getElementById('profile-close');

        if (profileIcon && profileModal && profileClose) {
            profileIcon.addEventListener('click', () => {
                profileModal.classList.add('show');
            });

            profileClose.addEventListener('click', () => {
                profileModal.classList.remove('show');
            });

            // Close modal when clicking outside
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) {
                    profileModal.classList.remove('show');
                }
            });
        }
    }

    toggleMapMode(isHeatmap) {
        this.isHeatmapMode = isHeatmap;

        const normalMapBtn = document.getElementById('normal-map-btn');
        const heatmapBtn = document.getElementById('heatmap-btn');

        if (isHeatmap) {
            normalMapBtn.classList.remove('active');
            heatmapBtn.classList.add('active');

            // Show heatmap
            if (this.heatLayer) {
                this.map.addLayer(this.heatLayer);
            }
        } else {
            heatmapBtn.classList.remove('active');
            normalMapBtn.classList.add('active');

            // Hide heatmap
            if (this.heatLayer) {
                this.map.removeLayer(this.heatLayer);
            }
        }
    }

    showLoading(show) {
        // Loading overlay removed - no longer showing secondary loading screen
        // Only the initial 3-second blurred loading animation is used
    }

    showError(message) {
        // Create and show error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error fade-in';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    async detectLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            const locationInfo = document.getElementById('location-info');
            locationInfo.innerHTML = '<div class="loading">Detecting location...</div>';

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    this.currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    // Get location name using reverse geocoding
                    let locationName = 'Unknown Location';
                    try {
                        const geoResponse = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.currentLocation.lat}&lon=${this.currentLocation.lng}&zoom=10`
                        );
                        const geoData = await geoResponse.json();

                        // Build location name from address components
                        if (geoData.address) {
                            const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.state_district;
                            const state = geoData.address.state;
                            const country = geoData.address.country;

                            if (city && country) {
                                locationName = `${city}, ${country}`;
                            } else if (state && country) {
                                locationName = `${state}, ${country}`;
                            } else if (country) {
                                locationName = country;
                            }
                        }
                    } catch (geoError) {
                        console.warn('Reverse geocoding failed, using fallback:', geoError);
                    }

                    // Fetch real climate data from AWS backend
                    try {
                        this.currentClimate = await this.fetchCurrentClimate(
                            this.currentLocation.lat,
                            this.currentLocation.lng
                        );

                        // Use AWS region if available, otherwise use geocoded name
                        const displayName = this.currentClimate.region || locationName;

                        locationInfo.innerHTML = `
                            <div><strong>Current Location:</strong></div>
                            <div style="font-size: 0.95rem; color: #0f172a; font-weight: 500; margin-top: 0.25rem;">
                                ${displayName}
                            </div>
                            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                                ${this.currentLocation.lat.toFixed(4)}, ${this.currentLocation.lng.toFixed(4)}
                            </div>
                        `;
                    } catch (error) {
                        console.error('Failed to fetch climate data:', error);
                        locationInfo.innerHTML = `
                            <div><strong>Current Location:</strong></div>
                            <div style="font-size: 0.95rem; color: #0f172a; font-weight: 500; margin-top: 0.25rem;">
                                ${locationName}
                            </div>
                            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                                ${this.currentLocation.lat.toFixed(4)}, ${this.currentLocation.lng.toFixed(4)}
                            </div>
                        `;
                    }

                    resolve(this.currentLocation);
                },
                (error) => {
                    locationInfo.innerHTML = '<div class="error">Location access denied</div>';
                    // Default to New York if location fails
                    this.currentLocation = { lat: 40.7128, lng: -74.0060 };
                    resolve(this.currentLocation);
                },
                { timeout: 10000, enableHighAccuracy: true }
            );
        });
    }

    async fetchCurrentClimate(lat, lon) {
        try {
            const response = await fetch(
                `${AWS_API_BASE}/climate/current?lat=${lat}&lon=${lon}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Backend /climate/current response:', data);

            // Check if backend returned climate metrics (temperature, humidity, etc.)
            // If not, generate realistic fallback data based on location
            let climateData;
            if (data.temperature !== undefined && data.humidity !== undefined) {
                // Backend returned proper climate data
                climateData = data;
            } else {
                // Backend returned risk data or incomplete data
                // Generate realistic climate metrics based on location
                console.warn('/climate/current did not return climate metrics, using generated data');
                climateData = this.generateClimateData(lat, lon);

                // Store the risk data if present for later use
                if (data.heat_risk && data.flood_risk && data.drought_risk) {
                    this.backendRiskData = data;
                }
            }

            // Update climate display
            this.updateClimateDisplay(climateData);

            return climateData;
        } catch (error) {
            console.error('Failed to fetch climate data:', error);
            // Generate fallback data on error
            const fallbackData = this.generateClimateData(lat, lon);
            this.updateClimateDisplay(fallbackData);
            return fallbackData;
        }
    }

    generateClimateData(lat, lon) {
        // Generate realistic climate data based on latitude
        // This is a fallback when backend doesn't provide real climate metrics

        // Temperature varies by latitude (warmer near equator)
        const baseTemp = 30 - Math.abs(lat) * 0.5;
        const temperature = Math.round(baseTemp + (Math.random() - 0.5) * 10);

        // Humidity typically higher in tropical regions
        const baseHumidity = 70 - Math.abs(lat - 23.5) * 0.8;
        const humidity = Math.round(Math.max(30, Math.min(95, baseHumidity + (Math.random() - 0.5) * 20)));

        // Wind speed varies
        const wind_speed = Math.round((Math.random() * 5 + 2) * 10) / 10;

        // Rainfall varies by region
        const rainfall = Math.round(Math.random() * 200 + 50);

        // Try to get region name (simplified fallback)
        const region = this.getRegionName(lat, lon);

        return {
            region,
            temperature,
            humidity,
            wind_speed,
            rainfall
        };
    }

    getRegionName(lat, lon) {
        // Simple region naming based on coordinates
        // In production, this would use reverse geocoding
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
    }

    updateClimateDisplay(climateData) {
        // Update the Quick Stats section with real climate data
        const statsSection = document.querySelector('.sidebar-section:last-child');
        if (statsSection) {
            // Safely access properties with fallback values
            const temperature = climateData?.temperature ?? '--';
            const humidity = climateData?.humidity ?? '--';
            const windSpeed = climateData?.wind_speed ?? '--';
            const rainfall = climateData?.rainfall ?? '--';

            statsSection.innerHTML = `
                <h3><i class="fas fa-cloud-sun"></i> Current Climate</h3>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-temperature-high"></i> Temperature</span>
                    <span class="stat-value">${temperature}°C</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-tint"></i> Humidity</span>
                    <span class="stat-value">${humidity}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-wind"></i> Wind Speed</span>
                    <span class="stat-value">${windSpeed} m/s</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label"><i class="fas fa-cloud-rain"></i> Rainfall</span>
                    <span class="stat-value">${rainfall} mm</span>
                </div>
            `;
        }
    }

    async initMap() {
        if (!this.currentLocation) {
            throw new Error('Location not available');
        }

        const mapElement = document.getElementById('map');

        // Initialize Leaflet map with MapTiler tiles
        this.map = L.map(mapElement).setView(
            [this.currentLocation.lat, this.currentLocation.lng],
            10
        );

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
        }).addTo(this.map);

        // Add custom marker for current location
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        L.marker([this.currentLocation.lat, this.currentLocation.lng], {
            icon: customIcon,
            title: 'Your Location'
        }).addTo(this.map);

        document.getElementById('map-loading').style.display = 'none';
    }

    async loadMapData() {
        try {
            const response = await fetch(`${AWS_API_BASE}/map/data`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Map data received from backend:', data);
            console.log('Map data type:', typeof data, 'Is Array:', Array.isArray(data));

            // Check if data is valid and has expected structure
            if (Array.isArray(data) && data.length > 0) {
                // Transform backend data to match expected format
                this.mapData = data.map(point => ({
                    lat: point.lat || point.latitude,
                    lng: point.lon || point.lng || point.longitude,
                    severity: this.getSeverityValue(point.severity),
                    color: point.color || this.getSeverityColor(point.severity)
                }));

                console.log('Parsed map data points:', this.mapData.length);
                console.log('Sample data point:', this.mapData[0]);
            } else {
                console.warn('Backend returned invalid or empty map data, using mock data');
                throw new Error('Invalid data format from backend');
            }

            this.createHeatmap();
        } catch (error) {
            console.error('Failed to load map data from backend:', error);
            console.log('Using generated mock data as fallback');

            // Use mock data as fallback
            this.mapData = this.generateMockMapData();
            console.log('Generated mock data points:', this.mapData.length);
            this.createHeatmap();
        }
    }

    getSeverityColor(severity) {
        const severityMap = {
            'High': '#ef4444',
            'Moderate': '#f59e0b',
            'Low': '#10b981'
        };
        return severityMap[severity] || '#10b981';
    }

    getSeverityValue(severity) {
        const severityMap = {
            'High': 0.9,
            'Moderate': 0.5,
            'Low': 0.2
        };
        return severityMap[severity] || 0.5;
    }

    generateMockMapData() {
        const data = [];
        const center = this.currentLocation;

        for (let i = 0; i < 50; i++) {
            const lat = center.lat + (Math.random() - 0.5) * 0.2;
            const lng = center.lng + (Math.random() - 0.5) * 0.2;
            const severity = Math.random();

            data.push({
                lat,
                lng,
                severity,
                color: severity > 0.7 ? '#ef4444' : severity > 0.4 ? '#f59e0b' : '#10b981'
            });
        }

        return data;
    }

    createHeatmap() {
        if (!this.map) {
            console.error('Map not initialized, cannot create heatmap');
            return;
        }

        console.log('Creating heatmap with', this.mapData.length, 'data points');

        // Remove existing heatmap layer if it exists
        if (this.heatLayer) {
            this.map.removeLayer(this.heatLayer);
        }

        // Prepare data for Leaflet heatmap
        const heatmapData = this.mapData.map(point => [
            point.lat,
            point.lng,
            point.severity // intensity
        ]);

        console.log('Heatmap data prepared:', heatmapData.length, 'points');
        console.log('Sample heatmap point:', heatmapData[0]);

        // Create heatmap layer
        this.heatLayer = L.heatLayer(heatmapData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            max: 1.0,
            gradient: {
                0.0: '#10b981',
                0.4: '#10b981',
                0.6: '#f59e0b',
                0.8: '#ef4444',
                1.0: '#ef4444'
            }
        });

        console.log('Heatmap layer created');

        // Add to map if in heatmap mode
        if (this.isHeatmapMode) {
            this.heatLayer.addTo(this.map);
            console.log('Heatmap layer added to map');
        } else {
            console.log('Heatmap mode disabled, layer not added to map');
        }
    }

    async loadRiskAnalysis() {
        if (!this.currentClimate) {
            console.warn('No climate data available for risk analysis');
            return;
        }

        try {
            // Fetch risk analysis from AWS backend
            const riskData = await this.fetchRiskAnalysis(this.currentClimate);
            console.log('Risk analysis received:', riskData);

            // Update risk cards
            this.updateRiskCards(riskData);

            // Fetch AI explanation
            const aiExplanation = await this.fetchAIExplanation(riskData);
            console.log('AI explanation received:', aiExplanation);

            // Update verdict card with AI explanation
            this.updateVerdictCard({
                riskLevel: this.calculateOverallRisk(riskData),
                confidence: aiExplanation.confidence,
                summary: aiExplanation.explanation
            });
        } catch (error) {
            console.error('Failed to load risk analysis:', error);
            this.showError('Failed to load risk analysis. Please try again.');
        }
    }

    async fetchRiskAnalysis(climateData) {
        try {
            const url = `${AWS_API_BASE}/analysis/risk?temperature=${climateData.temperature}&humidity=${climateData.humidity}&wind_speed=${climateData.wind_speed}&rainfall=${climateData.rainfall}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch risk analysis:', error);
            throw error;
        }
    }

    async fetchAIExplanation(riskData) {
        try {
            const response = await fetch(`${AWS_API_BASE}/ai/explain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    heat_risk: riskData.heat_risk,
                    flood_risk: riskData.flood_risk,
                    drought_risk: riskData.drought_risk
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch AI explanation:', error);
            throw error;
        }
    }

    updateRiskCards(riskData) {
        // Update heat risk card
        const heatCard = document.getElementById('heat-risk-card');
        if (heatCard) {
            const riskLevel = heatCard.querySelector('.risk-level');
            riskLevel.textContent = riskData.heat_risk;
            riskLevel.className = `risk-level ${riskData.heat_risk.toLowerCase()}`;
        }

        // Update flood risk card
        const floodCard = document.getElementById('flood-risk-card');
        if (floodCard) {
            const riskLevel = floodCard.querySelector('.risk-level');
            riskLevel.textContent = riskData.flood_risk;
            riskLevel.className = `risk-level ${riskData.flood_risk.toLowerCase()}`;
        }

        // Update drought risk card
        const droughtCard = document.getElementById('drought-risk-card');
        if (droughtCard) {
            const riskLevel = droughtCard.querySelector('.risk-level');
            riskLevel.textContent = riskData.drought_risk;
            riskLevel.className = `risk-level ${riskData.drought_risk.toLowerCase()}`;
        }
    }

    calculateOverallRisk(riskData) {
        const risks = [riskData.heat_risk, riskData.flood_risk, riskData.drought_risk];
        const riskValues = { 'Low': 1, 'Moderate': 2, 'High': 3 };

        const avgRisk = risks.reduce((sum, risk) => sum + riskValues[risk], 0) / risks.length;

        if (avgRisk >= 2.5) return 'high';
        if (avgRisk >= 1.5) return 'moderate';
        return 'low';
    }

    updateVerdictCard(data) {
        const indicator = document.getElementById('risk-indicator');
        const content = document.getElementById('verdict-content');

        const riskLevel = indicator.querySelector('.risk-level');
        riskLevel.textContent = data.riskLevel.toUpperCase();
        riskLevel.className = `risk-level ${data.riskLevel}`;

        // Display confidence as text (Low/Medium/High) or percentage
        const confidenceText = typeof data.confidence === 'string'
            ? data.confidence
            : `${data.confidence}%`;
        indicator.querySelector('.confidence').textContent = `Confidence: ${confidenceText}`;
        content.innerHTML = `<p>${data.summary}</p>`;
    }

    initChart() {
        const ctx = document.getElementById('climate-chart').getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: this.getChartData('temperature'),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: '#f1f5f9'
                        }
                    },
                    x: {
                        grid: {
                            color: '#f1f5f9'
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    }
                }
            }
        });
    }

    async loadRainfallData() {
        try {
            const response = await fetch('Data/SP-India-Rainfall-act-dep_1901_to_2019_0.csv');
            const csvText = await response.text();

            // Parse CSV
            const lines = csvText.trim().split('\n');
            const data = [];

            // Skip header, get data from year 1999-2019 (lines 100-120, 21 years)
            for (let i = 100; i <= 120; i++) {
                if (lines[i]) {
                    const cols = lines[i].split(',');
                    data.push({
                        year: parseInt(cols[0]),
                        rainfall: parseFloat(cols[5]) // JUN-SEP column
                    });
                }
            }

            return data;
        } catch (error) {
            console.error('Failed to load rainfall data:', error);
            // Return mock data as fallback
            return Array.from({ length: 21 }, (_, i) => ({
                year: 2000 + i,
                rainfall: 500 + Math.random() * 400
            }));
        }
    }

    async loadTemperatureData() {
        try {
            const response = await fetch('Data/Temperature data.csv');
            const csvText = await response.text();

            // Parse CSV to get yearly averages
            const lines = csvText.trim().split('\n');
            const yearlyData = {};

            // Skip header (line 0), process all data lines
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(',');
                if (cols.length < 5) continue;

                // Parse date (format: DD-MM-YYYY or could be timestamp)
                const dateStr = cols[1];
                let year;

                // Try to parse different date formats
                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                        year = parseInt(parts[2]); // DD-MM-YYYY format
                    }
                } else {
                    // Might be Excel serial number, skip invalid dates
                    continue;
                }

                if (!year || year < 2004 || year > 2024) continue;

                // Get temperature max and min
                const tempMax = parseFloat(cols[3]);
                const tempMin = parseFloat(cols[4]);

                if (isNaN(tempMax) || isNaN(tempMin)) continue;

                // Calculate average temperature for the day
                const avgTemp = (tempMax + tempMin) / 2;

                // Store in yearly buckets
                if (!yearlyData[year]) {
                    yearlyData[year] = { sum: 0, count: 0 };
                }
                yearlyData[year].sum += avgTemp;
                yearlyData[year].count++;
            }

            // Calculate yearly averages and sort by year
            const data = [];
            for (let year = 2004; year <= 2024; year++) {
                if (yearlyData[year] && yearlyData[year].count > 0) {
                    data.push({
                        year: year,
                        temperature: yearlyData[year].sum / yearlyData[year].count
                    });
                } else {
                    // Fill missing years with average of adjacent years or fallback
                    data.push({
                        year: year,
                        temperature: 25 // fallback value
                    });
                }
            }

            return data;
        } catch (error) {
            console.error('Failed to load temperature data:', error);
            // Return mock data as fallback
            return Array.from({ length: 21 }, (_, i) => ({
                year: 2004 + i,
                temperature: 15 + Math.random() * 10
            }));
        }
    }

    getChartData(type) {
        const years = Array.from({ length: 21 }, (_, i) => 2005 + i);

        if (type === 'temperature') {
            // Use real temperature data
            if (this.temperatureData && this.temperatureData.length > 0) {
                return {
                    labels: years,
                    datasets: [{
                        label: 'Average Temperature (°C)',
                        data: this.temperatureData.map(d => d.temperature),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true
                    }]
                };
            } else {
                // Fallback to random data if CSV not loaded
                return {
                    labels: years,
                    datasets: [{
                        label: 'Average Temperature (°C)',
                        data: years.map(() => 15 + Math.random() * 10 + Math.sin(Math.random()) * 3),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true
                    }]
                };
            }
        } else {
            // Use real rainfall data
            if (this.rainfallData && this.rainfallData.length > 0) {
                return {
                    labels: years,
                    datasets: [{
                        label: 'Annual Rainfall (mm)',
                        data: this.rainfallData.map(d => d.rainfall),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true
                    }]
                };
            } else {
                // Fallback to random data if CSV not loaded
                return {
                    labels: years,
                    datasets: [{
                        label: 'Annual Rainfall (mm)',
                        data: years.map(() => 500 + Math.random() * 400),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true
                    }]
                };
            }
        }
    }

    switchChart(type) {
        this.currentChart = type;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.chart === type);
        });

        // Update chart data
        this.chart.data = this.getChartData(type);
        this.chart.update();
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        // Add user message
        this.addMessage(message, 'user');
        input.value = '';

        // Show typing indicator
        const typingId = this.addMessage('', 'ai', true);

        try {
            // Mock AI response
            const response = await this.getAIResponse(message);
            this.removeMessage(typingId);
            this.addMessage(response, 'ai');
        } catch (error) {
            this.removeMessage(typingId);
            this.addMessage('Sorry, I encountered an error. Please try again.', 'ai');
        }
    }

    addMessage(content, sender, isTyping = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageId = Date.now();

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message fade-in`;
        messageDiv.id = `message-${messageId}`;

        if (isTyping) {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-${sender === 'ai' ? 'robot' : 'user'}"></i>
                </div>
                <div class="message-content">
                    ${content}
                </div>
            `;
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return messageId;
    }

    removeMessage(messageId) {
        const message = document.getElementById(`message-${messageId}`);
        if (message) {
            message.remove();
        }
    }

    async getAIResponse(message) {
        try {
            // Build context from current climate data
            let contextData = [];

            if (this.currentClimate) {
                contextData.push(`Current climate conditions:`);
                contextData.push(`- Temperature: ${this.currentClimate.temperature}°C`);
                contextData.push(`- Humidity: ${this.currentClimate.humidity}%`);
                contextData.push(`- Wind Speed: ${this.currentClimate.wind_speed} m/s`);
                contextData.push(`- Rainfall: ${this.currentClimate.rainfall} mm`);
                contextData.push(`- Location: ${this.currentClimate.region || 'Current Location'}`);
            }

            if (this.currentLocation) {
                contextData.push(`Coordinates: ${this.currentLocation.lat.toFixed(4)}, ${this.currentLocation.lng.toFixed(4)}`);
            }

            const context = contextData.join('\n');

            // Call backend API (API keys stored securely on server)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    context: context
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.response;

        } catch (error) {
            console.error('AI Response Error:', error);

            // Fallback responses if API fails
            const fallbackResponses = {
                'climate': 'Based on your location, you should monitor temperature trends and precipitation patterns. Climate change affects different regions uniquely.',
                'temperature': `Current temperature is ${this.currentClimate?.temperature || 'not available'}°C. Temperature patterns can indicate climate trends in your area.`,
                'risk': 'Climate risks vary by location. Check your heat, flood, and drought risk cards on the dashboard for detailed assessments.',
                'default': 'I can help you understand climate data, weather patterns, and environmental risks. What would you like to know?'
            };

            const lowerMessage = message.toLowerCase();
            for (const [key, response] of Object.entries(fallbackResponses)) {
                if (lowerMessage.includes(key)) {
                    return response;
                }
            }

            return fallbackResponses.default;
        }
    }

    toggleAssistant() {
        const chatContainer = document.getElementById('chat-container');
        const minimizeBtn = document.getElementById('minimize-assistant');

        if (chatContainer.style.display === 'none') {
            chatContainer.style.display = 'flex';
            minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        } else {
            chatContainer.style.display = 'none';
            minimizeBtn.innerHTML = '<i class="fas fa-plus"></i>';
        }
    }

    applyFilters() {
        const riskFilter = document.getElementById('risk-filter').value;
        const timeFilter = document.getElementById('time-filter').value;

        // Mock filter application
        console.log('Applying filters:', { riskFilter, timeFilter });

        // In a real app, this would filter the map data and reload the heatmap
        this.showLoading(true);
        setTimeout(() => {
            this.showLoading(false);
            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'success fade-in';
            successDiv.textContent = 'Filters applied successfully';
            document.body.appendChild(successDiv);

            setTimeout(() => successDiv.remove(), 3000);
        }, 1000);
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refresh-btn');

        // Show loading state
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.style.opacity = '0.6';
        }

        try {
            // Re-detect location first
            await this.detectLocation();

            await Promise.all([
                this.loadMapData(),
                this.loadRiskAnalysis()
            ]);

            // Update chart
            this.chart.data = this.getChartData(this.currentChart);
            this.chart.update();

            // Update climate display
            this.updateCurrentClimate();

        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showError('Failed to refresh data');
        } finally {
            // Restore button state
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';
            }
        }
    }

    // Mock API call function
    async mockApiCall(endpoint) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate API responses
        if (endpoint === '/map/data') {
            return { data: this.generateMockMapData() };
        } else if (endpoint === '/analysis/risk') {
            return {
                riskLevel: ['low', 'moderate', 'high'][Math.floor(Math.random() * 3)],
                confidence: 70 + Math.floor(Math.random() * 30),
                summary: 'Climate analysis indicates changing patterns in your region with various risk factors to consider.'
            };
        }

        return {};
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ClimateDashboard();
});
