/**
 * Ox Video Gallery - Client-side JavaScript
 * This file is served as a static asset
 */

console.log("Ox App started (Optimized Engine + New Features)...");

// ===============================================
// 1. OPTIMIZED ENGINE (Queue & Logic)
// ===============================================

// Antrean Thumbnail agar browser tidak hang
const thumbnailQueue = [];
let isProcessingQueue = false;

function addToQueue(card) {
    thumbnailQueue.push(card);
    processQueue();
}

async function processQueue() {
    if (isProcessingQueue || thumbnailQueue.length === 0) return;
    isProcessingQueue = true;
    const card = thumbnailQueue.shift();
    try {
        await new Promise((resolve) => {
            const videoPath = card.dataset.video;
            const isCached = card.dataset.cached === "true";
            const durationEl = card.querySelector('.duration-badge');
            const imgEl = card.querySelector('img');
            const thumbBox = card.querySelector('.thumb-box');
            const loader = card.querySelector('.loader');

            const v = document.createElement('video');
            v.src = videoPath;
            v.muted = true;
            v.preload = "metadata";

            // Cleanup & Selesai
            const finish = () => {
                v.removeAttribute('src');
                v.load();
                if (loader) loader.remove();
                resolve();
            };

            // Timeout safety (15s)
            const safety = setTimeout(finish, 15000);

            v.addEventListener('loadedmetadata', () => {
                if (v.duration && isFinite(v.duration)) {
                    durationEl.innerText = formatTime(v.duration);
                    durationEl.style.opacity = 1;
                    if (isCached) thumbBox.classList.add('loaded');
                }

                if (isCached) {
                    clearTimeout(safety);
                    finish();
                    return;
                }

                // Seek untuk ambil gambar
                v.currentTime = Math.min(510, v.duration * 0.2);
            });

            v.addEventListener('seeked', () => {
                clearTimeout(safety);
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = 240; // Hemat memori
                    canvas.height = 135;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    const d = canvas.toDataURL("image/jpeg", 0.6);

                    imgEl.src = d;
                    thumbBox.classList.add('loaded');

                    // Save thumbnail with duration
                    fetch("/save-thumb", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            path: decodeURI(videoPath),
                            data: d,
                            duration: v.duration
                        })
                    }).catch(() => { });
                } catch (e) { } finally {
                    finish();
                }
            });

            v.addEventListener('error', () => {
                clearTimeout(safety);
                finish();
            });
        });
    } catch (e) { console.error(e); } finally {
        isProcessingQueue = false;
        processQueue(); // Lanjut antrean
    }
}

// Observer: Hanya proses saat terlihat
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            addToQueue(entry.target);
            observer.unobserve(entry.target);
            // Aktifkan hover preview setelah terlihat
            initSingleHover(entry.target);
        }
    });
}, { rootMargin: "200px" });

function initObservers() {
    document.querySelectorAll('.video-card').forEach(c => {
        if (!c.dataset.observed) {
            c.dataset.observed = 'true';
            observer.observe(c);
        }
    });
}

// Panggil saat start
initObservers();

// ===============================================
// 2. INFINITE SCROLL
// ===============================================
let currentPage = 1;
let isLoadingMore = false;

const loadMoreObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !isLoadingMore) {
            loadMoreVideos();
        }
    });
}, { rootMargin: "100px" });

// Initialize load more trigger
const loadMoreTrigger = document.getElementById('loadMoreTrigger');
if (loadMoreTrigger) {
    loadMoreObserver.observe(loadMoreTrigger);
}

async function loadMoreVideos() {
    const grid = document.getElementById('contentGrid');
    const hasMore = grid.dataset.hasMore === 'true';

    if (!hasMore || isLoadingMore) return;

    isLoadingMore = true;
    currentPage++;

    try {
        const currentPath = decodeURIComponent(grid.dataset.path || '');
        const res = await fetch(`/api/videos?path=${encodeURIComponent(currentPath)}&page=${currentPage}&limit=20`);
        const data = await res.json();

        if (data.videos && data.videos.length > 0) {
            // Append new videos
            data.videos.forEach(v => {
                const card = createVideoCard(v, currentPath);
                grid.appendChild(card);
            });

            // Update has more status
            grid.dataset.hasMore = data.hasMore ? 'true' : 'false';

            // Hide load more trigger if no more videos
            if (!data.hasMore && loadMoreTrigger) {
                loadMoreTrigger.style.display = 'none';
            }

            // Init observers for new cards
            initObservers();
        }
    } catch (e) {
        console.error('Error loading more videos:', e);
    } finally {
        isLoadingMore = false;
    }
}

function createVideoCard(v, currentPath) {
    const card = document.createElement('div');
    card.className = 'card video-card item';
    card.dataset.video = encodeURI(v.path);
    card.dataset.cached = v.hasThumb ? 'true' : 'false';
    card.dataset.name = v.name.toLowerCase();
    card.dataset.size = v.bytes;
    card.dataset.type = 'video';
    card.dataset.fav = v.isFavorite ? 'true' : 'false';
    card.onclick = (e) => handleVideoClick(e, encodeURIComponent(currentPath), encodeURIComponent(v.path));

    card.innerHTML = `
    <div class="thumb-box ${v.hasThumb ? 'loaded' : ''}">
      ${!v.hasThumb ? '<div class="loader"></div>' : ''}
      <img src="${v.thumbUrl}" loading="lazy">
      <div class="duration-badge">${v.duration ? formatTime(v.duration) : '--:--'}</div>
      <button class="fav-btn-card ${v.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavoriteCard(this, '${encodeURIComponent(v.path)}')" title="Favorite">
        <span class="heart-empty">${window.SVG_ICONS.heart}</span>
        <span class="heart-filled">${window.SVG_ICONS.heartFilled}</span>
      </button>
      <div class="overlay-play"><div class="play-circle">${window.SVG_ICONS.play}</div></div>
    </div>
    <div class="meta"><div class="title" title="${v.name}">${v.name}</div><div class="details"><span>Video</span><span>${v.size}</span></div></div>
  `;

    return card;
}

// ===============================================
// 3. FAVORITES SYSTEM
// ===============================================

window.toggleFavorite = async function (encodedPath) {
    const videoPath = decodeURIComponent(encodedPath);
    const btn = document.querySelector('.fav-btn');

    try {
        const res = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: videoPath })
        });
        const data = await res.json();

        if (btn) {
            btn.classList.toggle('active', data.isFavorite);
        }
    } catch (e) {
        console.error('Error toggling favorite:', e);
    }
};

window.toggleFavoriteCard = async function (btn, encodedPath) {
    const videoPath = decodeURIComponent(encodedPath);

    try {
        const res = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: videoPath })
        });
        const data = await res.json();

        btn.classList.toggle('active', data.isFavorite);
        btn.closest('.card').dataset.fav = data.isFavorite ? 'true' : 'false';
    } catch (e) {
        console.error('Error toggling favorite:', e);
    }
};

// ===============================================
// 4. WATCH HISTORY & PROGRESS TRACKING
// ===============================================

let historyUpdateInterval = null;

function initHistoryTracking(video) {
    if (!video) return;

    const videoPath = decodeURIComponent(video.dataset.path || window.ACTIVE_VIDEO || '');
    if (!videoPath) return;

    // Save progress every 5 seconds while playing
    historyUpdateInterval = setInterval(() => {
        if (!video.paused && video.duration) {
            saveProgress(videoPath, video.currentTime, video.duration);
        }
    }, 5000);

    // Save progress on pause
    video.addEventListener('pause', () => {
        if (video.duration) {
            saveProgress(videoPath, video.currentTime, video.duration);
        }
    });

    // Save progress before leaving
    window.addEventListener('beforeunload', () => {
        if (video.duration) {
            saveProgress(videoPath, video.currentTime, video.duration);
        }
    });

    // Restore progress
    restoreProgress(videoPath, video);
}

async function saveProgress(videoPath, progress, duration) {
    try {
        await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: videoPath, progress, duration })
        });
    } catch (e) {
        // Silent fail
    }
}

async function restoreProgress(videoPath, video) {
    // First check localStorage for immediate restore
    const key = 'prog_' + window.location.search;
    const t = localStorage.getItem(key);
    if (t && t > 5) {
        video.currentTime = parseFloat(t);
        document.getElementById('resumeBadge').style.display = 'block';
    }
}

// ===============================================
// 5. UI FUNCTIONALITY
// ===============================================

// Handle video click
window.handleVideoClick = function (event, currentPathEncoded, videoPathEncoded) {
    // Don't navigate if clicking on favorite button or info button
    if (event.target.closest('.fav-btn-card') || event.target.closest('.info-btn-card')) return;
    location.href = `?path=${currentPathEncoded}&v=${videoPathEncoded}`;
};

// Video Info Modal Functions
window.showVideoInfo = function (name, path, size, duration) {
    document.getElementById('infoName').textContent = name;
    document.getElementById('infoPath').textContent = path;
    document.getElementById('infoSize').textContent = size;
    document.getElementById('infoDuration').textContent = duration || 'Tidak diketahui';
    document.getElementById('videoInfoModal').classList.add('open');
};

window.closeVideoInfo = function () {
    document.getElementById('videoInfoModal').classList.remove('open');
};

// Theme
const themeBtn = document.getElementById('themeBtn');
const html = document.documentElement;
const iconSun = document.querySelector('.icon-sun');
const iconMoon = document.querySelector('.icon-moon');
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
updateIcons(savedTheme);
themeBtn.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcons(next);
});
function updateIcons(t) {
    if (t === 'dark') { iconSun.classList.remove('hidden'); iconMoon.classList.add('hidden'); }
    else { iconSun.classList.add('hidden'); iconMoon.classList.remove('hidden'); }
}

// Search (Optimized with AbortController)
const searchInput = document.getElementById('searchInput');
const searchSpinner = document.getElementById('searchSpinner');
const grid = document.getElementById('contentGrid');
const searchStatus = document.getElementById('searchStatus');
let originalGridContent = grid.innerHTML;
let abortCtrl;

searchInput.addEventListener('input', async (e) => {
    const term = e.target.value;
    if (abortCtrl) abortCtrl.abort(); // Cancel prev request
    abortCtrl = new AbortController();

    if (term.length < 2) {
        grid.innerHTML = originalGridContent;
        searchStatus.classList.remove('visible');
        searchSpinner.style.display = 'none';
        initObservers(); // Re-attach
        return;
    }

    searchSpinner.style.display = 'block';
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: abortCtrl.signal });
        const results = await res.json();
        searchSpinner.style.display = 'none';
        searchStatus.classList.add('visible');
        searchStatus.textContent = `Ditemukan ${results.length} hasil untuk "${term}":`;

        if (results.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:#888">Tidak ditemukan.</div>';
            return;
        }

        grid.innerHTML = results.map(item => {
            if (item.type === 'folder') return '';
            return `
        <div class="card video-card item" onclick="location.href='?path=${encodeURIComponent(item.path.split('/').slice(0, -1).join('/'))}&v=${encodeURIComponent(item.path)}'" data-video="${encodeURI(item.path)}" data-cached="false">
          <div class="thumb-box"><div class="loader"></div><img loading="lazy"><div class="duration-badge">--:--</div><div class="overlay-play"><div class="play-circle">${window.SVG_ICONS.play}</div></div></div>
          <div class="meta"><div class="title">${item.name}</div><div class="details"><span>${item.size}</span></div></div>
        </div>`;
        }).join('');
        initObservers();
    } catch (err) { if (err.name !== 'AbortError') searchSpinner.style.display = 'none'; }
});

// Time Formatter
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

// Hover Preview Logic (One by One)
function initSingleHover(card) {
    let hoverTimeout;
    let activePreview = null;
    const thumbBox = card.querySelector('.thumb-box');
    const videoPath = card.dataset.video;

    card.addEventListener('mouseenter', () => {
        hoverTimeout = setTimeout(() => {
            const previewVid = document.createElement('video');
            // Use API proxy to avoid IDM catching the direct file extension
            previewVid.src = `/api/preview?path=${encodeURIComponent(decodeURI(videoPath))}`;
            previewVid.className = 'preview-video';
            previewVid.muted = true;
            previewVid.loop = true;
            previewVid.preload = "metadata";

            previewVid.addEventListener('canplaythrough', () => previewVid.play().catch(() => { }));
            previewVid.addEventListener('playing', () => {
                previewVid.classList.add('active');
                card.classList.add('previewing');
            });

            thumbBox.appendChild(previewVid);
            activePreview = previewVid;
        }, 400);
    });

    card.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        card.classList.remove('previewing');
        if (activePreview) {
            activePreview.remove();
            activePreview = null;
        }
    });
}

// Utils
const viewBtn = document.getElementById('viewBtn');
viewBtn.addEventListener('click', () => {
    grid.classList.toggle('list-view');
    // Also toggle section grids (Continue Watching, Favorites)
    document.querySelectorAll('.section-grid').forEach(sg => {
        sg.classList.toggle('list-view');
    });
    viewBtn.querySelector('.icon-grid').classList.toggle('hidden');
    viewBtn.querySelector('.icon-list').classList.toggle('hidden');
});

const sortBtn = document.getElementById('sortBtn');
sortBtn.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('sortMenu').classList.toggle('show'); });
document.addEventListener('click', () => document.getElementById('sortMenu').classList.remove('show'));

// Random Video Button - Global (all folders)
const randomBtn = document.getElementById('randomBtn');
randomBtn?.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/random-global');
        const data = await res.json();
        if (data.video) {
            window.location.href = `?path=${encodeURIComponent(data.folder)}&v=${encodeURIComponent(data.video)}`;
        } else {
            alert('Tidak ada video');
        }
    } catch (e) {
        console.error('Error getting random video:', e);
    }
});

// ===============================================
// MOBILE BOTTOM NAVIGATION
// ===============================================

// Mobile Search Button - Focus search input
document.getElementById('mobileSearchBtn')?.addEventListener('click', () => {
    document.getElementById('searchInput')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Mobile Random Button - Global random
document.getElementById('mobileRandomBtn')?.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/random-global');
        const data = await res.json();
        if (data.video) {
            window.location.href = `?path=${encodeURIComponent(data.folder)}&v=${encodeURIComponent(data.video)}`;
        } else {
            alert('Tidak ada video');
        }
    } catch (e) {
        console.error('Error getting random video:', e);
    }
});

// Mobile View Button - Toggle grid/list
document.getElementById('mobileViewBtn')?.addEventListener('click', () => {
    grid.classList.toggle('list-view');
    document.querySelectorAll('.section-grid').forEach(sg => sg.classList.toggle('list-view'));

    // Toggle icons in both mobile and desktop buttons
    document.querySelectorAll('.icon-grid').forEach(el => el.classList.toggle('hidden'));
    document.querySelectorAll('.icon-list').forEach(el => el.classList.toggle('hidden'));
});

// Mobile Menu Button - Open drawer
document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('mobileMenuOverlay')?.classList.remove('hidden');
});

// Close Mobile Menu
window.closeMobileMenu = function () {
    document.getElementById('mobileMenuOverlay')?.classList.add('hidden');
};

window.sortContent = (criteria) => {
    const items = Array.from(grid.querySelectorAll('.item'));
    items.sort((a, b) => {
        const typeA = a.classList.contains('folder') ? 'folder' : 'video';
        const typeB = b.classList.contains('folder') ? 'folder' : 'video';
        if (typeA !== typeB) return typeA === 'folder' ? -1 : 1;

        if (criteria.includes('name')) {
            const nA = a.querySelector('.title').innerText.toLowerCase();
            const nB = b.querySelector('.title').innerText.toLowerCase();
            return criteria === 'name_asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
        }
        if (criteria.includes('size')) {
            const sA = parseInt(a.dataset.size || 0);
            const sB = parseInt(b.dataset.size || 0);
            return criteria === 'size_asc' ? sA - sB : sB - sA;
        }
        return 0;
    });
    grid.innerHTML = ''; items.forEach(i => grid.appendChild(i));
    initObservers();
};

window.toggleModal = function (show) { document.getElementById('shortcutModal').classList.toggle('open', show); };

const video = document.getElementById('mainVideo');
if (video) {
    // Init history tracking
    initHistoryTracking(video);

    // Custom Video Player Controls
    const container = document.getElementById('videoContainer');
    const controls = document.getElementById('videoControls');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipForwardBtn = document.getElementById('skipForwardBtn');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const currentTimeEl = document.getElementById('currentTime');
    const durationTimeEl = document.getElementById('durationTime');
    const progressContainer = document.getElementById('progressContainer');
    const progressCurrent = document.getElementById('progressCurrent');
    const progressBuffered = document.getElementById('progressBuffered');
    const progressThumb = document.getElementById('progressThumb');
    const progressTooltip = document.getElementById('progressTooltip');
    const speedBtn = document.getElementById('speedBtn');
    const speedMenu = document.getElementById('speedMenu');
    const pipBtn = document.getElementById('pipBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const centerPlayOverlay = document.getElementById('centerPlayOverlay');

    let idleTimeout;
    let isDragging = false;

    // Format time helper
    function formatVideoTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // Update play/pause icons
    function updatePlayPauseIcon() {
        const isPlaying = !video.paused;
        playPauseBtn.querySelector('.icon-play').classList.toggle('hidden', isPlaying);
        playPauseBtn.querySelector('.icon-pause').classList.toggle('hidden', !isPlaying);
        container.classList.toggle('paused', !isPlaying);
        centerPlayOverlay.innerHTML = `<div class="center-play-btn">${isPlaying ? window.SVG_ICONS.pause : window.SVG_ICONS.play}</div>`;
    }

    // Update volume icon
    function updateVolumeIcon() {
        const vol = video.volume;
        const muted = video.muted;
        volumeBtn.querySelector('.icon-vol-high').classList.toggle('hidden', muted || vol < 0.5);
        volumeBtn.querySelector('.icon-vol-low').classList.toggle('hidden', muted || vol >= 0.5 || vol === 0);
        volumeBtn.querySelector('.icon-vol-mute').classList.toggle('hidden', !muted && vol > 0);
    }

    // Update progress bar
    function updateProgress() {
        if (!video.duration || isDragging) return;
        const percent = (video.currentTime / video.duration) * 100;
        progressCurrent.style.width = percent + '%';
        progressThumb.style.left = percent + '%';
        currentTimeEl.textContent = formatVideoTime(video.currentTime);
    }

    // Update buffered
    function updateBuffered() {
        if (!video.duration) return;
        const buffered = video.buffered;
        if (buffered.length > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            const percent = (bufferedEnd / video.duration) * 100;
            progressBuffered.style.width = percent + '%';
        }
    }

    // Reset idle timer
    function resetIdleTimer() {
        container.classList.remove('idle');
        clearTimeout(idleTimeout);
        if (!video.paused) {
            idleTimeout = setTimeout(() => {
                container.classList.add('idle');
            }, 3000);
        }
    }

    // Add to Queue (Theater)
    const addToQueueBtnTheater = document.getElementById('addToQueueBtnTheater');
    if (addToQueueBtnTheater) {
        addToQueueBtnTheater.addEventListener('click', () => {
            // Get current video info from dataset or URL
            const videoPath = video.dataset.path || new URL(window.location).searchParams.get('v');
            const folderPath = new URL(window.location).searchParams.get('path');
            const title = document.title.replace(' - Ox Video', ''); // Simple fallback

            if (videoPath) {
                addToVideoQueue(
                    decodeURIComponent(videoPath),
                    decodeURIComponent(folderPath),
                    title,
                    '' // No thumb in theater mode easily available/needed
                );
            }
        });
    }

    // Play/Pause
    playPauseBtn.addEventListener('click', () => {
        video.paused ? video.play() : video.pause();
    });

    // Click to play/pause (desktop only - mobile uses touch handler)
    video.addEventListener('click', (e) => {
        // Ignore if this is from a touch event (mobile)
        if (e.pointerType === 'touch' || 'ontouchstart' in window && e.sourceCapabilities?.firesTouchEvents) {
            return;
        }
        video.paused ? video.play() : video.pause();
    });

    video.addEventListener('play', updatePlayPauseIcon);
    video.addEventListener('pause', updatePlayPauseIcon);
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('progress', updateBuffered);
    video.addEventListener('loadedmetadata', () => {
        durationTimeEl.textContent = formatVideoTime(video.duration);
        updateProgress();
    });

    // Skip buttons
    skipBackBtn.addEventListener('click', () => { video.currentTime -= 10; });
    skipForwardBtn.addEventListener('click', () => { video.currentTime += 10; });

    // Volume
    volumeBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        updateVolumeIcon();
    });

    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value;
        video.muted = false;
        updateVolumeIcon();
    });

    // Progress bar seeking
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
    });

    progressContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        progressCurrent.style.width = (percent * 100) + '%';
        progressThumb.style.left = (percent * 100) + '%';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) {
            // Show tooltip on hover
            const rect = progressContainer.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                const percent = (e.clientX - rect.left) / rect.width;
                progressTooltip.textContent = formatVideoTime(percent * video.duration);
                progressTooltip.style.left = (percent * 100) + '%';
            }
            return;
        }
        const rect = progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        progressCurrent.style.width = (percent * 100) + '%';
        progressThumb.style.left = (percent * 100) + '%';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const rect = progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        video.currentTime = percent * video.duration;
    });

    // Touch events for mobile progress bar
    progressContainer.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        const rect = progressContainer.getBoundingClientRect();
        const percent = (touch.clientX - rect.left) / rect.width;
        progressCurrent.style.width = (percent * 100) + '%';
        progressThumb.style.left = (percent * 100) + '%';
    }, { passive: true });

    progressContainer.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const rect = progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        progressCurrent.style.width = (percent * 100) + '%';
        progressThumb.style.left = (percent * 100) + '%';
    }, { passive: true });

    progressContainer.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const touch = e.changedTouches[0];
        const rect = progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        video.currentTime = percent * video.duration;
    });

    // Tap to toggle controls on mobile + double-tap to skip
    let lastTap = 0;
    let singleTapTimeout = null;

    video.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        const now = Date.now();
        const rect = video.getBoundingClientRect();
        const tapX = touch.clientX;
        const videoWidth = rect.width;
        const tapPosition = tapX - rect.left;

        // Clear any pending single tap
        if (singleTapTimeout) {
            clearTimeout(singleTapTimeout);
            singleTapTimeout = null;
        }

        if (now - lastTap < 300) {
            // Double tap detected
            e.preventDefault();

            const isLeftSide = tapPosition < videoWidth / 3;
            const isRightSide = tapPosition > videoWidth * 2 / 3;

            if (isLeftSide) {
                // Double tap left - skip backward 10s
                video.currentTime = Math.max(0, video.currentTime - 10);
                showSkipIndicator(-10);
            } else if (isRightSide) {
                // Double tap right - skip forward 10s
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                showSkipIndicator(10);
            } else {
                // Double tap center - toggle play/pause
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
            lastTap = 0; // Reset to prevent triple-tap issues
        } else {
            // Wait to see if it's a double tap before executing single tap
            singleTapTimeout = setTimeout(() => {
                container.classList.toggle('controls-visible');
                setTimeout(() => container.classList.remove('controls-visible'), 3000);
            }, 300);
            lastTap = now;
        }
    });

    // Show skip indicator
    function showSkipIndicator(seconds) {
        // Create temporary indicator
        const indicator = document.createElement('div');
        indicator.className = 'skip-indicator';
        indicator.innerHTML = `${seconds > 0 ? '+' : ''}${seconds}s`;
        container.appendChild(indicator);

        // Position on left or right
        indicator.style.cssText = seconds < 0
            ? 'left: 20%; right: auto;'
            : 'left: auto; right: 20%;';

        // Remove after animation
        setTimeout(() => indicator.remove(), 600);
    }

    // Fullscreen toggle
    fullscreenBtn.addEventListener('click', async () => {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await container.requestFullscreen();
        }
    });

    // Handle fullscreen change to update icon
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenBtn.innerHTML = window.SVG_ICONS.exitFullscreen;
            container.classList.add('fullscreen');
        } else {
            fullscreenBtn.innerHTML = window.SVG_ICONS.fullscreen;
            container.classList.remove('fullscreen');
        }
    });

    // Speed control
    speedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speedMenu.classList.toggle('hidden');
    });

    speedMenu.querySelectorAll('.speed-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const speed = parseFloat(opt.dataset.speed);
            video.playbackRate = speed;
            speedBtn.textContent = speed + 'x';
            speedMenu.querySelectorAll('.speed-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            speedMenu.classList.add('hidden');
        });
    });

    // Picture in Picture
    pipBtn.addEventListener('click', async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (video.requestPictureInPicture) {
                await video.requestPictureInPicture();
            }
        } catch (e) { console.error('PiP error:', e); }
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        fullscreenBtn.querySelector('.icon-fs-enter').classList.toggle('hidden', isFs);
        fullscreenBtn.querySelector('.icon-fs-exit').classList.toggle('hidden', !isFs);
        container.classList.toggle('fullscreen', isFs);
    });

    // Idle detection
    container.addEventListener('mousemove', resetIdleTimer);
    container.addEventListener('click', resetIdleTimer);

    // Close speed menu on click outside
    document.addEventListener('click', () => speedMenu.classList.add('hidden'));

    // Double click for fullscreen
    video.addEventListener('dblclick', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;

        switch (e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                video.paused ? video.play() : video.pause();
                // Show center icon briefly
                container.classList.add('show-center-icon');
                setTimeout(() => container.classList.remove('show-center-icon'), 400);
                break;
            case 'arrowright':
                video.currentTime += 10;
                break;
            case 'arrowleft':
                video.currentTime -= 10;
                break;
            case 'arrowup':
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                volumeSlider.value = video.volume;
                updateVolumeIcon();
                break;
            case 'arrowdown':
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                volumeSlider.value = video.volume;
                updateVolumeIcon();
                break;
            case 'f':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    container.requestFullscreen();
                }
                break;
            case 'm':
                video.muted = !video.muted;
                updateVolumeIcon();
                break;
            case 'escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
                break;
        }
    });

    // Initialize
    updatePlayPauseIcon();
    updateVolumeIcon();

    // Restore progress from localStorage
    const key = 'prog_' + window.location.search;
    const t = localStorage.getItem(key);
    if (t && t > 5) {
        video.currentTime = parseFloat(t);
        document.getElementById('resumeBadge').style.display = 'block';
    }

    // Save progress periodically
    // Save progress periodically
    setInterval(() => { if (!video.paused) localStorage.setItem(key, video.currentTime); }, 2000);

    // Scroll to player
    setTimeout(() => { document.getElementById('playerSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);

    // =============================================
    // AUTO-PLAY NEXT WITH COUNTDOWN
    // =============================================
    const upNextOverlay = document.getElementById('upNextOverlay');
    const upNextCountdown = document.getElementById('upNextCountdown');
    const upNextCancel = document.getElementById('upNextCancel');
    const upNextPlay = document.getElementById('upNextPlay');

    if (upNextOverlay) {
        let countdownInterval = null;
        let countdownValue = 5;

        // Show overlay when video ends
        video.addEventListener('ended', () => {
            countdownValue = 5;
            upNextCountdown.textContent = countdownValue;
            upNextOverlay.classList.remove('hidden');

            // Start countdown
            countdownInterval = setInterval(() => {
                countdownValue--;
                upNextCountdown.textContent = countdownValue;

                if (countdownValue <= 0) {
                    clearInterval(countdownInterval);
                    playNextVideo();
                }
            }, 1000);
        });

        // Cancel button
        upNextCancel.addEventListener('click', () => {
            clearInterval(countdownInterval);
            upNextOverlay.classList.add('hidden');
        });

        // Play now button
        upNextPlay.addEventListener('click', () => {
            clearInterval(countdownInterval);
            playNextVideo();
        });

        // Navigate to next video
        function playNextVideo() {
            const nextPath = decodeURIComponent(upNextOverlay.dataset.nextPath);
            const currentPath = decodeURIComponent(upNextOverlay.dataset.currentPath);
            window.location.href = `?path=${encodeURIComponent(currentPath)}&v=${encodeURIComponent(nextPath)}`;
        }

        // Click on overlay to play
        upNextOverlay.querySelector('.up-next-thumb').addEventListener('click', () => {
            clearInterval(countdownInterval);
            playNextVideo();
        });
    }

    // =============================================
    // MINI PLAYER (Canvas-based)
    // =============================================
    const miniPlayer = document.getElementById('miniPlayer');
    const miniCanvas = document.getElementById('miniCanvas');
    const miniPlayPause = document.getElementById('miniPlayPause');
    const miniExpand = document.getElementById('miniExpand');
    const miniClose = document.getElementById('miniClose');

    if (miniPlayer && miniCanvas) {
        let miniPlayerClosed = false;
        let animationFrameId = null;
        const ctx = miniCanvas.getContext('2d');

        // Set canvas size based on video aspect ratio
        function resizeCanvas() {
            const width = 320;
            const height = Math.round(width * (video.videoHeight / video.videoWidth)) || 180;
            miniCanvas.width = width;
            miniCanvas.height = height;
        }

        video.addEventListener('loadedmetadata', resizeCanvas);
        resizeCanvas();

        // Draw frame to canvas
        function drawFrame() {
            if (miniPlayer.classList.contains('hidden')) {
                animationFrameId = null;
                return;
            }
            ctx.drawImage(video, 0, 0, miniCanvas.width, miniCanvas.height);
            animationFrameId = requestAnimationFrame(drawFrame);
        }

        // Start drawing when mini player is shown
        function startDrawing() {
            if (!animationFrameId) {
                drawFrame();
            }
        }

        // Observe when main player goes out of view
        const playerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (miniPlayerClosed) return;

                if (!entry.isIntersecting && !video.paused) {
                    // Show mini player when main player is out of view and video is playing
                    miniPlayer.classList.remove('hidden');
                    startDrawing();
                    miniPlayPause.innerHTML = window.SVG_ICONS.pause;
                } else {
                    // Hide mini player when main player is visible
                    miniPlayer.classList.add('hidden');
                }
            });
        }, { threshold: 0.3 });

        playerObserver.observe(container);

        // Mini play/pause button
        miniPlayPause.addEventListener('click', () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });

        // Sync play state
        video.addEventListener('play', () => {
            miniPlayPause.innerHTML = window.SVG_ICONS.pause;
            if (!miniPlayer.classList.contains('hidden')) {
                startDrawing();
            }
        });

        video.addEventListener('pause', () => {
            miniPlayPause.innerHTML = window.SVG_ICONS.play;
        });

        // Expand button - scroll back to main player
        miniExpand.addEventListener('click', () => {
            miniPlayer.classList.add('hidden');
            document.getElementById('playerSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // Close mini player
        miniClose.addEventListener('click', () => {
            miniPlayerClosed = true;
            miniPlayer.classList.add('hidden');
        });

        // Click on canvas to expand
        miniCanvas.addEventListener('click', () => {
            miniPlayer.classList.add('hidden');
            document.getElementById('playerSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
}

// Keyboard shortcuts (global)
document.addEventListener('keydown', (e) => {
    // B shortcut untuk back/close
    if (e.key === 'b') {
        const currentUrl = new URL(window.location);
        const hasPath = currentUrl.searchParams.has('path');
        const hasVideo = currentUrl.searchParams.has('v');

        // Jika ada video yang playing, pause dulu
        if (video && !video.paused) {
            video.pause();
        }

        // Jika ada path dan video, remove video
        if (hasPath && hasVideo) {
            currentUrl.searchParams.delete('v');
            window.location = currentUrl;
            return;
        }

        // Jika ada path, go back ke parent folder
        if (hasPath) {
            const path = currentUrl.searchParams.get('path');
            const newPath = path.split('/').slice(0, -1).join('/') || '';
            if (newPath) {
                currentUrl.searchParams.set('path', newPath);
            } else {
                currentUrl.searchParams.delete('path');
            }
            window.location = currentUrl;
            return;
        }

        // Jika ada modal terbuka, tutup modal
        if (document.getElementById('shortcutModal').classList.contains('open')) {
            toggleModal(false);
            return;
        }

        // Default: kembali ke root
        window.location = '/';
    }
});


window.addEventListener('scroll', () => {
    document.getElementById('scrollTopBtn').classList.toggle('visible', window.scrollY > 300);
});

// ===============================================
// PLAYLIST/QUEUE SYSTEM
// ===============================================

// Queue state
let videoQueue = [];
let currentQueueIndex = -1;

// Load queue from localStorage
function loadQueue() {
    try {
        const saved = localStorage.getItem('videoQueue');
        if (saved) {
            videoQueue = JSON.parse(saved);
            updateQueueBadge();
            renderQueueList();
        }
    } catch (e) {
        console.error('Failed to load queue:', e);
        videoQueue = [];
    }
}

// Save queue to localStorage
function saveQueue() {
    try {
        localStorage.setItem('videoQueue', JSON.stringify(videoQueue));
        updateQueueBadge();
    } catch (e) {
        console.error('Failed to save queue:', e);
    }
}

// Update queue badge count
function updateQueueBadge() {
    const badges = document.querySelectorAll('.queue-badge');
    badges.forEach(badge => {
        badge.textContent = videoQueue.length || '';
        badge.dataset.count = videoQueue.length;
    });
}

// Add video to queue
function addToVideoQueue(videoPath, folderPath, title, thumbnail) {
    // Decode paths to ensure we store raw strings (prevent double encoding)
    videoPath = decodeURIComponent(videoPath);
    folderPath = decodeURIComponent(folderPath);

    // Check if already in queue
    const exists = videoQueue.some(item => item.videoPath === videoPath);
    if (exists) {
        showToast('Video sudah ada di antrian');
        return false;
    }

    videoQueue.push({
        videoPath,
        folderPath,
        title,
        thumbnail,
        addedAt: Date.now()
    });

    saveQueue();
    renderQueueList();
    showToast('Ditambahkan ke antrian');
    return true;
}

// Remove video from queue
function removeFromQueue(index) {
    if (index >= 0 && index < videoQueue.length) {
        videoQueue.splice(index, 1);
        if (currentQueueIndex >= index && currentQueueIndex > 0) {
            currentQueueIndex--;
        }
        saveQueue();
        renderQueueList();
    }
}

// Clear entire queue
function clearQueue() {
    videoQueue = [];
    currentQueueIndex = -1;
    saveQueue();
    renderQueueList();
    showToast('Antrian dikosongkan');
}

// Play video from queue
function playFromQueue(index) {
    if (index >= 0 && index < videoQueue.length) {
        currentQueueIndex = index;
        const item = videoQueue[index];
        const url = new URL(window.location.origin);
        // Ensure we decode before setting to params (which will re-encode)
        // This handles cases where queue items might be stored as encoded strings
        url.searchParams.set('path', decodeURIComponent(item.folderPath));
        url.searchParams.set('v', decodeURIComponent(item.videoPath));
        url.searchParams.set('queue', 'true');
        window.location = url;
    }
}

// Play next in queue
function playNextInQueue() {
    if (videoQueue.length === 0) return false;

    const nextIndex = currentQueueIndex + 1;
    if (nextIndex < videoQueue.length) {
        playFromQueue(nextIndex);
        return true;
    }
    return false;
}

// Move item in queue (for drag-drop reorder)
function moveQueueItem(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const item = videoQueue.splice(fromIndex, 1)[0];
    videoQueue.splice(toIndex, 0, item);
    saveQueue();
    renderQueueList();
}

// Render queue list in drawer
function renderQueueList() {
    const queueList = document.getElementById('queueList');
    if (!queueList) return;

    if (videoQueue.length === 0) {
        queueList.innerHTML = `
            <div class="queue-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
                <p>Antrian kosong</p>
                <small>Tambahkan video dari galeri</small>
            </div>
        `;
        return;
    }

    // Find current playing video
    const currentUrl = new URL(window.location);
    const currentVideo = currentUrl.searchParams.get('v');

    queueList.innerHTML = videoQueue.map((item, index) => {
        const isPlaying = item.videoPath === currentVideo;
        if (isPlaying) currentQueueIndex = index;

        return `
            <div class="queue-item ${isPlaying ? 'playing' : ''}" 
                 data-index="${index}" 
                 draggable="true">
                <span class="queue-item-number">${isPlaying ? '▶' : index + 1}</span>
                <span class="queue-item-drag">⋮⋮</span>
                <img class="queue-item-thumb" 
                     src="${item.thumbnail || '/thumb-placeholder.svg'}" 
                     alt=""
                     onerror="this.src='/thumb-placeholder.svg'">
                <div class="queue-item-info">
                    <div class="queue-item-title">${item.title}</div>
                    <div class="queue-item-folder">${item.folderPath}</div>
                </div>
                <div class="queue-item-actions">
                    <button class="queue-item-btn" onclick="event.stopPropagation(); playFromQueue(${index})" title="Putar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                    <button class="queue-item-btn remove-btn" onclick="event.stopPropagation(); removeFromQueue(${index})" title="Hapus">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add drag-drop event listeners
    setupQueueDragDrop();
}

// Setup drag and drop for queue reordering
function setupQueueDragDrop() {
    const queueItems = document.querySelectorAll('.queue-item');
    let draggedItem = null;

    queueItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem !== item) {
                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);
                moveQueueItem(fromIndex, toIndex);
            }
        });

        // Click to play
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            playFromQueue(index);
        });
    });
}

// Toggle queue drawer
function toggleQueueDrawer(open) {
    const drawer = document.getElementById('queueDrawer');
    const overlay = document.getElementById('queueOverlay');
    if (!drawer) return;

    if (open === undefined) {
        open = !drawer.classList.contains('open');
    }

    drawer.classList.toggle('open', open);
    overlay?.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
}

// Show toast notification
function showToast(message, duration = 2000) {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 0.9rem;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Initialize queue system
function initQueueSystem() {
    loadQueue();

    // Queue drawer buttons
    const queueBtn = document.getElementById('queueBtn');
    const queueCloseBtn = document.getElementById('queueCloseBtn');
    const queueOverlay = document.getElementById('queueOverlay');
    const clearQueueBtn = document.getElementById('clearQueueBtn');

    queueBtn?.addEventListener('click', () => toggleQueueDrawer(true));
    queueCloseBtn?.addEventListener('click', () => toggleQueueDrawer(false));
    queueOverlay?.addEventListener('click', () => toggleQueueDrawer(false));
    clearQueueBtn?.addEventListener('click', () => {
        if (confirm('Kosongkan semua antrian?')) {
            clearQueue();
        }
    });

    // Mobile Queue Button
    document.getElementById('mobileQueueBtn')?.addEventListener('click', () => toggleQueueDrawer(true));

    // Add to queue buttons on video cards
    document.querySelectorAll('.add-queue-btn-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const card = btn.closest('.video-card, .section-card');
            if (!card) return;

            const videoPath = card.dataset.video || card.querySelector('a')?.href?.split('v=')[1]?.split('&')[0];
            const folderPath = new URL(window.location).searchParams.get('path') || '';
            const title = card.querySelector('.video-title, .section-card-title')?.textContent || 'Unknown';
            const thumbnail = card.querySelector('img')?.src || '';

            if (videoPath) {
                addToVideoQueue(decodeURIComponent(videoPath), folderPath, title, thumbnail);
            }
        });
    });

    // Check if playing from queue and setup auto-next
    const currentUrl = new URL(window.location);
    if (currentUrl.searchParams.get('queue') === 'true' && video) {
        video.addEventListener('ended', () => {
            // If playing from queue, try to play next
            if (!playNextInQueue()) {
                // No more in queue, show up-next overlay if available
                console.log('Queue finished');
            }
        });
    }

    // Keyboard shortcut: Q to toggle queue
    document.addEventListener('keydown', (e) => {
        if (e.key === 'q' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const activeEl = document.activeElement;
            if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
                toggleQueueDrawer();
            }
        }
    });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQueueSystem);
} else {
    initQueueSystem();
}
