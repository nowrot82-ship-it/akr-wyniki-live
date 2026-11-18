
'use strict';

const API = 'https://script.google.com/macros/s/AKfycbwtcbpTmcDbpIlW7YtfmmWJXyyg1Tgp9M-LS5CepIfh4vtdoHHicTK3MdOQQkjs9Jxb/exec';
const ENTRIES_API = 'https://script.google.com/macros/s/AKfycbyST2OYyrzZQopFxjkdqu1zYltvfMpBrpr6SxxlCwFGan07EogO9ovyUkbsPYwpOW3l/exec';
const REGISTRATION_URL = 'https://script.google.com/macros/s/AKfycbx9VTIRDZ6wSB58qDzcKuUWZLAB0xrfBymjU-v5_iLAsCoQcpAzfned1NMrAZSGDqzQ/exec';

const $ = id => document.getElementById(id);

const safeUrl = v => {
  try {
    const u = new URL(String(v || ''));
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function jsonp(endpoint, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb = 'AKRhome_' + Date.now() + '_' +
      Math.random().toString(36).slice(2);

    const script = document.createElement('script');
    let done = false;

    const timer = setTimeout(
      () => finish(new Error('Przekroczony czas oczekiwania')),
      timeoutMs
    );

    function finish(err, payload) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      delete window[cb];
      script.remove();
      err ? reject(err) : resolve(payload);
    }

    window[cb] = p => finish(null, p);
    script.onerror = () => finish(new Error('Błąd połączenia'));
    script.src = endpoint + '?callback=' +
      encodeURIComponent(cb) + '&t=' + Date.now();

    document.head.appendChild(script);
  });
}

function renderSettings(payload) {
  const cfg = payload?.ustawienia_rajdu;

  if (!cfg || typeof cfg !== 'object') {
    $('connection').textContent =
      'Nie udało się odczytać ustawień wydarzenia — wyświetlane są dane zapasowe.';
    return;
  }

  if (cfg.pokaz_rajd === false) {
    $('event-title').textContent = 'Wkrótce kolejny rajd';
    $('event-round').textContent = 'Szczegóły wkrótce';
    $('event-poster').hidden = true;
    document.querySelector('.event-actions').hidden = true;
    $('connection').textContent =
      'Organizator nie opublikował jeszcze wydarzenia.';
    return;
  }

  if (cfg.nazwa) $('event-title').textContent = String(cfg.nazwa);
  if (cfg.runda) $('event-round').textContent = String(cfg.runda);
  if (cfg.data) $('event-date').textContent = String(cfg.data);
  if (cfg.miejsce) $('event-place').textContent = String(cfg.miejsce);

  const poster = safeUrl(cfg.plakat_url);
  if (poster) $('event-poster').src = poster;

  const reg = $('registration');

  if (cfg.zapisy_otwarte === true) {
    const a = document.createElement('a');
    a.id = 'registration';
    a.className = reg.className;
    a.href = REGISTRATION_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = reg.innerHTML.replace(
      'ZAPISY ZAMKNIĘTE',
      'ZAPISZ SIĘ'
    );
    reg.replaceWith(a);
  }

  const rules = safeUrl(cfg.regulamin_url);

  if (rules) {
    $('regulations').href = rules;
    $('regulations').target = '_blank';
    $('regulations').rel = 'noopener noreferrer';
    $('regulations').removeAttribute('aria-disabled');
  }

  if (cfg.pokaz_liste_zgloszen === false) {
    $('entries').disabled = true;
    $('entries').setAttribute('aria-disabled', 'true');
  }

  const desc = [cfg.opis, cfg.harmonogram]
    .filter(Boolean)
    .map(String);

  if (desc.length) {
    $('description-text').textContent = desc[0] || '';
    $('schedule-text').textContent = desc.slice(1).join('\n\n');
  }

  $('connection').textContent =
    'Informacje wydarzenia pobrane z systemu AKR.';
}

// Nie pobieramy ustawień Dobrocina z API Wiktorii.
// Właściwy endpoint podłączymy po jego potwierdzeniu.
$('connection').textContent =
  'Dane wydarzenia: wersja testowa. Oczekiwanie na właściwe API Dobrocina.';

// Rozwijany opis i harmonogram.
const infoPanel = $('event-description');

infoPanel.addEventListener('toggle', () => {
  infoPanel.setAttribute(
    'aria-expanded',
    String(infoPanel.open)
  );
});

// Menu mobilne.
const overlay = $('menu-overlay');
const panel = $('menu-panel');
const openBtn = $('open-menu');

function toggleMenu(open) {
  overlay.hidden = !open;
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  openBtn.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) $('close-menu').focus();
  else openBtn.focus();
}

openBtn.onclick = () => toggleMenu(true);
$('close-menu').onclick = () => toggleMenu(false);
overlay.onclick = () => toggleMenu(false);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (panel.classList.contains('open')) {
      toggleMenu(false);
    }
    $('entries-dialog').hidden = true;
  }
});

// Lista potwierdzonych zgłoszeń.
$('entries').onclick = async () => {
  $('entries-dialog').hidden = false;
  $('entries-list').innerHTML = '';
  $('entries-status').textContent =
    'Pobieranie potwierdzonych zgłoszeń…';

  try {
    const p = await jsonp(ENTRIES_API);

    if (p?.ok !== true || !Array.isArray(p.crews)) {
      throw Error('Nieprawidłowa odpowiedź');
    }

    $('entries-status').textContent =
      'Potwierdzone zgłoszenia: ' + p.crews.length +
      ' • tylko opłacone załogi';

    $('entries-list').innerHTML = p.crews.map(z => `
      <div class="entry">
        <strong>${esc(z.kierowca)}</strong>
        <div>${esc(z.pilot)}</div>
        <small>${esc(z.samochod)} • ${esc(z.klasa)}</small>
      </div>
    `).join('') || '<p>Brak potwierdzonych zgłoszeń.</p>';

  } catch {
    $('entries-status').textContent =
      'Nie udało się pobrać zgłoszeń. Spróbuj ponownie.';
  }
};

$('entries-close').onclick = () => {
  $('entries-dialog').hidden = true;
};

$('entries-dialog').addEventListener('click', e => {
  if (e.target === $('entries-dialog')) {
    $('entries-dialog').hidden = true;
  }
});

$('regulations').addEventListener('click', e => {
  if ($('regulations').getAttribute('aria-disabled') === 'true') {
    e.preventDefault();
  }
});
