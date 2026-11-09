// Fa sapere all'app che gira come programma installato (la guida non propone di installarla).
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("attDesktop", true);
