const SUPABASE_URL = "https://espwjxbeofclgvqaeuvd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcHdqeGJlb2ZjbGd2cWFldXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTAzMjMsImV4cCI6MjEwNTc2NjMyM30.R2qAJ9T25y8HF5EAr8dVJopC0YYJN-X8CbgZ-e1oV4g"; 

// ==========================================
// 1. ELEMENTOS DO DOM & ESTADO
// ==========================================
const mangaGrid = document.getElementById('manga-grid');
const loadingSpinner = document.getElementById('loading-spinner');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroSynopsis = document.getElementById('hero-synopsis');

let allManhwas = [];
let heroInterval = null;
let authSupabase = null;
let currentSession = null;

// ==========================================
// 2. TEMA (DARK / LIGHT MODE)
// ==========================================
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    localStorage.removeItem('theme-override');
    document.documentElement.classList.toggle('tema-claro', !e.matches);
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

// ==========================================
// 3. BUSCA DE DADOS (SUPABASE)
// ==========================================
async function fetchManhwasFromSupabase() {
    showLoading(true);
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/manhwas?select=*,chapters(*)`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
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

// ==========================================
// 4. PÁGINA DE DETALHES E VIEWS
// ==========================================
async function loadDetailsPage(id) {
    showLoading(true);
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/manhwas?id=eq.${id}&select=*`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
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
        const found = getMockData().find(m => m.id == id) || getMockData()[0];
        renderDetailsUI(found);
    } finally {
        showLoading(false);
    }
}

async function incrementarVisualizacao(mangaId, viewsAtuais) {
    const storageKey = `viewed_manga_${mangaId}`;
    const ultimaVisualizacao = localStorage.getItem(storageKey);
    const agora = Date.now();

    if (ultimaVisualizacao && (agora - Number(ultimaVisualizacao) < 86400000)) return;

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

        if (response.ok) {
            localStorage.setItem(storageKey, agora.toString());
            const viewsEl = document.getElementById('details-views');
            if (viewsEl) viewsEl.textContent = novasViews;
        }
    } catch (err) {
        console.error("Erro ao incrementar views:", err);
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
    if (ratingEl) ratingEl.textContent = manhwa.rating ?? '0.0';
    if (viewsEl) viewsEl.textContent = manhwa.views ?? '0';

    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        let tagsList = Array.isArray(manhwa.tags) ? manhwa.tags : (typeof manhwa.tags === 'string' ? manhwa.tags.split(',') : []);

        if (tagsList.length > 0) {
            const fragment = document.createDocumentFragment();
            tagsList.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = tag.trim().toUpperCase();
                fragment.appendChild(span);
            });
            tagsContainer.appendChild(fragment);
        } else {
            tagsContainer.innerHTML = '<span class="tag">SEM TAGS</span>';
        }
    }

    setupSynopsisToggle();
}

function setupSynopsisToggle() {
    const synopsisEl = document.getElementById('details-synopsis');
    const toggleBtn = document.getElementById('synopsis-toggle');
    if (!synopsisEl || !toggleBtn) return;

    if (synopsisEl.textContent.trim().length > 200) {
        synopsisEl.classList.add('synopsis-collapsed');
        toggleBtn.style.display = 'inline-block';
        toggleBtn.textContent = 'Ler mais';

        toggleBtn.onclick = () => {
            const isCollapsed = synopsisEl.classList.toggle('synopsis-collapsed');
            toggleBtn.textContent = isCollapsed ? 'Ler mais' : 'Ler menos';
        };
    } else {
        toggleBtn.style.display = 'none';
    }
}

async function initAuth() {
    if (typeof window.supabase === 'undefined') return;
    authSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await authSupabase.auth.getSession();
    currentSession = session;
}

// ==========================================
// 5. RENDERIZAÇÃO DA HOME & HERO SLIDER
// ==========================================
function atualizarSEOHomepage(featuredManga) {
    if (!featuredManga) return;

    const seoTitle = `Read ${featuredManga.title} & More Manhwas Online - Mangaice`;
    const seoDesc = `Read ${featuredManga.title} and the best high-quality manhwas, webtoons, and mangas online with daily updates on Mangaice.`;

    document.title = seoTitle;
    document.getElementById('meta-title')?.setAttribute('content', seoTitle);
    document.getElementById('meta-desc')?.setAttribute('content', seoDesc);
    document.getElementById('og-title')?.setAttribute('content', seoTitle);
    document.getElementById('og-desc')?.setAttribute('content', seoDesc);

    if (featuredManga.cover_url) {
        document.getElementById('og-image')?.setAttribute('content', featuredManga.cover_url);
        document.getElementById('twitter-image')?.setAttribute('content', featuredManga.cover_url);
    }
}

function setupHeroSlider(manhwas) {
    if (!heroBanner && !heroTitle && !heroSynopsis) return;

    const top10 = [...manhwas].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 10);
    if (top10.length === 0) return;

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
            heroBanner.onclick = () => window.location.href = `details.html?id=${featured.id}`;
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
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + top10.length) % top10.length;
            updateHeroDisplay(currentIndex);
        };
    }
    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % top10.length;
            updateHeroDisplay(currentIndex);
        };
    }
}

function renderUI(manhwas) {
    if (!manhwas || manhwas.length === 0) return;
    setupHeroSlider(manhwas);

    if (mangaGrid) {
        mangaGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();

        manhwas.forEach((manhwa, index) => {
            const card = document.createElement('article');
            card.className = 'manga-card';
            card.style.animation = `fadeIn 0.3s ease forwards ${index * 0.05}s`;

            const totalCapitulos = Array.isArray(manhwa.chapters) ? manhwa.chapters.length : 0;
            const textoCapitulo = totalCapitulos > 0 ? `${totalCapitulos} ${totalCapitulos === 1 ? 'Chapter' : 'Chapters'}` : 'No Chapters';

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

            card.onclick = () => window.location.href = `details.html?id=${manhwa.id}`;
            fragment.appendChild(card);
        });

        mangaGrid.appendChild(fragment);
    }
}

function renderEmptyState(message) {
    if (mangaGrid) {
        mangaGrid.innerHTML = `<p style="color: var(--text-secondary); padding: 2rem; text-align: center;">${message}</p>`;
    }
}

// ==========================================
// 6. BUSCA E UTILITÁRIOS
// ==========================================
function handleSearch() {
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase().trim();

    if (query === '') {
        renderUI(allManhwas);
        return;
    }

    const filtered = allManhwas.filter(m =>
        m.title.toLowerCase().includes(query) || (m.author && m.author.toLowerCase().includes(query))
    );

    filtered.length > 0 ? renderUI(filtered) : renderEmptyState("Nenhum resultado encontrado.");
}

if (searchBtn) searchBtn.addEventListener('click', handleSearch);
if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleSearch(); });

function showLoading(isLoading) {
    if (loadingSpinner) loadingSpinner.style.display = isLoading ? 'flex' : 'none';
}

function getMockData() {
    return [
        { id: 1, title: "Solo Leveling", author: "Chugong", synopsis: "10 anos atrás...", cover_url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500", rating: "4.9", views: 120, tags: ["action"] },
        { id: 2, title: "Omniscient Reader's Viewpoint", author: "sing N song", synopsis: "Dokja era...", cover_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500", rating: "4.8", views: 95, tags: ["action"] }
    ];
}

function useFallbackData() {
    allManhwas = getMockData();
    renderUI(allManhwas);
}

function updateProfileButton() {
    const profileBtn = document.getElementById('profile-btn') || document.querySelector('.user-profile-btn');
    if (!profileBtn) return;
    if (currentSession) {
        profileBtn.href = 'index.html';
        profileBtn.title = 'Sair';
        profileBtn.onclick = async (e) => {
            e.preventDefault();
            if (authSupabase) {
                await authSupabase.auth.signOut();
                window.location.href = 'index.html';
            }
        };
    } else {
        profileBtn.href = 'login.html';
    }
}

// ==========================================
// 7. INICIALIZAÇÃO E PESQUISA EXTERNA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const manhwaId = new URLSearchParams(window.location.search).get('id');

    initAuth().then(updateProfileButton);

    if (manhwaId) {
        loadDetailsPage(manhwaId);
    } else {
        fetchManhwasFromSupabase();
    }
});

const searchField = document.querySelector('.search-box input');
const searchIcon = document.querySelector('.search-box svg');

function realizarPesquisa() {
    if (!searchField) return;
    const termo = searchField.value.trim();
    if (termo !== '') {
        document.body.style.transition = "opacity 0.4s ease-out";
        document.body.style.opacity = "0";
        setTimeout(() => window.location.href = `search.html?q=${encodeURIComponent(termo)}`, 400);
    }
}

if (searchField && searchIcon) {
    searchField.addEventListener('keypress', (e) => { if (e.key === 'Enter') realizarPesquisa(); });
    searchIcon.style.cursor = 'pointer';
    searchIcon.onclick = realizarPesquisa;
}

window.addEventListener('pageshow', () => { document.body.style.opacity = "1"; });
