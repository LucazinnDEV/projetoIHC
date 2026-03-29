// State
let busRoutes = [];
let map;
let routeLayers = {};
let allStopsLayer;
let highlightedLayerGroup;
let currentFavoriteBtn = null

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
    // Dim others
    Object.values(routeLayers).forEach(({polyline}) => {
        polyline.setStyle({ weight: 4, opacity: 0.2 });
    });

    highlightedLayerGroup.clearLayers();

    // Highlight selected
    const { polyline } = routeLayers[route.id];
    polyline.setStyle({ color: route.color, weight: 10, opacity: 1 });
    polyline.bringToFront();

    // Add terminus/stops
    if(route.path && route.path.length > 0) {
        const start = route.path[0];
        const end = route.path[route.path.length - 1];
        
        [start, end].forEach((pt, idx) => {
            L.marker(pt, {
                icon: L.divIcon({
                    className: 'terminus-marker',
                    html: idx === 0 ? 'A' : 'B',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                })
            }).addTo(highlightedLayerGroup)
              .bindPopup(`<strong>${route.name}</strong><br>${idx === 0 ? 'Início/Fim no Recife Antigo' : 'Destino'}`);
        });
    }

    // Optional: add some small markers for real stops if they exist
    if (route.stops && route.stops.length > 0) {
        route.stops.forEach(stop => {
            L.circleMarker(stop, {
                radius: 5,
                fillColor: '#fff',
                color: route.color,
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(highlightedLayerGroup);
        });
    }

    map.fitBounds(polyline.getBounds().pad(0.1));
    
    addToHistory(route);
    showFavoriteButton(route);
    closeSearchDropdown();
}

function resetMap() {
    Object.values(routeLayers).forEach(({polyline, data}) => {
        polyline.setStyle({ color: data.color, weight: 5, opacity: 0.6 });
    });
    highlightedLayerGroup.clearLayers();
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    if (currentFavoriteBtn){
        currentFavoriteBtn.remove();
        currentFavoriteBtn = null;
    }
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
                if(tab === 'favorites'){
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
            if(fullRoute) {
                selectRoute(fullRoute);
                document.getElementById('searchInput').value = route.name;
            }
        });
        historyList.appendChild(li);
    });
}
//favoritos

    function showFavoriteButton(route){
    if(currentFavoriteBtn){
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

    if (idx >= 0){
        favorites.splice(idx,1);
        currentFavoriteBtn.className = 'favorite-btn';
        currentFavoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
        showToast('Rota removida dos favoritos!!');
    }else{
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

            if(currentFavoriteBtn){
                currentFavoriteBtn.className = 'favorite-btn';
                currentFavoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
            }
        });
            
        favoritesList.appendChild(li);
    });
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

       
