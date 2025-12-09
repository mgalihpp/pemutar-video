/**
 * Utility functions for Ox Video Gallery
 */
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const crypto = require("crypto");
const { THUMB_DIR, ignoreFolders, videoExtensions } = require("./config");

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Convert path separator to URL format
 */
const toUrlPath = (p) => p.split(path.sep).join("/");

/**
 * Get thumbnail path for a video
 */
function getThumbPath(videoPath) {
    const normalized = toUrlPath(videoPath);
    const hash = crypto.createHash("md5").update(normalized).digest("hex");
    return path.join(THUMB_DIR, `${hash}.jpg`);
}

/**
 * Get items in folder (async)
 */
async function getItemsInFolder(dir, base = "") {
    const results = [];
    try {
        await fsPromises.access(dir);
        const list = await fsPromises.readdir(dir);

        await Promise.all(
            list.map(async (file) => {
                if (file.startsWith(".")) return;

                const fullPath = path.join(dir, file);
                const relPath = base ? toUrlPath(path.join(base, file)) : file;

                try {
                    const stat = await fsPromises.stat(fullPath);
                    if (stat.isDirectory()) {
                        if (ignoreFolders.includes(file)) return;
                        results.push({
                            type: "folder",
                            name: file,
                            path: relPath,
                            size: "-",
                            bytes: 0,
                        });
                    } else if (videoExtensions.test(file)) {
                        results.push({
                            type: "video",
                            name: file,
                            path: relPath,
                            size: formatBytes(stat.size),
                            bytes: stat.size,
                        });
                    }
                } catch (e) { }
            })
        );
    } catch (e) {
        return results;
    }
    return results;
}

/**
 * Recursive search for files and folders
 */
function searchRecursive(dir, term, results = [], relativeBase = "") {
    if (!fs.existsSync(dir)) return;
    let list;
    try {
        list = fs.readdirSync(dir);
    } catch (e) {
        return;
    }

    for (const file of list) {
        if (file.startsWith(".")) continue;
        if (ignoreFolders.includes(file)) continue;

        const fullPath = path.join(dir, file);
        const relPath = relativeBase
            ? toUrlPath(path.join(relativeBase, file))
            : file;
        const isMatch = file.toLowerCase().includes(term.toLowerCase());

        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (isMatch)
                    results.push({
                        type: "folder",
                        name: file,
                        path: relPath,
                        size: "-",
                        bytes: 0,
                    });
                searchRecursive(fullPath, term, results, relPath);
            } else if (videoExtensions.test(file)) {
                if (isMatch)
                    results.push({
                        type: "video",
                        name: file,
                        path: relPath,
                        size: formatBytes(stat.size),
                        bytes: stat.size,
                    });
            }
        } catch (e) { }
        if (results.length > 100) return;
    }
}

module.exports = {
    formatBytes,
    toUrlPath,
    getThumbPath,
    getItemsInFolder,
    searchRecursive,
};
