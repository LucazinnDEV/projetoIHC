document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('linhasContainer');
    
    try {
        const response = await fetch('assets/rotas.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const rotas = await response.json();
        
        container.innerHTML = '';
        
        if (rotas.length === 0) {
            container.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; color: #64748b;">Nenhuma linha cadastrada no momento.</p>';
            return;
        }
        
        rotas.forEach(rota => {
            const card = document.createElement('div');
            card.className = 'linha-card';
            
            const tarifa = rota.fare ? `R$ ${rota.fare.toFixed(2)}` : 'N/A';
            const duracao = rota.duration ? `${rota.duration} min` : 'N/A';
            const acessivel = rota.accessible ? 'active' : '';
            const arCond = rota.airConditioning ? 'active' : '';
            
            card.innerHTML = `
                <div class="linha-header" style="background: ${rota.color}">
                    <div class="linha-numero">${rota.id}</div>
                    <div class="linha-nome">${rota.name}</div>
                </div>
                <div class="linha-body">
                    <div class="linha-stat">
                        <i class="fa-solid fa-coins"></i> Tarifa: <span>${tarifa}</span>
                    </div>
                    <div class="linha-stat">
                        <i class="fa-solid fa-stopwatch"></i> Duração: <span>${duracao}</span>
                    </div>
                    <div class="linha-stat">
                        <i class="fa-solid fa-rotate"></i> Frequência: <span>${rota.frequency || 'N/A'}</span>
                    </div>
                    
                    <div class="linha-badges">
                        <div class="linha-badge ${acessivel}">
                            <i class="fa-solid fa-wheelchair"></i> Acessibilidade
                        </div>
                        <div class="linha-badge ${arCond}">
                            <i class="fa-solid fa-snowflake"></i> Ar Cond.
                        </div>
                    </div>
                </div>
                <button class="linha-btn" onclick="verNoMapa('${rota.id}')">
                    <i class="fa-solid fa-map-location-dot"></i> Ver no Mapa
                </button>
            `;
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Erro ao carregar as linhas:', error);
        container.innerHTML = `
            <div style="text-align: center; grid-column: 1 / -1; padding: 40px; color: #ef4444;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 10px;">Ops, tivemos um problema!</h3>
                <p>Não foi possível carregar as informações agora. Tente novamente mais tarde.</p>
            </div>
        `;
    }
});

function verNoMapa(id) {
    sessionStorage.setItem('recifeHub_autoSelectRoute', id);
    window.location.href = 'index.html';
}
