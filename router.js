/* Client-side router built on the History API.
   Routes are { path: "/product/:id", load: () => import("./views/x.js") }.
   Each view module's default export returns { title, element }. */
import { h } from "./utils/dom.js";

function compile(path) {
  const keys = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

export function createRouter({ routes, notFound, outlet, siteName, onNavigate }) {
  const table = routes.map((route) => ({ ...route, ...compile(route.path) }));
  let token = 0;          // ignores results of superseded navigations
  let firstRender = true;

  function match(pathname) {
    for (const route of table) {
      const result = route.pattern.exec(pathname);
      if (result) {
        const params = {};
        route.keys.forEach((key, i) => { params[key] = decodeURIComponent(result[i + 1]); });
        return { route, params };
      }
    }
    return null;
  }

  function errorView(error) {
    return {
      title: "Something went wrong",
      element: h("section", { class: "page" },
        h("h1", null, "Something went wrong"),
        h("p", null, error.message || "The page could not be loaded."),
        h("button", { type: "button", class: "btn", onClick: render }, "Try again")),
    };
  }

  async function render() {
    const mine = ++token;
    const found = match(location.pathname) || { route: notFound, params: {} };
    const query = Object.fromEntries(new URLSearchParams(location.search));
    outlet.setAttribute("aria-busy", "true");

    let view;
    try {
      const module = await found.route.load();     // code-split: loads on demand
      view = await module.default({ params: found.params, query });
    } catch (error) {
      console.error(error);
      view = errorView(error);
    }
    if (mine !== token) return;

    outlet.replaceChildren(view.element);
    outlet.removeAttribute("aria-busy");
    document.title = view.title ? `${view.title} | ${siteName}` : siteName;
    window.scrollTo(0, 0);

    if (!firstRender) {                             // move focus for keyboard and screen-reader users
      const heading = outlet.querySelector("h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
    firstRender = false;
    onNavigate?.(location.pathname);
  }

  function navigate(href) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) {
      location.assign(href);
      return;
    }
    if (url.pathname + url.search === location.pathname + location.search) return;
    history.pushState({}, "", url.pathname + url.search);
    render();
  }

  // one delegated listener turns every <a data-link> into an in-app navigation
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[data-link]");
    if (!link) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  });

  window.addEventListener("popstate", render);   // back / forward buttons

  return { start: render, navigate };
}
