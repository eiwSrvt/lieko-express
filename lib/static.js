const fs = require('fs');
const path = require('path');

module.exports = function serveStatic(root, options = {}) {
    const opts = {
        maxAge: options.maxAge || 0,
        index: options.index !== undefined ? options.index : 'index.html',
        dotfiles: options.dotfiles || 'ignore',
        etag: options.etag !== undefined ? options.etag : true,
        extensions: options.extensions || false,
        fallthrough: options.fallthrough !== undefined ? options.fallthrough : true,
        immutable: options.immutable || false,
        lastModified: options.lastModified !== undefined ? options.lastModified : true,
        redirect: options.redirect !== undefined ? options.redirect : true,
        setHeaders: options.setHeaders || null,
        cacheControl: options.cacheControl !== undefined ? options.cacheControl : true
    };

    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.htm': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.xml': 'application/xml; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogv': 'video/ogg',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mkv': 'video/x-matroska',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.eot': 'application/vnd.ms-fontobject',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.7z': 'application/x-7z-compressed',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.wasm': 'application/wasm',
        '.csv': 'text/csv; charset=utf-8'
    };

    const getMimeType = (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        return mimeTypes[ext] || 'application/octet-stream';
    };

    const generateETag = (stats) => {
        const mtime = stats.mtime.getTime().toString(16);
        const size = stats.size.toString(16);
        return `W/"${size}-${mtime}"`;
    };

    return async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        try {
            let pathname = req.url;
            const qIndex = pathname.indexOf('?');
            if (qIndex !== -1) {
                pathname = pathname.substring(0, qIndex);
            }

            if (pathname === '') {
                pathname = '/';
            }

            try {
                pathname = decodeURIComponent(pathname);
            } catch (e) {
                if (opts.fallthrough) return next();
                return res.status(400).send('Bad Request');
            }

            let filePath = pathname === '/' ? root : path.join(root, pathname);

            const resolvedPath = path.resolve(filePath);
            const resolvedRoot = path.resolve(root);

            if (!resolvedPath.startsWith(resolvedRoot)) {
                if (opts.fallthrough) return next();
                return res.status(403).send('Forbidden');
            }

            let stats;
            try {
                stats = await fs.promises.stat(filePath);
            } catch (err) {
                if (pathname === '/' && opts.index) {
                    const indexes = Array.isArray(opts.index) ? opts.index : [opts.index];
                    for (const indexFile of indexes) {
                        const indexPath = path.join(root, indexFile);
                        try {
                            stats = await fs.promises.stat(indexPath);
                            if (stats.isFile()) {
                                filePath = indexPath;
                                break;
                            }
                        } catch (e) { }
                    }
                }

                if (!stats && opts.extensions && Array.isArray(opts.extensions)) {
                    let found = false;
                    for (const ext of opts.extensions) {
                        const testPath = filePath + (ext.startsWith('.') ? ext : '.' + ext);
                        try {
                            stats = await fs.promises.stat(testPath);
                            filePath = testPath;
                            found = true;
                            break;
                        } catch (e) { }
                    }
                    if (!found) return next();
                } else if (!stats) {
                    return next();
                }
            }

            if (stats.isDirectory()) {
                if (opts.redirect && !pathname.endsWith('/')) {
                    const query = qIndex !== -1 ? req.url.substring(qIndex) : '';
                    const redirectUrl = pathname + '/' + query;
                    return res.redirect(redirectUrl, 301);
                }

                if (opts.index) {
                    const indexes = Array.isArray(opts.index) ? opts.index : [opts.index];

                    for (const indexFile of indexes) {
                        const indexPath = path.join(filePath, indexFile);
                        try {
                            const indexStats = await fs.promises.stat(indexPath);
                            if (indexStats.isFile()) {
                                filePath = indexPath;
                                stats = indexStats;
                                break;
                            }
                        } catch (e) { }
                    }

                    if (stats.isDirectory()) {
                        if (opts.fallthrough) return next();
                        return res.status(404).send('Not Found');
                    }
                } else {
                    if (opts.fallthrough) return next();
                    return res.status(404).send('Not Found');
                }
            }

            if (opts.etag) {
                const etag = generateETag(stats);
                const ifNoneMatch = req.headers['if-none-match'];

                if (ifNoneMatch === etag) {
                    res.statusCode = 304;
                    res.end();
                    return;
                }

                res.setHeader('ETag', etag);
            }

            if (opts.lastModified) {
                const lastModified = stats.mtime.toUTCString();
                const ifModifiedSince = req.headers['if-modified-since'];

                if (ifModifiedSince === lastModified) {
                    res.statusCode = 304;
                    res.end();
                    return;
                }

                res.setHeader('Last-Modified', lastModified);
            }

            if (opts.cacheControl) {
                let cacheControl = 'public';

                if (opts.maxAge > 0) {
                    cacheControl += `, max-age=${opts.maxAge}`;
                }

                if (opts.immutable) {
                    cacheControl += ', immutable';
                }

                res.setHeader('Cache-Control', cacheControl);
            }

            const mimeType = getMimeType(filePath);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', stats.size);

            if (typeof opts.setHeaders === 'function') {
                opts.setHeaders(res, filePath, stats);
            }

            if (req.method === 'HEAD') {
                return res.end();
            }

            const data = await fs.promises.readFile(filePath);
            res.end(data);
            return;

        } catch (error) {
            console.error('Static middleware error:', error);
            if (opts.fallthrough) return next();
            res.status(500).send('Internal Server Error');
        }
    };
};
