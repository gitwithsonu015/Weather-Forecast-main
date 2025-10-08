const API_KEY = "121dc95f1fa187b131aee5c1ece5cdbb";
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEOCODING_URL = "https://api.openweathermap.org/geo/1.0/direct";
const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";

document.addEventListener("DOMContentLoaded", () => {
  const locationLabel = document.getElementById("locationLabel");
  const currentTempEl = document.getElementById("currentTemp");
  const currentCondEl = document.getElementById("currentCond");
  const summaryTextEl = document.getElementById("summaryText");
  const forecastCardsEl = document.getElementById("forecastCards");
  const highlightsGridEl = document.getElementById("highlightsGrid");
  const lightBtn = document.getElementById("lightBtn");
  const darkBtn = document.getElementById("darkBtn");
  const celsiusBtn = document.getElementById("celsiusBtn");
  const fahrenheitBtn = document.getElementById("fahrenheitBtn");
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  const favoriteCitiesContainer = document.getElementById("favoriteCities");
  const viewAllBtn = document.getElementById("viewAll");
  const popupContainer = document.getElementById("popupContainer");
  const closeButton = document.querySelector(".close-button");
  const popupCardsGrid = document.getElementById("popupCardsGrid");
  const hourlyChartHeaderEl = document.getElementById("hourlyChartHeader");

  // Hero + loader + footer year
  const welcomeHero = document.getElementById("welcomeHero");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const yearNow = document.getElementById("yearNow");
  if (yearNow) yearNow.textContent = new Date().getFullYear();

  if (welcomeHero) welcomeHero.style.display = "flex";
  let firstRenderDone = false;

  // Minimum hero display (5s)
  const heroMinTimer = new Promise((res) => setTimeout(res, 5000));
  async function hideHeroAfterReady() {
    try {
      await heroMinTimer;
    } finally {
      if (welcomeHero && welcomeHero.style.display !== "none") {
        welcomeHero.classList.add("hide");
        setTimeout(() => { welcomeHero.style.display = "none"; }, 450);
      }
    }
  }

  function showLoader(show) {
    if (!loadingOverlay) return;
    if (show) {
      loadingOverlay.classList.add("show");
      loadingOverlay.setAttribute("aria-hidden", "false");
    } else {
      loadingOverlay.classList.remove("show");
      loadingOverlay.setAttribute("aria-hidden", "true");
    }
  }

  let chartInstance;
  let isCelsius = true;
  let countryCache = {};
  let latestCurrentData = null;
  let latestForecastData = null;
  let latestHourlyData = null;
  let latestOtherCitiesData = [];
  let defaultCities = ["London", "New York", "Tokyo", "Dubai", "Rome", "Sydney", "Paris"];
  let lastCity = "Hyderabad";

  function cToF(c) { return (c * 9) / 5 + 32; }
  function formatTemp(c) { return isCelsius ? `${Math.round(c)}°C` : `${Math.round(cToF(c))}°F`; }

  function getIconForHour(isDay, weatherCode) {
    const code = weatherCode;
    let icon = '';
    const isSunny = isDay === 1;
    if (code === 0) icon = isSunny ? 'fa-sun' : 'fa-moon';
    else if (code > 0 && code < 3) icon = isSunny ? 'fa-cloud-sun' : 'fa-cloud-moon';
    else if (code >= 3 && code < 51) icon = 'fa-cloud';
    else if (code >= 51 && code < 66) icon = 'fa-cloud-rain';
    else if (code >= 66 && code < 80) icon = 'fa-snowflake';
    else if (code >= 80 && code < 95) icon = 'fa-cloud-showers-heavy';
    else if (code >= 95) icon = 'fa-cloud-bolt';
    else icon = 'fa-cloud';
    return `fa-solid ${icon}`;
  }

  async function getCountryName(code) {
    if (!code) return "";
    if (countryCache[code]) return countryCache[code];
    try {
      const res = await fetch(`https://restcountries.com/v3.1/alpha/${code}`);
      if (!res.ok) throw new Error("country fetch failed");
      const data = await res.json();
      const name = data && data[0] && data[0].name && data[0].name.common ? data[0].name.common : code;
      countryCache[code] = name;
      return name;
    } catch {
      return code;
    }
  }

  function getIconInfo(main) {
    const key = (main || "").toLowerCase();
    let icon = "fa-cloud-sun", color = "icon-cloud";
    if (key.includes("clear")) { icon = "fa-sun"; color = "icon-sun"; }
    else if (key.includes("cloud")) { icon = "fa-cloud"; color = "icon-cloud"; }
    else if (key.includes("rain")) { icon = "fa-cloud-showers-heavy"; color = "icon-rain"; }
    else if (key.includes("drizzle")) { icon = "fa-cloud-rain"; color = "icon-rain"; }
    else if (key.includes("snow")) { icon = "fa-snowflake"; color = "icon-snow"; }
    else if (key.includes("thunder")) { icon = "fa-bolt"; color = "icon-storm"; }
    else if (key.includes("mist") || key.includes("fog") || key.includes("haze") || key.includes("smoke")) { icon = "fa-smog"; color = "icon-mist"; }
    return { icon, color };
  }

  async function getCoordsByCityName(city) {
    const res = await fetch(`${GEOCODING_URL}?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`);
    const data = await res.json();
    if (!data || data.length === 0) throw new Error("Geocoding failed for city: " + city);
    return { lat: data[0].lat, lon: data[0].lon, name: data[0].name, country: data[0].country };
  }

  // Reverse geocode lat/lon to a canonical city name (prevents odd local names)
  async function resolveCityName(lat, lon) {
    try {
      const res = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        return { name: data[0].name || "", country: data[0].country || "" };
      }
    } catch {}
    return null;
  }

  async function fetchOpenMeteoData(lat, lon, city) {
    const url = `${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,visibility,surface_pressure,cloud_cover,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || data.reason) throw new Error(data.reason);

    return {
      cod: 200,
      name: city,
      sys: { country: data.country || "" },
      main: {
        temp: data.hourly.temperature_2m[0],
        feels_like: data.hourly.temperature_2m[0],
        pressure: data.hourly.surface_pressure[0],
        humidity: data.hourly.relative_humidity_2m[0],
        temp_min: data.daily.temperature_2m_min[0],
        temp_max: data.daily.temperature_2m_max[0],
      },
      weather: [{ main: data.hourly.weather_code[0] > 0 ? "Cloudy" : "Clear", description: "Weather from Open-Meteo" }],
      wind: { speed: data.hourly.wind_speed_10m[0], deg: 0 },
      clouds: { all: data.hourly.cloud_cover[0] },
      visibility: data.hourly.visibility[0] / 1000,
      timezone: data.timezone_abbreviation || 0,
      coord: { lat: data.latitude, lon: data.longitude },
      list: data.daily.time.map((time, index) => ({
        dt: new Date(time).getTime() / 1000,
        main: {
          temp: (data.daily.temperature_2m_max[index] + data.daily.temperature_2m_min[index]) / 2,
          temp_max: data.daily.temperature_2m_max[index],
          temp_min: data.daily.temperature_2m_min[index],
        },
        weather: [{ main: data.daily.weather_code[index] > 0 ? "Cloudy" : "Clear", description: "Forecast from Open-Meteo" }]
      }))
    };
  }

  async function fetchWeather(city) {
    lastCity = city || lastCity;
    showLoader(true);
    try {
      const currentRes = await fetch(`${BASE_URL}/weather?q=${encodeURIComponent(lastCity)}&units=metric&appid=${API_KEY}`);
      const currentData = await currentRes.json();
      if (currentData.cod !== 200) throw new Error(currentData.message);

      const forecastRes = await fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(lastCity)}&units=metric&appid=${API_KEY}`);
      const forecastData = await forecastRes.json();

      const hourly = await fetchHourly(currentData.coord.lat, currentData.coord.lon);

      latestCurrentData = currentData;
      latestForecastData = forecastData;
      latestHourlyData = hourly;

      if (!latestOtherCitiesData.length) await updateOtherCities(defaultCities);

      await renderUIFromData();
      if (!firstRenderDone) { firstRenderDone = true; hideHeroAfterReady(); }
      searchInput.value = '';
    } catch (err) {
      console.warn("OpenWeatherMap fetch failed, attempting fallback:", err.message);
      try {
        const coords = await getCoordsByCityName(lastCity);
        const fallbackData = await fetchOpenMeteoData(coords.lat, coords.lon, coords.name);
        latestCurrentData = fallbackData;
        latestForecastData = fallbackData;

        await renderUIFromData();
        if (!firstRenderDone) { firstRenderDone = true; hideHeroAfterReady(); }
        if (locationLabel) locationLabel.textContent += " (Fallback)";
        searchInput.value = '';
      } catch (fallbackErr) {
        if (locationLabel) {
          locationLabel.textContent = `Error: ${fallbackErr.message}`;
          if (currentTempEl) currentTempEl.textContent = '--°';
          if (currentCondEl) currentCondEl.textContent = '--';
          if (summaryTextEl) summaryTextEl.textContent = '--';
          if (forecastCardsEl) forecastCardsEl.innerHTML = '';
          if (highlightsGridEl) highlightsGridEl.innerHTML = '';
        }
        console.error("Fallback failed:", fallbackErr);
      }
    } finally {
      showLoader(false);
    }
  }

  async function fetchWeatherByCoords(lat, lon) {
    // No loader; hero remains on first detection
    try {
      const currentRes = await fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
      const currentData = await currentRes.json();
      if (currentData.cod !== 200) throw new Error(currentData.message || "Current data error");

      // Normalize display name using reverse geocoding to avoid small-town labels
      const resolved = await resolveCityName(lat, lon);
      if (resolved && resolved.name) {
        currentData.name = resolved.name;
        currentData.sys = currentData.sys || {};
        currentData.sys.country = resolved.country || currentData.sys.country || "";
      }

      const forecastRes = await fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
      const forecastData = await forecastRes.json();

      const hourly = await fetchHourly(lat, lon);

      latestCurrentData = currentData;
      latestForecastData = forecastData;
      latestHourlyData = hourly;
      lastCity = currentData.name;

      if (!latestOtherCitiesData.length) await updateOtherCities(defaultCities);

      await renderUIFromData();
      if (!firstRenderDone) { firstRenderDone = true; hideHeroAfterReady(); }
    } catch (err) {
      console.warn("Coord fetch failed, falling back to city:", err);
      await fetchWeather(lastCity || "Hyderabad");
    }
  }

  async function fetchHourly(lat, lon) {
    const url = `${OPEN_METEO_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,is_day&forecast_days=1&timezone=auto`;
    const res = await fetch(url);
    return res.json();
  }

  function ymdFromDate(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function toLocalFromUTCSeconds(utcSeconds, tzOffsetSeconds) { return new Date((utcSeconds + tzOffsetSeconds) * 1000); }

  function selectDailySlots(list, tzOffsetSeconds, todayYMD) {
    const byDate = new Map();
    for (const item of list) {
      const local = toLocalFromUTCSeconds(item.dt, tzOffsetSeconds);
      const ymd = ymdFromDate(local);
      if (ymd === todayYMD) continue;
      const hour = local.getUTCHours();
      if (!byDate.has(ymd)) byDate.set(ymd, []);
      byDate.get(ymd).push({ item, hour, local });
    }
    const days = Array.from(byDate.keys()).sort();
    const chosen = [];
    for (const d of days) {
      const slots = byDate.get(d);
      slots.sort((a, b) => Math.abs(a.hour - 12) - Math.abs(b.hour - 12));
      chosen.push(slots[0].item);
      if (chosen.length === 5) break;
    }
    return chosen;
  }

  async function renderUIFromData() {
    if (!latestCurrentData) return;
    const currentData = latestCurrentData;
    const forecastData = latestForecastData;
    const hourlyData = latestHourlyData;

    if (locationLabel) {
      const countryFull = await getCountryName(currentData.sys.country);
      locationLabel.textContent = `${currentData.name}, ${countryFull}`;
    }

    if (currentTempEl) currentTempEl.textContent = formatTemp(currentData.main.temp);
    if (currentCondEl) currentCondEl.textContent = currentData.weather[0].main;
    if (summaryTextEl) summaryTextEl.textContent = currentData.weather[0].description;

    const heroIconEl = document.getElementById("todayIcon");
    if (heroIconEl) {
      const { icon, color } = getIconInfo(currentData.weather[0].main);
      heroIconEl.className = `fa-solid ${icon} ${color} today-bg-icon`;
    }

    if (highlightsGridEl) {
      highlightsGridEl.innerHTML = "";
      const highlights = {
        "Feels Like": { value: formatTemp(currentData.main.feels_like), iconClass: "feels-like", icon: "fa-temperature-half" },
        "Humidity":   { value: `${currentData.main.humidity}%`, iconClass: "humidity", icon: "fa-droplet" },
        "Pressure":   { value: `${currentData.main.pressure} hPa`, iconClass: "pressure", icon: "fa-gauge-high" },
        "Wind":       { value: `${currentData.wind.speed} m/s`, iconClass: "wind", icon: "fa-wind" },
        "Clouds":     { value: `${currentData.clouds.all}%`, iconClass: "clouds", icon: "fa-cloud" },
        "Visibility": { value: currentData.visibility ? (currentData.visibility / 1000).toFixed(1) + " km" : "--", iconClass: "visibility", icon: "fa-eye" },
      };
      for (const [label, data] of Object.entries(highlights)) {
        const card = document.createElement("div");
        card.className = "small-card";
        card.innerHTML = `
          <div class="small-card-top">
            <div class="small-card-icon ${data.iconClass}">
              <i class="fa-solid ${data.icon}"></i>
            </div>
            <div class="small-card-info">
              <div class="label">${label}</div>
            </div>
          </div>
          <div class="value">${data.value}</div>
        `;
        highlightsGridEl.appendChild(card);
      }
    }

    if (forecastCardsEl) {
      forecastCardsEl.innerHTML = "";
      if (forecastData && forecastData.list && Array.isArray(forecastData.list) && forecastData.list.length) {
        const tzOffset = (forecastData.city && typeof forecastData.city.timezone === "number") ? forecastData.city.timezone : (currentData.timezone || 0);
        const nowLocal = new Date(Date.now() + tzOffset * 1000);
        const todayLocalYMD = ymdFromDate(nowLocal);

        let picks = forecastData.list
          .filter(f => {
            const local = toLocalFromUTCSeconds(f.dt, tzOffset);
            const ymd = ymdFromDate(local);
            const hour = local.getUTCHours();
            return ymd !== todayLocalYMD && hour === 12;
          })
          .slice(0, 5);

        if (picks.length < 5) picks = selectDailySlots(forecastData.list, tzOffset, todayLocalYMD);

        picks.forEach((item, idx) => {
          const local = toLocalFromUTCSeconds(item.dt, tzOffset);
          const weekday = local.toLocaleDateString(undefined, { weekday: "long" });
          const longDate = local.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
          const info = getIconInfo(item.weather[0].main);
          const div = document.createElement("div");
          div.className = "fcard enhanced pencil";
          div.style.animationDelay = `${idx * 0.06}s`;
          div.innerHTML = `
            <i class="weather-icon fa-solid ${info.icon} ${info.color}"></i>
            <p style="font-weight:800">${formatTemp(item.main.temp)}</p>
            <div class="f-day">${weekday}</div>
            <div class="f-date">${longDate}</div>
          `;
          forecastCardsEl.appendChild(div);
        });
      } else {
        const msg = document.createElement("div");
        msg.className = "muted";
        msg.textContent = "Forecast unavailable.";
        forecastCardsEl.appendChild(msg);
      }
    }

    if (hourlyData && document.getElementById("tempChart")) updateHourly(hourlyData);
    if (latestOtherCitiesData && latestOtherCitiesData.length) {
      renderOtherCitiesFromData();
    } else {
      await updateOtherCities(defaultCities);
    }
  }

  // ===== Chart (with responsive gradient height) =====
  function updateHourly(data) {
    const tempsC = data.hourly.temperature_2m.slice(0, 8);
    const hours = data.hourly.time.slice(0, 8).map(t => new Date(t).toLocaleTimeString([], { hour: '2-digit' }));
    const weatherCodes = data.hourly.weather_code.slice(0, 8);
    const isDay = data.hourly.is_day.slice(0, 8);
    const temps = isCelsius ? tempsC : tempsC.map(c => cToF(c));

    hourlyChartHeaderEl.innerHTML = '';
    hours.forEach((time, index) => {
      const hourDiv = document.createElement('div');
      hourDiv.className = 'hourly-chart-column';

      const iconDiv = document.createElement('div');
      iconDiv.className = 'icon';
      iconDiv.innerHTML = `<i class="${getIconForHour(isDay[index], weatherCodes[index])}"></i>`;

      const timeDiv = document.createElement('div');
      timeDiv.className = 'time';
      timeDiv.textContent = index === 0 ? 'Now' : time;

      const tempDiv = document.createElement('div');
      tempDiv.className = 'temp';
      tempDiv.textContent = `${Math.round(temps[index])}°`;

      hourDiv.appendChild(timeDiv);
      hourDiv.appendChild(iconDiv);
      hourDiv.appendChild(tempDiv);
      hourlyChartHeaderEl.appendChild(hourDiv);
    });

    const ctx = document.getElementById("tempChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();

    // Responsive gradient height based on canvas size
    const canvas = ctx.canvas;
    const h = canvas.clientHeight || canvas.height || 200;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(93, 80, 198, 0.4)');
    gradient.addColorStop(1, 'rgba(93, 80, 198, 0)');

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours.map((time, index) => index === 0 ? 'Now' : time),
        datasets: [{
          data: temps,
          borderColor: '#5D50C6',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#5D50C6',
          pointBorderWidth: 2,
          pointRadius: 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false, grid: { display: false } },
          y: { display: false, grid: { display: false } }
        },
        elements: { line: { borderWidth: 2 } }
      }
    });
  }

  // ===== Favorites =====
  async function updateOtherCities(cities) {
    latestOtherCitiesData = [];
    for (const city of cities) {
      try {
        const res = await fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`);
        const data = await res.json();
        if (data.cod !== 200) continue;
        latestOtherCitiesData.push(data);
      } catch (err) {
        console.warn("Other city fetch failed:", city, err);
      }
    }
    renderOtherCitiesFromData();
  }

  function renderOtherCitiesFromData() {
    if (!favoriteCitiesContainer) return;
    favoriteCitiesContainer.innerHTML = "";

    latestOtherCitiesData.slice(0, 3).forEach((data) => {
      const div = document.createElement("div");
      div.className = "favorite-card";
      div.innerHTML = `
        <div class="card-content">
          <p class="city-description">${data.weather[0].main}</p>
          <p class="city-info">High: ${formatTemp(data.main.temp_max)} Low: ${formatTemp(data.main.temp_min)}</p>
          <h3 class="city-name">${data.name}</h3>
        </div>
      `;
      favoriteCitiesContainer.appendChild(div);
    });

    if (viewAllBtn) {
      viewAllBtn.style.display = latestOtherCitiesData.length > 3 ? 'block' : 'none';
    }
  }

  function renderPopupCardsFromData() {
    if (!popupCardsGrid) return;
    popupCardsGrid.innerHTML = "";
    latestOtherCitiesData.forEach((data) => {
      const div = document.createElement("div");
      div.className = "favorite-card";
      div.innerHTML = `
        <div class="card-content">
          <p class="city-description">${data.weather[0].main}</p>
          <p class="city-info">High: ${formatTemp(data.main.temp_max)} Low: ${formatTemp(data.main.temp_min)}</p>
          <h3 class="city-name">${data.name}</h3>
        </div>
      `;
      popupCardsGrid.appendChild(div);
    });
  }

  // ===== Location flows =====
  async function fallbackIpGeo() {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const json = await res.json();
      if (json && json.latitude && json.longitude) {
        await fetchWeatherByCoords(json.latitude, json.longitude); // hero stays
      } else {
        await fetchWeather(lastCity || "Hyderabad"); // uses loader
      }
    } catch (e) {
      console.warn("IP Geo fallback failed, using default city:", e);
      await fetchWeather(lastCity || "Hyderabad"); // uses loader
    }
  }

  // Geolocation with watchdog: wait for GPS first, then fallback
  function tryBrowserGeo() {
    if (!("geolocation" in navigator)) return false;
    const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!secure) return false;

    let settled = false;
    const watchdog = setTimeout(async () => {
      if (!settled) { settled = true; await fallbackIpGeo(); }
    }, 8000); // give GPS up to ~8s

    navigator.geolocation.getCurrentPosition(
      async pos => {
        if (!settled) {
          settled = true;
          clearTimeout(watchdog);
          await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        }
      },
      async _err => {
        if (!settled) {
          settled = true;
          clearTimeout(watchdog);
          await fallbackIpGeo();
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
    return true;
  }

  // ===== Events =====
  searchBtn.addEventListener("click", () => {
    const val = searchInput.value.trim().toLowerCase();
    if (val) { showLoader(true); fetchWeather(val); searchInput.value = ''; }
  });

  searchInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
      const val = e.target.value.trim().toLowerCase();
      if (val) { showLoader(true); fetchWeather(val); e.target.value = ''; }
    }
  });

  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      renderPopupCardsFromData();
      if (popupContainer) popupContainer.classList.add("show-popup");
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      if (popupContainer) popupContainer.classList.remove("show-popup");
    });
  }

  if (popupContainer) {
    popupContainer.addEventListener("click", (e) => {
      if (e.target === popupContainer) { popupContainer.classList.remove("show-popup"); }
    });
  }

  if (lightBtn) {
    lightBtn.addEventListener("click", () => {
      document.body.classList.remove("dark");
      lightBtn.classList.add("selected");
      darkBtn.classList.remove("selected");
    });
  }

  if (darkBtn) {
    darkBtn.addEventListener("click", () => {
      document.body.classList.add("dark");
      darkBtn.classList.add("selected");
      lightBtn.classList.remove("selected");
    });
  }

  if (celsiusBtn) {
    celsiusBtn.addEventListener("click", async () => {
      if (!isCelsius) {
        isCelsius = true;
        celsiusBtn.classList.add("selected");
        fahrenheitBtn.classList.remove("selected");
        await renderUIFromData();
      }
    });
  }

  if (fahrenheitBtn) {
    fahrenheitBtn.addEventListener("click", async () => {
      if (isCelsius) {
        isCelsius = false;
        fahrenheitBtn.classList.add("selected");
        celsiusBtn.classList.remove("selected");
        await renderUIFromData();
      }
    });
  }

  const tray = document.querySelector(".forecast-swipe");
  if (tray) tray.classList.add("as-tray");

  const started = tryBrowserGeo();
  if (!started) fallbackIpGeo();
});
