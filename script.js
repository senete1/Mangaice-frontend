const SUPABASE_URL = "https://espwjxbeofclgvqaeuvd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcHdqeGJlb2ZjbGd2cWFldXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTAzMjMsImV4cCI6MjEwNTc2NjMyM30.R2qAJ9T25y8HF5EAr8dVJopC0YYJN-X8CbgZ-e1oV4g";

// ==========================================================================
// 1. ELEMENTOS DO DOM
// ==========================================================================
const mangaGrid = document.getElementById('manga-grid');
const loadingSpinner = document.getElementById('loading-spinner');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// Elementos da Seção Hero (Home)
const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroSynopsis = document.getElementById('hero-synopsis');

// Estado da Aplicação
let allManhwas = [];
let heroInterval = null;

let authSupabase = null;
let currentSession = null;

// ==========================================
// ALTERNÂNCIA DE TEMA (DARK / LIGHT MODE)
// ==========================================

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    localStorage.removeItem('theme-override');
    if (!e.matches) {
        document.documentElement.classList.add('tema-claro');
    } else {
        document.documentElement.classList.remove('tema-claro');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('themeToggle');

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('tema-claro');
            localStorage.setItem('theme-override', isLight ? 'light' : 'dark');
        });
    }
});

// ==========================================================================
// 2. BUSCA DE DADOS (SUPABASE OU FALLBACK)
// ==========================================================================
async function fetchManhwasFromSupabase() {
    showLoading(true);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/manhwas?select=*,chapters(*)`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error(`Erro: ${response.statusText}`);

        const data = await response.json();

        if (data && data.length > 0) {
            allManhwas = data;
            renderUI(allManhwas);
        } else {
            renderEmptyState("Nenhum manhwa encontrado.");
        }

    } catch (error) {
        console.warn("Usando dados de exemplo (fallback):", error);
        useFallbackData();
    } finally {
        showLoading(false);
    }
}

// ==========================================================================
// 3. LÓGICA DA PÁGINA DE DETALHES E INCREMENTO DE VIEWS
// ==========================================================================
async function loadDetailsPage(id) {
    showLoading(true);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/manhwas?id=eq.${id}&select=*`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                renderDetailsUI(data[0]);
                await incrementarVisualizacao(id, data[0].views);
                return;
            }
        }
        throw new Error("Manhwa not found");

    } catch (error) {
        console.warn("Carregando detalhes via mock/fallback:", error);
        const mockData = getMockData();
        const found = mockData.find(m => m.id == id) || mockData[0];
        renderDetailsUI(found);
    } finally {
        showLoading(false);
    }
}

async function incrementarVisualizacao(mangaId, viewsAtuais) {
    const storageKey = `viewed_manga_${mangaId}`;
    const ultimaVisualizacao = localStorage.getItem(storageKey);
    const agora = Date.now();
    const vinteEQuatroHoras = 24 * 60 * 60 * 1000;

    if (ultimaVisualizacao && (agora - Number(ultimaVisualizacao) < vinteEQuatroHoras)) {
        console.log("Visualização recente já contabilizada para este utilizador.");
        return;
    }

    try {
        const novasViews = (Number(viewsAtuais) || 0) + 1;

        const response = await fetch(`${SUPABASE_URL}/rest/v1/manhwas?id=eq.${mangaId}`, {
            method: 'PATCH',
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ views: novasViews })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Erro ao atualizar views no Supabase:", errText);
        } else {
            console.log(`Nova visualização contabilizada! Total: ${novasViews}`);
            localStorage.setItem(storageKey, agora.toString());

            const viewsEl = document.getElementById('details-views');
            if (viewsEl) viewsEl.textContent = novasViews;
        }
    } catch (err) {
        console.error("Erro inesperado ao incrementar views:", err);
    }
}

function renderDetailsUI(manhwa) {
    const titleEl = document.getElementById('details-title') || document.querySelector('h1');
    const synopsisEl = document.getElementById('details-synopsis') || document.querySelector('.synopsis');
    const coverEl = document.getElementById('details-cover') || document.querySelector('.manga-cover img');
    const authorEl = document.getElementById('details-author');
    const yearEl = document.getElementById('details-year');
    const statusEl = document.getElementById('details-status');
    const ratingEl = document.getElementById('details-rating');
    const viewsEl = document.getElementById('details-views');
    const tagsContainer = document.getElementById('details-tags');

    if (titleEl) titleEl.textContent = manhwa.title;
    if (synopsisEl) synopsisEl.textContent = manhwa.synopsis || "Sem sinopse disponível.";
    if (coverEl && manhwa.cover_url) {
        coverEl.src = manhwa.cover_url;
        coverEl.alt = manhwa.title;
    }

    if (authorEl) authorEl.textContent = manhwa.author || manhwa.autor || 'Desconhecido';
    if (yearEl) yearEl.textContent = manhwa.Publication || manhwa.ano || 'N/A';
    if (statusEl) statusEl.textContent = manhwa.status ? manhwa.status.toUpperCase() : 'N/A';
    if (ratingEl) ratingEl.textContent = manhwa.rating !== undefined && manhwa.rating !== null ? manhwa.rating : '0.0';
    if (viewsEl) viewsEl.textContent = manhwa.views !== undefined && manhwa.views !== null ? manhwa.views : '0';

    if (tagsContainer) {
        tagsContainer.innerHTML = '';

        let tagsList = [];
        if (Array.isArray(manhwa.tags)) {
            tagsList = manhwa.tags;
        } else if (typeof manhwa.tags === 'string') {
            tagsList = manhwa.tags.split(',');
        }

        if (tagsList.length > 0) {
            tagsList.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = tag.trim().toUpperCase();
                tagsContainer.appendChild(span);
            });
        } else {
            tagsContainer.innerHTML = '<span class="tag">SEM TAGS</span>';
        }
    }

    setupSynopsisToggle();
}

async function initAuth() {
    if (typeof window.supabase === 'undefined') return;
    authSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await authSupabase.auth.getSession();
    currentSession = session;
}

function setupSynopsisToggle() {
    const synopsisEl = document.getElementById('details-synopsis');
    const toggleBtn = document.getElementById('synopsis-toggle');
    if (!synopsisEl || !toggleBtn) return;

    const synopsisText = synopsisEl.textContent.trim();

    if (synopsisText.length > 200) {
        synopsisEl.classList.add('synopsis-collapsed');
        toggleBtn.style.display = 'inline-block';
        toggleBtn.textContent = 'Ler mais';

        toggleBtn.addEventListener('click', () => {
            const isCollapsed = synopsisEl.classList.contains('synopsis-collapsed');
            if (isCollapsed) {
                synopsisEl.classList.remove('synopsis-collapsed');
                toggleBtn.textContent = 'Ler menos';
            } else {
                synopsisEl.classList.add('synopsis-collapsed');
                toggleBtn.textContent = 'Ler mais';
            }
        });
    } else {
        toggleBtn.style.display = 'none';
    }
}

// ==========================================================================
// 4. RENDERIZAÇÃO DA HOME (TOP 10 DESTAQUES + CATÁLOGO + SEO DINÂMICO)
// ==========================================================================

// Atualiza o SEO da Homepage dinamicamente com o mangá #1 em destaque
function atualizarSEOHomepage(featuredManga) {
    if (!featuredManga) return;

    const seoTitle = `Read ${featuredManga.title} & More Manhwas Online - Mangaice`;
    const seoDesc = `Read ${featuredManga.title} and the best high-quality manhwas, webtoons, and mangas online with daily updates on Mangaice.`;

    document.title = seoTitle;

    const metaTitle = document.getElementById('meta-title');
    if (metaTitle) metaTitle.innerText = seoTitle;

    const metaDesc = document.getElementById('meta-desc');
    if (metaDesc) metaDesc.setAttribute('content', seoDesc);

    const ogTitle = document.getElementById('og-title');
    if (ogTitle) ogTitle.setAttribute('content', seoTitle);

    const ogDesc = document.getElementById('og-desc');
    if (ogDesc) ogDesc.setAttribute('content', seoDesc);

    if (featuredManga.cover_url) {
        const ogImage = document.getElementById('og-image');
        if (ogImage) ogImage.setAttribute('content', featuredManga.cover_url);

        const twitterImage = document.getElementById('twitter-image');
        if (twitterImage) twitterImage.setAttribute('content', featuredManga.cover_url);
    }
}

function setupHeroSlider(manhwas) {
    if (!heroBanner && !heroTitle && !heroSynopsis) return;

    const top10 = [...manhwas]
        .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
        .slice(0, 10);

    if (top10.length === 0) return;

    // Atualizar o SEO com o mangá número 1 do ranking
    atualizarSEOHomepage(top10[0]);

    let currentIndex = 0;

    function updateHeroDisplay(index) {
        const featured = top10[index];
        if (!featured) return;

        if (heroTitle) heroTitle.textContent = featured.title;
        if (heroSynopsis) heroSynopsis.textContent = featured.synopsis || "Sem sinopse disponível.";

        if (heroBanner) {
            if (featured.cover_url) {
                heroBanner.style.backgroundImage = `url('${featured.cover_url}')`;
                heroBanner.style.backgroundSize = 'cover';
                heroBanner.style.backgroundPosition = 'center';
            }
            heroBanner.style.cursor = 'pointer';

            heroBanner.onclick = () => {
                window.location.href = `details.html?id=${featured.id}`;
            };
        }
    }

    updateHeroDisplay(currentIndex);

    if (heroInterval) clearInterval(heroInterval);
    if (top10.length > 1) {
        heroInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % top10.length;
            updateHeroDisplay(currentIndex);
        }, 5000);
    }

    const prevBtn = document.getElementById('hero-prev-btn');
    const nextBtn = document.getElementById('hero-next-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + top10.length) % top10.length;
            updateHeroDisplay(currentIndex);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % top10.length;
            updateHeroDisplay(currentIndex);
        });
    }
}

function renderUI(manhwas) {
    if (!manhwas || manhwas.length === 0) return;

    setupHeroSlider(manhwas);

    if (mangaGrid) {
        mangaGrid.innerHTML = '';

        manhwas.forEach((manhwa, index) => {
            const card = document.createElement('article');
            card.className = 'manga-card';
            card.style.animation = `fadeIn 0.3s ease forwards ${index * 0.05}s`;

            const totalCapitulos = Array.isArray(manhwa.chapters) ? manhwa.chapters.length : 0;
            const textoCapitulo = totalCapitulos > 0 
                ? `${totalCapitulos} ${totalCapitulos === 1 ? 'Chapter' : 'Chapters'}` 
                : 'No Chapters';

            card.innerHTML = `
                <div class="card-cover">
                    <img src="${manhwa.cover_url || 'https://via.placeholder.com/300'}" alt="${manhwa.title}">
                    <span class="card-rating">★ ${manhwa.rating || 'N/A'}</span>
                </div>
                <div class="card-details">
                    <h3 class="card-title">${manhwa.title}</h3>
                    <p class="card-chapter">${textoCapitulo}</p>
                </div>
            `;

            card.addEventListener('click', () => {
                window.location.href = `details.html?id=${manhwa.id}`;
            });

            mangaGrid.appendChild(card);
        });
    }
}

function renderEmptyState(message) {
    if (mangaGrid) {
        mangaGrid.innerHTML = `<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">${message}</p>`;
    }
}

// ==========================================================================
// 5. SISTEMA DE BUSCA LOCAL (index page)
// ==========================================================================
function handleSearch() {
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase().trim();

    if (query === '') {
        renderUI(allManhwas);
        return;
    }

    const filtered = allManhwas.filter(m =>
        m.title.toLowerCase().includes(query) ||
        (m.author && m.author.toLowerCase().includes(query))
    );

    if (filtered.length > 0) {
        renderUI(filtered);
    } else {
        renderEmptyState("Nenhum resultado encontrado.");
    }
}

if (searchBtn) searchBtn.addEventListener('click', handleSearch);
if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
}

// ==========================================================================
// 6. FUNÇÕES AUXILIARES E MOCK DATA
// ==========================================================================
function showLoading(isLoading) {
    if (loadingSpinner) {
        loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    }
}

function getMockData() {
    return [
        {
            id: 1,
            title: "Solo Leveling",
            author: "Chugong",
            synopsis: "10 anos atrás, depois que o 'Portal' se abriu...",
            cover_url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500",
            rating: "4.9",
            latest_chapter: "200",
            ano: 2018,
            status: "completed",
            tags: ["action", "fantasy", "system"],
            views: 120
        },
        {
            id: 2,
            title: "Omniscient Reader's Viewpoint",
            author: "sing N song",
            synopsis: "Dokja era um funcionário de escritório comum...",
            cover_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500",
            rating: "4.8",
            latest_chapter: "185",
            ano: 2020,
            status: "ongoing",
            tags: ["action", "apocalyptic", "system"],
            views: 95
        }
    ];
}

function useFallbackData() {
    allManhwas = getMockData();
    renderUI(allManhwas);
}

// ==========================================================================
// 7. INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const manhwaId = urlParams.get('id');

    initAuth().then(() => {
        updateProfileButton();
    });

    if (manhwaId) {
        loadDetailsPage(manhwaId);
    } else {
        fetchManhwasFromSupabase();
    }
});

function updateProfileButton() {
    const profileBtn = document.getElementById('profile-btn') || document.querySelector('.user-profile-btn');
    if (!profileBtn) return;
    if (currentSession) {
        profileBtn.href = 'index.html';
        profileBtn.title = 'Sair';
        profileBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (authSupabase) {
                await authSupabase.auth.signOut();
                window.location.href = 'index.html';
            }
        });
    } else {
        profileBtn.href = 'login.html';
    }
}

// ==========================================================================
// 8. PESQUISA COM ANIMAÇÃO (redireciona para search.html)
// ==========================================================================
const search = document.querySelector('.search-box input');
const searchIcon = document.querySelector('.search-box svg');

function realizarPesquisa() {
    if (!search) return;

    const termo = search.value.trim();

    if (termo !== '') {
        document.body.style.transition = "opacity 0.4s ease-out";
        document.body.style.opacity = "0";

        setTimeout(() => {
            window.location.href = `search.html?q=${encodeURIComponent(termo)}`;
        }, 400);
    }
}

if (search && searchIcon) {
    search.addEventListener('keypress', (evento) => {
        if (evento.key === 'Enter') {
            realizarPesquisa();
        }
    });

    searchIcon.style.cursor = 'pointer';
    searchIcon.addEventListener('click', realizarPesquisa);
}

window.addEventListener('pageshow', () => {
    document.body.style.opacity = "1";
});