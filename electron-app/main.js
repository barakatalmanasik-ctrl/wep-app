const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

/* ═══════════════════════════════════════
   Single Instance Lock
═══════════════════════════════════════ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

/* ═══════════════════════════════════════
   App Path Setup
   Dev:  electron-app/ → ../pure-app/
   Prod: resources/pure-app/ (extraResources)
═══════════════════════════════════════ */
let appDir;

if (app.isPackaged) {
    appDir = path.join(process.resourcesPath, 'pure-app');
} else {
    appDir = path.join(__dirname, '..', 'pure-app');
}

/* ═══════════════════════════════════════
   Disable Hardware Acceleration
═══════════════════════════════════════ */
app.disableHardwareAcceleration();

/* ═══════════════════════════════════════
   Window
═══════════════════════════════════════ */
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: 'بركات المناسك — نظام إدارة التذاكر',
        icon: path.join(appDir, 'icons', 'icon-512.png'),
        backgroundColor: '#f0f4f8',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });

    mainWindow.setMenu(null);

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('close', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key === 'F12') {
            event.preventDefault();
        }
    });

    mainWindow.webContents.on('context-menu', (e) => {
        e.preventDefault();
    });

    mainWindow.loadFile(path.join(appDir, 'index.html'));
}

/* ═══════════════════════════════════════
   App Ready
═══════════════════════════════════════ */
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
