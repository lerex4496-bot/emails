/**
 * MailTrace Extension Popup Controller
 */

const DEFAULT_API_URL = 'https://mailtrace-api-7bx5.onrender.com';
const DEFAULT_DASHBOARD_URL = 'https://emails-web-mu.vercel.app';

const apiUrlInput = document.getElementById('api-url');
const dashboardUrlInput = document.getElementById('dashboard-url');
const autoTrackCheckbox = document.getElementById('auto-track');
const statusIndicator = document.getElementById('status-indicator');
const btnSave = document.getElementById('btn-save');
const btnTest = document.getElementById('btn-test');
const linkDashboard = document.getElementById('link-dashboard');
const msgAlert = document.getElementById('msg-alert');

function showAlert(text, isError = false) {
  msgAlert.style.display = 'block';
  msgAlert.style.color = isError ? '#f87171' : '#34d399';
  msgAlert.textContent = text;
  setTimeout(() => {
    msgAlert.style.display = 'none';
  }, 3000);
}

// 1. Load saved settings
function loadSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['mailtrace_api_url', 'mailtrace_dashboard_url', 'mailtrace_enabled'], (items) => {
      // Use Render API and Vercel dashboard if not set or if still set to the old localhost defaults
      const savedApi = items.mailtrace_api_url;
      const effectiveApi = (!savedApi || savedApi === 'http://localhost:3000') ? DEFAULT_API_URL : savedApi;
      apiUrlInput.value = effectiveApi;

      const savedDash = items.mailtrace_dashboard_url;
      const effectiveDash = (!savedDash || savedDash === 'http://localhost:5173') ? DEFAULT_DASHBOARD_URL : savedDash;
      dashboardUrlInput.value = effectiveDash;

      autoTrackCheckbox.checked = typeof items.mailtrace_enabled === 'boolean' ? items.mailtrace_enabled : true;
      testConnection(apiUrlInput.value);
    });
  } else {
    apiUrlInput.value = DEFAULT_API_URL;
    dashboardUrlInput.value = DEFAULT_DASHBOARD_URL;
    testConnection(DEFAULT_API_URL);
  }
}

// 2. Test Connection
async function testConnection(url) {
  statusIndicator.textContent = 'Checking...';
  statusIndicator.className = 'badge-status';

  const cleanUrl = (url || DEFAULT_API_URL).replace(/\/$/, '');
  try {
    const res = await fetch(`${cleanUrl}/health`);
    if (res.ok) {
      statusIndicator.textContent = 'Connected';
      statusIndicator.className = 'badge-status';
      return true;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    statusIndicator.textContent = 'Offline';
    statusIndicator.className = 'badge-status offline';
    return false;
  }
}

// 3. Save Settings
btnSave.addEventListener('click', () => {
  const apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
  const dashboardUrl = dashboardUrlInput.value.trim().replace(/\/$/, '');
  const enabled = autoTrackCheckbox.checked;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({
      mailtrace_api_url: apiUrl,
      mailtrace_dashboard_url: dashboardUrl,
      mailtrace_enabled: enabled,
    }, () => {
      showAlert('Settings saved successfully!');
      testConnection(apiUrl);
    });
  } else {
    showAlert('Settings saved!');
    testConnection(apiUrl);
  }
});

btnTest.addEventListener('click', async () => {
  const success = await testConnection(apiUrlInput.value);
  if (success) {
    showAlert('Connection verified successfully!');
  } else {
    showAlert('Cannot reach MailTrace API.', true);
  }
});

linkDashboard.addEventListener('click', (e) => {
  e.preventDefault();
  const url = dashboardUrlInput.value.trim() || DEFAULT_DASHBOARD_URL;
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
});

document.addEventListener('DOMContentLoaded', loadSettings);
