
"use strict";

// AKR WYNIKI LIVE — strona główna
// Opis i harmonogram z USTAWIENIA_RAJDU

const EVENT_SETTINGS_API =
  "https://script.google.com/macros/s/AKfycbwtcbpTmcDbpIlW7YtfmmWJXyyg1Tgp9M-LS5CepIfh4vtdoHHicTK3MdOQQkjs9Jxb/exec";

const POSTER_FALLBACK =
  "https://drive.google.com/thumbnail?id=1r6W32THSy6I0DQ8HHqJHeI3ALfItRBBT&sz=w1600";

const ENTRIES_API =
  "https://script.google.com/macros/s/AKfycbyST2OYyrzZQopFxjkdqu1zYltvfMpBrpr6SxxlCwFGan07EogO9ovyUkbsPYwpOW3l/exec";

const REGISTRATION_URL =
  "https://script.google.com/macros/s/AKfycbx9VTIRDZ6wSB58qDzcKuUWZLAB0xrfBymjU-v5_iLAsCoQcpAzfned1NMrAZSGDqzQ/exec";

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function jsonp(endpoint, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const callback =
      "AKRhome_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    let finished = false;

    const timer = setTimeout(
      () => finish(new Error("Przekroczono czas oczekiwania")),
      timeoutMs
    );

    function finish(error, payload) {
      if (finished) return;

      finished = true;
      clearTimeout(timer);

      delete window[callback];
      script.remove();

      if (error) {
        reject(error);
      } else {
        resolve(payload);
      }
    }

    window[callback] = payload => finish(null, payload);

    script.onerror = () =>
      finish(new Error("Nie udało się pobrać danych"));

    const url = new URL(endpoint);
    url.searchParams.set("callback", callback);
    url.searchParams.set("t", Date.now());

    script.src = url.href;
    document.head.appendChild(script);
  });
}

function renderSettings(payload) {
  const cfg = payload?.ustawienia_rajdu;

  if (!cfg || typeof cfg !== "object") {
    throw new Error("API nie zwróciło USTAWIENIA_RAJDU");
  }

  if (cfg.pokaz_rajd === false) {
    $("connection").textContent =
      "Organizator nie opublikował jeszcze nowego wydarzenia.";
    return;
  }

  // Nie wyświetlamy danych Wiktorii w karcie Dobrocina.
  if (
    cfg.nazwa &&
    !String(cfg.nazwa)
      .toLocaleLowerCase("pl")
      .includes("dobrocin")
  ) {
    $("connection").textContent =
      "API zwróciło inne wydarzenie. Zachowano kartę Dobrocina.";
    return;
  }

  // Podstawowe informacje o wydarzeniu
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

  // Plakat z ustawień rajdu
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
    const element = $("regulations");

    element.href = rules;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
    element.removeAttribute("aria-disabled");
  }

  // Zapisy
  const registration = $("registration");

  if (
    cfg.zapisy_otwarte === true &&
    registration?.tagName === "BUTTON"
  ) {
    const link = document.createElement("a");

    link.id = "registration";
    link.className = registration.className;
    link.href = REGISTRATION_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    link.innerHTML = registration.innerHTML.replace(
      "ZAPISY ZAMKNIĘTE",
      "ZAPISZ SIĘ"
    );

    registration.replaceWith(link);
  }

  if (cfg.pokaz_liste_zgloszen === false) {
    $("entries").disabled = true;
    $("entries").setAttribute("aria-disabled", "true");
  }

  // OPIS WYDARZENIA I HARMONOGRAM
  // Oba pola są odczytywane z USTAWIENIA_RAJDU.

  const description = $("description-text");
  const schedule = $("schedule-text");

  const opis = String(cfg.opis ?? "").trim();
  const harmonogram = String(cfg.harmonogram ?? "").trim();

  description.textContent =
    opis ||
    "Organizator nie opublikował jeszcze opisu wydarzenia.";

  schedule.textContent = harmonogram
    ? "HARMONOGRAM\n" + harmonogram
    : "";

  $("connection").textContent =
    "Informacje wydarzenia pobrane z USTAWIENIA_RAJDU.";
}

// Właściwy plakat Dobrocina
$("event-poster").src = POSTER_FALLBACK;

$("event-poster").addEventListener("error", () => {
  $("connection").textContent =
    "Nie można wyświetlić plakatu z Google Drive.";
});

// Pobieranie ustawień z Google Sheets przez Apps Script
if (EVENT_SETTINGS_API) {
  jsonp(EVENT_SETTINGS_API)
    .then(renderSettings)
    .catch(() => {
      $("connection").textContent =
        "Nie udało się pobrać ustawień rajdu z Google.";
    });
}

// MENU MOBILNE

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

// OKNO LISTY ZGŁOSZEŃ

const dialog = $("entries-dialog");

function closeDialog() {
  dialog.hidden = true;
}

$("entries-close").addEventListener(
  "click",
  closeDialog
);

dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    closeDialog();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!dialog.hidden) {
      closeDialog();
    }

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
    const payload = await jsonp(ENTRIES_API);

    if (
      payload?.ok !== true ||
      !Array.isArray(payload.crews)
    ) {
      throw new Error("Nieprawidłowa odpowiedź API");
    }

    $("entries-status").textContent =
      "Potwierdzone zgłoszenia: " + payload.crews.length;

    $("entries-list").innerHTML =
      payload.crews.map(crew => `
        <div class="entry">
          <strong>${esc(crew.kierowca)}</strong>
          <div>${esc(crew.pilot)}</div>
          <small>
            ${esc(crew.samochod)} • ${esc(crew.klasa)}
          </small>
        </div>
      `).join("") ||
      "<p>Brak potwierdzonych zgłoszeń.</p>";

  } catch {
    $("entries-status").textContent =
      "Nie udało się pobrać zgłoszeń. Spróbuj ponownie.";
  }
});

// Blokada regulaminu bez poprawnego linku
$("regulations").addEventListener("click", event => {
  if (
    $("regulations").getAttribute("aria-disabled") === "true"
  ) {
    event.preventDefault();
  }
});

// Awaryjny napis, jeśli obraz logo się nie załaduje
const logo = document.querySelector(".brand img");

if (logo) {
  logo.addEventListener("error", () => {
    logo.hidden = true;

    const fallback = document.querySelector(".brand-fallback");

    if (fallback) {
      fallback.style.display = "block";
    }
  });
}
