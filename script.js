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

// AWS Backend API Configuration - Loaded dynamically from server config
let AWS_API_BASE = 'https://j8wnxa1ezd.execute-api.us-east-1.amazonaws.com'; // Fallback default

// Fetch server configuration on page load
async function loadServerConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            AWS_API_BASE = config.awsEndpoint;
            console.log(' Server config loaded. AWS Endpoint:', AWS_API_BASE);
        }
    } catch (error) {
        console.warn(' Failed to load server config, using fallback:', error);
    }
}



// API keys are now stored securely on the backend server (server.js)
// The backend handles all API calls to Gemini, keeping keys safe



class ClimateDashboard {
    constructor() {
        this.map = null;
        this.heatmap = null;
        this.heatLayer = null;                    // Regional heatmap layer
        this.userLocationHeatLayer = null;        // NEW: User location heatmap layer
        this.currentHeatmapLayer = 'regional';     // NEW: 'regional' or 'user'
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

        // NEW: Heatmap layer toggle controls
        const regionalLayerBtn = document.getElementById('regional-layer-btn');
        const userLayerBtn = document.getElementById('user-layer-btn');

        if (regionalLayerBtn && userLayerBtn) {
            regionalLayerBtn.addEventListener('click', () => this.switchHeatmapLayer('regional'));
            userLayerBtn.addEventListener('click', () => this.switchHeatmapLayer('user'));
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

            // Detect if on mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Check if using HTTPS (required for geolocation on mobile browsers)
            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

            // Warn about HTTPS requirement on mobile
            if (isMobile && !isSecure) {
                console.warn('⚠️ Geolocation requires HTTPS on mobile browsers');
                locationInfo.innerHTML = `
                    <div class="error" style="font-size: 0.85rem;">
                        <strong>Location unavailable</strong><br>
                        <span style="font-size: 0.75rem;">Mobile browsers require HTTPS for location access. Using default location.</span>
                    </div>
                `;
                // Use default location
                this.currentLocation = { lat: 40.7128, lng: -74.0060 };
                resolve(this.currentLocation);
                return;
            }

            // Configure geolocation options based on device type
            const geoOptions = {
                timeout: isMobile ? 30000 : 15000, // Longer timeout for mobile (30s vs 15s)
                enableHighAccuracy: !isMobile, // High accuracy can be slow on mobile
                maximumAge: isMobile ? 300000 : 0 // Allow 5-minute cached position on mobile for faster results
            };

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
                    // Handle different error types with specific messages
                    let errorMessage = 'Location access denied';

                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = isMobile
                                ? 'Location permission denied. Please enable location in your browser settings.'
                                : 'Location access denied. Please allow location access.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable. Using default location.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = isMobile
                                ? 'Location request timed out. Please ensure GPS is enabled.'
                                : 'Location request timed out.';
                            break;
                        default:
                            errorMessage = 'Unable to retrieve location. Using default location.';
                    }

                    console.warn('Geolocation error:', error.code, error.message);

                    locationInfo.innerHTML = `<div class="error" style="font-size: 0.85rem;">${errorMessage}</div>`;

                    // Default to New York if location fails
                    this.currentLocation = { lat: 40.7128, lng: -74.0060 };
                    resolve(this.currentLocation);
                },
                geoOptions
            );
        });
    }

    async fetchCurrentClimate(lat, lon) {
        try {
            // First, try to fetch atmospheric data from our new weather endpoint
            console.log('Fetching real-time weather data from /api/weather...');
            const weatherResponse = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);

            let climateData = null;
            if (weatherResponse.ok) {
                climateData = await weatherResponse.json();
                console.log('Fetched real-time weather data:', climateData);
            } else {
                console.warn('Failed to fetch real-time weather data, falling back to AWS/generated data');
            }

            // Also fetch risk data from AWS backend
            const riskResponse = await fetch(
                `${AWS_API_BASE}/climate/current?lat=${lat}&lon=${lon}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (riskResponse.ok) {
                const riskData = await riskResponse.json();
                console.log('Backend /climate/current response:', riskData);

                // Store the risk data if present for later use
                if (riskData.heat_risk && riskData.flood_risk && riskData.drought_risk) {
                    this.backendRiskData = riskData;
                    // If we don't have climate metrics from weather API, use AWS ones if available
                    if (!climateData && riskData.temperature !== undefined) {
                        climateData = riskData;
                    }
                }
            }

            // Final fallback: generate data if everything else failed
            if (!climateData) {
                console.warn('No climate data available from APIs, using generated fallback');
                climateData = this.generateClimateData(lat, lon);
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

        // Wait for Google Maps to load if not already loaded
        await this.waitForGoogleMaps();

        const mapElement = document.getElementById('map');

        // Initialize Google Maps
        this.map = new google.maps.Map(mapElement, {
            center: { lat: this.currentLocation.lat, lng: this.currentLocation.lng },
            zoom: 10,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                }
            ]
        });

        // Store markers array for Normal Map mode
        this.markers = [];

        // Add custom marker for current location
        new google.maps.Marker({
            position: { lat: this.currentLocation.lat, lng: this.currentLocation.lng },
            map: this.map,
            title: 'Your Location',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                scale: 10
            },
            zIndex: 1000
        });

        document.getElementById('map-loading').style.display = 'none';
    }

    // Wait for Google Maps API to load
    waitForGoogleMaps() {
        return new Promise((resolve) => {
            if (typeof google !== 'undefined' && google.maps) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (typeof google !== 'undefined' && google.maps) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    async loadMapData() {
        try {
            // Try to fetch climate-based grid data first
            console.log('Fetching climate-based heatmap data...');
            const climateResponse = await fetch(
                `/api/climate-grid?lat=${this.currentLocation.lat}&lon=${this.currentLocation.lng}`
            );

            if (climateResponse.ok) {
                const climateData = await climateResponse.json();
                console.log('Climate grid data received:', climateData.length, 'points');

                // Transform climate data for map
                this.mapData = climateData.map(point => ({
                    lat: point.lat,
                    lng: point.lon,
                    severity: point.severity,
                    weight: this.getSeverityWeight(point.severity),
                    color: this.getSeverityColor(point.severity),
                    temperature: point.temperature,
                    humidity: point.humidity,
                    wind_speed: point.wind_speed,
                    rainfall: point.rainfall
                }));

                console.log('Parsed climate-based map data:', this.mapData.length, 'points');

                // Cache the original data for filtering
                this.cachedMapData = [...this.mapData];

                this.renderMap();
                return;
            } else {
                console.warn('Climate grid API failed, trying AWS backend...');
            }
        } catch (error) {
            console.error('Failed to load climate grid data:', error);
        }

        // Fallback to AWS backend
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
            console.log('Map data received from AWS backend:', data);

            // Check if data is valid and has expected structure
            if (Array.isArray(data) && data.length > 0) {
                // Transform backend data for Google Maps (lon → lng conversion)
                this.mapData = data.map(point => ({
                    lat: point.lat || point.latitude,
                    lng: point.lon || point.lng || point.longitude,
                    severity: point.severity,
                    weight: this.getSeverityWeight(point.severity),
                    color: point.color || this.getSeverityColor(point.severity)
                }));

                console.log('Parsed AWS map data points:', this.mapData.length);

                // Cache the original data for filtering
                this.cachedMapData = [...this.mapData];
            } else {
                console.warn('Backend returned invalid or empty map data, using mock data');
                throw new Error('Invalid data format from backend');
            }

            // Render based on current mode
            console.log('Map data loaded successfully, rendering...');
            this.renderMap();
        } catch (error) {
            console.error('Failed to load map data from backend:', error);
            console.log('Using generated mock data as fallback');

            // Use mock data as fallback
            this.mapData = this.generateMockMapData();
            console.log('Generated mock data points:', this.mapData.length);

            // Cache the original data for filtering
            this.cachedMapData = [...this.mapData];

            this.renderMap();
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

    getSeverityWeight(severity) {
        // Map severity to weight for Google Maps heatmap
        // High intensity areas get higher weights
        const severityMap = {
            'High': 3,
            'Moderate': 2,
            'Low': 1
        };
        return severityMap[severity] || 2; // Default to Moderate if unknown
    }

    generateMockMapData() {
        const data = [];
        const center = this.currentLocation;
        const severities = ['Low', 'Moderate', 'High'];

        for (let i = 0; i < 50; i++) {
            const lat = center.lat + (Math.random() - 0.5) * 0.2;
            const lng = center.lng + (Math.random() - 0.5) * 0.2;
            const severityIdx = Math.floor(Math.random() * 3);
            const severity = severities[severityIdx];

            data.push({
                lat,
                lng,
                severity,
                weight: this.getSeverityWeight(severity),
                color: this.getSeverityColor(severity)
            });
        }

        return data;
    }

    // Helper: Box-Muller transform for Gaussian distribution
    randomGaussian() {
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    // Generate risk cloud: create scattered points around a main point for realistic zones
    // CRITICAL: Weight is distributed across points to prevent false high-intensity centers
    generateRiskCloud(point, count, spreadKm, originalWeight) {
        const points = [];
        const spreadInDegrees = spreadKm / 111.32; // Convert km to degrees (approx)

        // Distribute weight to prevent overlapping points from creating false high-risk zones
        // LINEAR DISTRIBUTION: Preserves total intensity when points overlap
        // Example: originalWeight=1, count=50 → each point=0.02, total at center=1 ✅
        // Previous (sqrt): 1/sqrt(50)=0.14, total=7 ❌ (caused red zones for low risk!)
        const distributedWeight = originalWeight / count;

        for (let i = 0; i < count; i++) {
            // Gaussian distribution for realistic clustering
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.abs(this.randomGaussian()) * spreadInDegrees;

            const offsetLat = radius * Math.cos(angle);
            const offsetLng = radius * Math.sin(angle);

            points.push({
                lat: point.lat + offsetLat,
                lng: point.lng + offsetLng,
                weight: distributedWeight  //  FIXED: distribute weight instead of using full weight
            });
        }

        return points;
    }

    // Create heatmap points: expand small datasets with risk clouds
    createHeatmapPoints(mapData) {
        if (!mapData || mapData.length === 0) {
            console.warn('No map data provided to createHeatmapPoints');
            return [];
        }

        console.log('Creating heatmap points from', mapData.length, 'data points');

        // If we have enough points (>= 10), use them directly
        if (mapData.length >= 10) {
            console.log('Sufficient data points, using direct mapping');
            return mapData.map(point => ({
                location: new google.maps.LatLng(point.lat, point.lng),
                weight: point.weight
            }));
        }

        // For small datasets, generate risk clouds around each point
        console.log('Small dataset detected, generating risk clouds with distributed weights');
        const expandedPoints = [];

        mapData.forEach(point => {
            // Generate 40-80 scattered points around each main point
            const cloudSize = 40 + Math.floor(Math.random() * 41); // 40-80 points
            const spreadRadius = 1 + Math.random() * 2; // 1-3 km spread

            console.log(`Generating cloud of ${cloudSize} points with ${spreadRadius.toFixed(2)}km radius for severity "${point.severity}" (weight: ${point.weight}) at [${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}]`);

            const cloudPoints = this.generateRiskCloud(point, cloudSize, spreadRadius, point.weight);

            // Convert to Google Maps format
            cloudPoints.forEach(cp => {
                expandedPoints.push({
                    location: new google.maps.LatLng(cp.lat, cp.lng),
                    weight: cp.weight  // Already distributed in generateRiskCloud
                });
            });
        });

        console.log('✅ Generated', expandedPoints.length, 'total heatmap points from', mapData.length, 'original points with distributed weights');
        return expandedPoints;
    }

    // Render map based on current mode
    renderMap() {
        if (this.isHeatmapMode) {
            this.renderHeatmap(this.mapData);
        } else {
            this.renderMarkers(this.mapData);
        }
    }

    // Render markers for Normal Map mode
    renderMarkers(points) {
        if (!this.map) {
            console.error('Map not initialized, cannot render markers');
            return;
        }

        console.log('Rendering markers for', points.length, 'data points');

        // Clear existing markers
        if (this.markers && this.markers.length > 0) {
            this.markers.forEach(marker => marker.setMap(null));
            this.markers = [];
        }

        // Hide heatmap if visible
        if (this.heatLayer) {
            this.heatLayer.setMap(null);
        }

        // Create markers for each point
        points.forEach(point => {
            const marker = new google.maps.Marker({
                position: { lat: point.lat, lng: point.lng },
                map: this.map,
                title: `Risk: ${point.severity}`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: point.color,
                    fillOpacity: 0.8,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: 8
                }
            });

            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <strong>Climate Risk</strong><br>
                        <span style="color: ${point.color}; font-weight: bold;">${point.severity}</span><br>
                        <small>Lat: ${point.lat.toFixed(4)}, Lng: ${point.lng.toFixed(4)}</small>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(this.map, marker);
            });

            this.markers.push(marker);
        });

        console.log('Markers rendered:', this.markers.length);
    }

    // Render heatmap for Heatmap Mode
    renderHeatmap(points) {
        if (!this.map) {
            console.error('Map not initialized, cannot create heatmap');
            return;
        }

        console.log('Creating Google Maps heatmap with', points.length, 'data points');

        // Clear existing markers
        if (this.markers && this.markers.length > 0) {
            this.markers.forEach(marker => marker.setMap(null));
        }

        // Remove existing heatmap layer if it exists
        if (this.heatLayer) {
            this.heatLayer.setMap(null);
        }

        // Create heatmap points with risk cloud generation
        const heatmapData = this.createHeatmapPoints(points);

        if (heatmapData.length === 0) {
            console.warn('No heatmap data to render');
            return;
        }

        console.log('Heatmap data prepared:', heatmapData.length, 'weighted points');
        if (heatmapData.length > 0) {
            console.log('Sample heatmap point:', {
                lat: heatmapData[0].location.lat(),
                lng: heatmapData[0].location.lng(),
                weight: heatmapData[0].weight
            });
        }

        // Create Google Maps heatmap layer with REALISTIC RISK-BASED configuration
        // Weight mapping: 1 = Low (green), 2 = Moderate (yellow), 3 = High (red)
        this.heatLayer = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: this.map,
            radius: 60,              // Wide coverage for zone-like appearance
            opacity: 0.5,            // Balanced opacity for clear visibility
            dissipating: true,       // Smooth edges for natural zones
            maxIntensity: 3,         // Maximum weight is 3 (High severity)
            // REALISTIC GRADIENT: Maps weights directly to risk levels
            // 0-33%: Green (Low risk, weight ~1)
            // 34-66%: Yellow (Moderate risk, weight ~2)  
            // 67-100%: Red (High risk, weight ~3)
            gradient: [
                'rgba(0,255,0,0)',         // 0% - Transparent (no data)
                'rgba(0,255,0,0.3)',       // 5% - Very light green
                'rgba(0,255,0,0.5)',       // 10% - Light green
                'rgba(0,255,0,0.7)',       // 15% - Green (Low risk starts)
                'rgba(50,205,50,0.75)',    // 20% - Medium green
                'rgba(34,139,34,0.8)',     // 25% - Forest green  
                'rgba(124,252,0,0.75)',    // 30% - Yellow-green (transition)
                'rgba(173,255,47,0.75)',   // 35% - Green-yellow
                'rgba(255,255,0,0.7)',     // 40% - Yellow (Moderate risk starts)
                'rgba(255,215,0,0.75)',    // 45% - Gold
                'rgba(255,200,0,0.75)',    // 50% - Golden yellow
                'rgba(255,180,0,0.8)',     // 55% - Orange-yellow
                'rgba(255,165,0,0.8)',     // 60% - Orange (transition)
                'rgba(255,140,0,0.8)',     // 65% - Dark orange
                'rgba(255,100,0,0.85)',    // 70% - Red-orange (High risk starts)
                'rgba(255,69,0,0.85)',     // 75% - Orange-red
                'rgba(255,50,0,0.9)',      // 80% - Red
                'rgba(255,20,0,0.9)',      // 85% - Bright red
                'rgba(255,0,0,0.9)',       // 90% - Pure red
                'rgba(220,0,0,0.95)',      // 95% - Dark red
                'rgba(180,0,0,1.0)'        // 100% - Deep red (extreme)
            ]
        });

        console.log('✅ Realistic climate risk heatmap created with:');
        console.log('   - Radius: 60 (zone coverage)');
        console.log('   - Opacity: 0.5 (balanced visibility)');
        console.log('   - MaxIntensity: 3 (weight scale: 1=Low, 2=Moderate, 3=High)');
        console.log('   - Gradient: Green (0-33%) → Yellow (34-66%) → Red (67-100%)');
        console.log('   - Color mapping: Weight 1=Green, Weight 2=Yellow, Weight 3=Red');
    }

    // NEW: Switch between Regional and User Location heatmap layers
    switchHeatmapLayer(layer) {
        if (!this.isHeatmapMode) {
            console.log('Not in heatmap mode, ignoring layer switch');
            return;
        }

        this.currentHeatmapLayer = layer;

        // Update button states
        const regionalBtn = document.getElementById('regional-layer-btn');
        const userBtn = document.getElementById('user-layer-btn');

        if (layer === 'regional') {
            regionalBtn.classList.add('active');
            userBtn.classList.remove('active');

            // Show regional heatmap, hide user heatmap
            if (this.heatLayer) {
                this.heatLayer.setMap(this.map);
            }
            if (this.userLocationHeatLayer) {
                this.userLocationHeatLayer.setMap(null);
            }

            console.log('✅ Switched to Regional Risk heatmap');
        } else if (layer === 'user') {
            userBtn.classList.add('active');
            regionalBtn.classList.remove('active');

            // Generate user location heatmap if not exists
            if (!this.userLocationHeatLayer && this.currentLocation) {
                this.generateUserLocationHeatmap();
            }

            // Show user heatmap, hide regional heatmap
            if (this.userLocationHeatLayer) {
                this.userLocationHeatLayer.setMap(this.map);
            }
            if (this.heatLayer) {
                this.heatLayer.setMap(null);
            }

            console.log('✅ Switched to My Location Risk heatmap');
        }
    }

    // NEW: Generate heatmap focused on user's current location
    generateUserLocationHeatmap() {
        if (!this.currentLocation || !this.map) {
            console.error('Cannot generate user location heatmap: location or map not available');
            return;
        }

        console.log('Generating user location heatmap...');

        // Determine severity weight based on current climate data or default to Moderate (2)
        let severityWeight = 2; // Default: Moderate

        if (this.backendRiskData) {
            // Calculate average risk from backend data
            const risks = [
                this.backendRiskData.heat_risk,
                this.backendRiskData.flood_risk,
                this.backendRiskData.drought_risk
            ];
            const riskValues = { 'Low': 1, 'Moderate': 2, 'High': 3 };
            const avgRisk = risks.reduce((sum, risk) => sum + (riskValues[risk] || 2), 0) / risks.length;
            severityWeight = Math.round(avgRisk);
        }

        // Generate risk cloud around user's location (100-150 points, 2-5km spread)
        const cloudSize = 100 + Math.floor(Math.random() * 51); // 100-150 points
        const spreadRadius = 2 + Math.random() * 3; // 2-5 km spread

        console.log(`Generating user location risk cloud: ${cloudSize} points, ${spreadRadius.toFixed(2)}km radius, weight: ${severityWeight}`);

        const userPoint = {
            lat: this.currentLocation.lat,
            lng: this.currentLocation.lng,
            weight: severityWeight
        };

        const cloudPoints = this.generateRiskCloud(userPoint, cloudSize, spreadRadius, severityWeight);

        // Convert to Google Maps format
        const heatmapData = cloudPoints.map(cp => ({
            location: new google.maps.LatLng(cp.lat, cp.lng),
            weight: cp.weight
        }));

        // Create user location heatmap layer
        this.userLocationHeatLayer = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: null, // Don't show immediately
            radius: 60,
            opacity: 0.45,
            dissipating: true,
            maxIntensity: 3,
            gradient: [
                'rgba(0,255,0,0)',
                'rgba(0,255,0,0.6)',
                'rgba(124,252,0,0.65)',
                'rgba(173,255,47,0.7)',
                'rgba(255,255,0,0.7)',
                'rgba(255,215,0,0.75)',
                'rgba(255,165,0,0.8)',
                'rgba(255,140,0,0.85)',
                'rgba(255,69,0,0.9)',
                'rgba(255,0,0,0.9)'
            ]
        });

        console.log(' User location heatmap layer created');
    }

    toggleMapMode(isHeatmap) {
        this.isHeatmapMode = isHeatmap;

        const normalMapBtn = document.getElementById('normal-map-btn');
        const heatmapBtn = document.getElementById('heatmap-btn');
        const layerControls = document.getElementById('heatmap-layer-controls');

        if (isHeatmap) {
            normalMapBtn.classList.remove('active');
            heatmapBtn.classList.add('active');

            // Show layer controls
            if (layerControls) {
                layerControls.style.display = 'flex';
            }

            // Show heatmap based on current layer selection
            if (this.currentHeatmapLayer === 'regional') {
                this.renderHeatmap(this.mapData);
            } else if (this.currentHeatmapLayer === 'user') {
                if (!this.userLocationHeatLayer && this.currentLocation) {
                    this.generateUserLocationHeatmap();
                }
                if (this.userLocationHeatLayer) {
                    this.userLocationHeatLayer.setMap(this.map);
                }
            }
        } else {
            heatmapBtn.classList.remove('active');
            normalMapBtn.classList.add('active');

            // Hide layer controls
            if (layerControls) {
                layerControls.style.display = 'none';
            }

            // Hide all heatmaps, show markers
            if (this.heatLayer) {
                this.heatLayer.setMap(null);
            }
            if (this.userLocationHeatLayer) {
                this.userLocationHeatLayer.setMap(null);
            }
            this.renderMarkers(this.mapData);
        }
    }

    async loadRiskAnalysis() {
        if (!this.currentClimate) {
            console.warn('No climate data available for risk analysis');
            return;
        }

        try {
            console.log('Starting risk analysis with climate data:', this.currentClimate);

            // Fetch risk analysis from AWS backend
            const riskData = await this.fetchRiskAnalysis(this.currentClimate);
            console.log(' Risk analysis received:', riskData);

            // Store risk data for later use
            this.backendRiskData = riskData;

            // Update risk cards
            this.updateRiskCards(riskData);

            // Fetch AI explanation
            try {
                const aiExplanation = await this.fetchAIExplanation(riskData);
                console.log('✅ AI explanation received:', aiExplanation);

                // Update verdict card with AI explanation
                this.updateVerdictCard({
                    riskLevel: this.calculateOverallRisk(riskData),
                    confidence: aiExplanation.confidence || 85,
                    summary: aiExplanation.explanation || aiExplanation.summary || 'Climate risk assessment completed based on current conditions.'
                });
            } catch (aiError) {
                console.warn('AI explanation failed, using fallback:', aiError);
                // Fallback: still update verdict card without AI explanation
                this.updateVerdictCard({
                    riskLevel: this.calculateOverallRisk(riskData),
                    confidence: 75,
                    summary: `Based on current conditions - Heat Risk: ${riskData.heat_risk}, Flood Risk: ${riskData.flood_risk}, Drought Risk: ${riskData.drought_risk}. Stay informed about local weather conditions.`
                });
            }
        } catch (error) {
            console.error('❌ Failed to load risk analysis:', error);

            // Show generic risk assessment as fallback
            const fallbackRiskData = {
                heat_risk: 'Moderate',
                flood_risk: 'Low',
                drought_risk: 'Low'
            };

            this.updateRiskCards(fallbackRiskData);

            // Still try to get AI explanation with fallback data
            try {
                console.log(' Attempting Groq AI analysis with fallback risk data...');
                const aiExplanation = await this.fetchAIExplanation(fallbackRiskData);
                console.log(' Groq AI explanation received:', aiExplanation);

                this.updateVerdictCard({
                    riskLevel: this.calculateOverallRisk(fallbackRiskData),
                    confidence: aiExplanation.confidence || 75,
                    summary: aiExplanation.explanation || aiExplanation.summary || 'Climate risk assessment based on current conditions.'
                });
            } catch (aiError) {
                console.warn(' AI explanation also failed, using basic fallback:', aiError);
                // Ultimate fallback - no AI available
                this.updateVerdictCard({
                    riskLevel: 'moderate',
                    confidence: 50,
                    summary: 'Unable to fetch real-time risk data. Showing estimated risk levels. Please refresh to try again.'
                });
            }
        }
    }

    async fetchRiskAnalysis(climateData) {
        try {
            if (!this.currentLocation) {
                throw new Error('Location not available for risk analysis');
            }

            const { lat, lng } = this.currentLocation;
            const url = `/api/analysis/risk?lat=${lat}&lon=${lng}`;
            console.log('Fetching risk analysis from local proxy:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Risk analysis API error ${response.status}:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Risk analysis API response:', data);

            // Ensure response has expected structure
            if (!data.heat_risk || !data.flood_risk || !data.drought_risk) {
                console.warn('Risk analysis response missing expected fields, using defaults');
                return {
                    heat_risk: data.heat_risk || 'Moderate',
                    flood_risk: data.flood_risk || 'Low',
                    drought_risk: data.drought_risk || 'Low'
                };
            }

            return data;
        } catch (error) {
            console.error('Failed to fetch risk analysis:', error);
            throw error;
        }
    }

    async fetchAIExplanation(riskData) {
        try {
            console.log('Fetching AI explanation for risk data:', riskData);

            const response = await fetch('/api/ai/explain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    heat_risk: riskData.heat_risk,
                    flood_risk: riskData.flood_risk,
                    drought_risk: riskData.drought_risk,
                    temperature: this.currentClimate?.temperature,
                    humidity: this.currentClimate?.humidity,
                    rainfall: this.currentClimate?.rainfall,
                    lat: this.currentLocation?.lat,
                    lon: this.currentLocation?.lng
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`AI explanation API error ${response.status}:`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('AI explanation API response:', data);

            // Handle different possible response formats
            // The API might return: { explanation: "...", confidence: 85 }
            // or { summary: "...", confidence: "High" }
            // or { message: "...", risk_level: "moderate" }

            return {
                explanation: data.explanation || data.summary || data.message || 'AI analysis completed successfully.',
                confidence: typeof data.confidence === 'number' ? data.confidence :
                    data.confidence === 'High' ? 90 :
                        data.confidence === 'Medium' ? 75 :
                            data.confidence === 'Low' ? 60 : 80
            };
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

        console.log('Applying filters:', { riskFilter, timeFilter });

        this.showLoading(true);

        // Apply filters after a short delay to show loading state
        setTimeout(() => {
            // Filter heatmap data by risk level
            this.filterHeatmapByRisk(riskFilter);

            // Update charts based on time range
            this.updateChartsByTimeRange(timeFilter);

            this.showLoading(false);

            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'success fade-in';
            successDiv.textContent = `Filters applied: ${riskFilter === 'all' ? 'All Levels' : riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1) + ' Risk'} | ${timeFilter === 'current' ? 'Current' : timeFilter}`;
            document.body.appendChild(successDiv);

            setTimeout(() => successDiv.remove(), 3000);
        }, 500);
    }

    filterHeatmapByRisk(riskLevel) {
        // If no map data cached, reload fresh data
        if (!this.cachedMapData || this.cachedMapData.length === 0) {
            console.warn('No cached map data, reloading...');
            this.loadMapData();
            return;
        }

        let filteredData = this.cachedMapData;

        // Filter by risk level if not "all"
        if (riskLevel !== 'all') {
            // Map risk filter values to severity strings
            const severityMap = {
                'high': 'High',
                'medium': 'Moderate',
                'low': 'Low'
            };

            const targetSeverity = severityMap[riskLevel];
            filteredData = this.cachedMapData.filter(point => point.severity === targetSeverity);

            console.log(`Filtered to ${riskLevel} risk: ${filteredData.length} points out of ${this.cachedMapData.length}`);
        }

        // Re-render the map with filtered data
        this.renderMap(filteredData);
    }

    updateChartsByTimeRange(timeRange) {
        // Map time filter to number of years
        const yearMap = {
            'current': 1,
            '1year': 1,
            '5years': 5,
            '10years': 10
        };

        const years = yearMap[timeRange] || 1;

        // Update the temperature chart with the selected time range
        if (this.chart) {
            // Get the last N years of data
            const allYears = Array.from({ length: 21 }, (_, i) => 2005 + i); // 2005-2025
            const filteredYears = allYears.slice(-years);

            // Update chart data
            this.chart.data.labels = filteredYears;
            this.chart.data.datasets[0].data = filteredYears.map(year => {
                // Use cached temperature data or generate based on year
                const baseTemp = 22;
                const yearOffset = (year - 2005) * 0.15; // Gradual warming trend
                return (baseTemp + yearOffset + Math.random() * 2).toFixed(1);
            });

            this.chart.update();
            console.log(`Updated chart to show ${years} year(s) of data`);
        }
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

// Initialize dashboard when page loads - after config is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure config is loaded before initializing dashboard
    await loadServerConfig();
    new ClimateDashboard();
});
