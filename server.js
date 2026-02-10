const http = require('http');
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const multer = require('multer');
require('dotenv').config();

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'profile.json');

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
            const key = `avatars/${Date.now()}${ext}`;

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
                    res.end(JSON.stringify({ success: true, url: url }));
                }
            });
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
