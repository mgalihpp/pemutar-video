/**
 * Configuration module for Ox Video Gallery
 */
const path = require("path");
const fs = require("fs");
const express = require("express");

// Constants
const THUMB_DIR = path.join(__dirname, "..", ".thumbnails");

const ignoreFolders = [
    "node_modules",
    ".git",
    ".vscode",
    "dist",
    "build",
    "temp",
    "tmp",
    "__pycache__",
    "src",
    "venv",
    ".next",
    "out",
    "cache",
    ".thumbnails",
    "$RECYCLE.BIN",
    "System Volume Information",
    "RECYCLER",
];

const videoExtensions = /\.(mp4|webm|ogg|mov|mkv|avi|flv|wmv|m4v)$/i;

/**
 * Setup Express middleware
 */
function setupMiddleware(app, baseDir) {
    // Ensure thumbnail directory exists
    if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR);

    // JSON parsing with limit
    app.use(express.json({ limit: "10mb" }));

    // CORS headers
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept"
        );
        next();
    });

    // Static file serving
    app.use(
        "/.thumbnails",
        express.static(THUMB_DIR, {
            maxAge: "1y",
            immutable: true,
        })
    );

    // Serve static files from src/templates for client assets
    app.use('/assets', express.static(path.join(__dirname, 'templates')));

    app.use(express.static(baseDir));
}

module.exports = {
    THUMB_DIR,
    ignoreFolders,
    videoExtensions,
    setupMiddleware,
};
