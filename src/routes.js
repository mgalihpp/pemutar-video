/**
 * Routes for Ox Video Gallery
 */
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { getItemsInFolder, searchRecursive, getThumbPath, formatBytes } = require("./utils");
const { renderHTML } = require("./templates/html");
const metadata = require("./metadata");

// Video extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.wmv', '.flv'];

// Pagination config
const DEFAULT_PAGE_SIZE = 20;

/**
 * Setup all routes
 */
function setupRoutes(app, baseDir) {
    // Search API
    app.get("/api/search", (req, res) => {
        const term = req.query.q;
        if (!term || term.length < 2) return res.json([]);
        const results = [];
        searchRecursive(baseDir, term, results, "");
        res.json(results);
    });

    // Paginated videos API
    app.get("/api/videos", async (req, res) => {
        const currentPath = req.query.path || "";
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || DEFAULT_PAGE_SIZE;

        const fullDir = path.join(baseDir, currentPath);

        try {
            await fsPromises.access(fullDir);
        } catch (e) {
            return res.json({ videos: [], hasMore: false });
        }

        const items = await getItemsInFolder(fullDir, currentPath);
        const videos = items
            .filter((i) => i.type === "video")
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedVideos = videos.slice(start, end);

        // Add metadata to each video
        const videosWithMeta = paginatedVideos.map((v) => {
            const thumbFile = getThumbPath(v.path);
            const hasThumb = fs.existsSync(thumbFile);
            const isFav = metadata.isFavorite(v.path);
            const progress = metadata.getProgress(v.path);
            const videoMeta = metadata.getVideoMeta(v.path);

            return {
                ...v,
                thumbUrl: hasThumb ? `/.thumbnails/${path.basename(thumbFile)}` : "",
                hasThumb,
                isFavorite: isFav,
                progress: progress ? progress.progress : 0,
                duration: videoMeta ? videoMeta.duration : null,
                percent: progress ? Math.round((progress.progress / progress.duration) * 100) : 0,
            };
        });

        res.json({
            videos: videosWithMeta,
            hasMore: end < videos.length,
            total: videos.length,
            page,
        });
    });

    // Favorites API
    app.get("/api/favorites", (req, res) => {
        const favorites = metadata.getFavorites();
        res.json(favorites);
    });

    app.post("/api/favorites", (req, res) => {
        const { path: videoPath } = req.body;
        if (!videoPath) return res.sendStatus(400);
        const isFav = metadata.toggleFavorite(videoPath);
        res.json({ isFavorite: isFav });
    });

    // Watch History API
    app.get("/api/history", (req, res) => {
        const history = metadata.getHistory();
        res.json(history);
    });

    app.post("/api/history", (req, res) => {
        const { path: videoPath, progress, duration } = req.body;
        if (!videoPath || progress === undefined) return res.sendStatus(400);
        metadata.updateProgress(videoPath, progress, duration);
        res.sendStatus(200);
    });

    // Continue Watching API
    app.get("/api/continue", (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const items = metadata.getContinueWatching(limit);

        // Add video info to each item
        const itemsWithInfo = items.map((item) => {
            const thumbFile = getThumbPath(item.path);
            const hasThumb = fs.existsSync(thumbFile);
            const name = path.basename(item.path);

            return {
                ...item,
                name,
                thumbUrl: hasThumb ? `/.thumbnails/${path.basename(thumbFile)}` : "",
                hasThumb,
            };
        });

        res.json(itemsWithInfo);
    });

    // Save video metadata (duration)
    app.post("/api/metadata", (req, res) => {
        const { path: videoPath, duration } = req.body;
        if (!videoPath) return res.sendStatus(400);
        metadata.setVideoMeta(videoPath, { duration });
        res.sendStatus(200);
    });

    // Main page route
    app.get("/", async (req, res) => {
        let currentPath = req.query.path || "";

        if (currentPath) {
            currentPath = path.normalize(currentPath);
            while (
                currentPath.startsWith(".." + path.sep) ||
                currentPath.startsWith("..")
            ) {
                currentPath = currentPath.replace(/^(\.\.[\\/])+/g, "");
            }
            if (currentPath === "." || currentPath === "..") currentPath = "";
        }

        const fullDir = path.join(baseDir, currentPath);

        // Check folder exists (async)
        try {
            await fsPromises.access(fullDir);
        } catch (e) {
            return res.status(404).send("Folder tidak ditemukan");
        }

        const items = await getItemsInFolder(fullDir, currentPath);

        items.sort((a, b) => {
            if (a.type === b.type)
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            return a.type === "folder" ? -1 : 1;
        });

        const folders = items.filter((i) => i.type === "folder");
        // Only get first page of videos for initial load
        const allVideos = items.filter((i) => i.type === "video");
        const videos = allVideos.slice(0, DEFAULT_PAGE_SIZE);
        const hasMoreVideos = allVideos.length > DEFAULT_PAGE_SIZE;
        const activeVideo = req.query.v || null;

        // Find next video for auto-play
        let nextVideo = null;
        if (activeVideo) {
            const currentIndex = allVideos.findIndex(v => v.path === activeVideo);
            if (currentIndex !== -1 && currentIndex < allVideos.length - 1) {
                const next = allVideos[currentIndex + 1];
                const thumbFile = getThumbPath(next.path);
                const hasThumb = fs.existsSync(thumbFile);
                nextVideo = {
                    path: next.path,
                    name: next.name,
                    thumbUrl: hasThumb ? `/.thumbnails/${path.basename(thumbFile)}` : "",
                    hasThumb
                };
            }
        }

        const pathParts = currentPath
            ? currentPath.split(/[\\/]/).filter(Boolean)
            : [];

        const crumbs = pathParts.map((part, i) => {
            const urlPath = pathParts.slice(0, i + 1).join("/");
            return { name: part, url: "?path=" + encodeURIComponent(urlPath) };
        });

        // Get continue watching for home page
        const continueWatching = currentPath === "" ? metadata.getContinueWatching(5) : [];

        // Add video info to continue watching
        const continueWithInfo = continueWatching.map((item) => {
            const thumbFile = getThumbPath(item.path);
            const hasThumb = fs.existsSync(thumbFile);
            const name = path.basename(item.path);
            return {
                ...item,
                name,
                thumbUrl: hasThumb ? `/.thumbnails/${path.basename(thumbFile)}` : "",
                hasThumb,
            };
        });

        // Get favorites for home page
        const favoritesList = currentPath === "" ? metadata.getFavorites().slice(0, 10) : [];
        const favoritesWithInfo = favoritesList.map((videoPath) => {
            const thumbFile = getThumbPath(videoPath);
            const hasThumb = fs.existsSync(thumbFile);
            const name = path.basename(videoPath);
            const videoMeta = metadata.getVideoMeta(videoPath);
            const historyData = metadata.getProgress(videoPath);
            // Try to get duration from videoMeta first, then from history
            const duration = (videoMeta && videoMeta.duration) || (historyData && historyData.duration) || null;
            return {
                path: videoPath,
                name,
                thumbUrl: hasThumb ? `/.thumbnails/${path.basename(thumbFile)}` : "",
                hasThumb,
                duration,
            };
        });

        res.send(renderHTML({
            currentPath,
            crumbs,
            folders,
            videos,
            activeVideo,
            nextVideo,
            getThumbPath,
            hasMoreVideos,
            continueWatching: continueWithInfo,
            favorites: favoritesWithInfo,
            metadata
        }));
    });

    // Save thumbnail
    app.post("/save-thumb", (req, res) => {
        const { path: vPath, data, duration } = req.body;
        if (!vPath || !data) return res.sendStatus(400);
        try {
            const thumbPath = getThumbPath(vPath);
            const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(thumbPath, base64Data, "base64");

            // Also save duration if provided
            if (duration) {
                metadata.setVideoMeta(vPath, { duration, hasThumbnail: true });
            }

            res.sendStatus(200);
        } catch (e) {
            res.sendStatus(500);
        }
    });

    // Random video API
    app.get("/api/random", async (req, res) => {
        const currentPath = req.query.path || "";
        const fullDir = path.join(baseDir, currentPath);

        try {
            const items = await getItemsInFolder(fullDir, currentPath);
            const videos = items.filter(i => i.type === "video");

            if (videos.length === 0) {
                return res.json({ video: null });
            }

            const randomIndex = Math.floor(Math.random() * videos.length);
            res.json({ video: videos[randomIndex].path });
        } catch (e) {
            res.json({ video: null });
        }
    });

    // Global random video API (all folders)
    app.get("/api/random-global", async (req, res) => {
        try {
            // Recursively get all videos from all folders
            async function getAllVideos(dir, basePath = "") {
                const allVideos = [];
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

                    if (entry.isDirectory()) {
                        const subVideos = await getAllVideos(fullPath, relativePath);
                        allVideos.push(...subVideos);
                    } else if (VIDEO_EXTENSIONS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
                        allVideos.push(relativePath);
                    }
                }
                return allVideos;
            }

            const allVideos = await getAllVideos(baseDir);

            if (allVideos.length === 0) {
                return res.json({ video: null, folder: null });
            }

            const randomIndex = Math.floor(Math.random() * allVideos.length);
            const videoPath = allVideos[randomIndex];
            const folderPath = videoPath.split('/').slice(0, -1).join('/');

            res.json({ video: videoPath, folder: folderPath });
        } catch (e) {
            console.error('Global random error:', e);
            res.json({ video: null, folder: null });
        }
    });
}

module.exports = { setupRoutes };
