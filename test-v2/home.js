
"use strict";

// AKR WYNIKI LIVE 2.7
// Strona główna — nadchodzące wydarzenie

const EVENT_SETTINGS_API =
  "https://script.google.com/macros/s/AKfycbwtcbpTmcDbpIlW7YtfmmWJXyyg1Tgp9M-LS5CepIfh4vtdoHHicTK3MdOQQkjs9Jxb/exec";

const POSTER_FALLBACK =
  "https://drive.google.com/thumbnail?id=1r6W32THSy6I0DQ8HHqJHeI3ALfItRBBT&sz=w1600";

const ENTRIES_API =
  "https://script.google.com/macros/s/AKfycbyST2OYyrzZQopFxjkdqu1zYltvfMpBrpr6SxxlCwFGan07EogO9ovyUkbsPYwpOW3l/exec";

const REGISTRATION_URL =
  "https://script.google.com/macros/s/AKfycbx9VTIRDZ6wSB58qDzcKuUWZLAB0xrfBymjU-v5_iLAsCoQcpAzfned1NMrAZSGDqzQ/exec";

const $ = id => document.getElementById(id);

const esc = v =>
  String(v ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
  );

const safeUrl = v => {
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};

function jsonp(endpoint, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cb =
      "AKRhome_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    let done = false;

    const timer = setTimeout(
      () => finish(new Error("Timeout")),
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

    script.onerror = () =>
      finish(new Error("Połączenie nieudane"));

    const url = new URL(endpoint);
    url.searchParams.set("callback", cb);
    url.searchParams.set("t", Date.now());

    script.src = url.href;
    document.head.appendChild(script);
  });
}

function renderSettings(payload) {
  const cfg = payload?.ustawienia_rajdu;

  if (!cfg || typeof cfg !== "object") {
    throw Error("Brak ustawień rajdu w odpowiedzi API");
  }

  if (cfg.pokaz_rajd === false) {
    $("connection").textContent =
      "Organizator nie opublikował jeszcze nowego wydarzenia.";
    return;
  }

  // Zabezpieczenie przed danymi innego rajdu.
  if (
    cfg.nazwa &&
    !String(cfg.nazwa)
      .toLocaleLowerCase("pl")
      .includes("dobrocin")
  ) {
    $("connection").textContent =
      "API udostępnia dane innego rajdu — zachowano kartę Dobrocina.";
    return;
  }

  if (cfg.nazwa) {
    $("event-title").textContent = String(cfg.nazwa);
  }

  if (cfg.runda) {
    $("event-round").textContent = String(cfg.runda);
  }

  if (cfg.data) {
    $("event-date").textContent = String(cfg.data);
  }

  if (cfg.miejsce) {
    $("event-place").textContent = String(cfg.miejsce);
  }

  // Plakat z USTAWIENIA_RAJDU.
  // Nie podmieniamy go, jeżeli API zwróci inny rajd.
  const poster = safeUrl(cfg.plakat_url);

  const isDobrocin = String(cfg.nazwa || "")
    .toLocaleLowerCase("pl")
    .includes("dobrocin");

  if (poster && isDobrocin) {
    $("event-poster").src = poster;
  }

  // Regulamin
  const rules = safeUrl(cfg.regulamin_url);

  if (rules) {
    const el = $("regulations");
    el.href = rules;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
    el.removeAttribute("aria-disabled");
  }

  // Zapisy
  const reg = $("registration");

  if (
    cfg.zapisy_otwarte === true &&
    reg?.tagName === "BUTTON"
  ) {
    const a = document.createElement("a");

    a.id = "registration";
    a.className = reg.className;
    a.href = REGISTRATION_URL;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    a.innerHTML = reg.innerHTML.replace(
      "ZAPISY ZAMKNIĘTE",
      "ZAPISZ SIĘ"
    );

    reg.replaceWith(a);
  }

  if (cfg.pokaz_liste_zgloszen === false) {
    $("entries").disabled = true;
    $("entries").setAttribute("aria-disabled", "true");
  }

  if (cfg.opis) {
    $("description-text").textContent = String(cfg.opis);
  }

  if (cfg.harmonogram) {
    $("schedule-text").textContent =
      "HARMONOGRAM\n" + String(cfg.harmonogram);
  }

  $("connection").textContent =
    "Informacje wydarzenia pobrane z USTAWIENIA_RAJDU.";
}

// Domyślnie właściwy plakat Dobrocina
$("event-poster").src = POSTER_FALLBACK;

$("event-poster").addEventListener("error", () => {
  $("connection").textContent =
    "Nie można wyświetlić plakatu z Google Drive — sprawdź uprawnienia udostępniania.";
});

// Pobieranie ustawień rajdu
if (EVENT_SETTINGS_API) {
  jsonp(EVENT_SETTINGS_API)
    .then(renderSettings)
    .catch(() => {
      $("connection").textContent =
        "Dane organizatora chwilowo niedostępne — pokazujemy kartę Dobrocina.";
    });
} else {
  $("connection").textContent =
    "Plakat z Google Drive. Automatyczne dane rajdu wymagają adresu API ustawień.";
}

// Menu mobilne
const overlay = $("menu-overlay");
const panel = $("menu-panel");
const openBtn = $("open-menu");

function toggleMenu(open) {
  overlay.hidden = !open;

  panel.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));

  openBtn.setAttribute("aria-expanded", String(open));

  document.body.style.overflow = open ? "hidden" : "";

  (open ? $("close-menu") : openBtn).focus();
}

openBtn.addEventListener("click", () => toggleMenu(true));

$("close-menu").addEventListener(
  "click",
  () => toggleMenu(false)
);

overlay.addEventListener(
  "click",
  () => toggleMenu(false)
);

// Lista zgłoszeń
const dialog = $("entries-dialog");

const closeDialog = () => {
  dialog.hidden = true;
};

$("entries-close").addEventListener(
  "click",
  closeDialog
);

dialog.addEventListener("click", e => {
  if (e.target === dialog) closeDialog();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!dialog.hidden) closeDialog();

    if (panel.classList.contains("open")) {
      toggleMenu(false);
    }
  }
});

$("entries").addEventListener("click", async () => {
  dialog.hidden = false;

  $("entries-list").innerHTML = "";

  $("entries-status").textContent =
    "Pobieranie potwierdzonych zgłoszeń…";

  try {
    const p = await jsonp(ENTRIES_API);

    if (
      p?.ok !== true ||
      !Array.isArray(p.crews)
    ) {
      throw Error("Nieprawidłowa odpowiedź");
    }

    $("entries-status").textContent =
      "Potwierdzone zgłoszenia: " + p.crews.length;

    $("entries-list").innerHTML =
      p.crews.map(z => `
        <div class="entry">
          <strong>${esc(z.kierowca)}</strong>
          <div>${esc(z.pilot)}</div>
          <small>
            ${esc(z.samochod)} • ${esc(z.klasa)}
          </small>
        </div>
      `).join("") ||
      "<p>Brak potwierdzonych zgłoszeń.</p>";

  } catch {
    $("entries-status").textContent =
      "Nie udało się pobrać zgłoszeń. Spróbuj ponownie.";
  }
});

// Blokada regulaminu bez adresu
$("regulations").addEventListener("click", e => {
  if (
    $("regulations").getAttribute("aria-disabled") === "true"
  ) {
    e.preventDefault();
  }
});

// Awaryjny napis, gdy logo się nie wczyta
const logo = document.querySelector(".brand img");

logo.addEventListener("error", () => {
  logo.hidden = true;

  document.querySelector(
    ".brand-fallback"
  ).style.display = "block";
});
