// main.js — versão final com correção de ícones
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let downloadProcess = null; // Armazenar processo de download para cancelamento

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
  // Tentar em desenvolvimento: assets/bin
  const devPath = path.join(__dirname, 'assets', 'bin', process.platform === 'win32' ? nameWin : nameUnix);
  if (fs.existsSync(devPath)) {
    console.log(`Binário encontrado em dev: ${devPath}`);
    return devPath;
  }
  
  // Tentar em produção: process.resourcesPath/bin
  const prodPath = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? nameWin : nameUnix);
  if (fs.existsSync(prodPath)) {
    console.log(`Binário encontrado em prod: ${prodPath}`);
    return prodPath;
  }
  
  // Fallback: procurar no PATH
  const binName = process.platform === 'win32' ? nameWin : nameUnix;
  console.log(`Binário não encontrado localmente, usando PATH: ${binName}`);
  return binName;
}

// Caminhos dos binários (yt-dlp, ffmpeg, ffprobe)
const ytDlpPath = resolveBundledBin('yt-dlp.exe', 'yt-dlp');
const ffmpegPath = resolveBundledBin('ffmpeg.exe', 'ffmpeg');
const ffprobePath = resolveBundledBin('ffprobe.exe', 'ffprobe');

// Debug: verificar binários
console.log('=== BINÁRIOS CARREGADOS ===');
console.log('yt-dlp:', ytDlpPath, 'Existe:', fs.existsSync(ytDlpPath));
console.log('ffmpeg:', ffmpegPath, 'Existe:', fs.existsSync(ffmpegPath));
console.log('ffprobe:', ffprobePath, 'Existe:', fs.existsSync(ffprobePath));
console.log('==========================');

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
    // Enviar o caminho correto de Downloads para o renderer
    const downloadsPath = app.getPath('downloads');
    mainWindow.webContents.send('set-downloads-path', downloadsPath);
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

// IPC: Obter lista de vídeos de uma playlist
ipcMain.handle('fetch-playlist', async (event, url) => {
  return new Promise((resolve, reject) => {
    try {
      // Argumentos para listar vídeos SEM extrair formatos (muito mais rápido)
      const args = [
        '--dump-json',
        '--no-warnings',
        '--quiet',
        '--skip-download',
        '--extract-flat=in_playlist', // Não extrai detalhes de cada vídeo
        url
      ];

      const ytdlp = spawn(ytDlpPath, args, { shell: false });

      let output = '';
      let errorOutput = '';

      ytdlp.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          try {
            // Limpar output: remover linhas vazias e caracteres extras
            const cleanOutput = output.trim();
            
            // Extrair apenas o JSON válido (começa com { ou [ e termina com } ou ])
            let jsonString = '';
            let braceCount = 0;
            let inJson = false;
            
            for (let i = 0; i < cleanOutput.length; i++) {
              const char = cleanOutput[i];
              
              if (!inJson && (char === '{' || char === '[')) {
                inJson = true;
                jsonString = char;
                braceCount = char === '{' ? 1 : 1;
              } else if (inJson) {
                jsonString += char;
                if (char === '{') braceCount++;
                else if (char === '}') braceCount--;
                else if (char === '[') braceCount++;
                else if (char === ']') braceCount--;
                
                if (braceCount === 0) {
                  break;
                }
              }
            }
            
            if (!jsonString) {
              throw new Error('Nenhum JSON encontrado na resposta');
            }
            
            const data = JSON.parse(jsonString);
            
            // Se for uma playlist, retornar os vídeos
            if (data.entries) {
              const videos = data.entries.map(entry => ({
                id: entry.id,
                title: entry.title || 'Vídeo sem título',
                duration: entry.duration || 0,
                thumbnail: entry.thumbnail || '',
                url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                index: entry.playlist_index || 0
              }));
              
              resolve({
                success: true,
                isPlaylist: true,
                playlistTitle: data.title || 'Playlist',
                playlistDescription: data.description || '',
                videos: videos,
                total: videos.length
              });
            } else {
              // Se for um vídeo único
              resolve({
                success: true,
                isPlaylist: false,
                videos: [{
                  id: data.id,
                  title: data.title || 'Vídeo',
                  duration: data.duration || 0,
                  thumbnail: data.thumbnail || '',
                  url: `https://www.youtube.com/watch?v=${data.id}`
                }],
                total: 1
              });
            }
          } catch (e) {
            console.error('Erro ao parsear JSON:', e.message);
            console.error('Output recebido:', output.substring(0, 500));
            reject(new Error(`Erro ao parsear resposta: ${e.message}`));
          }
        } else {
          reject(new Error(`Erro ao listar playlist: ${errorOutput}`));
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

// IPC: Selecionar pasta de destino
// -----------------------------------------------------
ipcMain.handle('get-downloads-path', async () => {
  return app.getPath('downloads');
});

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
        '-o', '%(title).100B [%(id)s].%(ext)s', // Formato simplificado
      ];

      // Se for playlist com seleção, NÃO usar --no-playlist
      // Se for URL única, usar --no-playlist
      if (!config.urls || config.urls.length === 1) {
        args.push('--no-playlist'); // NÃO baixar playlists, apenas vídeo individual
      }

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
        // Modo vídeo - formato simples e compatível
        args.push(
          '-f',
          'best[ext=mp4]/best',
          '--merge-output-format',
          'mp4'
        );
      }

      // Configurar FFmpeg se disponível
      if (fs.existsSync(ffmpegPath)) {
        args.push('--ffmpeg-location', ffmpegPath);
      }

      // URL(s) - aceitar array ou string
      if (config.urls && Array.isArray(config.urls)) {
        // Múltiplas URLs (playlist selecionada)
        config.urls.forEach(url => args.push(url));
      } else {
        // URL única
        args.push(config.url);
      }

      // Ambiente: força yt-dlp a achar o ffmpeg/ffprobe empacotado
      const ffmpegDir = path.dirname(ffmpegPath);
      const env = {
        ...process.env,
        PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH}`,
        FFMPEG: ffmpegPath,
        FFPROBE: ffprobePath,
      };

      // Debug: logar informações
      console.log('=== DOWNLOAD DEBUG ===');
      console.log('FFmpeg Path:', ffmpegPath);
      console.log('FFmpeg Exists:', fs.existsSync(ffmpegPath));
      console.log('yt-dlp Args:', args.join(' '));
      console.log('=====================');

      // Spawn do processo
      downloadProcess = spawn(ytDlpPath, args, { shell: false, env });

      let output = '';
      let errorOutput = '';

      downloadProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        mainWindow.webContents.send('download-progress', text);
      });

      downloadProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        mainWindow.webContents.send('download-progress', text);
      });

      downloadProcess.on('close', (code) => {
        downloadProcess = null; // Limpar processo
        if (code === 0) {
          mainWindow.webContents.send('download-progress', '\n✅ Download finalizado com sucesso!');
          resolve({ success: true, output });
        } else if (code === 15 || code === -15) {
          // Código 15 = SIGTERM (cancelado pelo usuário)
          reject(new Error('Download cancelado pelo usuário'));
        } else {
          reject(new Error(`Download falhou (código ${code}):\n${errorOutput}`));
        }
      });

      downloadProcess.on('error', (err) => {
        downloadProcess = null;
        reject(new Error(`Erro ao executar yt-dlp: ${err.message}`));
      });
    } catch (err) {
      downloadProcess = null;
      reject(err);
    }
  });
});

// IPC: Cancelar download em andamento
ipcMain.handle('cancel-download', async () => {
  if (downloadProcess && !downloadProcess.killed) {
    downloadProcess.kill('SIGTERM');
    downloadProcess = null;
    return { success: true, message: 'Download cancelado' };
  }
  return { success: false, message: 'Nenhum download em andamento' };
});
