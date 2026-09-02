// ═══════════════════════════════════════════════════════════════════
//  TELA CHEIA — compartilhado por Insumos, Produção e o menu
// ═══════════════════════════════════════════════════════════════════
// No tablet, as barras do navegador comem uns 15% da tela e ainda dão
// ao operador um caminho fácil pra sair do sistema no meio da operação.
// Este script tira as barras de duas formas complementares:
//
//   1) Abrindo em tela cheia no primeiro toque (a API de tela cheia
//      exige um gesto do usuário — não dá pra chamar sozinho no load).
//   2) Se o sistema tiver sido "adicionado à tela de início", o
//      manifest.webmanifest já abre sem navegador nenhum e este script
//      só não faz nada.
//
// No desktop não faz sentido — a janela já é a tela — então tudo aqui
// só liga quando o ponteiro é grosso (dedo), não fino (mouse).
(function () {
  'use strict';

  var OPT_OUT = 'zeta_fullscreen_off';
  var doc = document;
  var el = doc.documentElement;

  function ehToque() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  // Já instalado na tela de início: não tem barra pra esconder.
  function ehApp() {
    var mm = window.matchMedia;
    return (mm && (mm('(display-mode: fullscreen)').matches || mm('(display-mode: standalone)').matches))
      || window.navigator.standalone === true;
  }
  function suportado() {
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }
  function ativo() {
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  }
  function recusou() {
    try { return localStorage.getItem(OPT_OUT) === '1'; } catch (e) { return false; }
  }

  function entrar() {
    try {
      var p = el.requestFullscreen
        ? el.requestFullscreen({ navigationUI: 'hide' })
        : (el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null);
      // Navegador pode recusar (falta de gesto, política do dispositivo).
      // Não é erro fatal: a tela continua funcionando normalmente.
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function sair() {
    try {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    } catch (e) {}
  }

  // Se o operador sair da tela cheia de propósito, a escolha dele fica
  // guardada — senão o próximo toque jogaria ele de volta pra lá.
  function alternar() {
    if (ativo()) {
      try { localStorage.setItem(OPT_OUT, '1'); } catch (e) {}
      sair();
    } else {
      try { localStorage.removeItem(OPT_OUT); } catch (e) {}
      entrar();
    }
  }

  if (!suportado() || ehApp() || !ehToque()) return;

  // ── Botão discreto de canto ──
  var btn = doc.createElement('button');
  btn.className = 'zeta-fs-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Tela cheia');
  function pintarBotao() {
    var on = ativo();
    btn.textContent = on ? '✖' : '⛶';
    btn.title = on ? 'Sair da tela cheia' : 'Ver em tela cheia';
    btn.classList.toggle('is-on', on);
  }
  btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); alternar(); });

  function montar() {
    if (!doc.body || doc.body.contains(btn)) return;
    doc.body.appendChild(btn);
    pintarBotao();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', montar);
  else montar();

  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (evt) {
    doc.addEventListener(evt, pintarBotao);
  });

  // ── Entrada automática no primeiro toque ──
  // Usa a fase de captura e não cancela nada: o toque segue normalmente
  // pro botão que o operador realmente quis apertar.
  function primeiroToque() {
    if (!ativo() && !recusou()) entrar();
  }
  doc.addEventListener('pointerdown', primeiroToque, { capture: true, once: true });
  doc.addEventListener('touchstart', primeiroToque, { capture: true, once: true, passive: true });

  window.ZetaTelaCheia = { entrar: entrar, sair: sair, alternar: alternar, ativo: ativo };
})();
