/* preload.js — minimal bridge between Electron and renderer */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform
});
