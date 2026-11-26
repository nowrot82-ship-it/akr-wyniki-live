/* AKR 2.0 — wspólny nagłówek i menu */
(function () {
  "use strict";

  const mount = document.getElementById("akr-shared-header");
  if (!mount) return;

  mount.innerHTML = `
    <header class="akr-topbar">
      <a class="akr-brand" href="/" aria-label="AKR WYNIKI LIVE — strona główna">
        <img src="/akr-logo-stoper.png?v=5" alt="AKR WYNIKI LIVE — system wyników rajdowych">
        <span class="akr-brand-fallback" aria-hidden="true">
          AKR <b>WYNIKI LIVE</b>
        </span>
      </a>

      <button class="akr-hamburger" type="button"
        aria-label="Otwórz menu"
        aria-expanded="false"
        aria-controls="akr-menu-panel">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </header>

    <div class="akr-menu-overlay" hidden></div>

    <aside class="akr-menu-panel"
      id="akr-menu-panel"
      aria-label="Menu nawigacji"
      aria-hidden="true">

      <div class="akr-menu-top">
        <span>AKR <b>WYNIKI LIVE</b></span>
        <button type="button"
          class="akr-menu-close"
          aria-label="Zamknij menu">×</button>
      </div>

      <nav>
        <a href="/">
          ⌂ <span>STRONA GŁÓWNA</span><b>❯</b>
        </a>

        <a href="/test-v2/wyniki-dotychczasowe.html">
          ◷ <span>WYNIKI RAJDÓW</span><b>❯</b>
        </a>

        <a href="/test-v2/wyniki-szczegoly.html?event=live">
          ⚑ <span>WYNIKI LIVE</span><b>❯</b>
        </a>

        <a href="/test-v2/komunikaty.html">
          📢 <span>KOMUNIKATY ORGANIZATORA</span><b>❯</b>
        </a>

        <a href="/test-v2/wyniki-szczegoly.html?view=season">
          🏆 <span>KLASYFIKACJA ROCZNA</span><b>❯</b>
        </a>

        <a href="/test-v2/wyniki-dotychczasowe.html#archiwum">
          ▦ <span>ARCHIWUM WYNIKÓW</span><b>❯</b>
        </a>
      </nav>

      <div class="akr-menu-bottom">
        AKR WYNIKI LIVE 2.0
      </div>
    </aside>
  `;

  const logo = mount.querySelector(".akr-brand img");
  const fallback = mount.querySelector(".akr-brand-fallback");

  function showFallback() {
    logo.style.display = "none";
    fallback.style.display = "block";
  }

  logo.addEventListener("error", showFallback);

  if (logo.complete && !logo.naturalWidth) {
    showFallback();
  }

  const btn = mount.querySelector(".akr-hamburger");
  const overlay = mount.querySelector(".akr-menu-overlay");
  const panel = mount.querySelector(".akr-menu-panel");
  const closeBtn = mount.querySelector(".akr-menu-close");

  let previousFocus = null;

  function toggle(open) {
    overlay.hidden = !open;
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", String(!open));
    btn.setAttribute("aria-expanded", String(open));

    document.body.style.overflow = open ? "hidden" : "";

    if (open) {
      previousFocus = document.activeElement;
      closeBtn.focus();
    } else if (
      previousFocus &&
      typeof previousFocus.focus === "function"
    ) {
      previousFocus.focus();
    }
  }

  btn.addEventListener("click", () => toggle(true));
  closeBtn.addEventListener("click", () => toggle(false));
  overlay.addEventListener("click", () => toggle(false));

  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      panel.classList.contains("open")
    ) {
      toggle(false);
    }
  });

  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      toggle(false);
    });

    const target = new URL(link.href, location.href);

    const normalize = path =>
      path.replace(/\/index\.html$/, "/");

    if (
      normalize(target.pathname) === normalize(location.pathname) &&
      target.search === location.search &&
      target.hash === location.hash
    ) {
      link.setAttribute("aria-current", "page");
    }
  });
})();
