// Script para verificar se o ícone está correto
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, 'assets', 'icon.ico');

console.log('🔍 Verificando ícone...');
console.log('📁 Caminho:', iconPath);

if (fs.existsSync(iconPath)) {
  const stats = fs.statSync(iconPath);
  console.log('✅ Ícone encontrado!');
  console.log('📊 Tamanho:', (stats.size / 1024).toFixed(2), 'KB');
  
  // Verificar se é um .ico válido
  const buffer = fs.readFileSync(iconPath);
  const header = buffer.slice(0, 4);
  
  if (header[0] === 0 && header[1] === 0 && header[2] === 1 && header[3] === 0) {
    console.log('✅ Formato .ico válido!');
    
    // Contar número de imagens no .ico
    const numImages = buffer.readUInt16LE(4);
    console.log('🖼️  Número de tamanhos embutidos:', numImages);
    
    if (numImages < 3) {
      console.warn('⚠️  AVISO: Seu .ico tem apenas', numImages, 'tamanho(s).');
      console.warn('⚠️  Recomendado: pelo menos 3 tamanhos (16x16, 32x32, 256x256)');
      console.warn('⚠️  Use https://icoconvert.com/ para criar um .ico completo');
    } else {
      console.log('✅ Ícone completo com múltiplos tamanhos!');
    }
  } else {
    console.error('❌ ERRO: Arquivo não é um .ico válido!');
    console.error('❌ Converta seu PNG para .ico em: https://icoconvert.com/');
  }
} else {
  console.error('❌ ERRO: Ícone não encontrado em:', iconPath);
  console.error('❌ Certifique-se de que assets/icon.ico existe!');
}

console.log('\n📋 Checklist:');
console.log('  [ ] Ícone em assets/icon.ico');
console.log('  [ ] Formato .ico válido');
console.log('  [ ] Múltiplos tamanhos (16, 32, 48, 64, 128, 256)');
console.log('  [ ] Desinstalou versão antiga do app');
console.log('  [ ] Limpou cache de ícones do Windows');
console.log('  [ ] Reiniciou o Windows (se necessário)');