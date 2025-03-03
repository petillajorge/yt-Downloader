const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// Clean up downloads older than 1 hour
function cleanupDownloads() {
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();
    
    files.forEach(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;
        
        // Delete files older than 1 hour (3600000 ms)
        if (fileAge > 3600000) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old file: ${file}`);
        }
    });
}

// Run cleanup every hour
setInterval(cleanupDownloads, 3600000);

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Download API endpoint
app.post('/api/download', async (req, res) => {
    try {
        const { videoUrl, format } = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({ message: 'Video URL is required' });
        }
        
        // Validate YouTube URL
        const isValid = await ytdl.validateURL(videoUrl);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid YouTube URL' });
        }
        
        // Get video info
        const info = await ytdl.getInfo(videoUrl);
        const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        
        // Generate a unique filename
        const randomString = crypto.randomBytes(8).toString('hex');
        const fileExt = format === 'audioonly' ? 'mp3' : 'mp4';
        const fileName = `${videoTitle}-${randomString}.${fileExt}`;
        const filePath = path.join(downloadsDir, fileName);
        
        // Set download options
        const options = {
            quality: format === 'audioonly' ? 'highestaudio' : 'highest',
            filter: format
        };
        
        // Start the download process
        const videoStream = ytdl(videoUrl, options);
        const fileStream = fs.createWriteStream(filePath);
        
        videoStream.pipe(fileStream);
        
        fileStream.on('finish', () => {
            console.log(`Download completed: ${fileName}`);
        });
        
        fileStream.on('error', (error) => {
            console.error('Error writing file:', error);
        });
        
        // Respond immediately with the download link
        res.json({
            message: 'Download started',
            downloadUrl: `/downloads/${fileName}`,
            title: videoTitle
        });
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: `Download failed: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});