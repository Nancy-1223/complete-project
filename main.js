import { createRouter } from "./router.js";
import { count, subscribe } from "./store.js";

const outlet = document.getElementById("app");
const badge = document.getElementById("cart-count");
const cartLink = document.getElementById("cart-link");

function paintBadge() {
  const n = count();
  badge.textContent = n;
  badge.hidden = n === 0;
  cartLink.setAttribute("aria-label", n === 0 ? "Cart" : `Cart, ${n} ${n === 1 ? "item" : "items"}`);
}
subscribe(paintBadge);
paintBadge();

function markActiveNav(pathname) {
  document.querySelectorAll(".nav a[data-link]").forEach((link) => {
    const target = link.getAttribute("href");
    const active = target === "/" ? pathname === "/" : pathname === target || pathname.startsWith(`${target.replace(/s$/, "")}`);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

const router = createRouter({
  outlet,
  siteName: "Parcel",
  onNavigate: markActiveNav,
  routes: [
    { path: "/", load: () => import("./views/home.js") },
    { path: "/products", load: () => import("./views/catalog.js") },
    { path: "/product/:id", load: () => import("./views/product.js") },
    { path: "/cart", load: () => import("./views/cart.js") },
  ],
  notFound: { load: () => import("./views/notfound.js") },
});

router.start();
