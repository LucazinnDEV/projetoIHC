// State
let busRoutes = [];
let map;
let routeLayers = {};
let allStopsLayer;
let highlightedLayerGroup;
let currentFavoriteBtn = null
let selectedRouteId = null;

let userMarker = null;           // marcador azul  do usuário
let nearbyStopMarkers = [];      // marcadores de terminais próximos
let routeStopMarkers = [];       // marcadores numerados das paradas da rota selecionada
let userCoords = null;           // { lat, lng } do usuário
let currentSelectedRoute = null; // rota atualmente selecionada

// Terminais fixos usados para calcular paradas próximas (add em terminais.json)
const TERMINALS = [
    { name: 'TI Joana Bezerra',  lat: -8.080956, lng: -34.897512 },
    { name: 'TI Aeroporto',      lat: -8.129722, lng: -34.923056 },
    { name: 'TI Recife',         lat: -8.063889, lng: -34.871111 },
    { name: 'Shopping RioMar',   lat: -8.080897, lng: -34.897078 },
    { name: 'Recife Antigo',     lat: -8.062778, lng: -34.871111 }
];


// Constants
const RECIFE_ANTIGO_COORDS = [-8.061, -34.873];
const STORAGE_KEY_HISTORY = 'recifeHub_history';
const STORAGE_KEY_USER = 'recifeHub_user';
const STORAGE_KEY_FAVORITES = 'recifeHub_favorites';

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initUI();
    await loadData();
    initGeolocation();
    
    // Check auto-select
    const autoSelectId = sessionStorage.getItem('recifeHub_autoSelectRoute');
    if (autoSelectId) {
        sessionStorage.removeItem('recifeHub_autoSelectRoute');
        const targetRoute = busRoutes.find(r => r.id === autoSelectId || r.id.toString() === autoSelectId.toString());
        if (targetRoute) {
            selectRoute(targetRoute);
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = targetRoute.name;
        }
    }
});

function initMap() {
    map = L.map('map', { zoomControl: false }).setView(RECIFE_ANTIGO_COORDS, 15);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a> OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    allStopsLayer = L.layerGroup().addTo(map);
    highlightedLayerGroup = L.layerGroup().addTo(map);

    map.on('click', () => {
        closeInfoSidebar();
    });
}

// Geolocalização
function initGeolocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude: lat, longitude: lng } = position.coords;
            userCoords = { lat, lng };

            map.setView([lat, lng], 15);

            userMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div class="user-dot"><div class="user-pulse"></div></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(map);

            userMarker.bindPopup('<strong>Você está aqui</strong>');

            showNearbyTerminals(lat, lng);
        },
        (err) => {
            console.warn('Geolocalização não disponível:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}
// Haversine
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Terminais próximos
function showNearbyTerminals(userLat, userLng) {
    clearNearbyStopMarkers();

    const MAX_DISTANCE_KM = 5;

    TERMINALS.forEach(terminal => {
        const distance = haversineDistance(userLat, userLng, terminal.lat, terminal.lng);
        if (distance > MAX_DISTANCE_KM) return;

        const marker = L.marker([terminal.lat, terminal.lng], {
            icon: L.divIcon({
                className: 'nearby-stop-marker',
                html: `<div class="stop-marker-content"><i class="fa-solid fa-bus"></i></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        }).addTo(map);

        marker.bindPopup(`
            <strong>${terminal.name}</strong><br>
            <small>~${distance.toFixed(1)} km de você</small>
        `);

        nearbyStopMarkers.push(marker);
    });
}

function clearNearbyStopMarkers() {
    nearbyStopMarkers.forEach(m => m.remove());
    nearbyStopMarkers = [];
}


function restoreUserAndNearbyMarkers() {
    if (userCoords && !userMarker) {
        userMarker = L.marker([userCoords.lat, userCoords.lng], {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<div class="user-dot"><div class="user-pulse"></div></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map);
        userMarker.bindPopup('<strong>Você está aqui</strong>');
    } else if (userCoords && userMarker) {
        if (!map.hasLayer(userMarker)) userMarker.addTo(map);
    }

    if (userCoords) {
        showNearbyTerminals(userCoords.lat, userCoords.lng);
    }
}
// Paradas da rota
function getEvenlySpacedStops(path, count = 9) {
    if (!path || path.length < 2) return [];
    const stops = [];
    const step = (path.length - 1) / (count - 1);
    for (let i = 0; i < count; i++) {
        const idx = Math.round(i * step);
        stops.push(path[Math.min(idx, path.length - 1)]);
    }
    return stops;
}

function showRouteStops(route) {
    clearRouteStopMarkers();

    const stops = getEvenlySpacedStops(route.path, 9);

    stops.forEach((point, i) => {
        let html;
        if (i === 0) {
            html = `<div class="route-stop-dot" style="color:${route.color}; border-color:${route.color};">A</div>`;
        } else if (i === stops.length - 1) {
            html = `<div class="route-stop-dot" style="color:${route.color}; border-color:${route.color};">B</div>`;
        } else {
            html = `<div class="route-stop-dot" style="color:${route.color}; border-color:${route.color};">${i}</div>`;
        }

        const marker = L.marker(point, {
            icon: L.divIcon({
                className: 'route-stop-marker',
                html,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            })
        }).addTo(map);

        routeStopMarkers.push(marker);
    });
}

function clearRouteStopMarkers() {
    routeStopMarkers.forEach(m => m.remove());
    routeStopMarkers = [];
}

// Painel de informações da rota
function openRoutePanel(route) {
    const panel = document.getElementById('routeInfoPanel');
    const content = document.getElementById('panelContent');

    const metaHTML = `
        <p class="panel-section-title">Informações</p>
        <div class="panel-meta-grid">
            <div class="panel-meta-item">
                <span class="panel-meta-icon"><i class="fa-solid fa-coins"></i></span>
                <span class="panel-meta-label">Tarifa</span>
                <span class="panel-meta-value">R$ ${route.fare ? route.fare.toFixed(2) : '—'}</span>
            </div>
            <div class="panel-meta-item">
                <span class="panel-meta-icon"><i class="fa-solid fa-stopwatch"></i></span>
                <span class="panel-meta-label">Duração</span>
                <span class="panel-meta-value">${route.duration ? route.duration + ' min' : '—'}</span>
            </div>
            <div class="panel-meta-item">
                <span class="panel-meta-icon"><i class="fa-solid fa-rotate"></i></span>
                <span class="panel-meta-label">Frequência</span>
                <span class="panel-meta-value">${route.frequency || '—'}</span>
            </div>
            <div class="panel-meta-item">
                <span class="panel-meta-icon"><i class="fa-solid fa-wheelchair"></i></span>
                <span class="panel-meta-label">Acessível</span>
                <span class="panel-meta-value">${route.accessible ? 'Sim' : 'Não'}</span>
            </div>
            <div class="panel-meta-item">
                <span class="panel-meta-icon"><i class="fa-solid fa-snowflake"></i></span>
                <span class="panel-meta-label">Ar cond.</span>
                <span class="panel-meta-value">${route.airConditioning ? 'Sim' : 'Não'}</span>
            </div>
        </div>
    `;

    const nearbyToRoute = userCoords
        ? TERMINALS.filter(t => haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng) <= 5)
        : [];

    const nearbyHTML = nearbyToRoute.length > 0
        ? `<p class="panel-section-title">Terminais próximos de você</p>
           ${nearbyToRoute.map(t => {
               const d = haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng).toFixed(1);
               return `<div class="panel-nearby-item">
                   <i class="fa-solid fa-bus-simple"></i>
                   <span><strong>${t.name}</strong><br><small>~${d} km de você</small></span>
               </div>`;
           }).join('')}`
        : '';

    content.innerHTML = `
        <div class="panel-route-header">
            <div class="panel-route-color-bar" style="background:${route.color}"></div>
            <div>
                <div class="panel-route-name">${route.name}</div>
                <div class="panel-route-id">Linha ${route.id}</div>
            </div>
        </div>

        ${metaHTML}

        <p class="panel-section-title">Paradas da rota</p>
        <ul class="panel-stops-list">
            ${(route.stops || []).map((stop, i, arr) => {
                const badge = i === 0 ? 'A' : i === arr.length - 1 ? 'B' : i;
                return `<li class="panel-stop-item">
                    <div class="panel-stop-badge" style="background:${route.color}">${badge}</div>
                    <span>${stop}</span>
                </li>`;
            }).join('')}
        </ul>

        ${nearbyHTML}
    `;

    panel.classList.add('active');
}

function closeRoutePanel() {
    document.getElementById('routeInfoPanel').classList.remove('active');
}

// Sidebar de informações
function openInfoSidebar(type, data) {
    const sidebar  = document.getElementById('infoSidebar');
    const iconEl   = sidebar.querySelector('.sidebar-icon');
    const titleEl  = sidebar.querySelector('.sidebar-title');
    const bodyEl   = sidebar.querySelector('.sidebar-body');

    if (type === 'route') {
        const isFav = isFavorite(data.id);
        const returnColor = routeLayers[data.id]?.returnColor || data.color;

        const nearbyTerminals = userCoords
            ? TERMINALS.filter(t => haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng) <= 5)
            : [];
        const nearbyHTML = nearbyTerminals.length > 0
            ? `<p class="sidebar-section-title">Terminais próximos</p>
               ${nearbyTerminals.map(t => {
                   const d = haversineDistance(userCoords.lat, userCoords.lng, t.lat, t.lng).toFixed(1);
                   return `<div class="info-item">
                       <i class="fa-solid fa-bus-simple" style="color:#10b981;"></i>
                       <div>
                           <div class="info-label">${t.name}</div>
                           <div class="info-value" style="font-size:14px;">~${d} km de você</div>
                       </div>
                   </div>`;
               }).join('')}`
            : '';

        iconEl.style.background = data.color + '22';
        iconEl.innerHTML = `<i class="fa-solid fa-bus" style="color:${data.color};"></i>`;
        titleEl.textContent = data.name;

        bodyEl.innerHTML = `
            <div class="route-direction-legend">
                <div class="direction-item">
                    <span class="direction-bar" style="background:${data.color}"></span>
                    <span>Ida</span>
                </div>
                <div class="direction-item">
                    <span class="direction-bar" style="background:${returnColor}"></span>
                    <span>Volta</span>
                </div>
            </div>
            <div class="info-item">
                <i class="fa-solid fa-coins" style="color:#64748b;"></i>
                <div>
                    <div class="info-label">Tarifa</div>
                    <div class="info-value">R$ ${data.fare ? data.fare.toFixed(2) : '—'}</div>
                </div>
            </div>
            <div class="info-item">
                <i class="fa-solid fa-stopwatch" style="color:#64748b;"></i>
                <div>
                    <div class="info-label">Duração estimada</div>
                    <div class="info-value">${data.duration ? data.duration + ' min' : '—'}</div>
                </div>
            </div>
            <div class="info-item">
                <i class="fa-solid fa-rotate" style="color:#64748b;"></i>
                <div>
                    <div class="info-label">Frequência</div>
                    <div class="info-value">${data.frequency || '—'}</div>
                </div>
            </div>
            <div class="info-item">
                <i class="fa-solid fa-wheelchair" style="color:#64748b;"></i>
                <div>
                    <div class="info-label">Acessibilidade</div>
                    <div class="info-value">${data.accessible ? 'Acessível' : 'Não acessível'}</div>
                </div>
            </div>
            <div class="info-item">
                <i class="fa-solid fa-snowflake" style="color:#64748b;"></i>
                <div>
                    <div class="info-label">Ar condicionado</div>
                    <div class="info-value">${data.airConditioning ? 'Sim' : 'Não'}</div>
                </div>
            </div>
            <div class="info-item">
                <i class="fa-solid fa-bus" style="color:#64748b;"></i>
                <div class="terminal-info-container">
                <div class="terminal-name">
                    <div class="info-label">Terminal</div>
                    <div class="info-value">${data.terminal || '—'}</div>
                </div>
               <div class="terminal-info-icon">
               <i class="fa-solid fa-circle-info"></i>
                </div>
                </div>
            </div>
            ${data.integration ?
                ` 
                <div class="info-item">
                <i class="fa-solid fa-ticket"></i>
                <div class="integration-container">
                <div class="info-label">
                Possui integração com ${data.integration_place}
                </div>
                <div class="integration-more-info">
                <i class="fa-solid fa-circle-question"></i>
                </div>
                </div>
                
                </div>
            </div>
                `: ""
            }

            ${nearbyHTML}

            <p class="sidebar-section-title">Paradas da linha</p>
            <ul class="panel-stops-list">
                ${(data.stops || []).map((stop, i, arr) => {
                    const badge = i === 0 ? 'A' : i === arr.length - 1 ? 'B' : i;
                    return `<li class="panel-stop-item">
                        <div class="panel-stop-badge" style="background:${data.color}">${badge}</div>
                        <span>${stop}</span>
                    </li>`;
                }).join('')}
            </ul>

            <!-- Botão favoritar -->
            <button class="sidebar-fav-btn ${isFav ? 'favorited' : ''}"
                    id="sidebarFavBtn"
                    onclick="toggleSidebarFavorite()">
                <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
                ${isFav ? 'Favoritado' : 'Favoritar rota'}
            </button>
        `;
    }

    sidebar.classList.add('active');
}

function closeInfoSidebar() {
    document.getElementById('infoSidebar').classList.remove('active');
}

function toggleSidebarFavorite() {
    if (!currentSelectedRoute) return;
    toggleFavorite(currentSelectedRoute);

    const btn = document.getElementById('sidebarFavBtn');
    if (!btn) return;
    const isFav = isFavorite(currentSelectedRoute.id);
    btn.className = `sidebar-fav-btn ${isFav ? 'favorited' : ''}`;
    btn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i> ${isFav ? 'Favoritado' : 'Favoritar rota'}`;
}

async function loadData() {
    try {
        const response = await fetch('assets/rotas.json');
        if (!response.ok) throw new Error('Network response was not ok');
        busRoutes = await response.json();
        document.getElementById('loadingOverlay').style.opacity = '0';
        setTimeout(() => document.getElementById('loadingOverlay').style.display = 'none', 500);

        drawAllRoutes();
    } catch (error) {
        console.error("Error loading routes:", error);
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.opacity = '1';
        overlay.innerHTML = `
            <div style="text-align:center; max-width:400px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:4rem; color:#ef4444; margin-bottom:20px;"></i>
                <h2 style="color:#1e293b; margin-bottom:12px; font-size:1.5rem;">Erro ao Carregar Rotas :(</h2>
                <p style="color:#64748b; margin-bottom:30px; line-height:1.6;">
                    Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente.
                </p>
                <button onclick="location.reload()" style="
                    padding:14px 28px; 
                    background:#4f46e5; 
                    color:white; 
                    border:none; 
                    border-radius:12px; 
                    font-weight:600; 
                    font-size:1rem;
                    cursor:pointer; 
                    box-shadow:0 4px 12px rgba(79,70,229,0.3);
                    transition: all 0.2s;
                " onmouseover="this.style.background='#4338ca'; this.style.transform='translateY(-2px)';" 
                   onmouseout="this.style.background='#4f46e5'; this.style.transform='translateY(0)';">
                    <i class="fa-solid fa-rotate-right"></i> Tentar Novamente
                </button>
            </div>
        `;
    }
}

function deriveReturnColor(hex) {
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    h = (h + 0.5) % 1;
    function hue2rgb(p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p2 = 2 * l - q2;
    const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toHex(hue2rgb(p2,q2,h+1/3))}${toHex(hue2rgb(p2,q2,h))}${toHex(hue2rgb(p2,q2,h-1/3))}`;
}

// Rotas
function drawAllRoutes() {
    busRoutes.forEach(route => {
        const mid = Math.floor(route.path.length / 2);
        const pathGo     = route.path.slice(0, mid + 1);
        const pathReturn = route.path.slice(mid);
        const returnColor = deriveReturnColor(route.color);

        const polylineGo = L.polyline(pathGo, {
            color: route.color, weight: 4, opacity: 0
        }).addTo(map);

        const polylineReturn = L.polyline(pathReturn, {
            color: returnColor, weight: 4, opacity: 0
        }).addTo(map);

        [polylineGo, polylineReturn].forEach(pl => {
            pl.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                selectRoute(route);
                document.getElementById('searchInput').value = route.name;
            });
        });

        routeLayers[route.id] = { polylineGo, polylineReturn, returnColor, data: route };
    });
}

// Seleciona rota
function selectRoute(route) {
    currentSelectedRoute = route;

    if (userMarker) userMarker.remove();
    clearNearbyStopMarkers();

    Object.values(routeLayers).forEach(({ polylineGo, polylineReturn }) => {
        polylineGo.setStyle({ weight: 4, opacity: 0 });
        polylineReturn.setStyle({ weight: 4, opacity: 0 });
    });

    highlightedLayerGroup.clearLayers();
    clearRouteStopMarkers();

    const { polylineGo, polylineReturn, returnColor } = routeLayers[route.id];
    polylineGo.setStyle({ color: route.color, weight: 4, opacity: 1 });
    polylineReturn.setStyle({ color: returnColor, weight: 4, opacity: 1 });
    polylineGo.bringToFront();
    polylineReturn.bringToFront();

    showRouteStops(route);

    const bounds = polylineGo.getBounds().extend(polylineReturn.getBounds());
    map.fitBounds(bounds.pad(0.1));

    addToHistory(route);
    closeSearchDropdown();

    openInfoSidebar('route', route);
}

function resetMap() {
    currentSelectedRoute = null;

    Object.values(routeLayers).forEach(({ polylineGo, polylineReturn, returnColor, data }) => {
        polylineGo.setStyle({ color: data.color, weight: 4, opacity: 0 });
        polylineReturn.setStyle({ color: returnColor, weight: 4, opacity: 0 });
    });

    highlightedLayerGroup.clearLayers();
    clearRouteStopMarkers();

    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';

    closeInfoSidebar();
    closeRoutePanel();
    restoreUserAndNearbyMarkers();

    if (userCoords) {
        map.setView([userCoords.lat, userCoords.lng], 15);
    } else {
        map.setView(RECIFE_ANTIGO_COORDS, 15);
    }
}

// UI
function initUI() {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const dropdownList = document.getElementById('dropdownList');
    const dropdownHeader = document.getElementById('dropdownHeader');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput.addEventListener('focus', () => {
        renderSearchDropdown();
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = query ? 'block' : 'none';
        renderSearchDropdown(query);
    });

    clearSearchBtn.addEventListener('click', () => {
        resetMap();
        renderSearchDropdown('');
    });

    document.getElementById('resetMapBtn').addEventListener('click', resetMap);

    const favNavBtn = document.getElementById('favNavBtn');
    if (favNavBtn) {
        favNavBtn.addEventListener('click', () => {
            loadProfileData();
            renderFavorites();
            profileModal.classList.add('active');
            // Ativa aba Favoritos
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="favorites"]').classList.add('active');
            document.getElementById('favoritesTab').classList.add('active');
        });
    }

    const closePanelBtn = document.getElementById('closePanelBtn');
    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', () => {
            closeRoutePanel();
            resetMap();
        });
    }

    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => closeInfoSidebar());
    }

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            closeSearchDropdown();
        }
    });

    const profileBtn = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    profileBtn.addEventListener('click', () => {
        loadProfileData();
        renderProfileHistory();
        profileModal.classList.add('active');
    });

    closeProfileBtn.addEventListener('click', () => profileModal.classList.remove('active'));

    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) profileModal.classList.remove('active');
    });

    saveProfileBtn.addEventListener('click', () => {
        const name = document.getElementById('userName').value;
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify({ name }));
        alert('Perfil salvo!');
        profileModal.classList.remove('active');
    });

    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        renderProfileHistory();
    });
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById(`${tab}Tab`).classList.add('active');
            if (tab === 'favorites') {
                renderFavorites();
            }
        });
    });
    // Mobile menu toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.querySelector('.nav-center').classList.toggle('active');
    });

    // AI Chat Events
    const toggleAiBtn = document.getElementById('toggleAiBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatAssistant = document.getElementById('chatAssistant');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

    if (toggleAiBtn) {
        toggleAiBtn.addEventListener('click', () => {
            chatAssistant.classList.add('active');
            chatInput.focus();
            
            // Personalize greeting if name is set
            const userData = localStorage.getItem(STORAGE_KEY_USER);
            if (userData) {
                const name = JSON.parse(userData).name;
                if (name && name.trim()) {
                    const chatMessages = document.getElementById('chatMessages');
                    const firstMsg = chatMessages.querySelector('.ai-message p');
                    if (firstMsg && !firstMsg.getAttribute('data-personalized')) {
                        firstMsg.innerHTML = `Olá, ${name}! Que bom te ver por aqui no Recife Hub AI 🤖<br>Como posso te ajudar com as rotas hoje?`;
                        firstMsg.setAttribute('data-personalized', 'true');
                    }
                }
            }
        });
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            chatAssistant.classList.remove('active');
        });
    }

    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', handleUserChatMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUserChatMessage();
        });
    }
}

function renderSearchDropdown(query = '') {
    const searchDropdown = document.getElementById('searchDropdown');
    const dropdownList = document.getElementById('dropdownList');
    const dropdownHeader = document.getElementById('dropdownHeader');

    dropdownList.innerHTML = '';

    if (!query) {
        const history = getHistory();
        if (history.length === 0) {
            closeSearchDropdown();
            return;
        }
        dropdownHeader.innerText = "Pesquisas Recentes";
        history.slice(0, 5).forEach(route => {
            const li = document.createElement('li');
            li.innerHTML = `
                <i class="fa-solid fa-clock-rotate-left recent-item-icon"></i>
                <div class="route-color-dot" style="background:${route.color}"></div>
                <span class="route-name">${route.name}</span>
            `;
            li.addEventListener('click', () => {
                const fullRoute = busRoutes.find(r => r.id === route.id);
                if (fullRoute) selectRoute(fullRoute);
            });
            dropdownList.appendChild(li);
        });
    } else {
        dropdownHeader.innerText = "Resultados da Busca";
        const matches = busRoutes.filter(r => r.name.toLowerCase().includes(query));
        if (matches.length === 0) {
            dropdownList.innerHTML = `<li style="justify-content:center; color:#888;">Nenhuma rota encontrada :/</li>`;
        } else {
            matches.forEach(route => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="route-color-dot" style="background:${route.color}"></div>
                    <span class="route-name">${route.name}</span>
                `;
                li.addEventListener('click', () => selectRoute(route));
                dropdownList.appendChild(li);
            });
        }
    }

    searchDropdown.classList.add('active');
}

function closeSearchDropdown() {
    document.getElementById('searchDropdown').classList.remove('active');
}

// Histórico
function getHistory() {
    const data = localStorage.getItem(STORAGE_KEY_HISTORY);
    return data ? JSON.parse(data) : [];
}

function addToHistory(route) {
    let history = getHistory();
    history = history.filter(r => r.id !== route.id);
    history.unshift({ id: route.id, name: route.name, color: route.color });
    if (history.length > 10) history.pop();
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

function loadProfileData() {
    const data = localStorage.getItem(STORAGE_KEY_USER);
    if (data) {
        document.getElementById('userName').value = JSON.parse(data).name || '';
    }
}

function renderProfileHistory() {
    const historyList = document.getElementById('profileHistoryList');
    const history = getHistory();

    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<li>Nenhuma rota recente. Busque e clique em uma rota no mapa!</li>';
        return;
    }

    history.forEach(route => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="route-color-dot" style="background:${route.color}"></div>
                <strong>${route.name}</strong>
            </div>
            <button class="history-route-action">Ver no Mapa</button>
        `;
        li.querySelector('button').addEventListener('click', () => {
            document.getElementById('profileModal').classList.remove('active');
            const fullRoute = busRoutes.find(r => r.id === route.id);
            if (fullRoute) {
                selectRoute(fullRoute);
                document.getElementById('searchInput').value = route.name;
            }
        });
        historyList.appendChild(li);
    });
}
function getFavorites() {
    const data = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return data ? JSON.parse(data) : [];
}
function isFavorite(routeId) {
    const favorites = getFavorites();
    return favorites.some(r => r.id === routeId);
}
function toggleFavorite(route) {
    let favorites = getFavorites();
    const idx = favorites.findIndex(r => r.id === route.id);

    if (idx >= 0) {
        favorites.splice(idx, 1);
        showToast('Rota removida dos favoritos!!');
    } else {
        favorites.push({ id: route.id, name: route.name, color: route.color });
        showToast('Rota adicionada aos favoritos!!');
    }
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-sucess';
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    const favorites = getFavorites();

    favoritesList.innerHTML = '';

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<li style="text-align:center;padding:40px;color:#94a3b8;">Nenhuma rota favoritada ainda</li>';
        return;
    }
    favorites.forEach(fav => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex;gap:10px;align-items:center;">
                <div class="route-color-dot" style="background:${fav.color}"></div>
                <strong>${fav.name}</strong>
            </div>
            <div>
                <button class="view-favorite-btn">Ver</button>
                <button class="remove-fav-btn" style="background:none;border:none;color: #ef4444;cursor:pointer;padding:6px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
         `;
        // botão ver
        li.querySelector('.view-favorite-btn').addEventListener('click', () => {
            const route = busRoutes.find(r => r.id === fav.id);
            if (route) {
                document.getElementById('profileModal').classList.remove('active');
                selectRoute(route);
            }
        });
        //botão remover
        li.querySelector('.remove-fav-btn').addEventListener('click', () => {
            let favs = getFavorites();
            favs = favs.filter(f => f.id !== fav.id);
            localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favs));
            renderFavorites();
            showToast('Favorito removido');

            if (currentFavoriteBtn) {
                currentFavoriteBtn.className = 'favorite-btn';
                currentFavoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
            }
        });

        favoritesList.appendChild(li);
    });
}

// script para drag horizontal em containers de paradas e galeria de imagens
function enableHorizontalDrag(container) {
    if (!container || container.dataset.dragReady === 'true') return;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    container.addEventListener('mousedown', (event) => {
        isDragging = true;
        startX = event.pageX;
        startScrollLeft = container.scrollLeft;
        container.classList.add('is-dragging');
    });

    container.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        event.preventDefault();
        const walk = event.pageX - startX;
        container.scrollLeft = startScrollLeft - walk;
    });

    const stopDragging = () => {
        isDragging = false;
        container.classList.remove('is-dragging');
    };

    container.addEventListener('mouseleave', stopDragging);
    container.addEventListener('mouseup', stopDragging);
    container.dataset.dragReady = 'true';
}
//mostrar informações da integração
function showIntegrationInfo(integrationPlace) {
    const detailedInfo = document.getElementById('detailedInfo');
    if (!detailedInfo) return;
    detailedInfo.innerHTML += `
    <div class="integration-info-container">
    <div class="integration-info">
    <div class="integration-header">
    <p>Significa que ao utilizar essa linha pagando pelo cartão VEM, não será necessário pagar uma nova passagem para utilizar o metrô na ${integrationPlace} no período de 2 horas.</p>
    <a href="#">Saiba mais</a>
    </div>
    <button class="back-btn" onclick="hideIntegrationInfo()">Ok</button>
    </div>
    </div>
    `
}

function hideIntegrationInfo() {
    const detailedInfo = document.getElementById('detailedInfo');
    if (!detailedInfo) return;

    const integrationInfoDiv = detailedInfo.querySelector('.integration-info-container');
    if (integrationInfoDiv) {
        integrationInfoDiv.remove();
    }
}

//mostrar informações do terminal
async function showTerminalInfo(terminalName) {
    const detailedInfo = document.getElementById('detailedInfo');
    if (!detailedInfo) return;

    let terminalData = {
        name: terminalName,
        integration: 'Unknown',
        'other-info': 'Nenhuma informação adicional disponível para este terminal.'
    };

    try {
        const response = await fetch('assets/terminais.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const terminals = await response.json();
        const foundTerminal = Array.isArray(terminals)
            ? terminals.find(item => item.name === terminalName)
            : null;

        if (foundTerminal) {
            terminalData = foundTerminal;
        }
    } catch (error) {
        console.error("Error loading terminal data:", error);
    }

    //apagar conteudo anterior
    detailedInfo.innerHTML = '';

    // Buscar todas as rotas que usam este terminal
    const routesUsingTerminal = busRoutes.filter(route => route.terminal === terminalName);

    // Criar HTML das rotas
    const routesHtml = routesUsingTerminal.length > 0
        ? routesUsingTerminal.map(route => `
            <div class="bus_name">
            <div class="bus_container_favorites">
                <div id="color" style="background:${route.color}"></div>
                <p>${route.name}</p>
                <i class="fa-regular fa-star"></i>
            </div>
            </div>
        `).join('')
        : '<p style="color:#94a3b8;">Nenhuma rota disponível.</p>';

    detailedInfo.innerHTML += `
    <div class="terminal-info-container">
    <section class="terminal-header">
            <div class="header-title">
                <a href="#" class="back-btn" onclick="hideTerminalInfo()">
                    <i class="fa-solid fa-angle-left"></i>
                    <p>Voltar</p>
                </a>
                <h2>${terminalData.name || terminalName}</h2>
            </div>
            <section id="galery_container">
                <div class="galery">
                ${terminalData.images && terminalData.images.length > 0 ? terminalData.images.map(img => `<img src="${img}" alt="Imagem do terminal">`).join('') : `<p style="color:#94a3b8;">Nenhuma imagem disponível para
                        este terminal.</p>`}
                </div>
            </section>
        </section>

        <section class="terminal-main-info">
            <p class="main-info-title">Linhas disponíveis por aqui:</p>
            <div class="bus-here-container">
                    ${routesHtml}
                </div>
            <hr>
            ${terminalData.integration === 'Yes' ? `<div class="integration">
                <p class="integration-info-title">Integração com a ${terminalData.integration_place}</p>
            </div>` : ''}
            <div class="other-info">
                <p class="other-info-title">Outras informações</p>
                <p style="color:#94a3b8;">${terminalData['other-info'] || 'Nenhuma informação adicional disponível para este terminal.'}</p>
            </div>
            </section>
            </div>
    `;
}

function hideTerminalInfo() {
    const detailedInfo = document.getElementById('detailedInfo');
    if (!detailedInfo) return;

    const terminalInfoDiv = detailedInfo.querySelector('.terminal-info-container');
    if (terminalInfoDiv) {
        terminalInfoDiv.remove();
        showLineInfo(busRoutes.find(r => r.id === selectedRouteId));
    }
}

// ==========================================
// AI Chat Assistant Logic (Recife Hub AI)
// ==========================================

let chatHistory = [];

function getSystemPrompt() {
    const routeNames = busRoutes.map(r => r.name).join(', ');
    return `Você é o Recife Hub AI, um assistente virtual especialista no transporte público do Recife. 
    O Grand Recife Consórcio é o responsável pelo transporte. 
    
    ROTAS DISPONÍVEIS NO APP: ${routeNames}.
    
    INSTRUÇÕES:
    1. Ajude os usuários a encontrarem a melhor forma de se locomover.
    2. Seja prestativo, claro e conciso (máximo 3 parágrafos).
    3. Use um tom amigável (estilo WhatsApp).
    4. IMPORTANTE: Sempre que mencionar uma das "ROTAS DISPONÍVEIS", escreva o nome completo da rota exatamente como listado.
    5. Se não tiver certeza de algo, oriente o usuário a verificar o mapa ou usar a busca.`;
}

// Initialize chat history with dynamic prompt
function initChatHistory() {
    chatHistory = [
        { role: "system", content: getSystemPrompt() }
    ];
}

async function handleUserChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    // Ensure history is initialized with current routes
    if (chatHistory.length === 0) initChatHistory();

    // Remove text from input
    input.value = '';

    // Append user message to UI
    appendMessage(text, 'user-message');
    
    // Add to history
    chatHistory.push({ role: "user", content: text });

    // Show typing indicator
    showTypingIndicator();

    try {
        const responseText = await fetchGroqCompletion(chatHistory);
        
        // Remove typing indicator before showing result
        hideTypingIndicator();

        // Append AI message
        appendMessage(responseText, 'ai-message');
        
        // Add to history
        chatHistory.push({ role: "assistant", content: responseText });

        // Auto-detect routes to highlight
        detectAndHighlightRoutes(responseText);

    } catch (e) {
        hideTypingIndicator();
        appendMessage("Desculpe, estou com problemas técnicos no momento. Tente novamente mais tarde.", 'ai-message');
        console.error("Erro no Chat AI:", e);
    }
}

function detectAndHighlightRoutes(text) {
    // Look for route names in the text
    const foundRoutes = busRoutes.filter(route => 
        text.toLowerCase().includes(route.name.toLowerCase())
    );

    if (foundRoutes.length > 0) {
        // We could automatically select the first found route or add buttons
        // For now, let's add a "Ver no Mapa" button to the last message if routes found
        const chatMessages = document.getElementById('chatMessages');
        const lastMsg = chatMessages.lastElementChild;
        
        if (lastMsg && lastMsg.classList.contains('ai-message')) {
            const btnContainer = document.createElement('div');
            btnContainer.style.marginTop = '10px';
            btnContainer.style.display = 'flex';
            btnContainer.style.flexWrap = 'wrap';
            btnContainer.style.gap = '8px';

            foundRoutes.forEach(route => {
                const btn = document.createElement('button');
                btn.className = 'history-route-action';
                btn.style.padding = '6px 10px';
                btn.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> Ver ${route.name}`;
                btn.onclick = () => {
                    selectRoute(route);
                    if (window.innerWidth < 768) {
                        document.getElementById('chatAssistant').classList.remove('active');
                    }
                };
                btnContainer.appendChild(btn);
            });
            lastMsg.appendChild(btnContainer);
        }
    }
}

function appendMessage(text, className) {
    const chatMessages = document.getElementById('chatMessages');
    
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;
    
    // Replace newlines with <br> for HTML rendering
    const formattedText = text.replace(/\\n/g, '<br>');

    msgDiv.innerHTML = `
        <p>${formattedText}</p>
        <span class="message-time">${time}</span>
    `;

    chatMessages.appendChild(msgDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const indicator = document.createElement('div');
    indicator.className = 'message ai-message typing-indicator-container';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

async function fetchGroqCompletion(messages) {
    // Uses the API Key from CONFIG in config.js
    if (!CONFIG || !CONFIG.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não configurada no config.js');
    }

    const payload = {
        model: "llama-3.1-8b-instant",
        messages: messages,
        temperature: 0.5,
        max_tokens: 500
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${CONFIG.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro da API: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}
