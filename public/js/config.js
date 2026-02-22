// config.js - loads config.json synchronously before everything else

(function () {
  function loadSync(path) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', path, false);
      xhr.send(null);
      if (xhr.status === 200) return JSON.parse(xhr.responseText);
    } catch (e) { console.error('[AirLink] config load failed:', e); }
    return null;
  }

  var isDocsPage = window.location.pathname.indexOf('/docs/') !== -1;
  var configPath = isDocsPage ? '../../config.json' : 'config.json';
  var cfg = loadSync(configPath);

  if (!cfg) {
    cfg = {
      site: {
        title: 'AirLink', versionLabel: 'v1.0.0 beta',
        githubOrg: 'AirlinkLabs', githubPanel: 'AirlinkLabs/panel',
        githubDaemon: 'AirlinkLabs/daemon', discordUrl: 'https://discord.gg/D8YbT9rDqz'
      },
      underConstruction: { enabled: false },
      features: [], addons: [],
      docs: { manifest: [] }
    };
  }

  window.SITE_CONFIG = cfg;

  // apply theme early to prevent flash
  var theme = 'dark';
  try { theme = localStorage.getItem('theme') || 'dark'; } catch(e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
