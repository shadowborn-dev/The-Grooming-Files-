import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');

// Serve static files from the dist directory
app.use(express.static(distPath));

// Handle all other routes - Express 5 compatible
app.use((req, res) => {
  const urlPath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(distPath, urlPath);
  const filePathHtml = path.join(distPath, urlPath + '.html');
  const filePathIndex = path.join(distPath, urlPath, 'index.html');

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else if (fs.existsSync(filePathHtml)) {
    res.sendFile(filePathHtml);
  } else if (fs.existsSync(filePathIndex)) {
    res.sendFile(filePathIndex);
  } else {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
