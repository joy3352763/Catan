const fs = require('fs');
let c = fs.readFileSync('src/main.ts', 'utf8');

c = c.replace(/<label[^>]*id="sfxToggle"[^>]*>.*?<\/label>/g, '<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;"><input type="checkbox" id="sfxToggle" checked>音效</label>');
c = c.replace(/<label[^>]*id="bgmToggle"[^>]*>.*?<\/label>/g, '<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;"><input type="checkbox" id="bgmToggle" checked>音樂</label>');
c = c.replace(/title="[^"]*"/g, 'title="音樂音量"');

fs.writeFileSync('src/main.ts', c, 'utf8');

