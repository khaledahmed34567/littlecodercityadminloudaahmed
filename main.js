// تطبيق اللابتوب (Electron): بيشغّل اللعبة من سيرفر محلي على localhost
// عشان الدخول بجوجل (Firebase) يشتغل، لأن localhost مسموح تلقائياً في Firebase Authorized domains.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// نخلّي الـ User-Agent شبه كروم (جوجل بتمنع الدخول من متصفحات Electron الافتراضية)
try { app.userAgentFallback = app.userAgentFallback.replace(/Electron\/[\d.]+\s/, '').replace(/[\w.-]+\/\d[\w.]*\s(?=Chrome)/, ''); } catch (e) {}
if (!app.requestSingleInstanceLock()) app.quit();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.otf': 'font/otf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.css': 'text/css' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.normalize(path.join(__dirname, p));
      if (!file.startsWith(__dirname) || /node_modules|package\.json|main\.js/.test(p)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

// حماية المحتوى: بتخلي أي برنامج تصوير أو تسجيل شاشة أو لقطة شاشة يطلّع النافذة سودا (ويندوز وماك)
function protect(win) {
  try { win.setContentProtection(true); } catch (e) {}
  win.webContents.on('context-menu', e => e.preventDefault());
  win.webContents.on('devtools-opened', () => win.webContents.closeDevTools());
  try {
    const ses = win.webContents.session;
    ses.setPermissionRequestHandler((wc, perm, cb) => cb(false));            // رفض الكاميرا/الميكروفون/مشاركة الشاشة
    ses.setDisplayMediaRequestHandler((req, cb) => cb({}));                  // منع التقاط الشاشة من داخل الصفحة
  } catch (e) {}
}
app.on('browser-window-created', (_e, w) => { try { w.setContentProtection(true); } catch (e) {} });
app.on('browser-window-focus', () => {});

async function createWindow() {
  const port = await serve();
  const win = new BrowserWindow({
    width: 1100, height: 800, minWidth: 420, minHeight: 560,
    title: 'مدينة المبرمج الصغير',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#17413f',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false }
  });
  Menu.setApplicationMenu(null);
  protect(win);
  win.loadURL('http://localhost:' + port + '/index.html');

  win.webContents.on('before-input-event', (event, input) => {
    // منع لقطة الشاشة وأدوات المطوّر
    const k = (input.key || '').toLowerCase();
    if (input.type === 'keyDown' && (k === 'printscreen' || k === 'f12' || (input.control && input.shift && ['i', 'j', 'c', 's'].includes(k)) || (input.meta && input.shift && ['3', '4', '5'].includes(k)))) { event.preventDefault(); return; }
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
  });
  // نافذة دخول جوجل بتتفتح جوه التطبيق، وأي لينك تاني بيتفتح في المتصفح
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/accounts\.google\.com|firebaseapp\.com\/__\/auth|googleapis\.com/.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true, parent: win, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
