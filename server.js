const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'profile.json');

const server = http.createServer((req, res) => {
    // 设置 CORS 允许跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 只处理 /api/save 的 POST 请求
    if (req.method === 'POST' && req.url === '/api/save') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                // 简单的校验
                if (!data.basicInfo) {
                    throw new Error('Invalid data structure');
                }

                // 写入文件
                fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
                    if (err) {
                        console.error('Error writing file:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: '写入文件失败' }));
                    } else {
                        console.log('Profile updated successfully');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: '保存成功' }));
                    }
                });
            } catch (error) {
                console.error('Invalid JSON:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '无效的数据格式' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`API Server is running on http://localhost:${PORT}`);
});
