const http = require('http');
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const multer = require('multer');
require('dotenv').config();

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'profile.json');
const LUO_DATA_FILE = path.join(__dirname, 'data', 'profile_luo.json');
const LUO_DATA_DIR = path.join(__dirname, 'luo', 'data');

const removeLuoPrefix = (url) => url.replace(/^\/luo/, '');

// 初始化 COS
const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY
});

// 配置 multer 处理文件上传 (内存存储)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB 限制
});

const server = http.createServer((req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 处理 /api/save (原有逻辑)
    if (req.method === 'POST' && req.url === '/api/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Write failed' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Saved' }));
                    }
                });
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // 处理 /api/upload (新增逻辑)
    if (req.method === 'POST' && req.url === '/api/upload') {
        // 使用 multer 手动处理 multipart/form-data
        upload.single('file')(req, res, (err) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message }));
                return;
            }

            if (!req.file) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No file uploaded' }));
                return;
            }

            // 生成唯一文件名
            const ext = path.extname(req.file.originalname) || '.png';
            const key = `moods/${Date.now()}${ext}`;

            // 上传到 COS
            cos.putObject({
                Bucket: process.env.COS_BUCKET,
                Region: process.env.COS_REGION,
                Key: key,
                Body: req.file.buffer,
            }, function(err, data) {
                if (err) {
                    console.error('COS Upload Error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Upload to COS failed' }));
                } else {
                    // 拼接 URL (如果有 CDN 域名则使用 CDN，否则使用默认链接)
                    const cdnDomain = process.env.COS_CDN_DOMAIN;
                    const url = cdnDomain 
                        ? `https://${cdnDomain}/${key}` 
                        : `https://${data.Location}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, url: url, key: key }));
                }
            });
        });
        return;
    }

    // 处理 /api/delete-file (删除 COS 图片)
    if (req.method === 'POST' && req.url === '/api/delete-file') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.key) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Missing key' }));
                    return;
                }

                cos.deleteObject({
                    Bucket: process.env.COS_BUCKET,
                    Region: process.env.COS_REGION,
                    Key: data.key,
                }, function(err, data) {
                    if (err) {
                        console.error('COS Delete Error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Delete from COS failed' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                });
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // 处理 /api/save-luo (luo 的数据保存)
    if (req.method === 'POST' && (req.url === '/api/save-luo' || req.url === '/luo/api/save-luo')) {
        const actualUrl = removeLuoPrefix(req.url);
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const newData = JSON.parse(body);
                
                // 读取现有数据并合并
                const readAndMerge = (filePath) => {
                    return new Promise((resolve) => {
                        fs.readFile(filePath, 'utf8', (err, content) => {
                            if (err || !content) {
                                resolve(newData);
                                return;
                            }
                            try {
                                const existingData = JSON.parse(content);
                                const mergedData = { ...existingData, ...newData };
                                resolve(mergedData);
                            } catch (e) {
                                resolve(newData);
                            }
                        });
                    });
                };
                
                // 合并两个文件的数据
                Promise.all([
                    readAndMerge(LUO_DATA_FILE),
                    readAndMerge(path.join(LUO_DATA_DIR, 'profile_luo.json'))
                ]).then(([data1, data2]) => {
                    const finalData = { ...data1, ...data2 };
                    const jsonStr = JSON.stringify(finalData, null, 2);
                    
                    const savePromises = [
                        new Promise((resolve, reject) => {
                            fs.writeFile(LUO_DATA_FILE, jsonStr, (err) => err ? reject(err) : resolve());
                        }),
                        new Promise((resolve, reject) => {
                            fs.writeFile(path.join(LUO_DATA_DIR, 'profile_luo.json'), jsonStr, (err) => err ? reject(err) : resolve());
                        })
                    ];
                    
                    Promise.all(savePromises)
                        .then(() => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Saved' }));
                        })
                        .catch((err) => {
                            console.error('Save error:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, message: 'Write failed' }));
                        });
                });
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // 处理 /api/upload-luo (luo 的图片上传)
    if (req.method === 'POST' && (req.url === '/api/upload-luo' || req.url === '/luo/api/upload-luo')) {
        upload.single('file')(req, res, (err) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message }));
                return;
            }

            if (!req.file) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No file uploaded' }));
                return;
            }

            const ext = path.extname(req.file.originalname) || '.png';
            const key = `luo/${Date.now()}${ext}`;

            cos.putObject({
                Bucket: process.env.COS_BUCKET,
                Region: process.env.COS_REGION,
                Key: key,
                Body: req.file.buffer,
            }, function(err, data) {
                if (err) {
                    console.error('COS Upload Error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Upload to COS failed' }));
                } else {
                    const cdnDomain = process.env.COS_CDN_DOMAIN;
                    const url = cdnDomain 
                        ? `https://${cdnDomain}/${key}` 
                        : `https://${data.Location}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, url: url, key: key }));
                }
            });
        });
        return;
    }

    // 处理 /api/delete-file-luo (删除 luo 的 COS 图片)
    if (req.method === 'POST' && (req.url === '/api/delete-file-luo' || req.url === '/luo/api/delete-file-luo')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.key) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Missing key' }));
                    return;
                }

                cos.deleteObject({
                    Bucket: process.env.COS_BUCKET,
                    Region: process.env.COS_REGION,
                    Key: data.key,
                }, function(err, data) {
                    if (err) {
                        console.error('COS Delete Error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Delete from COS failed' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                });
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
    if (!process.env.COS_SECRET_ID) {
        console.warn('⚠️  Warning: COS environment variables are missing!');
    }
});
