// ==========================================
// Recomendações de Lugares Próximos
// ==========================================

// --- State ---
let userLocation = null;
let nearbyPlacesData = {};
let activeCategory = null;

// --- Categorias ---
const PLACE_CATEGORIES = [
    { id: 'restaurants', label: 'Restaurantes', icon: 'fa-utensils', tag: 'amenity=restaurant' },
    { id: 'attractions', label: 'Atrações', icon: 'fa-landmark', tag: 'tourism=attraction' },
    { id: 'cafes', label: 'Cafés', icon: 'fa-mug-hot', tag: 'amenity=cafe' },
    { id: 'supermarkets', label: 'Supermercados', icon: 'fa-cart-shopping', tag: 'shop=supermarket' }
];

// --- 1. Geolocalização ---
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalização não suportada pelo navegador.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                resolve(userLocation);
            },
            (error) => {
                // Fallback: Recife Antigo
                console.warn('Geolocalização negada, usando localização padrão (Recife Antigo).');
                userLocation = { lat: -8.063, lng: -34.871 };
                resolve(userLocation);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });
}

// --- 2. Buscar Lugares via Overpass API (OpenStreetMap) ---
async function fetchNearbyPlaces(category) {
    if (!userLocation) {
        await getUserLocation();
    }

    // Check cache
    if (nearbyPlacesData[category.id] && nearbyPlacesData[category.id].length > 0) {
        return nearbyPlacesData[category.id];
    }

    const radius = 3000; // 3km
    const [key, value] = category.tag.split('=');

    const query = `
        [out:json][timeout:10];
        (
            node["${key}"="${value}"](around:${radius},${userLocation.lat},${userLocation.lng});
            way["${key}"="${value}"](around:${radius},${userLocation.lat},${userLocation.lng});
        );
        out center 20;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query)
        });

        if (!response.ok) throw new Error('Erro na API Overpass');

        const data = await response.json();

        const places = data.elements
            .filter(el => el.tags && el.tags.name)
            .map(el => {
                const lat = el.lat || (el.center && el.center.lat);
                const lng = el.lon || (el.center && el.center.lon);
                return {
                    name: el.tags.name,
                    type: getPlaceType(el.tags, category),
                    lat,
                    lng,
                    distance: calculateDistance(userLocation.lat, userLocation.lng, lat, lng),
                    cuisine: el.tags.cuisine || null,
                    openingHours: el.tags.opening_hours || null,
                    phone: el.tags.phone || null
                };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);

        nearbyPlacesData[category.id] = places;
        return places;

    } catch (error) {
        console.error('Erro ao buscar lugares:', error);
        return [];
    }
}

// --- 3. Tipo de Estabelecimento ---
function getPlaceType(tags, category) {
    if (tags.cuisine) {
        const cuisines = {
            'pizza': 'Pizzaria', 'burger': 'Hamburgueria', 'japanese': 'Japonês',
            'italian': 'Italiano', 'brazilian': 'Brasileiro', 'chinese': 'Chinês',
            'seafood': 'Frutos do Mar', 'regional': 'Regional', 'sushi': 'Sushi',
            'coffee_shop': 'Cafeteria', 'ice_cream': 'Sorveteria'
        };
        const first = tags.cuisine.split(';')[0].trim().toLowerCase();
        if (cuisines[first]) return cuisines[first];
    }
    const typeMap = {
        'restaurants': 'Restaurante',
        'attractions': 'Atração Turística',
        'cafes': 'Café',
        'supermarkets': 'Supermercado'
    };
    return typeMap[category.id] || 'Estabelecimento';
}

// --- 4. Cálculo de Distância (Haversine) ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

function formatDistance(distKm) {
    if (distKm < 1) {
        return `${Math.round(distKm * 1000)} m`;
    }
    return `${distKm.toFixed(1)} km`;
}

// --- 5. Renderização da UI ---
function initNearbyPlaces() {
    createNearbyPlacesUI();
    getUserLocation();
}

function createNearbyPlacesUI() {
    // Container principal
    const container = document.createElement('div');
    container.id = 'nearbyPlacesContainer';
    container.className = 'nearby-places-container';

    // Barra de categorias
    const categoryBar = document.createElement('div');
    categoryBar.className = 'nearby-category-bar';
    categoryBar.id = 'nearbyCategoryBar';

    PLACE_CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'nearby-category-btn';
        btn.dataset.category = cat.id;
        btn.innerHTML = `<i class="fa-solid ${cat.icon}"></i> ${cat.label}`;
        btn.addEventListener('click', () => handleCategoryClick(cat, btn));
        categoryBar.appendChild(btn);
    });

    container.appendChild(categoryBar);

    // Painel expansível
    const panel = document.createElement('div');
    panel.className = 'nearby-panel';
    panel.id = 'nearbyPanel';
    container.appendChild(panel);

    // Inserir acima do mapa, abaixo da navbar
    const mapWrapper = document.querySelector('.map-wrapper');
    mapWrapper.parentElement.insertBefore(container, mapWrapper);
}

async function handleCategoryClick(category, btnElement) {
    const panel = document.getElementById('nearbyPanel');
    const allBtns = document.querySelectorAll('.nearby-category-btn');

    // Toggle se clicou na mesma categoria
    if (activeCategory === category.id) {
        activeCategory = null;
        panel.classList.remove('open');
        allBtns.forEach(b => b.classList.remove('active'));
        return;
    }

    // Ativar botão
    allBtns.forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    activeCategory = category.id;

    // Mostrar loading
    panel.classList.add('open');
    panel.innerHTML = `
        <div class="nearby-loading">
            <div class="nearby-spinner"></div>
            <span>Buscando ${category.label.toLowerCase()} próximos...</span>
        </div>
    `;

    // Buscar e renderizar
    const places = await fetchNearbyPlaces(category);
    renderPlaces(places, category);
}

function renderPlaces(places, category) {
    const panel = document.getElementById('nearbyPanel');

    if (places.length === 0) {
        panel.innerHTML = `
            <div class="nearby-empty">
                <i class="fa-solid fa-map-pin"></i>
                <p>Nenhum resultado encontrado nas proximidades.</p>
                <span>Tente outra categoria ou verifique sua localização.</span>
            </div>
        `;
        return;
    }

    // Header do painel
    let html = `
        <div class="nearby-panel-header">
            <h3><i class="fa-solid ${getCategoryIcon(category.id)}"></i> ${category.label}</h3>
            <span class="nearby-count">${places.length} encontrados</span>
        </div>
        <div class="nearby-list">
    `;

    places.forEach((place, index) => {
        const icon = getCategoryListIcon(category.id);
        html += `
            <div class="nearby-place-card" style="animation-delay: ${index * 0.05}s">
                <div class="nearby-place-icon ${category.id}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="nearby-place-info">
                    <h4 class="nearby-place-name">${place.name}</h4>
                    <span class="nearby-place-type">${place.type}</span>
                </div>
                <div class="nearby-place-distance">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${formatDistance(place.distance)}</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    panel.innerHTML = html;

    // Adicionar clique para mostrar no mapa
    const cards = panel.querySelectorAll('.nearby-place-card');
    cards.forEach((card, idx) => {
        card.addEventListener('click', () => {
            const p = places[idx];
            if (p.lat && p.lng && typeof map !== 'undefined') {
                map.setView([p.lat, p.lng], 17);
                L.popup()
                    .setLatLng([p.lat, p.lng])
                    .setContent(`
                        <div style="text-align:center; padding:4px;">
                            <strong style="font-size:1rem;">${p.name}</strong><br>
                            <span style="color:#64748b; font-size:0.85rem;">${p.type}</span><br>
                            <span style="color:#4f46e5; font-weight:600; font-size:0.85rem;">${formatDistance(p.distance)}</span>
                        </div>
                    `)
                    .openOn(map);
            }
        });
    });
}

function getCategoryIcon(id) {
    const icons = {
        'restaurants': 'fa-utensils',
        'attractions': 'fa-landmark',
        'cafes': 'fa-mug-hot',
        'supermarkets': 'fa-cart-shopping'
    };
    return icons[id] || 'fa-location-dot';
}

function getCategoryListIcon(id) {
    const icons = {
        'restaurants': 'fa-utensils',
        'attractions': 'fa-camera',
        'cafes': 'fa-coffee',
        'supermarkets': 'fa-basket-shopping'
    };
    return icons[id] || 'fa-store';
}

// Inicializar quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    initNearbyPlaces();
});
