"use strict";

/* =========================================================
   CONFIG
   Open-Meteo is free and needs no API key.
   ========================================================= */
var GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
var TIMEOUT_MS = 10000;
var STORAGE_KEY = "weather.last.v1";

// WMO weather codes -> label + icon
var WEATHER_CODES = {
  0: ["Clear sky", "\u2600\uFE0F"],
  1: ["Mainly clear", "\uD83C\uDF24\uFE0F"],
  2: ["Partly cloudy", "\u26C5"],
  3: ["Overcast", "\u2601\uFE0F"],
  45: ["Fog", "\uD83C\uDF2B\uFE0F"],
  48: ["Rime fog", "\uD83C\uDF2B\uFE0F"],
  51: ["Light drizzle", "\uD83C\uDF26\uFE0F"],
  53: ["Drizzle", "\uD83C\uDF26\uFE0F"],
  55: ["Heavy drizzle", "\uD83C\uDF27\uFE0F"],
  56: ["Freezing drizzle", "\uD83C\uDF27\uFE0F"],
  57: ["Freezing drizzle", "\uD83C\uDF27\uFE0F"],
  61: ["Light rain", "\uD83C\uDF26\uFE0F"],
  63: ["Rain", "\uD83C\uDF27\uFE0F"],
  65: ["Heavy rain", "\uD83C\uDF27\uFE0F"],
  66: ["Freezing rain", "\uD83C\uDF27\uFE0F"],
  67: ["Freezing rain", "\uD83C\uDF27\uFE0F"],
  71: ["Light snow", "\uD83C\uDF28\uFE0F"],
  73: ["Snow", "\u2744\uFE0F"],
  75: ["Heavy snow", "\u2744\uFE0F"],
  77: ["Snow grains", "\u2744\uFE0F"],
  80: ["Light showers", "\uD83C\uDF26\uFE0F"],
  81: ["Showers", "\uD83C\uDF27\uFE0F"],
  82: ["Violent showers", "\u26C8\uFE0F"],
  85: ["Snow showers", "\uD83C\uDF28\uFE0F"],
  86: ["Heavy snow showers", "\uD83C\uDF28\uFE0F"],
  95: ["Thunderstorm", "\u26C8\uFE0F"],
  96: ["Thunderstorm with hail", "\u26C8\uFE0F"],
  99: ["Thunderstorm with hail", "\u26C8\uFE0F"]
};

/* =========================================================
   STATE
   ========================================================= */
var state = {
  units: "metric",   // "metric" | "imperial"
  place: null,       // { name, admin1, country, latitude, longitude }
  controller: null   // AbortController of the request in flight
};

/* =========================================================
   ELEMENTS
   ========================================================= */
var $ = function (id) { return document.getElementById(id); };
var form = $("search-form");
var cityInput = $("city");
var statusEl = $("status");
var matchesEl = $("matches");
var currentEl = $("current");
var forecastSection = $("forecast-section");
var forecastEl = $("forecast");

/* =========================================================
   NETWORK  (fetch + async/await + typed errors)
   ========================================================= */
function AppError(message, kind) {
  this.name = "AppError";
  this.message = message;
  this.kind = kind;
}
AppError.prototype = Object.create(Error.prototype);

async function fetchJSON(url, signal) {
  var timeoutId;
  var timeout = new Promise(function (_, reject) {
    timeoutId = setTimeout(function () {
      reject(new AppError("The weather service took too long to respond. Try again.", "timeout"));
    }, TIMEOUT_MS);
  });

  try {
    var response = await Promise.race([fetch(url, { signal: signal }), timeout]);

    if (!response.ok) {
      if (response.status === 429) {
        throw new AppError("Too many requests. Wait a moment and try again.", "rate");
      }
      if (response.status >= 500) {
        throw new AppError("The weather service is having problems. Try again later.", "server");
      }
      throw new AppError("The request failed (error " + response.status + ").", "http");
    }

    try {
      return await response.json();
    } catch (parseErr) {
      throw new AppError("The service sent data this app could not read.", "parse");
    }
  } catch (err) {
    if (err instanceof AppError) { throw err; }
    if (err.name === "AbortError") { throw err; }
    // fetch() rejects with a TypeError when the network is down or blocked
    throw new AppError("Could not reach the weather service. Check your internet connection.", "network");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchCities(name, signal) {
  var url = GEO_URL + "?name=" + encodeURIComponent(name) + "&count=5&language=en&format=json";
  var data = await fetchJSON(url, signal);
  // when nothing matches, the API omits "results" entirely
  return Array.isArray(data.results) ? data.results : [];
}

async function getWeather(place, units, signal) {
  var params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: 5,
    temperature_unit: units === "imperial" ? "fahrenheit" : "celsius",
    wind_speed_unit: units === "imperial" ? "mph" : "kmh"
  });
  var data = await fetchJSON(FORECAST_URL + "?" + params.toString(), signal);

  // validate the nested shape before rendering
  if (!data || !data.current || !data.daily || !Array.isArray(data.daily.time)) {
    throw new AppError("The service returned incomplete weather data.", "shape");
  }
  return data;
}

/* =========================================================
   PARSING  – turn the nested JSON into flat view models
   ========================================================= */
function describe(code) {
  return WEATHER_CODES[code] || ["Unknown", "\uD83C\uDF21\uFE0F"];
}

function parseCurrent(data) {
  var c = data.current;
  var u = data.current_units || {};
  var info = describe(c.weather_code);
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    wind: Math.round(c.wind_speed_10m),
    tempUnit: u.temperature_2m || "\u00B0",
    windUnit: u.wind_speed_10m || "",
    label: info[0],
    icon: info[1],
    time: c.time
  };
}

function parseDaily(data) {
  var d = data.daily;
  return d.time.map(function (date, i) {
    var info = describe(d.weather_code[i]);
    return {
      date: date,
      label: info[0],
      icon: info[1],
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null
    };
  });
}

/* =========================================================
   RENDER
   ========================================================= */
function setStatus(message, kind) {
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.className = "status";
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = "status status--" + (kind || "info");
}

function placeLabel(place) {
  var parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) { parts.push(place.admin1); }
  if (place.country) { parts.push(place.country); }
  return parts.join(", ");
}

function weekday(isoDate, index) {
  if (index === 0) { return "Today"; }
  var parts = isoDate.split("-");
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function renderWeather(place, data) {
  var cur = parseCurrent(data);
  var days = parseDaily(data);

  $("place").textContent = placeLabel(place);
  $("icon").textContent = cur.icon;
  $("condition").textContent = cur.label;
  $("local-time").textContent = "Local time " + cur.time.slice(11, 16);
  $("temp").textContent = cur.temp + cur.tempUnit;
  $("feels").textContent = cur.feels + cur.tempUnit;
  $("humidity").textContent = cur.humidity + "%";
  $("wind").textContent = cur.wind + " " + cur.windUnit;
  currentEl.hidden = false;

  forecastEl.textContent = "";
  var fragment = document.createDocumentFragment();
  days.forEach(function (day, i) {
    var li = document.createElement("li");
    li.className = "day";

    var name = document.createElement("p");
    name.className = "day__name";
    name.textContent = weekday(day.date, i);

    var icon = document.createElement("p");
    icon.className = "day__icon";
    icon.textContent = day.icon;
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", day.label);

    var temps = document.createElement("p");
    temps.className = "day__temps";
    temps.textContent = day.max + "\u00B0 / " + day.min + "\u00B0";

    li.appendChild(name);
    li.appendChild(icon);
    li.appendChild(temps);

    if (day.rain !== null && day.rain !== undefined) {
      var rain = document.createElement("p");
      rain.className = "day__rain";
      rain.textContent = day.rain + "% rain";
      li.appendChild(rain);
    }
    fragment.appendChild(li);
  });
  forecastEl.appendChild(fragment);
  forecastSection.hidden = false;
}

function renderMatches(results) {
  matchesEl.textContent = "";
  results.forEach(function (place) {
    var li = document.createElement("li");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "match";
    btn.textContent = placeLabel(place);
    btn.dataset.index = String(matchesEl.children.length);
    li.appendChild(btn);
    matchesEl.appendChild(li);
  });
  matchesEl.hidden = false;
}

function hideResults() {
  currentEl.hidden = true;
  forecastSection.hidden = true;
  matchesEl.hidden = true;
}

/* =========================================================
   CONTROLLER
   ========================================================= */
function newRequest() {
  if (state.controller) { state.controller.abort(); }   // cancel the stale request
  state.controller = new AbortController();
  return state.controller.signal;
}

function reportError(err) {
  if (err && err.name === "AbortError") { return; }     // superseded by a newer request
  hideResults();
  setStatus(err instanceof AppError ? err.message : "Something went wrong. Please try again.", "error");
}

async function loadWeather(place) {
  var signal = newRequest();
  state.place = place;
  matchesEl.hidden = true;
  setStatus("Loading weather for " + place.name + "\u2026", "info");
  try {
    var data = await getWeather(place, state.units, signal);
    if (signal.aborted) { return; }
    renderWeather(place, data);
    setStatus("");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(place)); } catch (e) {}
  } catch (err) {
    reportError(err);
  }
}

async function handleSearch(name) {
  var query = name.trim();
  if (query.length < 2) {
    hideResults();
    setStatus("Enter at least 2 characters of a city name.", "error");
    return;
  }
  var signal = newRequest();
  hideResults();
  setStatus("Searching for \u201C" + query + "\u201D\u2026", "info");
  try {
    var results = await searchCities(query, signal);
    if (signal.aborted) { return; }
    if (results.length === 0) {
      setStatus("No city found for \u201C" + query + "\u201D. Check the spelling or try a nearby city.", "error");
      return;
    }
    if (results.length > 1) {
      setStatus("Several places match. Choose one:", "info");
      renderMatches(results);
      matchesEl._results = results;
      return;
    }
    await loadWeather(results[0]);
  } catch (err) {
    reportError(err);
  }
}

/* =========================================================
   EVENTS
   ========================================================= */
form.addEventListener("submit", function (event) {
  event.preventDefault();
  handleSearch(cityInput.value);
});

// delegated: one listener for every match button
matchesEl.addEventListener("click", function (event) {
  var btn = event.target.closest(".match");
  if (!btn) { return; }
  var place = matchesEl._results[Number(btn.dataset.index)];
  if (place) { loadWeather(place); }
});

document.querySelector(".units").addEventListener("click", function (event) {
  var btn = event.target.closest(".units__btn");
  if (!btn || btn.dataset.units === state.units) { return; }
  state.units = btn.dataset.units;
  document.querySelectorAll(".units__btn").forEach(function (b) {
    var on = b === btn;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  if (state.place) { loadWeather(state.place); }
});

/* =========================================================
   INIT  – reopen the last searched city, if any
   ========================================================= */
(function init() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}
  if (saved && typeof saved.latitude === "number" && typeof saved.longitude === "number") {
    cityInput.value = saved.name || "";
    loadWeather(saved);
  } else {
    setStatus("Search for a city to see its current weather.", "info");
  }
})();
