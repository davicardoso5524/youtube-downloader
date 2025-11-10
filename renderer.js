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

// Debug: verificar se electron está disponível
console.log('Window.electron disponível:', !!window.electron);
if (!window.electron) {
  console.error('ERRO: window.electron não está disponível! Verifique o preload.js');
}

// Configurações padrão - detectar sistema operacional pelo userAgent
let defaultPath;
if (navigator.userAgent.includes('Windows')) {
  defaultPath = 'C:\\Users\\conta\\Downloads';
} else if (navigator.userAgent.includes('Mac')) {
  defaultPath = '/Users/' + (navigator.userAgent.match(/Mac OS X/) ? 'usuario' : 'usuario') + '/Downloads';
} else {
  defaultPath = '/home/usuario/Downloads';
}

if (downloadPathInput) {
  downloadPathInput.value = defaultPath;
  updateFolderDisplay(defaultPath);
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

    // Preparar configuração
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
      if (progressFill) progressFill.style.width = '100%';
      if (progressPercentage) progressPercentage.textContent = '100%';
      
      // Ocultar spinner e mostrar mensagem de sucesso
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
      
      // Notificação
      showNotification('Download Concluído!', 'Seu vídeo foi baixado com sucesso.', 'success');
    } catch (error) {
      // Erro
      if (progressFill) {
        progressFill.style.width = '100%';
        progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      }
      if (progressPercentage) {
        progressPercentage.textContent = 'Erro';
        progressPercentage.style.color = '#fafafa';
      }
      
      // Ocultar spinner e mostrar mensagem de erro
      const spinner = document.querySelector('.progress-status .spinner');
      if (spinner) spinner.style.display = 'none';
      
      const statusTitle = document.querySelector('.progress-status h3');
      if (statusTitle) {
        statusTitle.innerHTML = '❌ Erro';
        statusTitle.style.color = '#ef4444';
      }
      
      if (progressLog) {
        progressLog.innerHTML += `\n<div style="color: #ef4444; font-weight: 600; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-top: 10px;">❌ Erro: ${error.message}</div>\n`;
      }
      
      // Notificação de erro
      showNotification('Erro no Download', 'Ocorreu um erro durante o download. Verifique os detalhes.', 'error');
    } finally {
      // Reabilitar botão
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
  });
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