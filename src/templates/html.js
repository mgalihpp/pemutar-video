/**
 * HTML Template Generator for Ox Video Gallery
 */
const path = require("path");
const fs = require("fs");
const ICONS = require("./icons");

// Add heart icon for favorites
ICONS.heart = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
ICONS.heartFilled = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
ICONS.clock = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// Read CSS file
const cssPath = path.join(__dirname, "styles.css");
const CSS_CONTENT = fs.readFileSync(cssPath, "utf8");

/**
 * Generate continue watching section HTML
 */
function renderContinueWatching(items, currentPath) {
  if (!items || items.length === 0) return "";

  return `
    <div class="section-container">
      <h2 class="section-title">${ICONS.clock} Lanjutkan Menonton</h2>
      <div class="section-grid">
        ${items.map(item => {
    const folderPath = item.path.split('/').slice(0, -1).join('/');
    return `
          <div class="card video-card section-card" onclick="location.href='?path=${encodeURIComponent(folderPath)}&v=${encodeURIComponent(item.path)}'">
            <div class="thumb-box ${item.hasThumb ? 'loaded' : ''}">
              ${!item.hasThumb ? '<div class="loader"></div>' : ''}
              <img src="${item.thumbUrl || ''}" loading="lazy">
              <div class="duration-badge">${formatTime(item.duration)}</div>
              <div class="progress-overlay">
                <div class="progress-bar-bottom">
                  <div class="progress-fill" style="width: ${item.percent}%"></div>
                </div>
              </div>
              <div class="overlay-play"><div class="play-circle">${ICONS.play}</div></div>
            </div>
            <div class="meta">
              <div class="title" title="${item.name}">${item.name}</div>
              <div class="details">
                <span class="progress-text">${item.percent}% ditonton</span>
                <span>${formatDuration(item.duration - item.progress)} tersisa</span>
              </div>
            </div>
          </div>
        `;
  }).join('')}
      </div>
    </div>
  `;
}

/**
 * Format duration in seconds to readable string
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m ${s}d`;
}

/**
 * Format duration for display
 */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Generate favorites section HTML
 */
function renderFavorites(items) {
  if (!items || items.length === 0) return "";

  return `
    <div class="section-container">
      <h2 class="section-title">${ICONS.heartFilled} Favorit</h2>
      <div class="section-grid">
        ${items.map(item => {
    const folderPath = item.path.split('/').slice(0, -1).join('/');
    return `
          <div class="card video-card section-card" onclick="location.href='?path=${encodeURIComponent(folderPath)}&v=${encodeURIComponent(item.path)}'">
            <div class="thumb-box ${item.hasThumb ? 'loaded' : ''}">
              ${!item.hasThumb ? '<div class="loader"></div>' : ''}
              <img src="${item.thumbUrl || ''}" loading="lazy">
              <div class="duration-badge">${item.duration ? formatTime(item.duration) : '--:--'}</div>
              <div class="favorite-badge">${ICONS.heartFilled}</div>
              <div class="overlay-play"><div class="play-circle">${ICONS.play}</div></div>
            </div>
            <div class="meta">
              <div class="title" title="${item.name}">${item.name}</div>
              <div class="details"><span>Favorit</span><span>${item.duration ? formatTime(item.duration) : '--:--'}</span></div>
            </div>
          </div>
        `;
  }).join('')}
      </div>
    </div>
  `;
}


/**
 * Generate full HTML page
 */
function renderHTML({ currentPath, crumbs, folders, videos, activeVideo, nextVideo, getThumbPath, hasMoreVideos, continueWatching, favorites, metadata }) {
  return `
<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ox</title>
  <link rel="icon" type="image/jpg" href="/dbba13bf2cdbf7cbe9cdfa9b72c6336f.jpg">
  <style>
${CSS_CONTENT}
  </style>
</head>
<body>

  <!-- Desktop Navbar -->
  <nav class="navbar">
    <a href="/" class="brand">Ox</a>
    
    <div class="nav-center">
      <div class="search-wrapper">
        <div class="search-box">
          ${ICONS.search}
          <input type="text" id="searchInput" placeholder="Cari video...">
        </div>
        <div class="search-spinner" id="searchSpinner">${ICONS.loading}</div>
      </div>
    </div>

    <div class="nav-right">
      <button class="icon-btn desktop-only" id="randomBtn" title="Random Video">${ICONS.shuffle}</button>
      <button class="icon-btn desktop-only" id="viewBtn" title="Grid/List"><span class="icon-grid">${ICONS.grid}</span><span class="icon-list hidden">${ICONS.list}</span></button>
      
      <div class="sort-wrapper desktop-only">
        <button class="icon-btn" id="sortBtn" title="Urutkan">${ICONS.sort}</button>
        <div class="sort-menu" id="sortMenu">
          <button class="sort-item" onclick="sortContent('name_asc')">Nama (A-Z)</button>
          <button class="sort-item" onclick="sortContent('name_desc')">Nama (Z-A)</button>
          <button class="sort-item" onclick="sortContent('size_desc')">Size (Besar)</button>
          <button class="sort-item" onclick="sortContent('size_asc')">Size (Kecil)</button>
        </div>
      </div>

      <button class="icon-btn desktop-only" onclick="toggleModal(true)" title="Shortcuts">${ICONS.keyboard}</button>
      <button class="icon-btn" id="themeBtn" title="Tema"><span class="icon-sun">${ICONS.sun}</span><span class="icon-moon hidden">${ICONS.moon}</span></button>
    </div>
  </nav>

  <!-- Mobile Bottom Navigation -->
  <nav class="bottom-nav" id="bottomNav">
    <a href="/" class="bottom-nav-item ${currentPath === '' && !activeVideo ? 'active' : ''}" title="Beranda">
      ${ICONS.home}
      <span>Beranda</span>
    </a>
    <button class="bottom-nav-item" id="mobileSearchBtn" title="Cari">
      ${ICONS.search}
      <span>Cari</span>
    </button>
    <button class="bottom-nav-item" id="mobileRandomBtn" title="Random">
      ${ICONS.shuffle}
      <span>Random</span>
    </button>
    <button class="bottom-nav-item" id="mobileViewBtn" title="Tampilan">
      <span class="icon-grid">${ICONS.grid}</span>
      <span class="icon-list hidden">${ICONS.list}</span>
      <span>Tampilan</span>
    </button>
    <button class="bottom-nav-item" id="mobileMenuBtn" title="Lainnya">
      ${ICONS.settings}
      <span>Lainnya</span>
    </button>
  </nav>

  <!-- Mobile Menu Drawer -->
  <div class="mobile-menu-overlay hidden" id="mobileMenuOverlay" onclick="closeMobileMenu()">
    <div class="mobile-menu" onclick="event.stopPropagation()">
      <div class="mobile-menu-header">
        <span>Menu</span>
        <button class="mobile-menu-close" onclick="closeMobileMenu()">${ICONS.close}</button>
      </div>
      <button class="mobile-menu-item" onclick="sortContent('name_asc'); closeMobileMenu()">
        ${ICONS.sort}
        <span>Urutkan: Nama A-Z</span>
      </button>
      <button class="mobile-menu-item" onclick="sortContent('name_desc'); closeMobileMenu()">
        ${ICONS.sort}
        <span>Urutkan: Nama Z-A</span>
      </button>
      <button class="mobile-menu-item" onclick="sortContent('size_desc'); closeMobileMenu()">
        ${ICONS.sort}
        <span>Urutkan: Size Besar</span>
      </button>
      <button class="mobile-menu-item" onclick="toggleModal(true); closeMobileMenu()">
        ${ICONS.keyboard}
        <span>Keyboard Shortcuts</span>
      </button>
    </div>
  </div>

  <button id="scrollTopBtn" class="scroll-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">${ICONS.arrowUp}</button>

  <div class="modal-overlay" id="shortcutModal" onclick="if(event.target===this) toggleModal(false)">
    <div class="modal-content">
      <h2 style="margin-top:0; color:var(--primary)">Shortcuts</h2>
      <div class="key-row"><span>Play/Pause</span><div><span class="kbd">Spasi</span> / <span class="kbd">K</span></div></div>
      <div class="key-row"><span>Seek +/- 5s</span><div><span class="kbd">←</span> <span class="kbd">→</span></div></div>
      <div class="key-row"><span>Fullscreen</span><span class="kbd">F</span></div>
      <div class="key-row"><span><strong>Back/Close</strong></span><span class="kbd">B</span></div>
    </div>
  </div>

  <!-- Video Info Modal -->
  <div class="modal-overlay" id="videoInfoModal" onclick="if(event.target===this) closeVideoInfo()">
    <div class="modal-content video-info-modal">
      <h2 style="margin-top:0; color:var(--primary); display:flex; align-items:center; gap:10px;">${ICONS.info} Info Video</h2>
      <div class="info-row"><span class="info-label">Nama</span><span class="info-value" id="infoName">-</span></div>
      <div class="info-row"><span class="info-label">Path</span><span class="info-value" id="infoPath">-</span></div>
      <div class="info-row"><span class="info-label">Ukuran</span><span class="info-value" id="infoSize">-</span></div>
      <div class="info-row"><span class="info-label">Durasi</span><span class="info-value" id="infoDuration">-</span></div>
      <button class="modal-close-btn" onclick="closeVideoInfo()">Tutup</button>
    </div>
  </div>

  <div class="container">
    <div class="breadcrumbs-container">
      <div class="breadcrumbs">
        <a href="/" class="crumb-item crumb-home" title="Root">${ICONS.home}</a>
        ${crumbs.length > 0 ? `<span class="crumb-separator">${ICONS.chevron}</span>` : ""}
        ${crumbs
      .map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return `<a href="${c.url}" class="crumb-item ${isLast ? "active" : ""}">${c.name}</a>${!isLast ? `<span class="crumb-separator">${ICONS.chevron}</span>` : ""}`;
      })
      .join("")}
      </div>
    </div>

    ${activeVideo
      ? `
      <div class="theater-mode" id="playerSection">
        <div class="video-container" id="videoContainer">
          <video id="mainVideo" autoplay data-path="${encodeURIComponent(activeVideo)}"><source src="${encodeURI(activeVideo)}" type="video/mp4"></video>
          
          <!-- Custom Video Controls -->
          <div class="video-controls" id="videoControls">
            <!-- Progress Bar -->
            <div class="progress-container" id="progressContainer">
              <div class="progress-bar-video" id="progressBar">
                <div class="progress-buffered" id="progressBuffered"></div>
                <div class="progress-current" id="progressCurrent"></div>
                <div class="progress-thumb" id="progressThumb"></div>
              </div>
              <div class="progress-tooltip" id="progressTooltip">0:00</div>
            </div>
            
            <!-- Control Buttons -->
            <div class="controls-row">
              <div class="controls-left">
                <button class="control-btn" id="playPauseBtn" title="Play/Pause (K)">
                  <span class="icon-play">${ICONS.play}</span>
                  <span class="icon-pause hidden">${ICONS.pause}</span>
                </button>
                <button class="control-btn" id="skipBackBtn" title="-10s (←)">${ICONS.skipBack}</button>
                <button class="control-btn" id="skipForwardBtn" title="+10s (→)">${ICONS.skipForward}</button>
                <div class="volume-control">
                  <button class="control-btn" id="volumeBtn" title="Mute (M)">
                    <span class="icon-vol-high">${ICONS.volumeHigh}</span>
                    <span class="icon-vol-low hidden">${ICONS.volumeLow}</span>
                    <span class="icon-vol-mute hidden">${ICONS.volumeMute}</span>
                  </button>
                  <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.05" value="1">
                </div>
                <div class="time-display">
                  <span id="currentTime">0:00</span>
                  <span class="time-sep">/</span>
                  <span id="durationTime">0:00</span>
                </div>
              </div>
              <div class="controls-right">
                <button class="control-btn" id="speedBtn" title="Playback Speed">1x</button>
                <button class="control-btn" id="pipBtn" title="Picture in Picture">${ICONS.pip}</button>
                <button class="control-btn" id="fullscreenBtn" title="Fullscreen (F)">
                  <span class="icon-fs-enter">${ICONS.fullscreen}</span>
                  <span class="icon-fs-exit hidden">${ICONS.exitFullscreen}</span>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Center Play/Pause Overlay -->
          <div class="center-play-overlay" id="centerPlayOverlay">
            <div class="center-play-btn">${ICONS.play}</div>
          </div>
          
          <!-- Speed Menu -->
          <div class="speed-menu hidden" id="speedMenu">
            <button class="speed-option" data-speed="0.25">0.25x</button>
            <button class="speed-option" data-speed="0.5">0.5x</button>
            <button class="speed-option" data-speed="0.75">0.75x</button>
            <button class="speed-option active" data-speed="1">1x</button>
            <button class="speed-option" data-speed="1.25">1.25x</button>
            <button class="speed-option" data-speed="1.5">1.5x</button>
            <button class="speed-option" data-speed="2">2x</button>
          </div>
        </div>
        <div class="video-info">
          <div class="video-title">${path.basename(activeVideo)}</div>
          <div class="video-actions">
            <button class="fav-btn ${metadata && metadata.isFavorite(activeVideo) ? 'active' : ''}" onclick="toggleFavorite('${encodeURIComponent(activeVideo)}')" title="Favorite">
              <span class="heart-empty">${ICONS.heart}</span>
              <span class="heart-filled">${ICONS.heartFilled}</span>
            </button>
            <div id="resumeBadge" class="resume-badge">Melanjutkan</div>
          </div>
        </div>
        ${nextVideo ? `
        <!-- Up Next Overlay -->
        <div class="up-next-overlay hidden" id="upNextOverlay" 
             data-next-path="${encodeURIComponent(nextVideo.path)}" 
             data-current-path="${encodeURIComponent(currentPath)}">
          <div class="up-next-content">
            <div class="up-next-header">
              <span class="up-next-label">Selanjutnya</span>
              <span class="up-next-countdown" id="upNextCountdown">5</span>
            </div>
            <div class="up-next-info">
              <div class="up-next-thumb ${nextVideo.hasThumb ? 'loaded' : ''}">
                <img src="${nextVideo.thumbUrl || ''}" alt="">
                <div class="play-icon">${ICONS.play}</div>
              </div>
              <div class="up-next-details">
                <div class="up-next-title">${nextVideo.name}</div>
              </div>
            </div>
            <div class="up-next-actions">
              <button class="up-next-cancel" id="upNextCancel">Batal</button>
              <button class="up-next-play" id="upNextPlay">Putar Sekarang</button>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    `
      : ""
    }

    ${renderContinueWatching(continueWatching, currentPath)}

    ${renderFavorites(favorites)}

    <div id="searchStatus" class="search-status">Hasil Pencarian:</div>

    <div class="grid" id="contentGrid" data-path="${encodeURIComponent(currentPath)}" data-page="1" data-has-more="${hasMoreVideos}">
      ${folders
      .map(
        (f) => `
        <div class="card folder item" onclick="location.href='?path=${encodeURIComponent(f.path)}'" data-name="${f.name.toLowerCase()}" data-type="folder" data-size="0">
          ${ICONS.folder}<div class="title">${f.name}</div>
        </div>
      `
      )
      .join("")}

      ${videos
      .map((v) => {
        const thumbFile = getThumbPath(v.path);
        const hasThumb = fs.existsSync(thumbFile);
        const thumbUrl = hasThumb ? `/.thumbnails/${path.basename(thumbFile)}` : "";
        const isFav = metadata && metadata.isFavorite(v.path);
        return `
        <div class="card video-card item" onclick="handleVideoClick(event, '${encodeURIComponent(currentPath)}', '${encodeURIComponent(v.path)}')" 
             data-video="${encodeURI(v.path)}" 
             data-cached="${hasThumb}" 
             data-name="${v.name.toLowerCase()}" 
             data-size="${v.bytes}" 
             data-type="video"
             data-fav="${isFav}">
          
          <div class="thumb-box ${hasThumb ? "loaded" : ""}">
             ${!hasThumb ? '<div class="loader"></div>' : ""}
             
             <img src="${thumbUrl}" loading="lazy">
             <div class="duration-badge">--:--</div>

             <button class="fav-btn-card ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavoriteCard(this, '${encodeURIComponent(v.path)}')" title="Favorite">
               <span class="heart-empty">${ICONS.heart}</span>
               <span class="heart-filled">${ICONS.heartFilled}</span>
             </button>

             <div class="overlay-play"><div class="play-circle">${ICONS.play}</div></div>
          </div>
          <div class="meta"><div class="title" title="${v.name}">${v.name}</div><div class="details"><span>Video</span><span>${v.size}</span></div></div>
        </div>`;
      })
      .join("")}
    </div>
    
    ${hasMoreVideos ? '<div id="loadMoreTrigger" class="load-more-trigger"><div class="loader"></div></div>' : ''}
  </div>

  <!-- Mini Player -->
  ${activeVideo ? `
  <div class="mini-player hidden" id="miniPlayer">
    <canvas id="miniCanvas"></canvas>
    <div class="mini-controls">
      <button class="mini-btn" id="miniPlayPause">${ICONS.play}</button>
      <div class="mini-title">${path.basename(activeVideo)}</div>
      <button class="mini-btn mini-expand" id="miniExpand">${ICONS.fullscreen}</button>
      <button class="mini-btn mini-close" id="miniClose">${ICONS.close}</button>
    </div>
  </div>
  ` : ''}

  <script>
    const SVG_ICONS = ${JSON.stringify(ICONS)};
    window.SVG_ICONS = SVG_ICONS;
    window.CURRENT_PATH = "${encodeURIComponent(currentPath)}";
    window.ACTIVE_VIDEO = ${activeVideo ? `"${encodeURIComponent(activeVideo)}"` : 'null'};
  </script>
  <script src="/assets/client.js"></script>
</body>
</html>
  `;
}

module.exports = { renderHTML };
