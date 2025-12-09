/**
 * Metadata Manager for Ox Video Gallery
 * Handles: video metadata cache, favorites, watch history
 */
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", ".data");
const METADATA_FILE = path.join(DATA_DIR, "metadata.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load metadata from file
 */
function loadMetadata() {
    try {
        if (fs.existsSync(METADATA_FILE)) {
            const data = fs.readFileSync(METADATA_FILE, "utf8");
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Error loading metadata:", e);
    }
    return {
        videos: {},      // { "path": { duration, thumbnail, lastAccessed } }
        favorites: [],   // ["path1", "path2"]
        history: {},     // { "path": { progress, duration, lastWatched, completed } }
    };
}

/**
 * Save metadata to file
 */
function saveMetadata(metadata) {
    try {
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    } catch (e) {
        console.error("Error saving metadata:", e);
    }
}

// Load initial metadata
let metadata = loadMetadata();

/**
 * Get video metadata
 */
function getVideoMeta(videoPath) {
    return metadata.videos[videoPath] || null;
}

/**
 * Set video metadata (duration, thumbnail status)
 */
function setVideoMeta(videoPath, data) {
    metadata.videos[videoPath] = {
        ...metadata.videos[videoPath],
        ...data,
        lastAccessed: Date.now(),
    };
    saveMetadata(metadata);
}

/**
 * Get all favorites
 */
function getFavorites() {
    return metadata.favorites || [];
}

/**
 * Check if video is favorite
 */
function isFavorite(videoPath) {
    return metadata.favorites.includes(videoPath);
}

/**
 * Toggle favorite status
 */
function toggleFavorite(videoPath) {
    const index = metadata.favorites.indexOf(videoPath);
    if (index > -1) {
        metadata.favorites.splice(index, 1);
    } else {
        metadata.favorites.push(videoPath);
    }
    saveMetadata(metadata);
    return metadata.favorites.includes(videoPath);
}

/**
 * Get watch history
 */
function getHistory() {
    return metadata.history || {};
}

/**
 * Update watch progress
 */
function updateProgress(videoPath, progress, duration) {
    const completed = duration > 0 && progress / duration > 0.9;
    metadata.history[videoPath] = {
        progress,
        duration,
        lastWatched: Date.now(),
        completed,
    };
    saveMetadata(metadata);
}

/**
 * Get continue watching list (videos with progress < 90% watched)
 */
function getContinueWatching(limit = 10) {
    const history = metadata.history || {};
    const items = Object.entries(history)
        .filter(([_, data]) => !data.completed && data.progress > 0)
        .sort((a, b) => b[1].lastWatched - a[1].lastWatched)
        .slice(0, limit)
        .map(([path, data]) => ({
            path,
            progress: data.progress,
            duration: data.duration,
            lastWatched: data.lastWatched,
            percent: Math.round((data.progress / data.duration) * 100),
        }));
    return items;
}

/**
 * Get video progress
 */
function getProgress(videoPath) {
    return metadata.history[videoPath] || null;
}

/**
 * Reload metadata from file (if needed)
 */
function reloadMetadata() {
    metadata = loadMetadata();
}

module.exports = {
    getVideoMeta,
    setVideoMeta,
    getFavorites,
    isFavorite,
    toggleFavorite,
    getHistory,
    updateProgress,
    getContinueWatching,
    getProgress,
    reloadMetadata,
};
