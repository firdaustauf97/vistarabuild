(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;

  const themeButton = document.getElementById("themeButton");
  const themeText = document.getElementById("themeText");
  const themeIcon = document.getElementById("themeIcon");

  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;

    const dark = theme === "dark";
    themeText.textContent = dark ? "Light mode" : "Dark mode";
    themeIcon.innerHTML = dark ? "&#9728;" : "&#9790;";

    localStorage.setItem("vistara-theme", theme);
  }

  applyTheme(localStorage.getItem("vistara-theme") || getSystemTheme());

  themeButton.addEventListener("click", function () {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  const viewButtons = document.querySelectorAll(".view-button");

  function applyView(view) {
    body.classList.remove("view-auto", "view-mobile", "view-desktop");
    body.classList.add("view-" + view);

    viewButtons.forEach(function (button) {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    localStorage.setItem("vistara-view", view);
  }

  applyView(localStorage.getItem("vistara-view") || "auto");

  viewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyView(button.dataset.view);
    });
  });

  const menuButton = document.getElementById("menuButton");
  const mobileMenu = document.getElementById("mobileMenu");

  menuButton.addEventListener("click", function () {
    const open = mobileMenu.classList.toggle("open");
    menuButton.textContent = open ? "âœ•" : "â˜°";
    menuButton.setAttribute("aria-expanded", String(open));
  });

  mobileMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      mobileMenu.classList.remove("open");
      menuButton.textContent = "â˜°";
      menuButton.setAttribute("aria-expanded", "false");
    });
  });

  const whatsapp = body.dataset.whatsapp || "";

  function openWhatsApp(message) {
    if (!whatsapp) {
      alert("Nomor WhatsApp belum diisi melalui panel admin.");
      document.getElementById("kontak").scrollIntoView({
        behavior: "smooth"
      });
      return;
    }

    const url =
      "https://wa.me/" +
      whatsapp +
      "?text=" +
      encodeURIComponent(message);

    window.open(url, "_blank", "noopener,noreferrer");
  }

  document.querySelectorAll(".wa-link").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();

      openWhatsApp(
        link.dataset.message ||
        "Halo Vistara Build, saya ingin berkonsultasi."
      );
    });
  });

  const surveyForm = document.getElementById("surveyForm");

  surveyForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const data = new FormData(surveyForm);

    const message = [
      "Halo Vistara Build, saya ingin mengajukan survei.",
      "",
      "Nama: " + data.get("name"),
      "Lokasi: " + data.get("location"),
      "Kebutuhan: " + data.get("service"),
      "Keterangan: " + data.get("message")
    ].join("\n");

    openWhatsApp(message);
  });

  document.getElementById("year").textContent =
    new Date().getFullYear();
})();
