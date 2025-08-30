// ======= Configuration =======
// Use this test key until your personal key activates, then replace it.
const API_KEY = "43f0d50b0aac42d37f1bb1f8f2b56ae9";

// ======= Utilities =======
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function kph(ms) { return Math.round(ms * 3.6); } // meters/sec -> km/h
function c(v) { return Math.round(v); }

// Weather icon url
function iconUrl(code, size = "2x") {
  const suffix = size === "4x" ? "@4x.png" : size === "2x" ? "@2x.png" : ".png";
  return `https://openweathermap.org/img/wn/${code}${suffix}`;
}

// ======= Theme / Background =======
function setBodyByWeather(main) {
  const b = document.body;
  b.classList.remove("bg-clear","bg-clouds","bg-rain","bg-snow","bg-thunder","bg-drizzle");
  const map = {
    Clear: "bg-clear",
    Clouds: "bg-clouds",
    Rain: "bg-rain",
    Snow: "bg-snow",
    Thunderstorm: "bg-thunder",
    Drizzle: "bg-drizzle"
  };
  if (map[main]) b.classList.add(map[main]);
}

function setThemeFromStorage() {
  const saved = localStorage.getItem("theme") || "auto";
  document.body.classList.add("theme-auto");
  if (saved === "dark") document.documentElement.setAttribute("data-theme","dark");
  if (saved === "light") document.documentElement.setAttribute("data-theme","light");
}

function attachThemeToggle() {
  const btn = document.getElementById("toggleThemeBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const current = localStorage.getItem("theme") || "auto";
    const next = current === "dark" ? "light" : current === "light" ? "auto" : "dark";
    localStorage.setItem("theme", next);
    alert(`Theme set to: ${next}`);
  });
}

function attachLocationButtons() {
  const btn1 = document.getElementById("useLocationBtn");
  const btn2 = document.getElementById("quickLocation");
  const handler = () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const { latitude: lat, longitude: lon } = coords;
      const data = await fetchCurrentByCoords(lat, lon);
      const container = document.getElementById("topCities");
      if (container) container.insertAdjacentHTML("afterbegin", createWeatherCard(data, true));
      setBodyByWeather(data.weather?.[0]?.main);
    }, () => alert("Failed to get location"));
  };
  if (btn1) btn1.addEventListener("click", handler);
  if (btn2) btn2.addEventListener("click", handler);
}

// ======= Date / Time =======
function updateDateTime() {
  const el = document.getElementById("dateTime");
  if (!el) return;
  el.textContent = new Date().toLocaleString();
  setTimeout(updateDateTime, 1000);

}

// ======= OpenWeather: Current & Forecast =======
async function fetchCurrent(city) {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
  return fetchJSON(url);
}
async function fetchCurrentByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  return fetchJSON(url);
}
async function fetchForecast(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  return fetchJSON(url);
}
async function geocodeCity(q, limit=5) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${API_KEY}`;
  return fetchJSON(url);
}

// Pick around midday for each date
function reduceTo3DayForecast(list) {
  const days = {};
  for (const item of list) {
    const [date, time] = item.dt_txt.split(" ");
    if (!days[date]) days[date] = item;
    if (time === "12:00:00") days[date] = item;
  }
  return Object.values(days).slice(0, 3);
}

// ======= Rendering =======
function createWeatherCard(data, compact=false) {
  if (!data || data.cod && +data.cod !== 200) return `<div class="card">City not found.</div>`;

  const name = `${data.name || ""}${data.sys && data.sys.country ? ", " + data.sys.country : ""}`;
  const weather = data.weather?.[0] || { main:"", description:"" };
  const main = data.main || {};
  const wind = data.wind || {};
  const clouds = data.clouds || {};

  const icon = weather.icon ? `<img class="weather-icon" src="${iconUrl(weather.icon, '4x')}" alt="">` : "";
  const meta = `
    <div class="meta">
      <div>Wind: ${kph(wind.speed||0)} km/h</div>
      <div>Humidity: ${main.humidity ?? 0}%</div>
      <div>Clouds: ${clouds.all ?? 0}%</div>
    </div>`;

  const favBtn = `<button class="btn-secondary" onclick="addToFavorites('${data.name}')">Save</button>`;

  return `<div class="card">
    <div class="city">${name}</div>
    ${icon}
    <div class="temp">${c(main.temp)}°C</div>
    <div class="desc">${weather.description || ""}</div>
    ${meta}
    ${favBtn}
  </div>`;
}

function createForecastCards(items) {
  return items.map(d => {
    const date = new Date(d.dt_txt);
    const day = date.toLocaleDateString(undefined, { weekday: "short", month:"short", day:"numeric" });
    return `<div class="forecast-card">
      <div class="forecast-date">${day}</div>
      <img class="weather-icon" src="${iconUrl(d.weather[0].icon)}" alt="">
      <div class="forecast-temp">${c(d.main.temp)}°C</div>
      <div class="desc">${d.weather[0].description}</div>
    </div>`;
  }).join("");
}

// ======= Dashboard =======
async function loadTopCities(cities) {
  const container = document.getElementById("topCities");
  const highlight = document.getElementById("highlightCards");
  if (!container) return;
  container.innerHTML = "";
  let list = [];
  try {
    const results = await Promise.allSettled(cities.map(c => fetchCurrent(c)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        list.push(r.value);
        container.insertAdjacentHTML("beforeend", createWeatherCard(r.value));
      }
    }
    // Highlights
    if (highlight && list.length) {
      const hottest = list.reduce((a,b) => (a.main.temp > b.main.temp ? a : b));
      const coldest = list.reduce((a,b) => (a.main.temp < b.main.temp ? a : b));
      const windiest = list.reduce((a,b) => ((a.wind.speed||0) > (b.wind.speed||0) ? a : b));
      setBodyByWeather(list[0]?.weather?.[0]?.main);

      highlight.innerHTML = `
        <div class="card"><div class="city">Hottest</div><div class="temp">${hottest.name}: ${c(hottest.main.temp)}°C</div></div>
        <div class="card"><div class="city">Coldest</div><div class="temp">${coldest.name}: ${c(coldest.main.temp)}°C</div></div>
        <div class="card"><div class="city">Windiest</div><div class="temp">${windiest.name}: ${kph(windiest.wind.speed)} km/h</div></div>
      `;
    }
  } catch(e) {
    container.innerHTML = `<div class="card">Failed to load top cities.</div>`;
  }
}

// ======= Search =======
function bindSearch() {
  const input = document.getElementById("cityInput");
  const btn = document.getElementById("searchBtn");
  const suggest = document.getElementById("suggestions");
  const runSearch = async (q) => {
    const res = await geocodeCity(q || input.value.trim(), 5);
    if (!res.length) return;
    const best = res[0];
    const cityFull = `${best.name}${best.state ? ", " + best.state : ""}, ${best.country}`;
    await showCityByCoords(best.lat, best.lon, cityFull);
    saveRecentSearch(cityFull);
    suggest.innerHTML = "";
  };

  if (btn) btn.addEventListener("click", () => runSearch());
  if (input) {
    input.addEventListener("input", async () => {
      const q = input.value.trim();
      if (q.length < 2) { suggest.innerHTML=""; return; }
      const res = await geocodeCity(q, 6);
      suggest.innerHTML = res.map(r => {
        const label = `${r.name}${r.state ? ", " + r.state : ""}, ${r.country}`;
        return `<li data-lat="${r.lat}" data-lon="${r.lon}" data-label="${label}">${label}</li>`;
      }).join("");
    });
    suggest?.addEventListener("click", async (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      const lat = +li.dataset.lat, lon = +li.dataset.lon, label = li.dataset.label;
      await showCityByCoords(lat, lon, label);
      saveRecentSearch(label);
      suggest.innerHTML = "";
      input.value = label;
    });
  }
}

async function showCityByCoords(lat, lon, labelOverride) {
  const current = await fetchCurrentByCoords(lat, lon);
  if (labelOverride) current.name = labelOverride;
  const resultEl = document.getElementById("searchResult");
  if (resultEl) resultEl.innerHTML = createWeatherCard(current);

  const forecast = await fetchForecast(lat, lon);
  const three = reduceTo3DayForecast(forecast.list);
  const forecastEl = document.getElementById("forecastResult");
  if (forecastEl) forecastEl.innerHTML = createForecastCards(three);
}

// Recent searches
function saveRecentSearch(city) {
  let recent = JSON.parse(localStorage.getItem("recent") || "[]");
  recent = [city, ...recent.filter(c => c !== city)].slice(0, 7);
  localStorage.setItem("recent", JSON.stringify(recent));
  renderRecentSearches();
}
function renderRecentSearches() {
  const list = document.getElementById("recentSearches");
  if (!list) return;
  const recent = JSON.parse(localStorage.getItem("recent") || "[]");
  list.innerHTML = recent.map(c => `<li onclick="quickSearch('${c.replace(/'/g,"\'")}')">${c}</li>`).join("");
}
async function quickSearch(label) {
  const geo = await geocodeCity(label, 1);
  if (!geo.length) return;
  await showCityByCoords(geo[0].lat, geo[0].lon, label);
}

// ======= Favorites =======
function addToFavorites(city) {
  if (!city) return;
  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (!favs.includes(city)) favs.push(city);
  localStorage.setItem("favorites", JSON.stringify(favs));
  alert(`${city} added to favorites`);
}

function removeFromFavorites(city) {
  let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  favs = favs.filter(c => c !== city);
  localStorage.setItem("favorites", JSON.stringify(favs));
  loadFavorites();
}

async function loadFavorites() {
  const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
  const container = document.getElementById("favCities");
  const sel1 = document.getElementById("city1");
  const sel2 = document.getElementById("city2");
  if (sel1 && sel2) {
    sel1.innerHTML = favs.map(c => `<option>${c}</option>`).join("");
    sel2.innerHTML = favs.map(c => `<option>${c}</option>`).join("");
  }
  if (!container) return;
  container.innerHTML = "";
  for (const city of favs) {
    try {
      const cur = await fetchCurrent(city);
      const geo = await geocodeCity(city, 1);
      let forecastHTML = "";
      if (geo.length) {
        const fc = await fetchForecast(geo[0].lat, geo[0].lon);
        forecastHTML = `<div class="forecast-grid">${createForecastCards(reduceTo3DayForecast(fc.list))}</div>`;
      }
      container.insertAdjacentHTML("beforeend",
        `<div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div class="city">${cur.name}, ${cur.sys?.country || ""}</div>
            <button class="btn-secondary" onclick="removeFromFavorites('${city}')">Remove</button>
          </div>
          <img class="weather-icon" src="${iconUrl(cur.weather?.[0]?.icon || '01d','4x')}" alt="">
          <div class="temp">${c(cur.main?.temp)}°C</div>
          <div class="desc">${cur.weather?.[0]?.description || ""}</div>
          <div class="meta">
            <div>Wind: ${kph(cur.wind?.speed||0)} km/h</div>
            <div>Humidity: ${cur.main?.humidity ?? 0}%</div>
            <div>Clouds: ${cur.clouds?.all ?? 0}%</div>
          </div>
          ${forecastHTML}
        </div>`);
    } catch {}
  }
}

function bindCompare() {
  const btn = document.getElementById("compareBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const a = document.getElementById("city1")?.value;
    const b = document.getElementById("city2")?.value;
    if (!a || !b) return;
    const [da, db] = await Promise.all([fetchCurrent(a), fetchCurrent(b)]);
    const result = document.getElementById("comparisonResult");
    if (result) {
      result.innerHTML = `
        <div class="card">
          <div class="city">${da.name}</div>
          <div class="temp">${c(da.main.temp)}°C</div>
          <div class="desc">${da.weather[0].description}</div>
        </div>
        <div class="card">
          <div class="city">${db.name}</div>
          <div class="temp">${c(db.main.temp)}°C</div>
          <div class="desc">${db.weather[0].description}</div>
        </div>`;
    }
    const ctx = document.getElementById("compareChart");
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: [da.name, db.name],
          datasets: [
            { label: "Temperature °C", data: [da.main.temp, db.main.temp] }
          ]
        }
      });
    }
  });
}

// ======= Trends =======
async function loadTrends() {
  const cities = ["Cairo","London","Paris","New York","Tokyo","Sydney","Dubai","Toronto"];
  const results = await Promise.allSettled(cities.map(c => fetchCurrent(c)));
  const list = results.filter(r => r.status === "fulfilled").map(r => r.value);

  // Highlights
  const highlight = document.getElementById("trendHighlights");
  if (highlight && list.length) {
    const hottest = list.reduce((a,b)=> a.main.temp > b.main.temp ? a : b);
    const coldest = list.reduce((a,b)=> a.main.temp < b.main.temp ? a : b);
    const windiest = list.reduce((a,b)=> (a.wind.speed||0) > (b.wind.speed||0) ? a : b);
    highlight.innerHTML = `
      <div class="card"><div class="city">Hottest</div><div class="temp">${hottest.name}: ${c(hottest.main.temp)}°C</div></div>
      <div class="card"><div class="city">Coldest</div><div class="temp">${coldest.name}: ${c(coldest.main.temp)}°C</div></div>
      <div class="card"><div class="city">Windiest</div><div class="temp">${windiest.name}: ${kph(windiest.wind.speed)} km/h</div></div>
    `;
  }

  // Chart
  const chartEl = document.getElementById("trendChart");
  if (chartEl && list.length) {
    new Chart(chartEl, {
      type: "line",
      data: {
        labels: list.map(x => x.name),
        datasets: [{ label: "Temperature °C", data: list.map(x => x.main.temp) }]
      }
    });
  }
}

// ======= Helpers =======
window.addEventListener("load", () => {
  // optional hooks
});
