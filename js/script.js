// State
let busRoutes = [];
let map;
let routeLayers = {};
let allStopsLayer;
let highlightedLayerGroup;
let currentFavoriteBtn = null
let selectedRouteId = null;

// Constants
const RECIFE_ANTIGO_COORDS = [-8.061, -34.873];
const STORAGE_KEY_HISTORY = 'recifeHub_history';
const STORAGE_KEY_USER = 'recifeHub_user';
const STORAGE_KEY_FAVORITES = 'recifeHub_favorites';

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initUI();
    await loadData();
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

    map.on('click', () => resetMap());
}

async function loadData() {
    try {
        const response = await fetch('assets/rotas.json');
        if (!response.ok) throw new Error('Network response was not ok');
        busRoutes = await response.json();

        // Hide loading
        document.getElementById('loadingOverlay').style.opacity = '0';
        setTimeout(() => document.getElementById('loadingOverlay').style.display = 'none', 500);

        drawAllRoutes();
    } catch (error) {
        console.error("Error loading routes:", error);

        // estado de erro c botao retry
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

function drawAllRoutes() {
    busRoutes.forEach(route => {
        const polyline = L.polyline(route.path, {
            color: route.color,
            weight: 5,
            opacity: 0.6
        }).addTo(map);

        polyline.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            selectRoute(route);
            document.getElementById('searchInput').value = route.name;
        });


        routeLayers[route.id] = { polyline, data: route };
    });
}

// Select a route (Highlight + History)
function selectRoute(route) {
    // Ensure we always use the full route object loaded from JSON.
    const fullRoute = routeLayers[route.id]?.data || route;
    selectedRouteId = fullRoute.id;

    hideDetailedLineInfo();

    // Dim others
    Object.values(routeLayers).forEach(({ polyline }) => {
        polyline.setStyle({ weight: 4, opacity: 0.2 });
    });

    highlightedLayerGroup.clearLayers();

    // Highlight selected
    const { polyline } = routeLayers[fullRoute.id];
    polyline.setStyle({ color: fullRoute.color, weight: 10, opacity: 1 });
    polyline.bringToFront();

    // Add terminus/stops
    if (fullRoute.path && fullRoute.path.length > 0) {
        const start = fullRoute.path[0];
        const end = fullRoute.path[fullRoute.path.length - 1];

        [start, end].forEach((pt, idx) => {
            L.marker(pt, {
                icon: L.divIcon({
                    className: 'terminus-marker',
                    html: idx === 0 ? 'A' : 'B',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                })
            }).addTo(highlightedLayerGroup)
                .bindPopup(`<strong>${fullRoute.name}</strong><br>${idx === 0 ? 'Início/Fim no Recife Antigo' : 'Destino'}`);
        });
    }

    // Optional: add some small markers for real stops if they exist
    if (fullRoute.stops && fullRoute.stops.length > 0) {
        fullRoute.stops.forEach(stop => {
            L.circleMarker(stop, {
                radius: 5,
                fillColor: '#fff',
                color: fullRoute.color,
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(highlightedLayerGroup);
        });
    }

    //mostrar informações da linha
    showLineInfo(fullRoute);

    map.fitBounds(polyline.getBounds().pad(0.1));

    addToHistory(fullRoute);
    showFavoriteButton(fullRoute);
    closeSearchDropdown();
}

function resetMap() {
    selectedRouteId = null;
    Object.values(routeLayers).forEach(({ polyline, data }) => {
        polyline.setStyle({ color: data.color, weight: 5, opacity: 0.6 });
    });
    highlightedLayerGroup.clearLayers();
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    if (currentFavoriteBtn) {
        currentFavoriteBtn.remove();
        currentFavoriteBtn = null;
    }

    hideLineInfo();
    map.setView(RECIFE_ANTIGO_COORDS, 15);
}

// User Profile & History UI
function initUI() {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const dropdownList = document.getElementById('dropdownList');
    const dropdownHeader = document.getElementById('dropdownHeader');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    // Search Interactivity
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

    // Close dropdown on outside click
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            closeSearchDropdown();
        }
    });

    // Profile Modal
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
}

function renderSearchDropdown(query = '') {
    const searchDropdown = document.getElementById('searchDropdown');
    const dropdownList = document.getElementById('dropdownList');
    const dropdownHeader = document.getElementById('dropdownHeader');

    dropdownList.innerHTML = '';

    if (!query) {
        // Show history
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
            li.addEventListener('click', () => selectRoute(route));
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

// History Management API
function getHistory() {
    const data = localStorage.getItem(STORAGE_KEY_HISTORY);
    return data ? JSON.parse(data) : [];
}

function addToHistory(route) {
    let history = getHistory();
    // deduplicate
    history = history.filter(r => r.id !== route.id);
    history.unshift({ id: route.id, name: route.name, color: route.color });
    // keep only last 10
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
//favoritos

function showFavoriteButton(route) {
    if (currentFavoriteBtn) {
        currentFavoriteBtn.remove();
    }
    const isFav = isFavorite(route.id);

    currentFavoriteBtn = document.createElement('button');
    currentFavoriteBtn.className = `favorite-btn ${isFav ? 'favorited' : ''}`;
    currentFavoriteBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i> ${isFav ? 'Favoritado' : 'Favoritar'}`;

    currentFavoriteBtn.onclick = () => toggleFavorite(route);

    document.body.appendChild(currentFavoriteBtn);
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
        currentFavoriteBtn.className = 'favorite-btn';
        currentFavoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
        showToast('Rota removida dos favoritos!!');
    } else {
        showToast('Rota adicionada aos favoritos!!');
        favorites.push({
            id: route.id,
            name: route.name,
            color: route.color
        });
        currentFavoriteBtn.className = 'favorite-btn favorited';
        currentFavoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
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

//mostrar informações da linha
function showLineInfo(route) {
    const lineInfoContainer = document.getElementById('lineInfoContainer');
    lineInfoContainer.classList.remove('line-info-fullscreen');
    lineInfoContainer.style.display = 'block';
    const showMoreBtn = document.getElementById('showMoreInfoBtn');
    const lessInfoBtn = document.getElementById('LessInfoBtn');
    const detailedInfo = document.getElementById('detailedInfo');

    detailedInfo.style.display = 'none';
    lessInfoBtn.style.display = 'none';
    showMoreBtn.style.display = 'block';

    showMoreBtn.onclick = () => {
        if (selectedRouteId !== route.id) return;

        lineInfoContainer.classList.add('line-info-fullscreen');
        const price = route.price || route.preco || 'Não informado';
        const terminal = route.terminal || 'Não informado';
        const topStops = Array.isArray(route.top_stops) ? route.top_stops : [];
        const namedStops = Array.isArray(route.stops)
            ? route.stops.filter(stop => stop && typeof stop === 'object' && !Array.isArray(stop) && (stop.name || stop.image))
            : [];
        const displayStops = topStops.length > 0 ? topStops : namedStops;
        const topStopsHtml = displayStops.length > 0
            ? displayStops.slice(0, displayStops.length).map(stop => `
                        <div class="stop">
                            ${stop.image ? `<img src="${stop.image}" alt="Imagem de ${stop.name || 'Parada'}">` : ''}
                            <p>${stop.name || 'Parada sem nome'}</p>
                        </div>`).join('')
            : `<p style="color:#94a3b8;">Nenhuma parada em destaque disponível para esta linha.</p>`;
        detailedInfo.style.display = 'block';
        showMoreBtn.style.display = 'none';
        lessInfoBtn.style.display = 'block';
        detailedInfo.innerHTML = `
            <section id="bus_name_container">
                <div class="bus_name">
                    <div id="color" style="background:${route.color}"></div>
                    <div class="bus_container_favorites">
                        <p>${route.name}</p>
                        <i class="fa-regular fa-star"></i>
                    </div>
                </div>
            </section>
            <hr class="separator">
            <section id="main_infos_container">
                <section id="price_container">
                    <p>Valor da passagem</p>
                    <p class="price">${price}</p>
                </section>
                <section id="terminal_container">
                    <p>Terminal</p>
                    <div class="name_terminal_container">
                        <p class="name_terminal">${terminal}</p>
                        <i class="fa-solid fa-circle-info" onclick="showTerminalInfo('${terminal}')"></i>
                    </div>
                </section>
                <hr>
                <section id="top_stops_container">
                    <p>Paradas em destaque</p>
                    <div class="top_stops">
                    ${topStopsHtml}
                    </div>
                </section>
                <hr>
                <section id="other_info_container">
                ${route.integration === 'Yes' ? `<div class="integration">Integração com ${route.integration_place}  <i class="fa-regular fa-circle-question"></i></div>` : ''}
                    <div class="bonus">
                    ${route.accessibility === 'Yes' ? `
                        <div class="acessibility">
                            <i class="fa-brands fa-accessible-icon"></i>
                            <p>Acessibilidade</p>
                        </div>` : ''}
                    ${route.air_conditioning === 'Yes' ? `
                        <div class="air_conditioning">
                            <i class="fa-solid fa-snowflake"></i>
                            <p>Ar Condicionado</p>
                        </div>` : ''}
                    </div>
                </section>
            </section>
            <hr class="separator">
            <section id="galery_container">
                <p>Galeria</p>
                <div class="galery">
                ${route.images && route.images.length > 0 ? route.images.map(img => `<img src="${img}" alt="Imagem do onibus">`).join('') : `<p style="color:#94a3b8;">Nenhuma imagem disponível para esta linha.</p>`}
                </div>
            </section>
        `;

        enableHorizontalDrag(detailedInfo.querySelector('.top_stops'));
        enableHorizontalDrag(detailedInfo.querySelector('.galery'));
    };

    lessInfoBtn.onclick = () => {
        hideDetailedLineInfo();
    };
}

function hideDetailedLineInfo() {
    const lineInfoContainer = document.getElementById('lineInfoContainer');
    const showMoreBtn = document.getElementById('showMoreInfoBtn');
    const lessInfoBtn = document.getElementById('LessInfoBtn');
    const detailedInfo = document.getElementById('detailedInfo');

    if (!lineInfoContainer || !showMoreBtn || !lessInfoBtn || !detailedInfo) return;

    lineInfoContainer.classList.remove('line-info-fullscreen');
    detailedInfo.style.display = 'none';
    lessInfoBtn.style.display = 'none';
    showMoreBtn.style.display = 'block';
}

function hideLineInfo() {
    const lineInfoContainer = document.getElementById('lineInfoContainer');
    if (!lineInfoContainer) return;

    hideDetailedLineInfo();
    lineInfoContainer.style.display = 'none';
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

//mostrar informações do terminal
function showTerminalInfo(terminal) {}

