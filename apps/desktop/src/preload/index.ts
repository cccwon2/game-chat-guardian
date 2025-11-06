import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gcg', {
  sendRoi: (roi: { x: number; y: number; width: number; height: number }) => ipcRenderer.send('ROI_SELECTED', roi),
  onContentFlagged: (cb: (event: any, data?: any) => void) => {
    ipcRenderer.on('CONTENT_FLAGGED', (event, data) => cb(event, data));
  },
  sendOcrText: (text: string) => ipcRenderer.send('OCR_TEXT', text),
  sendSttText: (text: string) => ipcRenderer.send('STT_TEXT', text)
});
