
"use strict";

// AKR WYNIKI LIVE 2.0
// Strona główna — ustawienia rajdu z Google Sheets

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

function asText(value) {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return "";
  }

  return String(value).trim();
}

function isTrue(value) {
  return value === true ||
    value === 1 ||
    String(value).trim().toLowerCase() === "true" ||
    String(value).trim().toLowerCase() === "tak";
}

function isFalse(value) {
  return value === false ||
    value === 0 ||
    String(value).trim().toLowerCase() === "false" ||
    String(value).trim().toLowerCase() === "nie";
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

    const timer = setTimeout(() => {
      finish(new Error("JSONP: przekroczono czas oczekiwania"));
    }, timeoutMs);

    function finish(error, payload) {
      if (finished) return;

      finished = true;
      clearTimeout(timer);

      try {
        delete window[callback];
      } catch {
        window[callback] = undefined;
      }

      script.remove();

      if (error) {
        reject(error);
      } else {
        resolve(payload);
      }
    }

    window[callback] = payload => finish(null, payload);

    script.onerror = () => {
      finish(new Error("JSONP: skrypt nie został załadowany"));
    };

    const url = new URL(endpoint);
    url.searchParams.set("callback", callback);
    url.searchParams.set("t", Date.now());

    script.src = url.href;
    document.head.appendChild(script);
  });
}

async function fetchJson(endpoint, timeoutMs = 12000) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const url = new URL(endpoint);
    url.searchParams.set("t", Date.now());

    const response = await fetch(url.href, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function findSettings(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("API nie zwróciło obiektu z danymi");
  }

  if (payload.ok === false) {
    throw new Error(
      "API zgłosiło błąd: " +
      asText(payload.error || payload.message || "brak szczegółów")
    );
  }

  const candidates = [
    payload.ustawienia_rajdu,
    payload.ustawieniaRajdu,
    payload.settings,
    payload.ustawienia,
    payload.rajd,
    payload.data?.ustawienia_rajdu,
    payload.data?.ustawienia,
    payload.data?.settings,
    payload.data,
    payload
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    if (
      "opis" in candidate ||
      "harmonogram" in candidate ||
      "nazwa" in candidate ||
      "plakat_url" in candidate ||
      "pokaz_rajd" in candidate
    ) {
      return candidate;
    }
  }

  const keys = Object.keys(payload).slice(0, 12).join(", ");

  throw new Error(
    "Nie znaleziono ustawień rajdu. Pola API: " +
    (keys || "brak")
  );
}

function setConnection(message) {
  const element = $("connection");

  if (element) {
    element.textContent = message;
  }
}

function renderSettings(payload) {
  const cfg = findSettings(payload);

  if (isFalse(cfg.pokaz_rajd)) {
    setConnection(
      "Organizator nie opublikował jeszcze nowego wydarzenia."
    );
    return;
  }

  const name = asText(cfg.nazwa);

  // Nie podmieniamy karty Dobrocina danymi innego rajdu.
  if (
    name &&
    !name.toLocaleLowerCase("pl").includes("dobrocin")
  ) {
    setConnection(
      "API zwróciło inne wydarzenie: " +
      name +
      ". Zachowano kartę Dobrocina."
    );
    return;
  }

  const title = $("event-title");
  const round = $("event-round");
  const date = $("event-date");
  const place = $("event-place");

  if (name && title) {
    title.textContent = name;
  }

  if (cfg.runda && round) {
    round.textContent = asText(cfg.runda);
  }

  if (cfg.data && date) {
    date.textContent = asText(cfg.data);
  }

  if (cfg.miejsce && place) {
    place.textContent = asText(cfg.miejsce);
  }

  const poster = safeUrl(cfg.plakat_url);

  if (poster && $("event-poster")) {
    $("event-poster").src = poster;
  }

  const rules = safeUrl(cfg.regulamin_url);
  const regulations = $("regulations");

  if (rules && regulations) {
    regulations.href = rules;
    regulations.target = "_blank";
    regulations.rel = "noopener noreferrer";
    regulations.removeAttribute("aria-disabled");
  }

  const registration = $("registration");

  if (
    isTrue(cfg.zapisy_otwarte) &&
    registration &&
    registration.tagName === "BUTTON"
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

  if (isFalse(cfg.pokaz_liste_zgloszen) && $("entries")) {
    $("entries").disabled = true;
    $("entries").setAttribute("aria-disabled", "true");
  }

  // OPIS WYDARZENIA Z ARKUSZA

  const description = $("description-text");
  const schedule = $("schedule-text");

  const opis = asText(
    cfg.opis ??
    cfg.opis_wydarzenia ??
    cfg.opis_rajdu ??
    cfg.description
  );

  const harmonogram = asText(
    cfg.harmonogram ??
    cfg.program ??
    cfg.schedule
  );

  if (description) {
    description.textContent =
      opis ||
      "W ustawieniach rajdu nie znaleziono opisu wydarzenia.";

    description.style.whiteSpace = "pre-line";
  }

  if (schedule) {
    schedule.textContent = harmonogram
      ? "HARMONOGRAM\n" + harmonogram
      : "";

    schedule.style.whiteSpace = "pre-line";
  }

  if (opis || harmonogram) {
    setConnection(
      "Połączono."
    );
  } else {
    setConnection(
      "Połączono z API, ale pola opis i harmonogram są puste " +
      "lub nie zostały udostępnione."
    );
  }
}

async function loadEventSettings() {
  setConnection("Łączenie z ustawieniami organizatora…");

  const errors = [];

  try {
    const payload = await fetchJson(EVENT_SETTINGS_API);
    renderSettings(payload);
    return;
  } catch (error) {
    errors.push("JSON: " + error.message);
  }

  try {
    const payload = await jsonp(EVENT_SETTINGS_API);
    renderSettings(payload);
    return;
  } catch (error) {
    errors.push("JSONP: " + error.message);
  }

  setConnection(
    "Nie udało się pobrać ustawień rajdu. " +
    errors.join(" | ")
  );

  const description = $("description-text");

  if (description) {
    description.textContent =
      "Opis nie został pobrany z arkusza. " +
      "Szczegóły błędu znajdują się pod kartą wydarzenia.";
  }
}

// PLAKAT

const eventPoster = $("event-poster");

if (eventPoster) {
  eventPoster.src = POSTER_FALLBACK;

  eventPoster.addEventListener("error", () => {
    setConnection(
      "Nie można wyświetlić plakatu z Google Drive."
    );
  });
}

// START POBIERANIA USTAWIEŃ

loadEventSettings();

// MENU MOBILNE

const overlay = $("menu-overlay");
const panel = $("menu-panel");
const openBtn = $("open-menu");
const closeBtn = $("close-menu");

function toggleMenu(open) {
  if (!overlay || !panel || !openBtn) return;

  overlay.hidden = !open;

  panel.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));

  openBtn.setAttribute("aria-expanded", String(open));

  document.body.style.overflow = open ? "hidden" : "";

  const focusTarget = open ? closeBtn : openBtn;

  if (focusTarget) {
    focusTarget.focus();
  }
}

if (openBtn) {
  openBtn.addEventListener("click", () => {
    toggleMenu(true);
  });
}

if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    toggleMenu(false);
  });
}

if (overlay) {
  overlay.addEventListener("click", () => {
    toggleMenu(false);
  });
}

// LISTA ZGŁOSZEŃ

const dialog = $("entries-dialog");

function closeDialog() {
  if (dialog) {
    dialog.hidden = true;
  }
}

const entriesClose = $("entries-close");

if (entriesClose) {
  entriesClose.addEventListener("click", closeDialog);
}

if (dialog) {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (dialog && !dialog.hidden) {
      closeDialog();
    }

    if (panel && panel.classList.contains("open")) {
      toggleMenu(false);
    }
  }
});

const entriesButton = $("entries");

if (entriesButton) {
  entriesButton.addEventListener("click", async () => {
    if (!dialog) return;

    dialog.hidden = false;

    const list = $("entries-list");
    const status = $("entries-status");

    if (list) {
      list.innerHTML = "";
    }

    if (status) {
      status.textContent =
        "Pobieranie potwierdzonych zgłoszeń…";
    }

    try {
      const payload = await jsonp(ENTRIES_API);

      if (
        payload?.ok !== true ||
        !Array.isArray(payload.crews)
      ) {
        throw new Error("Nieprawidłowa odpowiedź API");
      }

      if (status) {
        status.textContent =
          "Potwierdzone zgłoszenia: " +
          payload.crews.length;
      }

      if (list) {
        list.innerHTML =
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
      }

    } catch {
      if (status) {
        status.textContent =
          "Nie udało się pobrać zgłoszeń. Spróbuj ponownie.";
      }
    }
  });
}

// REGULAMIN

const regulationsLink = $("regulations");

if (regulationsLink) {
  regulationsLink.addEventListener("click", event => {
    if (
      regulationsLink.getAttribute("aria-disabled") === "true"
    ) {
      event.preventDefault();
    }
  });
}

// AWARYJNE LOGO

const logo = document.querySelector(".brand img");

if (logo) {
  logo.addEventListener("error", () => {
    logo.hidden = true;

    const fallback =
      document.querySelector(".brand-fallback");

    if (fallback) {
      fallback.style.display = "block";
    }
  });
}
