// Elementos da interface
const urlInput = document.getElementById('url');
const downloadPathInput = document.getElementById('downloadPath');
const folderNameDisplay = document.getElementById('folderName');
const selectFolderBtn = document.getElementById('selectFolder');
const modeInput = document.getElementById('mode');
const cookieBrowserSelect = document.getElementById('cookieBrowser');
const rateLimitInput = document.getElementById('rateLimit');
const downloadSubsCheckbox = document.getElementById('downloadSubs');
const downloadBtn = document.getElementById('downloadBtn');
const progressCard = document.getElementById('progressCard');
const progressFill = document.getElementById('progressFill');
const progressLog = document.getElementById('progressLog');
const openFolderBtn = document.getElementById('openFolderBtn');
const advancedToggle = document.getElementById('advancedToggle');
const advancedContent = document.getElementById('advancedContent');
const videoOption = document.getElementById('videoOption');
const audioOption = document.getElementById('audioOption');
const progressPercentage = document.querySelector('.progress-percentage');
const cancelDownloadBtn = document.getElementById('cancelDownloadBtn') || createCancelButton();

// Elementos da modal de playlist
const playlistModal = document.getElementById('playlistModal');
const closePlaylistBtn = document.getElementById('closePlaylistBtn');
const playlistTitle = document.getElementById('playlistTitle');
const playlistContainer = document.getElementById('playlistContainer');
const selectAllPlaylistBtn = document.getElementById('selectAllPlaylistBtn');
const deselectAllPlaylistBtn = document.getElementById('deselectAllPlaylistBtn');
const playlistCount = document.getElementById('playlistCount');
const downloadPlaylistBtn = document.getElementById('downloadPlaylistBtn');
const cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');

// Variáveis de estado
let currentPlaylistVideos = [];
let selectedVideoUrls = [];

// Debug: verificar se electron está disponível
console.log('Window.electron disponível:', !!window.electron);
if (!window.electron) {
  console.error('ERRO: window.electron não está disponível! Verifique o preload.js');
}

// Criar botão de cancelamento dinamicamente se não existir
function createCancelButton() {
  const btn = document.createElement('button');
  btn.id = 'cancelDownloadBtn';
  btn.className = 'btn-cancel';
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    Cancelar Download
  `;
  btn.style.display = 'none';
  return btn;
}

// Configurações padrão - detectar pasta de Downloads do usuário
let defaultPath;
if (navigator.userAgent.includes('Windows')) {
  // Usar a API do Electron para obter o caminho correto (sem depender do userAgent)
  // Para Windows, usamos um path genérico que será resolvido pelo main.js
  defaultPath = null; // Será definido pelo main.js
} else if (navigator.userAgent.includes('Mac')) {
  defaultPath = null;
} else {
  defaultPath = null;
}

// Se não conseguir pela API, pedir ao usuário para selecionar
if (!defaultPath) {
  // Esperamos que o main.js envie o caminho correto via IPC
  // Enquanto isso, deixamos vazio para o usuário selecionar
  defaultPath = '';
}

if (downloadPathInput) {
  downloadPathInput.value = defaultPath;
  updateFolderDisplay(defaultPath);
}

// Receber o caminho correto de Downloads do main process
if (window.electron && window.electron.onSetDownloadsPath) {
  window.electron.onSetDownloadsPath((downloadsPath) => {
    downloadPathInput.value = downloadsPath;
    updateFolderDisplay(downloadsPath);
  });
}

// Modo de download (vídeo por padrão)
let currentMode = 'video';
if (videoOption) videoOption.classList.add('active');

// Alternar entre opções de vídeo e áudio
if (videoOption) {
  videoOption.addEventListener('click', () => {
    videoOption.classList.add('active');
    if (audioOption) audioOption.classList.remove('active');
    currentMode = 'video';
    if (modeInput) modeInput.value = 'video';
  });
}

if (audioOption) {
  audioOption.addEventListener('click', () => {
    audioOption.classList.add('active');
    if (videoOption) videoOption.classList.remove('active');
    currentMode = 'audio';
    if (modeInput) modeInput.value = 'audio';
  });
}

// Toggle de opções avançadas
if (advancedToggle && advancedContent) {
  advancedToggle.addEventListener('click', () => {
    advancedToggle.classList.toggle('active');
    advancedContent.classList.toggle('show');
  });
}

// Atualizar display da pasta
function updateFolderDisplay(path) {
  if (!folderNameDisplay) return;
  const pathParts = path.split(/[\\/]/);
  const folderName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || 'Downloads';
  folderNameDisplay.textContent = folderName;
}

// Selecionar pasta
if (selectFolderBtn) {
  selectFolderBtn.addEventListener('click', async () => {
    try {
      const folder = await window.electron.selectFolder();
      if (folder && downloadPathInput) {
        downloadPathInput.value = folder;
        updateFolderDisplay(folder);
      }
    } catch (error) {
      console.error('Erro ao selecionar pasta:', error);
    }
  });
}

// Abrir pasta após download
if (openFolderBtn) {
  openFolderBtn.addEventListener('click', () => {
    if (downloadPathInput && downloadPathInput.value) {
      window.electron.openFolder(downloadPathInput.value);
    }
  });
}

// Iniciar download
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!urlInput || !downloadPathInput) {
      console.error('Elementos necessários não encontrados');
      return;
    }

    const url = urlInput.value.trim();
    const downloadPath = downloadPathInput.value.trim();

    // Validações
    if (!url) {
      showNotification('Erro', 'Por favor, insira uma URL válida!', 'error');
      urlInput.focus();
      return;
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      showNotification('Erro', 'Por favor, insira uma URL válida do YouTube!', 'error');
      urlInput.focus();
      return;
    }

    if (!downloadPath) {
      showNotification('Erro', 'Por favor, selecione uma pasta de destino!', 'error');
      return;
    }

    // Verificar se é playlist
    if (url.includes('playlist?list=') || (url.includes('/watch?v=') && url.includes('&list='))) {
      // É uma playlist - carregá-la
      await fetchPlaylistVideos(url);
      return;
    }

    // Preparar configuração para vídeo único
    const config = {
      url: url,
      downloadPath: downloadPath,
      mode: currentMode,
      cookieBrowser: cookieBrowserSelect ? cookieBrowserSelect.value || null : null,
      rateLimit: rateLimitInput ? rateLimitInput.value.trim() || null : null,
      downloadSubs: downloadSubsCheckbox ? downloadSubsCheckbox.checked : false
    };

    // UI: desabilitar botão e mostrar progresso
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> Baixando...';
    
    if (cancelDownloadBtn) {
      cancelDownloadBtn.style.display = 'block';
    }
    
    if (progressCard) {
      progressCard.classList.add('show');
    }
    if (progressLog) {
      progressLog.innerHTML = '';
    }
    if (progressFill) {
      progressFill.style.width = '0%';
      progressFill.style.background = 'linear-gradient(90deg, #ff0000, #ff6b6b, #ff0000)';
    }
    if (progressPercentage) {
      progressPercentage.textContent = '0%';
      progressPercentage.style.color = '#fafafa';
    }
    if (openFolderBtn) {
      openFolderBtn.classList.remove('show');
    }

    try {
      // Iniciar download
      const result = await window.electron.startDownload(config);
      
      // Sucesso
      completeDownloadSuccess();
      
      // Notificação
      showNotification('Download Concluído!', 'Seu vídeo foi baixado com sucesso.', 'success');
    } catch (error) {
      // Erro
      completeDownloadError(error.message);
      
      // Notificação de erro
      showNotification('Erro no Download', 'Ocorreu um erro durante o download. Verifique os detalhes.', 'error');
    } finally {
      // Reabilitar botão
      resetDownloadButton();
      if (cancelDownloadBtn) {
        cancelDownloadBtn.style.display = 'none';
      }
    }
  });
}

// Cancelar download
if (cancelDownloadBtn) {
  cancelDownloadBtn.addEventListener('click', async () => {
    try {
      cancelDownloadBtn.disabled = true;
      cancelDownloadBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Cancelando...
      `;
      
      const result = await window.electron.cancelDownload();
      if (result.success) {
        showNotification('Cancelado', 'Download cancelado com sucesso.', 'info');
      }
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      showNotification('Erro', 'Erro ao cancelar o download.', 'error');
    } finally {
      cancelDownloadBtn.disabled = false;
      cancelDownloadBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Cancelar Download
      `;
    }
  });
}

// Função para completar download com sucesso
function completeDownloadSuccess() {
  if (progressFill) progressFill.style.width = '100%';
  if (progressPercentage) progressPercentage.textContent = '100%';
  
  const spinner = document.querySelector('.progress-status .spinner');
  if (spinner) spinner.style.display = 'none';
  
  const statusTitle = document.querySelector('.progress-status h3');
  if (statusTitle) {
    statusTitle.innerHTML = '✅ Concluído!';
    statusTitle.style.color = '#10b981';
  }
  
  if (progressLog) {
    progressLog.innerHTML += '\n<div style="color: #10b981; font-weight: 600; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; margin-top: 10px;">✅ Download concluído com sucesso!</div>\n';
  }
  
  if (openFolderBtn) openFolderBtn.classList.add('show');
}

// Função para completar download com erro
function completeDownloadError(errorMessage) {
  // Verificar se foi cancelamento do usuário
  const isCancelled = errorMessage.includes('cancelado') || errorMessage.includes('SIGTERM');
  
  if (isCancelled) {
    // Estilo para cancelamento
    if (progressFill) {
      progressFill.style.width = '100%';
      progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #f97316)';
    }
    if (progressPercentage) {
      progressPercentage.textContent = 'Cancelado';
      progressPercentage.style.color = '#f59e0b';
    }
    
    const spinner = document.querySelector('.progress-status .spinner');
    if (spinner) spinner.style.display = 'none';
    
    const statusTitle = document.querySelector('.progress-status h3');
    if (statusTitle) {
      statusTitle.innerHTML = '⚠️ Cancelado';
      statusTitle.style.color = '#f59e0b';
    }
    
    if (progressLog) {
      progressLog.innerHTML += `\n<div style="color: #f59e0b; font-weight: 600; padding: 10px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; margin-top: 10px;">⚠️ Download cancelado pelo usuário</div>\n`;
    }
  } else {
    // Estilo para erro
    if (progressFill) {
      progressFill.style.width = '100%';
      progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    }
    if (progressPercentage) {
      progressPercentage.textContent = 'Erro';
      progressPercentage.style.color = '#fafafa';
    }
    
    const spinner = document.querySelector('.progress-status .spinner');
    if (spinner) spinner.style.display = 'none';
    
    const statusTitle = document.querySelector('.progress-status h3');
    if (statusTitle) {
      statusTitle.innerHTML = '❌ Erro';
      statusTitle.style.color = '#ef4444';
    }
    
    if (progressLog) {
      progressLog.innerHTML += `\n<div style="color: #ef4444; font-weight: 600; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-top: 10px;">❌ Erro: ${errorMessage}</div>\n`;
    }
  }
}

// Função para resetar botão de download
function resetDownloadButton() {
  downloadBtn.disabled = false;
  downloadBtn.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Baixar Agora
  `;
}

// Receber progresso do download
if (window.electron && window.electron.onDownloadProgress) {
  window.electron.onDownloadProgress((data) => {
    if (!progressLog) return;
    
    const logEntry = document.createElement('div');
    logEntry.textContent = data;
    logEntry.style.marginBottom = '4px';
    progressLog.appendChild(logEntry);
    progressLog.scrollTop = progressLog.scrollHeight;
    
    // Atualizar barra de progresso baseado em porcentagem
    const percentMatch = data.match(/(\d+\.?\d*)%/);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
      if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(percent)}%`;
      }
    }
  });
}

// Sistema de notificações
function showNotification(title, message, type = 'info') {
  // Notificação do sistema (se permitido)
  if ('Notification' in window && Notification.permission === 'granted') {
    const iconMap = {
      success: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%2310b981" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23ef4444" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      info: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%233b82f6" d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg>'
    };
    
    new Notification(title, {
      body: message,
      icon: iconMap[type] || iconMap.info
    });
  }
}

// Solicitar permissão para notificações
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Atalho: Enter no campo URL inicia download
if (urlInput && downloadBtn) {
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !downloadBtn.disabled) {
      downloadBtn.click();
    }
  });
}

// Validação em tempo real da URL
if (urlInput) {
  urlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      urlInput.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    } else {
      urlInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }
  });
}

// ===== GERENCIAMENTO DE PLAYLIST =====

// Fechar modal
if (closePlaylistBtn) {
  closePlaylistBtn.addEventListener('click', closePlaylistModal);
}

if (cancelPlaylistBtn) {
  cancelPlaylistBtn.addEventListener('click', closePlaylistModal);
}

function closePlaylistModal() {
  if (playlistModal) {
    playlistModal.style.display = 'none';
    currentPlaylistVideos = [];
    selectedVideoUrls = [];
  }
}

// Fechar ao clicar fora
if (playlistModal) {
  playlistModal.addEventListener('click', (e) => {
    if (e.target === playlistModal) {
      closePlaylistModal();
    }
  });
}

// Selecionar/Desselecionar todos
if (selectAllPlaylistBtn) {
  selectAllPlaylistBtn.addEventListener('click', () => {
    const checkboxes = playlistContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = true;
      cb.closest('.playlist-video-item').classList.add('checked');
    });
    updatePlaylistCount();
  });
}

if (deselectAllPlaylistBtn) {
  deselectAllPlaylistBtn.addEventListener('click', () => {
    const checkboxes = playlistContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = false;
      cb.closest('.playlist-video-item').classList.remove('checked');
    });
    updatePlaylistCount();
  });
}

// Playlist agora é carregada ao clicar em "Baixar Agora" se a URL for uma playlist

// Função para buscar vídeos da playlist
// Função para buscar vídeos da playlist - COM FEEDBACK DE CARREGAMENTO
async function fetchPlaylistVideos(url) {
  try {
    console.log('Carregando playlist:', url);
    
    if (!playlistModal) {
      console.error('playlistModal não encontrado');
      throw new Error('Elemento modal não encontrado');
    }
    
    // Mostrar modal com animação de carregamento melhorada
    playlistModal.style.display = 'flex';
    
    if (playlistContainer) {
      playlistContainer.innerHTML = `
        <div style="text-align: center; color: #a1a1a1; padding: 40px; width: 100%;">
          <div style="margin-bottom: 16px;">
            <div class="spinner" style="width: 40px; height: 40px; border-width: 3px; margin: 0 auto;"></div>
          </div>
          <div style="font-size: 14px;">Carregando vídeos da playlist...</div>
          <div style="font-size: 12px; margin-top: 8px; opacity: 0.6;">Isso pode levar alguns segundos</div>
        </div>
      `;
    }

    if (!window.electron || !window.electron.fetchPlaylist) {
      throw new Error('window.electron.fetchPlaylist não disponível');
    }

    // Usar Promise.race para timeout de 45 segundos
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao carregar playlist')), 45000)
    );

    const result = await Promise.race([
      window.electron.fetchPlaylist(url),
      timeoutPromise
    ]);

    if (result.success) {
      currentPlaylistVideos = result.videos;
      playlistTitle.textContent = result.playlistTitle || 'Selecione os vídeos';
      
      // Renderizar vídeos com animação
      renderPlaylistVideos(result.videos);
      updatePlaylistCount();
    } else {
      throw new Error(result.error || 'Erro ao carregar playlist');
    }
  } catch (error) {
    console.error('Erro ao carregar playlist:', error);
    if (playlistContainer) {
      playlistContainer.innerHTML = `
        <div style="text-align: center; color: #ef4444; padding: 40px;">
          <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 600; margin-bottom: 4px;">Erro ao carregar</div>
          <div style="font-size: 12px; opacity: 0.8;">${error.message}</div>
        </div>
      `;
    }
  }
}

// Renderizar vídeos com otimização de performance
function renderPlaylistVideos(videos) {
  if (!playlistContainer) return;
  
  playlistContainer.innerHTML = '';
  
  // Usar DocumentFragment para melhor performance
  const fragment = document.createDocumentFragment();
  
  videos.forEach((video, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-video-item';
    
    const duration = video.duration ? formatDuration(video.duration) : '--:--';
    const thumbnail = video.thumbnail || '';
    
    // HTML mais simples e leve
    item.innerHTML = `
      <input type="checkbox" data-url="${video.url}" data-index="${index}">
      ${thumbnail ? `<img src="${thumbnail}" alt="${video.title}" class="playlist-video-thumbnail" loading="lazy">` : '<div style="width: 60px; height: 60px; border-radius: 6px; background: rgba(255,255,255,0.1);"></div>'}
      <div class="playlist-video-info">
        <div class="playlist-video-title" title="${video.title}">${video.title}</div>
        <div class="playlist-video-duration">${duration}</div>
      </div>
    `;
    
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
      updatePlaylistCount();
    });
    
    fragment.appendChild(item);
  });
  
  playlistContainer.appendChild(fragment);
}

// Atualizar contagem de selecionados
function updatePlaylistCount() {
  const selected = playlistContainer?.querySelectorAll('input[type="checkbox"]:checked').length || 0;
  if (playlistCount) {
    playlistCount.textContent = `${selected} selecionado${selected !== 1 ? 's' : ''}`;
  }
}

// Formatar duração
function formatDuration(seconds) {
  if (!seconds) return '--:--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Baixar vídeos selecionados
if (downloadPlaylistBtn) {
  downloadPlaylistBtn.addEventListener('click', async () => {
    const selected = playlistContainer?.querySelectorAll('input[type="checkbox"]:checked') || [];
    
    if (selected.length === 0) {
      showNotification('Erro', 'Selecione pelo menos um vídeo!', 'error');
      return;
    }

    const urls = Array.from(selected).map(cb => cb.dataset.url);
    
    // Fechar modal e iniciar download
    closePlaylistModal();
    
    // Preparar configuração
    const config = {
      urls: urls,
      downloadPath: downloadPathInput.value.trim(),
      mode: currentMode,
      cookieBrowser: cookieBrowserSelect ? cookieBrowserSelect.value || null : null,
      rateLimit: rateLimitInput ? rateLimitInput.value.trim() || null : null,
      downloadSubs: downloadSubsCheckbox ? downloadSubsCheckbox.checked : false
    };

    // Iniciar download
    startPlaylistDownload(config);
  });
}

// Iniciar download de playlist
async function startPlaylistDownload(config) {
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> Baixando...';
  
  if (cancelDownloadBtn) {
    cancelDownloadBtn.style.display = 'block';
  }
  
  if (progressCard) {
    progressCard.classList.add('show');
  }
  if (progressLog) {
    progressLog.innerHTML = '';
  }
  if (progressFill) {
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #ff0000, #ff6b6b, #ff0000)';
  }
  if (progressPercentage) {
    progressPercentage.textContent = '0%';
    progressPercentage.style.color = '#fafafa';
  }
  if (openFolderBtn) {
    openFolderBtn.classList.remove('show');
  }

  try {
    const result = await window.electron.startDownload(config);
    completeDownloadSuccess();
    showNotification('Downloads Concluídos!', `${config.urls.length} vídeos foram baixados com sucesso.`, 'success');
  } catch (error) {
    completeDownloadError(error.message);
    showNotification('Erro no Download', 'Ocorreu um erro durante o download. Verifique os detalhes.', 'error');
  } finally {
    resetDownloadButton();
    if (cancelDownloadBtn) {
      cancelDownloadBtn.style.display = 'none';
    }
  }
}

// Animação de entrada
document.addEventListener('DOMContentLoaded', () => {
  const mainCard = document.querySelector('.main-card');
  if (mainCard) {
    mainCard.style.animation = 'slideIn 0.6s ease';
  }
  
  console.log('App carregado com sucesso!');
  console.log('Elementos encontrados:', {
    urlInput: !!urlInput,
    downloadBtn: !!downloadBtn,
    selectFolderBtn: !!selectFolderBtn,
    videoOption: !!videoOption,
    audioOption: !!audioOption,
    advancedToggle: !!advancedToggle
  });
});