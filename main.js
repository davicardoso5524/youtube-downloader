// main.js — versão final com correção de ícones
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

// IMPORTANTE: Configuração do Windows ANTES de tudo
if (process.platform === 'win32') {
  // Define o AppUserModelId para o Windows identificar o app corretamente
  app.setAppUserModelId('com.youtube.downloader');
  
  // Caminho do ícone
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.join(__dirname, 'assets', 'icon.ico');
  
  // Verifica se o ícone existe e define como padrão
  if (fs.existsSync(iconPath)) {
    // Isso garante que o Windows use o ícone correto
    app.setPath('userData', app.getPath('userData'));
  }
}

// -----------------------------------------------------
// Função auxiliar: resolve binário empacotado no build
// -----------------------------------------------------
function resolveBundledBin(nameWin, nameUnix) {
  const candidate = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? nameWin : nameUnix);
  if (fs.existsSync(candidate)) return candidate;
  return process.platform === 'win32' ? nameWin : nameUnix; // fallback pro PATH
}

// Caminhos dos binários (yt-dlp, ffmpeg, ffprobe)
const ytDlpPath = resolveBundledBin('yt-dlp.exe', 'yt-dlp');
const ffmpegPath = resolveBundledBin('ffmpeg.exe', 'ffmpeg');
const ffprobePath = resolveBundledBin('ffprobe.exe', 'ffprobe');

// -----------------------------------------------------
// Criação da janela principal
// -----------------------------------------------------
function createWindow() {
  // Caminho do ícone (funciona em dev e produção)
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.join(__dirname, 'assets', 'icon.ico');

  // Verifica se o ícone existe
  if (!fs.existsSync(iconPath)) {
    console.error('Ícone não encontrado em:', iconPath);
  }

  const windowOptions = {
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f0f23',
    show: false,
    title: 'YouTube Downloader',
  };

  // Adiciona ícone apenas se existir
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // CRÍTICO: No Windows, força o ícone após criar a janela
  if (process.platform === 'win32' && fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
    
    // Define o título da janela explicitamente
    mainWindow.setTitle('YouTube Downloader');
  }

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ADICIONAR: Event listener para garantir ícone em todas as janelas
app.on('browser-window-created', (event, window) => {
  if (process.platform === 'win32') {
    let iconPath;
    if (app.isPackaged) {
      iconPath = path.join(process.resourcesPath, 'assets', 'icon.ico');
    } else {
      iconPath = path.join(__dirname, 'assets', 'icon.ico');
    }
    
    if (fs.existsSync(iconPath)) {
      window.setIcon(iconPath);
    }
  }
});

// -----------------------------------------------------
// Eventos principais do ciclo do app
// -----------------------------------------------------
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// -----------------------------------------------------
// IPC: Selecionar pasta de destino
// -----------------------------------------------------
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// -----------------------------------------------------
// IPC: Abrir pasta no explorador
// -----------------------------------------------------
ipcMain.handle('open-folder', async (event, folderPath) => {
  if (fs.existsSync(folderPath)) {
    await shell.openPath(folderPath);
    return true;
  }
  return false;
});

// -----------------------------------------------------
// IPC: Processo principal de download
// -----------------------------------------------------
ipcMain.handle('start-download', async (event, config) => {
  return new Promise((resolve, reject) => {
    try {
      // Verificar se o yt-dlp existe
      if (!ytDlpPath) {
        reject(new Error('yt-dlp não encontrado. Coloque yt-dlp.exe na pasta bin ou adicione ao PATH.'));
        return;
      }

      // Garantir que a pasta de destino exista
      if (!fs.existsSync(config.downloadPath)) {
        fs.mkdirSync(config.downloadPath, { recursive: true });
      }

      // Argumentos base
      const args = [
        '-c', // continuar downloads interrompidos
        '-P', config.downloadPath,
        '-o', '%(playlist_title,unknown)s/%(playlist_index>03)s - %(title).200B [%(id)s].%(ext)s',
      ];

      // Cookies
      if (config.cookieBrowser) {
        args.push('--cookies-from-browser', config.cookieBrowser);
      }

      // Limite de velocidade
      if (config.rateLimit) {
        args.push('-r', config.rateLimit);
      }

      // Legendas
      if (config.downloadSubs) {
        args.push('--write-subs', '--sub-lang', 'pt,en', '--convert-subs', 'srt', '--embed-subs');
      }

      // Modo de download
      if (config.mode === 'audio') {
        args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
      } else {
        // Modo vídeo (compatível com TVs antigas)
        args.push(
          '-f',
          'bv*[vcodec^=avc1][height<=720]+ba[acodec^=mp4a]/b[ext=mp4]',
          '--merge-output-format',
          'mp4',
          '--recode-video',
          'mp4',
          '--postprocessor-args',
          'video:-c:v libx264 -pix_fmt yuv420p -profile:v main -level 3.1 -vf scale=min(1280\\,iw):-2,fps=30 -movflags +faststart -c:a aac -b:a 160k -ac 2 -ar 48000',
          '--embed-metadata'
        );
      }

      // URL final
      args.push(config.url);

      // Ambiente: força yt-dlp a achar o ffmpeg/ffprobe empacotado
      const env = {
        ...process.env,
        PATH: `${path.dirname(ffmpegPath)}${path.delimiter}${process.env.PATH}`,
        FFmpegLocation: ffmpegPath,
        FFPROBE: ffprobePath,
      };

      // Spawn do processo
      const ytdlp = spawn(ytDlpPath, args, { shell: false, env });

      let output = '';
      let errorOutput = '';

      ytdlp.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        mainWindow.webContents.send('download-progress', text);
      });

      ytdlp.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        mainWindow.webContents.send('download-progress', text);
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(`Download falhou (código ${code}):\n${errorOutput}`));
        }
      });

      ytdlp.on('error', (err) => {
        reject(new Error(`Erro ao executar yt-dlp: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
});