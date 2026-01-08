import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all routes by serving index.html for client-side routing
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'dist', req.path);

  // Try to serve the exact file
  res.sendFile(filePath, (err) => {
    if (err) {
      // If file doesn't exist, try with .html extension
      res.sendFile(filePath + '.html', (err2) => {
        if (err2) {
          // If still not found, try index.html in that directory
          res.sendFile(path.join(filePath, 'index.html'), (err3) => {
            if (err3) {
              // Finally fallback to root index.html
              res.sendFile(path.join(__dirname, 'dist', 'index.html'));
            }
          });
        }
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
