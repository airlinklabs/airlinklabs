// install.js - quick/manual installer switcher

function initInstallWizard() {
  var wrap = document.getElementById('install-wrap');
  if (!wrap) return;

  var sel = wrap.querySelector('.install-choice-grid');
  var quickPanel = wrap.querySelector('.install-panel[data-panel="quick"]');
  var manualPanel = wrap.querySelector('.install-panel[data-panel="manual"]');

  function showPanel(panel) {
    sel.style.display = 'none';
    quickPanel.style.display = 'none';
    manualPanel.style.display = 'none';
    panel.style.display = 'block';
    panel.style.animation = 'fadeInPanel 0.28s ease';
  }

  function showSel() {
    sel.style.display = 'flex';
    quickPanel.style.display = 'none';
    manualPanel.style.display = 'none';
  }

  var btnQ = wrap.querySelector('.btn-quick');
  var btnM = wrap.querySelector('.btn-manual');
  if (btnQ) btnQ.addEventListener('click', function () { showPanel(quickPanel); });
  if (btnM) btnM.addEventListener('click', function () { showPanel(manualPanel); });

  wrap.querySelectorAll('.btn-back').forEach(function (b) {
    b.addEventListener('click', showSel);
  });
}

// add fadeInPanel keyframes dynamically
var _panelStyle = document.createElement('style');
_panelStyle.textContent = '@keyframes fadeInPanel { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }';
document.head.appendChild(_panelStyle);

initInstallWizard();
