const TMDB_API_KEY = window.TMDB_CONFIG?.apiKey || "PASTE_YOUR_TMDB_API_KEY_HERE";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
const POSTER_PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="#121a30" offset="0"/>
          <stop stop-color="#050816" offset="1"/>
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)"/>
      <text x="50%" y="48%" text-anchor="middle" fill="#9ca8be" font-family="Arial, sans-serif" font-size="28">No poster</text>
      <text x="50%" y="54%" text-anchor="middle" fill="#6dd6ff" font-family="Arial, sans-serif" font-size="18">Available on TMDB</text>
    </svg>
  `);

const sections = {
  movie: {
    popular: { label: "Popular titles", endpoint: "/movie/popular" },
    top_rated: { label: "Top rated titles", endpoint: "/movie/top_rated" },
    now_playing: { label: "Now playing titles", endpoint: "/movie/now_playing" },
    upcoming: { label: "Upcoming titles", endpoint: "/movie/upcoming" },
  },
  tv: {
    popular: { label: "Popular shows", endpoint: "/tv/popular" },
    top_rated: { label: "Top rated shows", endpoint: "/tv/top_rated" },
    now_playing: { label: "Airing today", endpoint: "/tv/airing_today" },
    upcoming: { label: "On the air", endpoint: "/tv/on_the_air" },
  },
};

const state = {
  media: "movie",
  section: "popular",
  genre: "all",
  searchTerm: "",
  genres: [],
  featured: null,
  featuredQueue: [],
  featuredTimer: null,
  featuredRefreshTimer: null,
  featuredIndex: 0,
  currentMovies: [],
  currentPage: 1,
  totalPages: 1,
};

const providerHomepages = {
  Netflix: "https://www.netflix.com",
  "Prime Video": "https://www.primevideo.com",
  Hulu: "https://www.hulu.com",
  "Disney Plus": "https://www.disneyplus.com",
  "Disney+": "https://www.disneyplus.com",
  "Apple TV+": "https://tv.apple.com",
  Max: "https://www.max.com",
  "HBO Max": "https://www.max.com",
  Crunchyroll: "https://www.crunchyroll.com",
  HIDIVE: "https://www.hidive.com",
  Peacock: "https://www.peacocktv.com",
  "Paramount Plus": "https://www.paramountplus.com",
};

const dom = {
  hero: document.getElementById("hero"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  movieGrid: document.getElementById("movie-grid"),
  status: document.getElementById("status"),
  resultsLabel: document.getElementById("results-label"),
  resultsTitle: document.getElementById("results-title"),
  genreRow: document.getElementById("genre-row"),
  featureLabel: document.getElementById("feature-label"),
  statCount: document.getElementById("stat-count"),
  statSection: document.getElementById("stat-section"),
  statRating: document.getElementById("stat-rating"),
  featureMedia: document.getElementById("feature-media"),
  featureTitle: document.getElementById("feature-title"),
  featureOverview: document.getElementById("feature-overview"),
  featureYear: document.getElementById("feature-year"),
  featureRuntime: document.getElementById("feature-runtime"),
  featureScore: document.getElementById("feature-score"),
  featureOpen: document.getElementById("feature-open"),
  clearSearch: document.getElementById("clear-search"),
  pagination: document.getElementById("pagination"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  pageIndicator: document.getElementById("page-indicator"),
  featurePanel: document.querySelector(".feature-panel"),
  modal: document.getElementById("movie-modal"),
  modalBody: document.getElementById("modal-body"),
  closeModal: document.getElementById("close-modal"),
};

function assertKey() {
  if (!TMDB_API_KEY || TMDB_API_KEY.includes("PASTE_YOUR")) {
    dom.status.textContent =
      "Add your TMDB API key in script.js, then reload the page to start browsing movies.";
    dom.movieGrid.innerHTML = "";
    return false;
  }
  return true;
}

async function request(path) {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(TMDB_API_KEY)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json();
}

function formatYear(dateString) {
  if (!dateString) return "Unknown";
  return new Date(dateString).getFullYear();
}

function formatRuntime(minutes) {
  if (!minutes) return "--";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function posterUrl(path) {
  return path ? `${IMAGE_BASE}${path}` : POSTER_PLACEHOLDER;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function genreName(ids) {
  if (!ids?.length || !state.genres.length) return "Movie";
  const selected = state.genres.find((genre) => ids.includes(genre.id));
  return selected?.name ?? "Movie";
}

function mediaTypeLabel(mediaType) {
  return mediaType === "tv" ? "TV Show" : "Movie";
}

function posterTypeLabel(mediaType) {
  return mediaType === "tv" ? "show" : "movie";
}

function getActiveSection() {
  return sections[state.media][state.section];
}

function getRecentWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 60);

  const toYmd = (date) => date.toISOString().slice(0, 10);
  return {
    from: toYmd(start),
    to: toYmd(end),
  };
}

function clearFeatureTimers() {
  if (state.featuredTimer) {
    clearInterval(state.featuredTimer);
    state.featuredTimer = null;
  }
  if (state.featuredRefreshTimer) {
    clearInterval(state.featuredRefreshTimer);
    state.featuredRefreshTimer = null;
  }
}

function animateFeaturedSwap() {
  if (!dom.featurePanel) return;
  dom.featurePanel.classList.remove("is-switching");
  void dom.featurePanel.offsetWidth;
  dom.featurePanel.classList.add("is-switching");
  window.setTimeout(() => dom.featurePanel.classList.remove("is-switching"), 600);
}

async function loadFeaturedQueue() {
  const { from, to } = getRecentWindow();
  const listEndpoint =
    state.media === "movie"
      ? `/discover/movie?primary_release_date.gte=${from}&primary_release_date.lte=${to}&sort_by=popularity.desc&page=1`
      : `/discover/tv?first_air_date.gte=${from}&first_air_date.lte=${to}&sort_by=popularity.desc&page=1`;

  const data = await request(listEndpoint);
  const picks = (data.results || []).slice(0, 6);

  if (!picks.length) {
    state.featuredQueue = [];
    return;
  }

  const details = await Promise.all(
    picks.map(async (item) => {
      try {
        return await request(`/${state.media}/${item.id}`);
      } catch (error) {
        console.error(error);
        return null;
      }
    })
  );

  state.featuredQueue = details.filter(Boolean);
  state.featuredIndex = 0;
}

function showFeatured(index = 0) {
  if (!state.featuredQueue.length) return;
  const item = state.featuredQueue[index % state.featuredQueue.length];
  if (!item) return;

  animateFeaturedSwap();
  setHero(item);
  dom.featureOpen.onclick = null;
  dom.featureOpen.dataset.featuredId = item.id;
  dom.featureOpen.dataset.featuredMedia = state.media;
  state.featured = item;
  state.featuredIndex = index % state.featuredQueue.length;
}

function startFeaturedRotation() {
  clearFeatureTimers();

  if (!state.featuredQueue.length) return;

  state.featuredTimer = window.setInterval(() => {
    if (!state.featuredQueue.length) return;
    const nextIndex = (state.featuredIndex + 1) % state.featuredQueue.length;
    showFeatured(nextIndex);
  }, 8000);

  state.featuredRefreshTimer = window.setInterval(() => {
    refreshFeatured().catch((error) => console.error(error));
  }, 30 * 60 * 1000);
}

async function refreshFeatured() {
  await loadFeaturedQueue();
  if (!state.featuredQueue.length) {
    dom.featureMedia.innerHTML = `<div class="feature-placeholder">No recent releases found for this section yet.</div>`;
    dom.featureTitle.textContent = "Nothing recent yet";
    dom.featureOverview.textContent = "Check back soon for new arrivals.";
    dom.featureYear.textContent = "--";
    dom.featureRuntime.textContent = "-- min";
    dom.featureScore.textContent = "-- / 10";
    return;
  }

  showFeatured(0);
  startFeaturedRotation();
}

function updateStats() {
  dom.statCount.textContent = String(state.currentMovies.length || 0).padStart(2, "0");
  dom.statSection.textContent = state.media === "movie" ? "Movies" : "TV Shows";
  dom.statRating.textContent = state.searchTerm ? "Search" : "TMDB";
  dom.pageIndicator.textContent = `Page ${state.currentPage} of ${state.totalPages || 1}`;
  dom.prevPage.disabled = state.currentPage <= 1;
  dom.nextPage.disabled = state.currentPage >= (state.totalPages || 1);
}

function renderGenres() {
  const chips = [
    `<button class="pill ${state.genre === "all" ? "active" : ""}" data-genre="all">All</button>`,
    ...state.genres.map(
      (genre) =>
        `<button class="pill ${state.genre === String(genre.id) ? "active" : ""}" data-genre="${genre.id}">${escapeHtml(genre.name)}</button>`
    ),
  ];
  dom.genreRow.innerHTML = chips.join("");
}

function createMovieCard(movie) {
  const title = movie.title || movie.name || "Untitled";
  const overview = movie.overview || "No overview available for this title yet.";
  const year = formatYear(movie.release_date || movie.first_air_date);
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";

  return `
    <article class="movie-card" data-id="${movie.id}">
      <div class="poster-wrap">
        <img loading="lazy" src="${posterUrl(movie.poster_path)}" alt="${escapeHtml(title)} poster" />
        <span class="rating-badge">★ ${rating}</span>
      </div>
      <div class="movie-card-body">
        <h3>${escapeHtml(title)}</h3>
        <div class="card-meta">
          <span>${year}</span>
          <span>${escapeHtml(genreName(movie.genre_ids))}</span>
        </div>
        <p class="card-overview">${escapeHtml(overview)}</p>
        <button class="open-details" data-open="${movie.id}">View details</button>
      </div>
    </article>
  `;
}

function createSearchResultCard(movie) {
  const title = movie.title || movie.name || "Untitled";
  const overview = movie.overview || "No overview available for this title yet.";
  const year = formatYear(movie.release_date || movie.first_air_date);
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const mediaType = movie.media_type || state.media;

  return `
    <article class="movie-card" data-id="${movie.id}">
      <div class="poster-wrap">
        <img loading="lazy" src="${posterUrl(movie.poster_path)}" alt="${escapeHtml(title)} poster" />
        <span class="rating-badge">${mediaTypeLabel(mediaType)} · ★ ${rating}</span>
      </div>
      <div class="movie-card-body">
        <h3>${escapeHtml(title)}</h3>
        <div class="card-meta">
          <span>${year}</span>
          <span>${escapeHtml(genreName(movie.genre_ids))}</span>
        </div>
        <p class="card-overview">${escapeHtml(overview)}</p>
        <button class="open-details" data-open="${movie.id}" data-media-type="${mediaType}">View details</button>
      </div>
    </article>
  `;
}

function renderMovies(movies) {
  state.currentMovies = movies;
  dom.movieGrid.innerHTML = movies.length
    ? movies.map(createSearchResultCard).join("")
    : `<div class="status">No movies found. Try a different search or filter.</div>`;
  updateStats();
}

function setStatus(message) {
  dom.status.textContent = message;
}

function setLoadingSkeleton() {
  dom.movieGrid.innerHTML = Array.from({ length: 8 })
    .map(
      () => `
      <article class="movie-card">
        <div class="poster-wrap skeleton"></div>
        <div class="movie-card-body">
          <div class="skeleton" style="height: 20px; border-radius: 10px;"></div>
          <div class="skeleton" style="height: 14px; width: 70%; border-radius: 999px;"></div>
          <div class="skeleton" style="height: 56px; border-radius: 12px;"></div>
          <div class="skeleton" style="height: 40px; border-radius: 12px;"></div>
        </div>
      </article>
    `
    )
    .join("");
}

function setHero(movie) {
  state.featured = movie;
  dom.featureTitle.textContent = movie.title || movie.name || "Featured title";
  dom.featureOverview.textContent = movie.overview || "This featured title is ready for you to explore.";
  dom.featureYear.textContent = String(formatYear(movie.release_date || movie.first_air_date));
  dom.featureRuntime.textContent = `${formatRuntime(movie.runtime || movie.episode_run_time?.[0])} runtime`;
  dom.featureScore.textContent = movie.vote_average ? `${movie.vote_average.toFixed(1)} / 10` : "-- / 10";
  dom.featureLabel.textContent = state.media === "movie" ? "Recent movie spotlight" : "Recent TV spotlight";
  dom.featureMedia.innerHTML = movie.backdrop_path
    ? `<img src="${posterUrl(movie.backdrop_path)}" alt="${escapeHtml(movie.title || movie.name)} backdrop" />`
    : `<div class="feature-placeholder">No backdrop available for this title.</div>`;
}

async function loadGenres() {
  const data = await request(`/genre/${state.media}/list`);
  state.genres = data.genres || [];
  renderGenres();
}

async function loadFeaturedMovie() {
  await refreshFeatured();
}

async function loadMovies() {
  const active = getActiveSection();
  state.searchTerm = dom.searchInput.value.trim();
  dom.clearSearch.hidden = !state.searchTerm;
  dom.resultsLabel.textContent = state.searchTerm ? "All search results" : active.label;
  dom.resultsTitle.textContent = state.searchTerm
    ? `Results for "${state.searchTerm}"`
    : `Browse ${active.label.toLowerCase()}`;

  setStatus("Loading movies...");
  setLoadingSkeleton();

  try {
    let data;
    if (state.searchTerm) {
      data = await request(
        `/search/multi?query=${encodeURIComponent(state.searchTerm)}&page=${state.currentPage}&include_adult=false`
      );
    } else if (state.genre !== "all") {
      data = await request(`/discover/${state.media}?with_genres=${encodeURIComponent(state.genre)}&sort_by=popularity.desc&page=${state.currentPage}`);
    } else {
      data = await request(`${active.endpoint}?page=${state.currentPage}`);
    }

    const movies = (data.results || [])
      .filter((movie) => movie.media_type !== "person")
      .map((movie) =>
        state.searchTerm && !movie.media_type ? { ...movie, media_type: movie.title ? "movie" : "tv" } : movie
      )
      .filter((movie) => movie.poster_path || movie.backdrop_path);
    state.totalPages = Math.max(1, Math.min(data.total_pages || 1, 500));
    renderMovies(movies);
    setStatus(
      movies.length
        ? `Showing ${movies.length} results.`
        : "No titles matched your filters."
    );
    updateStats();
  } catch (error) {
    console.error(error);
    setStatus("We could not load TMDB data right now. Check your API key and internet connection.");
    dom.movieGrid.innerHTML = "";
  }
}

async function openMovie(movieId) {
  try {
    dom.modalBody.innerHTML = `<div class="status">Loading movie details...</div>`;
    dom.modal.showModal();

    const data = await request(`/${state.media}/${movieId}?append_to_response=videos,credits`);
    const cast = (data.credits?.cast || []).slice(0, 8);
    const trailers = (data.videos?.results || []).filter(
      (video) => video.site === "YouTube" && video.type === "Trailer"
    );
    const trailer = trailers[0];
    const genres = (data.genres || []).map((genre) => `<span>${escapeHtml(genre.name)}</span>`).join("");
    const castHtml = cast.map((person) => `<span>${escapeHtml(person.name)}</span>`).join("");

    dom.modalBody.innerHTML = `
      <div class="modal-poster">
        <img src="${posterUrl(data.poster_path)}" alt="${escapeHtml(data.title || data.name)} poster" />
      </div>
      <div class="modal-copy">
        <p class="eyebrow">${escapeHtml(data.tagline || "TMDB movie details")}</p>
        <h2>${escapeHtml(data.title || data.name)}</h2>
        <div class="meta-line">
          <span class="meta-pill">${formatYear(data.release_date || data.first_air_date)}</span>
          <span class="meta-pill">${formatRuntime(data.runtime || data.episode_run_time?.[0])}</span>
          <span class="meta-pill">★ ${data.vote_average ? data.vote_average.toFixed(1) : "N/A"}</span>
          <span class="meta-pill">${escapeHtml(data.status || "Released")}</span>
        </div>
        <p>${escapeHtml(data.overview || "No description is available for this title.")}</p>
        <div class="genre-list">${genres || "<span>Movie</span>"}</div>
        <div class="cast-list">${castHtml || "<span>Cast unavailable</span>"}</div>
        <div class="modal-actions">
          ${
            trailer
              ? `<a class="primary" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}" target="_blank" rel="noreferrer">Watch trailer</a>`
              : ""
          }
          <a class="secondary" href="https://www.themoviedb.org/${state.media}/${data.id}" target="_blank" rel="noreferrer">Open on TMDB</a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    dom.modalBody.innerHTML = `<div class="status">Could not load this movie right now.</div>`;
    dom.modal.showModal();
  }
}

function providerLinksFor(providerData) {
  const region = providerData.US || providerData.NG || Object.values(providerData)[0];
  const providers = region?.flatrate || region?.rent || region?.buy || [];

  return providers
    .map((provider) => {
      const homepage = providerHomepages[provider.provider_name];
      if (!homepage) return null;
      return `<a class="provider-pill" href="${homepage}" target="_blank" rel="noreferrer">Watch on ${escapeHtml(provider.provider_name)}</a>`;
    })
    .filter(Boolean)
    .join("");
}

function getStreamingLinks(mediaType) {
  if (mediaType === "tv") {
    return `
      <a class="provider-pill" href="https://animepahe.pw" target="_blank" rel="noreferrer">Watch on animepahe.pw</a>
    `;
  } else {
    return `
      <a class="provider-pill" href="https://nkiri.ink" target="_blank" rel="noreferrer">Watch on nkiri.ink</a>
      <a class="provider-pill" href="https://moviebox.ph" target="_blank" rel="noreferrer">Watch on moviebox.ph</a>
    `;
  }
}

async function openTitle(movieId, mediaType = state.media) {
  try {
    dom.modalBody.innerHTML = `<div class="status">Loading title details...</div>`;
    dom.modal.showModal();

    const [data, providerData] = await Promise.all([
      request(`/${mediaType}/${movieId}?append_to_response=videos,credits`),
      request(`/${mediaType}/${movieId}/watch/providers`),
    ]);
    const cast = (data.credits?.cast || []).slice(0, 8);
    const trailers = (data.videos?.results || []).filter(
      (video) => video.site === "YouTube" && video.type === "Trailer"
    );
    const trailer = trailers[0];
    const genres = (data.genres || []).map((genre) => `<span>${escapeHtml(genre.name)}</span>`).join("");
    const castHtml = cast.map((person) => `<span>${escapeHtml(person.name)}</span>`).join("");
    const providerHtml = providerLinksFor(providerData.results || {});
    const title = data.title || data.name || "Untitled";

    dom.modalBody.innerHTML = `
      <div class="modal-poster">
        <img src="${posterUrl(data.poster_path)}" alt="${escapeHtml(title)} poster" />
      </div>
      <div class="modal-copy">
        <p class="eyebrow">${escapeHtml(data.tagline || `${mediaTypeLabel(mediaType)} details`)}</p>
        <h2>${escapeHtml(title)}</h2>
        <div class="meta-line">
          <span class="meta-pill">${formatYear(data.release_date || data.first_air_date)}</span>
          <span class="meta-pill">${formatRuntime(data.runtime || data.episode_run_time?.[0])}</span>
          <span class="meta-pill">★ ${data.vote_average ? data.vote_average.toFixed(1) : "N/A"}</span>
          <span class="meta-pill">${escapeHtml(data.status || "Released")}</span>
        </div>
        <p>${escapeHtml(data.overview || "No description is available for this title.")}</p>
        <div class="genre-list">${genres || `<span>${mediaTypeLabel(mediaType)}</span>`}</div>
        <div class="cast-list">${castHtml || "<span>Cast unavailable</span>"}</div>
        <div class="watch-section">
          <h3>Stream now</h3>
          <div class="provider-grid">
            ${getStreamingLinks(mediaType)}
          </div>
        </div>
        <div class="watch-section">
          <h3>Watch on official platforms</h3>
          <div class="provider-grid">
            ${providerHtml || `<span class="provider-empty">No official provider found in your region yet.</span>`}
          </div>
        </div>
        <div class="modal-actions">
          ${
            trailer
              ? `<a class="primary" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}" target="_blank" rel="noreferrer">Watch trailer</a>`
              : ""
          }
          <a class="secondary" href="https://www.themoviedb.org/${mediaType}/${data.id}" target="_blank" rel="noreferrer">Open on TMDB</a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    dom.modalBody.innerHTML = `<div class="status">Could not load this title right now.</div>`;
    dom.modal.showModal();
  }
}

function wireEvents() {
  document.querySelectorAll("[data-media]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("[data-media]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.media = button.dataset.media;
      state.section = "popular";
      state.genre = "all";
      state.searchTerm = "";
      state.currentPage = 1;
      state.totalPages = 1;
      dom.searchInput.value = "";
      dom.clearSearch.hidden = true;
      document.querySelectorAll("[data-section]").forEach((item, index) => {
        item.classList.toggle("active", index === 0);
      });
      updateSectionButtonLabels();
      await refreshData();
    });
  });

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-section]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.section = button.dataset.section;
      state.genre = "all";
      state.currentPage = 1;
      renderGenres();
      loadMovies();
    });
  });

  dom.genreRow.addEventListener("click", (event) => {
    const target = event.target.closest("[data-genre]");
    if (!target || target.classList.contains("pill-muted")) return;
    state.genre = target.dataset.genre;
    renderGenres();
    loadMovies();
  });

  dom.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.currentPage = 1;
    loadMovies();
  });

  dom.clearSearch.addEventListener("click", () => {
    dom.searchInput.value = "";
    state.searchTerm = "";
    dom.clearSearch.hidden = true;
    state.currentPage = 1;
    loadMovies();
  });

  dom.prevPage.addEventListener("click", () => {
    if (state.currentPage <= 1) return;
    state.currentPage -= 1;
    loadMovies();
  });

  dom.nextPage.addEventListener("click", () => {
    if (state.currentPage >= state.totalPages) return;
    state.currentPage += 1;
    loadMovies();
  });

  dom.featureOpen.addEventListener("click", () => {
    if (!state.featured?.id) return;
    openTitle(state.featured.id, state.media);
  });

  dom.movieGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open]");
    if (!button) return;
    openTitle(button.dataset.open, button.dataset.mediaType || state.media);
  });

  dom.closeModal.addEventListener("click", () => dom.modal.close());
  dom.modal.addEventListener("click", (event) => {
    const rect = dom.modal.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedOutside) dom.modal.close();
  });
}

function updateSectionButtonLabels() {
  const labels =
    state.media === "movie"
      ? ["Popular", "Top Rated", "Now Playing", "Upcoming"]
      : ["Popular", "Top Rated", "Airing Today", "On The Air"];
  document.querySelectorAll("[data-section]").forEach((button, index) => {
    button.textContent = labels[index] || button.textContent;
  });
  dom.searchInput.placeholder =
    state.media === "movie"
      ? "Search movies, TV shows, and franchises"
      : "Search TV shows, movies, and franchises";
  dom.featureMedia.innerHTML = `<div class="feature-placeholder">Loading featured ${
    state.media === "movie" ? "movie" : "show"
  }...</div>`;
  dom.featureLabel.textContent = state.media === "movie" ? "Recent movie spotlight" : "Recent TV spotlight";
}

async function refreshData() {
  renderGenres();
  setStatus("Loading TMDB data...");
  await Promise.all([loadGenres(), loadFeaturedMovie()]);
  await loadMovies();
}

async function bootstrap() {
  if (!assertKey()) return;
  wireEvents();
  updateSectionButtonLabels();
  renderGenres();
  setStatus("Loading TMDB data...");

  try {
    await refreshData();
  } catch (error) {
    console.error(error);
    setStatus("Something went wrong while initializing the app.");
  }
}

bootstrap();
