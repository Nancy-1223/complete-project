// Shared interactions for every page.
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#primary-navigation");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation.classList.toggle("is-open", !isOpen);
  });
}

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

// This front-end demo validates the form but does not send/store messages.
const contactForm = document.querySelector("#contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = document.querySelector("#form-status");

    if (!contactForm.reportValidity()) {
      status.textContent = "Please check the required fields and try again.";
      return;
    }

    status.textContent = "Thanks! The form is working in demo mode. Connect a backend or form service to receive this message.";
    contactForm.reset();
  });
}
