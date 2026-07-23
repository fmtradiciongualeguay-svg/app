document.addEventListener('DOMContentLoaded', () => {

  // ─── 1. CONFIG DESDE SHEETS (hoja configuracion) ─────────────────────────
  // Se carga primero para tener redes, WA, etc. disponibles
  async function initConfig() {
    try {
      const resp = await fetch(`${CONFIG.APPS_SCRIPT_URL}?hoja=configuracion`);
      const rows = await resp.json();
      // Convertir array [{clave,valor}] a objeto plano
      const cfg = {};
      rows.forEach(r => { if (r.clave) cfg[r.clave.trim()] = (r.valor || '').toString().trim(); });
      return cfg;
    } catch (e) {
      console.error('Config sheets:', e);
      return {};
    }
  }

  // ─── 2. REPRODUCTOR ───────────────────────────────────────────────────────
  const audio        = document.getElementById('audio-stream');
  const btnPlay      = document.getElementById('btn-play');
  const playerStatus = document.getElementById('player-status');
  let isPlaying = false;

  audio.src = CONFIG.STREAM_URL;
  audio.load();

  btnPlay.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO';
      playerStatus.classList.remove('live');
      isPlaying = false;
    } else {
      pauseYouTubePlayer();
      audio.play().catch(e => { playerStatus.textContent = 'Error de conexión'; console.error(e); });
      btnPlay.textContent = '⏸';
      playerStatus.textContent = '🔴 EN VIVO';
      playerStatus.classList.add('live');
      isPlaying = true;
      setupMediaSession();
    }
  });
  audio.addEventListener('error', () => { playerStatus.textContent = 'Sin señal...'; playerStatus.classList.remove('live'); btnPlay.textContent = '▶'; isPlaying = false; });
  audio.addEventListener('ended', () => { playerStatus.textContent = 'PAUSADO'; playerStatus.classList.remove('live'); btnPlay.textContent = '▶'; isPlaying = false; });

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'FM Tradición 97.1', artist: 'Tu radio amiga',
      artwork: [{ src: CONFIG.IMG_LOGO, sizes: '512x512', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play',  () => { audio.play();  btnPlay.textContent='⏸'; playerStatus.textContent='🔴 EN VIVO'; playerStatus.classList.add('live');    isPlaying=true;  });
    navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); btnPlay.textContent='▶'; playerStatus.textContent='PAUSADO';   playerStatus.classList.remove('live'); isPlaying=false; });
  }

  // ─── 3. NAVEGACIÓN ────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // ─── 4. FETCH GENÉRICO ────────────────────────────────────────────────────
  async function fetchData(sheetName) {
    try {
      const resp = await fetch(`${CONFIG.APPS_SCRIPT_URL}?hoja=${sheetName}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return Array.isArray(data) ? data : (data.error ? [] : [data]);
    } catch (err) { console.error(`Error cargando ${sheetName}:`, err); return []; }
  }

  // ─── 5. PANEL LATERAL DE REDES ────────────────────────────────────────────
  function initRedesPanel(cfg) {
    const panel   = document.getElementById('redes-panel');
    const overlay = document.getElementById('redes-overlay');
    const btn     = document.getElementById('redes-btn');
    const close   = document.getElementById('redes-close');

    function openPanel()  { panel.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closePanel() { panel.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; }

    btn.addEventListener('click', openPanel);
    close.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // Swipe para cerrar (deslizar hacia la derecha)
    let startX = 0;
    panel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    panel.addEventListener('touchend',   e => { if (e.changedTouches[0].clientX - startX > 60) closePanel(); }, { passive: true });

    // Logo en el panel
    document.getElementById('redes-logo').src = CONFIG.IMG_LOGO;

    // Rellenar links desde cfg (Sheets) con fallback a CONFIG
    const web = cfg['Pagina web'] ? cfg['descripcion (solo para uso interno)'] || 'https://fmtradicion971.com/' : 'https://fmtradicion971.com/';
    const webUrl  = cfg['Pagina web'] ? 'https://fmtradicion971.com/' : '#';
    const fbUrl   = cfg['facebook_url']  || '#';
    const igUrl   = cfg['instagram_url'] || '#';
    const ytUrl   = cfg['youtube_url']   || '#';
    const waNum   = cfg['whatsapp_numero'] || CONFIG.WHATSAPP_NUM;
    const waMsg   = cfg['whatsapp_mensaje'] || CONFIG.WHATSAPP_MSG;
    const email   = cfg['email_contacto'] || '';

    document.getElementById('link-web').href       = webUrl;
    document.getElementById('link-facebook').href  = fbUrl;
    document.getElementById('link-instagram').href = igUrl;
    document.getElementById('link-youtube').href   = ytUrl;
    document.getElementById('link-whatsapp').href  = `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`;
    document.getElementById('link-email').href     = email ? `mailto:${email}` : '#';
    document.getElementById('txt-web').textContent   = 'fmtradicion971.com';
    document.getElementById('txt-email').textContent = email;

    // Ocultar links sin datos
    if (!fbUrl || fbUrl === '#') document.getElementById('link-facebook').style.display = 'none';
    if (!igUrl || igUrl === '#') document.getElementById('link-instagram').style.display = 'none';
    if (!ytUrl || ytUrl === '#') document.getElementById('link-youtube').style.display   = 'none';
    if (!email)                  document.getElementById('link-email').style.display     = 'none';

    // WA btn flotante
    document.getElementById('wa-btn').href =
      `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`;
  }

  // ─── 6. CLIMA — llamada directa desde el navegador (sin Apps Script) ──────
  // Open-Meteo bloquea llamadas desde los servidores de Google (403).
  // La solución correcta es llamarlo directo desde el browser del usuario.
  async function fetchClima() {
    try {
      const url =
        'https://api.open-meteo.com/v1/forecast' +
        '?latitude=-33.1366&longitude=-59.3136' +
        '&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relative_humidity_2m,precipitation' +
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode' +
        '&timezone=America%2FArgentina%2FBuenos_Aires' +
        '&wind_speed_unit=kmh&forecast_days=4';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) { console.error('Open-Meteo:', e); return null; }
  }

  function interpretarClima(c) {
    if (c===0) return 'Despejado';
    if (c<=2)  return 'Parcialmente nublado';
    if (c<=3)  return 'Nublado';
    if (c<=48) return 'Niebla';
    if (c<=55) return 'Llovizna';
    if (c<=65) return 'Lluvia';
    if (c<=75) return 'Nevada';
    if (c<=82) return 'Chaparrones';
    return 'Tormenta';
  }
  function iconoClima(c) {
    if (c===0) return '☀️'; if (c<=2) return '🌤️'; if (c<=3) return '☁️';
    if (c<=48) return '🌫️'; if (c<=55) return '🌦️'; if (c<=65) return '🌧️';
    if (c<=75) return '❄️'; if (c<=82) return '🌧️'; return '⛈️';
  }

  // ─── 7. WIDGETS ───────────────────────────────────────────────────────────
  async function renderWidgets() {
    // Clima: fetch directo al browser, sin Apps Script
    const climaRaw = await fetchClima();
    const cur = climaRaw?.current;
    const clima = cur ? {
      temperatura: Math.round(cur.temperature_2m),
      sensacion:   Math.round(cur.apparent_temperature),
      humedad:     cur.relative_humidity_2m,
      viento_kmh:  Math.round(cur.windspeed_10m),
      lluvia_mm:   cur.precipitation,
      descripcion: interpretarClima(cur.weathercode),
      icono:       iconoClima(cur.weathercode),
      pronostico:  (climaRaw.daily?.time || []).slice(1,4).map((fecha, i) => ({
        fecha,
        max:    Math.round(climaRaw.daily.temperature_2m_max[i+1]),
        min:    Math.round(climaRaw.daily.temperature_2m_min[i+1]),
        lluvia: climaRaw.daily.precipitation_sum[i+1],
        icono:  iconoClima(climaRaw.daily.weathercode[i+1]),
        desc:   interpretarClima(climaRaw.daily.weathercode[i+1])
      }))
    } : null;

    // Widget banner
    renderWidgetClima(clima);
    renderClimaSectionExt(clima);

    // Ríos — solo manual (scraping hidráulica también da 403 desde GAS)
    const rioManual = await fetchData('rios_manual');
    renderWidgetRios(rioManual);
    renderRiosManual(rioManual);

    // Farmacia
    const farmData = await fetchData('farmacia_turno');
    renderWidgetFarmacia(farmData);
    renderFarmaciaSectionExt(farmData);

    // Publicidades
    renderPublicidades(await fetchData('publicidades'));
  }

  function renderWidgetClima(clima) {
    const el = document.getElementById('widget-clima');
    if (!clima) { el.innerHTML = '<div class="widget-error">🌡️ Sin datos</div>'; return; }
    el.innerHTML = `
      <div class="widget-icon">${clima.icono}</div>
      <div class="widget-body">
        <div class="widget-label">Gualeguay</div>
        <div class="widget-value">${clima.temperatura}°C</div>
        <div class="widget-sub">${clima.descripcion}</div>
      </div>`;
  }

  function renderWidgetRios(data) {
    const el = document.getElementById('widget-rios');
    const ultimo = data && data.length > 0 ? [...data].reverse()[0] : null;
    if (!ultimo) { el.innerHTML = '<div class="widget-error">🌊 Sin datos</div>'; return; }
    el.innerHTML = `
      <div class="widget-icon">🌊</div>
      <div class="widget-body">
        <div class="widget-label">${escHtml(ultimo.estacion || 'Río')}</div>
        <div class="widget-value">${escHtml(String(ultimo.altura))} ${escHtml(ultimo.unidad || 'cm')}</div>
        <div class="widget-sub">${escHtml(ultimo.fecha || '')}</div>
      </div>`;
  }

  function renderWidgetFarmacia(data) {
    const el  = document.getElementById('widget-farmacia');
    const hoy = data && data.find(f => esHoy(f.fecha));
    if (!hoy) { el.innerHTML = '<div class="widget-error">💊 Sin turno hoy</div>'; return; }
    el.innerHTML = `
      <div class="widget-icon">💊</div>
      <div class="widget-body">
        <div class="widget-label">Turno hoy</div>
        <div class="widget-value" style="font-size:.82rem;line-height:1.2">${escHtml(hoy.nombre || hoy['nombre '] || '')}</div>
        <div class="widget-sub">${escHtml(hoy.telefono || hoy[' telefono'] || '')}</div>
      </div>`;
  }

  function renderClimaSectionExt(clima) {
    const el = document.getElementById('clima-ext-content');
    if (!clima) { el.innerHTML = '<p class="empty-msg">Clima no disponible.</p>'; return; }
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const pron = (clima.pronostico || []).map(d => {
      const f = new Date(d.fecha + 'T12:00:00');
      return `<div class="pron-item">
        <div class="pron-dia">${dias[f.getDay()]}</div>
        <div class="pron-icon">${d.icono}</div>
        <div class="pron-temps"><span class="temp-max">${d.max}°</span><span class="temp-min">${d.min}°</span></div>
        <div class="pron-lluvia">${d.lluvia > 0 ? `💧${d.lluvia}mm` : ''}</div>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div class="clima-actual">
        <div class="clima-big-icon">${clima.icono}</div>
        <div class="clima-big-temp">${clima.temperatura}°C</div>
        <div class="clima-desc">${clima.descripcion}</div>
        <div class="clima-detalles">
          <span>🌡️ Sensación ${clima.sensacion}°C</span>
          <span>💧 Humedad ${clima.humedad}%</span>
          <span>💨 Viento ${clima.viento_kmh} km/h</span>
          ${clima.lluvia_mm > 0 ? `<span>🌧️ Lluvia ${clima.lluvia_mm}mm</span>` : ''}
        </div>
      </div>
      ${pron ? `<div class="pronostico-grid">${pron}</div>` : ''}
      <p class="info-source" style="margin-top:8px">Fuente: Open-Meteo · Gratis · Sin registro</p>`;
  }

  function renderRiosManual(data) {
    const el = document.getElementById('rios-manual-content');
    if (!data || !data.length) { el.innerHTML = '<p class="empty-msg">Sin registros cargados aún.<br>Cargalos en la hoja rios_manual del Sheets.</p>'; return; }
    el.innerHTML = [...data].reverse().slice(0,5).map(r => `
      <div class="rio-item">
        <div class="rio-header">
          <span class="rio-nombre">${escHtml(r.estacion || '—')}</span>
          <span class="rio-fecha">${escHtml(r.fecha || '')}</span>
        </div>
        <div class="rio-altura">${escHtml(String(r.altura || ''))} ${escHtml(r.unidad || 'cm')}</div>
        ${r.fuente      ? `<div class="rio-obs">📡 ${escHtml(r.fuente)}</div>`      : ''}
        ${r.observacion ? `<div class="rio-obs">💬 ${escHtml(r.observacion)}</div>` : ''}
      </div>`).join('');
  }

  function renderFarmaciaSectionExt(data) {
    const el = document.getElementById('farmacia-ext-content');
    if (!data || !data.length) { el.innerHTML = '<p class="empty-msg">Sin datos. Cargalos en el Sheets.</p>'; return; }
    // Normalizar nombres de columna (tienen espacios en el Sheets actual)
    const norm = data.map(f => ({
      nombre:      f.nombre      || f['nombre ']     || '',
      direccion:   f.direccion   || f['direccion ']  || '',
      telefono:    f.telefono    || f[' telefono']   || '',
      fecha:       f.fecha       || '',
      horario:     f.horario     || '',
      observacion: f.observacion || f['observacion ']|| '',
    }));
    const hoy      = norm.filter(f => esHoy(f.fecha));
    const proximos = norm.filter(f => !esHoy(f.fecha) && esFuturo(f.fecha)).slice(0,4);
    let html = hoy.length
      ? `<div class="farmacia-hoy">${hoy.map(f => tarjetaFarmacia(f,true)).join('')}</div>`
      : '<p class="empty-msg">Sin farmacia de turno para hoy.</p>';
    if (proximos.length)
      html += `<h4 class="subsection-title">Próximos turnos</h4>${proximos.map(f => tarjetaFarmacia(f,false)).join('')}`;
    el.innerHTML = html;
  }

  function tarjetaFarmacia(f, esHoyFlag) {
    return `<div class="farmacia-card ${esHoyFlag ? 'farmacia-hoy-card' : ''}">
      ${esHoyFlag ? '<div class="farmacia-badge">HOY</div>' : `<div class="farmacia-fecha">${escHtml(f.fecha)}</div>`}
      <div class="farmacia-nombre">${escHtml(f.nombre)}</div>
      <div class="farmacia-dir">📍 ${escHtml(f.direccion)}</div>
      ${f.telefono  ? `<a class="farmacia-tel" href="tel:${escHtml(f.telefono)}">📞 ${escHtml(f.telefono)}</a>` : ''}
      ${f.horario   ? `<div class="farmacia-horario">🕐 ${escHtml(f.horario)}</div>` : ''}
      ${f.observacion ? `<div class="farmacia-obs">${escHtml(f.observacion)}</div>` : ''}
    </div>`;
  }

  // ─── 8. SLIDER PUBLICIDADES ───────────────────────────────────────────────
  let pubTimer = null, pubIdx = 0;
  function renderPublicidades(data) {
    const wrap  = document.getElementById('pub-slider');
    const track = document.getElementById('pub-track');
    const dots  = document.getElementById('pub-dots');
    const activas = (data || []).filter(p => p.imagen_url && p.imagen_url.trim());
    if (!activas.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    track.innerHTML = dots.innerHTML = '';
    activas.forEach((pub, i) => {
      const slide = document.createElement('a');
      slide.className = 'pub-slide';
      slide.href   = pub.link_url?.trim() || '#';
      slide.target = pub.link_url?.trim() ? '_blank' : '_self';
      slide.rel    = 'noopener';
      slide.innerHTML = `<img src="${escHtml(pub.imagen_url)}" alt="${escHtml(pub.anunciante || 'Publicidad')}">`;
      if (!pub.link_url?.trim()) slide.addEventListener('click', e => e.preventDefault());
      track.appendChild(slide);
      const dot = document.createElement('button');
      dot.className = 'pub-dot' + (i===0?' active':'');
      dot.setAttribute('aria-label', `Publicidad ${i+1}`);
      dot.addEventListener('click', () => goToPub(i));
      dots.appendChild(dot);
    });
    goToPub(0);
    if (pubTimer) clearInterval(pubTimer);
    pubTimer = setInterval(() => goToPub((pubIdx+1) % activas.length), 4000);
  }
  function goToPub(idx) {
    pubIdx = idx;
    const track = document.getElementById('pub-track');
    document.querySelectorAll('.pub-dot').forEach((d,i) => d.classList.toggle('active', i===idx));
    if (track) track.style.transform = `translateX(${-idx*100}%)`;
  }

  // ─── 9. YOUTUBE ───────────────────────────────────────────────────────────
  async function renderYouTube() {
    const data = await fetchData('youtube');
    if (!data.length) return;
    const enVivo   = data.filter(v => v.tipo === 'en_vivo');
    const grabados = data.filter(v => v.tipo === 'grabado');

    if (enVivo.length) activarBannerLive(enVivo[0]);

    const liveList = document.getElementById('yt-live-list');
    liveList.innerHTML = '';
    if (!enVivo.length) {
      liveList.innerHTML = '<p class="empty-msg">No hay streams en vivo ahora.<br>El banner rojo aparecerá cuando haya transmisión.</p>';
    } else {
      enVivo.forEach(v => {
        const card = document.createElement('div');
        card.className = 'yt-live-card';
        card.innerHTML = `
          <div class="yt-live-badge">🔴 EN VIVO</div>
          <div class="yt-thumb-wrap">
            <img class="yt-thumb" src="https://img.youtube.com/vi/${escHtml(v.video_id)}/mqdefault.jpg" alt="${escHtml(v.titulo)}">
            <div class="yt-play-overlay">▶</div>
          </div>
          <div class="yt-card-info">
            <div class="yt-card-title">${escHtml(v.titulo)}</div>
            <div class="yt-card-desc">${escHtml(v.descripcion||'')}</div>
            <div class="yt-card-actions">
              <button class="yt-btn-watch">▶ Ver en la app</button>
              <a class="yt-btn-yt" href="https://youtube.com/watch?v=${escHtml(v.video_id)}" target="_blank" rel="noopener">↗ YouTube</a>
            </div>
          </div>`;
        card.querySelector('.yt-btn-watch').addEventListener('click', () => loadYouTubePlayer(v.video_id, v.titulo, true));
        card.querySelector('.yt-thumb-wrap').addEventListener('click', () => loadYouTubePlayer(v.video_id, v.titulo, true));
        liveList.appendChild(card);
      });
    }

    const recGrid = document.getElementById('yt-recorded-list');
    recGrid.innerHTML = '';
    if (!grabados.length) {
      recGrid.innerHTML = '<p class="empty-msg">No hay videos grabados cargados aún.</p>';
    } else {
      grabados.forEach(v => {
        const card = document.createElement('div');
        card.className = 'yt-rec-card';
        card.innerHTML = `
          <div class="yt-thumb-wrap">
            <img class="yt-thumb" src="https://img.youtube.com/vi/${escHtml(v.video_id)}/mqdefault.jpg" alt="${escHtml(v.titulo)}">
            <div class="yt-play-overlay">▶</div>
          </div>
          <div class="yt-rec-info">
            <div class="yt-card-title">${escHtml(v.titulo)}</div>
            <div class="yt-card-meta">${escHtml(v.fecha||'')} ${v.duracion ? '· '+escHtml(v.duracion) : ''}</div>
            <div class="yt-card-desc">${escHtml(v.descripcion||'')}</div>
          </div>`;
        card.addEventListener('click', () => loadYouTubePlayer(v.video_id, v.titulo, false));
        recGrid.appendChild(card);
      });
    }

    document.querySelectorAll('.yt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.yt-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ytab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('ytab-' + tab.dataset.ytab).classList.add('active');
      });
    });
  }

  function activarBannerLive(video) {
    const banner = document.getElementById('live-banner');
    document.getElementById('live-banner-title').textContent = (video.titulo || 'FM TRADICIÓN EN VIVO').toUpperCase();
    document.getElementById('live-banner-sub').textContent   = video.descripcion || 'Tocá para ver la transmisión';
    banner.style.display = 'block';
    document.getElementById('live-cta-btn').onclick = () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector('[data-target="youtube"]').classList.add('active');
      document.getElementById('youtube').classList.add('active');
      loadYouTubePlayer(video.video_id, video.titulo, true);
    };
  }

  function loadYouTubePlayer(videoId, titulo, isLive) {
    const wrapper   = document.getElementById('yt-player-wrapper');
    const container = document.getElementById('yt-container');
    const label     = document.getElementById('yt-playing-label');
    if (isPlaying) { audio.pause(); btnPlay.textContent='▶'; playerStatus.textContent='PAUSADO (YouTube)'; playerStatus.classList.remove('live'); isPlaying=false; }
    container.innerHTML = `<iframe id="yt-iframe" width="100%" height="100%"
      src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${isLive?1:0}&origin=${encodeURIComponent(window.location.origin)}"
      frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    label.textContent = isLive ? `🔴 EN VIVO — ${titulo}` : `▶ ${titulo}`;
    label.className   = 'yt-playing-label' + (isLive ? ' is-live' : '');
    wrapper.style.display = 'block';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('yt-close-btn').onclick = () => { container.innerHTML=''; wrapper.style.display='none'; };
  }

  function pauseYouTubePlayer() {
    const iframe = document.getElementById('yt-iframe');
    if (iframe?.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}), '*');
  }

  // ─── 10. PROGRAMACIÓN ─────────────────────────────────────────────────────
  async function renderProgramacion() {
    const data = await fetchData('programacion');
    const el   = document.getElementById('prog-list');
    el.innerHTML = '';
    if (!data.length) { el.innerHTML = '<p class="empty-msg">No hay programación disponible.</p>'; return; }
    const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const now   = new Date();
    const today = dias[now.getDay()];
    const cur   = now.getHours() + now.getMinutes()/60;
    data.forEach(item => {
      const dArr = (item.dias_emision||'').split(',').map(d=>d.trim());
      let live = false;
      if (dArr.includes(today) && item.hora_inicio && item.hora_fin) {
        // Las horas pueden venir como "HH:MM" o como objeto Time serializado "HH:MM:SS"
        const parseH = s => { const p = String(s).split(':'); return Number(p[0]) + Number(p[1]||0)/60; };
        const s = parseH(item.hora_inicio), e2 = parseH(item.hora_fin);
        const end = e2 < s ? e2+24 : e2;
        if (cur >= s && cur < end) live = true;
      }
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${escHtml(item.programa)} ${live ? '<span class="live-badge">● EN VIVO</span>' : ''}</h3>
        <p><strong>Locutor/a:</strong> ${escHtml(item.locutor)}</p>
        <p class="meta">${escHtml(item.dias_emision)} | ${escHtml(String(item.hora_inicio||''))} – ${escHtml(String(item.hora_fin||''))}</p>
        <p>${escHtml(item.descripcion||'')}</p>`;
      el.appendChild(div);
    });
  }

  // ─── 11. AUDIOTECA ────────────────────────────────────────────────────────
  async function renderAudioteca() {
    const data = await fetchData('audioteca');
    const el   = document.getElementById('audio-list');
    el.innerHTML = '';
    if (!data.length) { el.innerHTML = '<p class="empty-msg">No hay audios disponibles.</p>'; return; }
    data.forEach(item => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${escHtml(item.titulo)}</h3>
        <p class="meta">${escHtml(item.fecha||'')} | ⏱ ${escHtml(String(item.duracion||''))}</p>
        <audio controls style="width:100%;margin-top:8px;" src="${escHtml(item.url_audio||'')}"></audio>
        <p style="margin-top:8px;">${escHtml(item.descripcion||'')}</p>`;
      el.appendChild(div);
    });
  }

  // ─── 12. GALERÍA ──────────────────────────────────────────────────────────
  async function renderGaleria() {
    const data = await fetchData('galeria');
    const el   = document.getElementById('gallery-container');
    el.innerHTML = '';
    if (!data.length) { el.innerHTML = '<p class="empty-msg">No hay imágenes disponibles.</p>'; return; }
    const idx = {};
    data.forEach((item,i) => {
      if (!item.url_imagen) return;
      const urls = item.url_imagen.split(',').map(u=>u.trim()).filter(Boolean);
      const wrap = document.createElement('div');
      wrap.className='slider-wrapper'; wrap.id=`slider-${i}`;
      if (urls.length===1) {
        wrap.innerHTML=`<img src="${urls[0]}" alt="${escHtml(item.pie_de_foto)}" style="width:100%;display:block;">
          <div class="slider-caption">${escHtml(item.pie_de_foto)}</div>`;
      } else {
        idx[i]=0;
        wrap.innerHTML=`<div class="slider-track">${urls.map(u=>`<div class="slider-slide"><img src="${u}" alt="Galería"></div>`).join('')}</div>
          <button class="slider-btn prev">❮</button><button class="slider-btn next">❯</button>
          <div class="slider-caption">${escHtml(item.pie_de_foto)}</div>`;
        const track=wrap.querySelector('.slider-track'), slides=track.querySelectorAll('.slider-slide');
        wrap.querySelector('.prev').addEventListener('click',()=>{idx[i]=Math.max(0,idx[i]-1);track.style.transform=`translateX(${-idx[i]*100}%)`;});
        wrap.querySelector('.next').addEventListener('click',()=>{idx[i]=Math.min(slides.length-1,idx[i]+1);track.style.transform=`translateX(${-idx[i]*100}%)`;});
      }
      el.appendChild(wrap);
    });
  }

  // ─── UTILIDADES ───────────────────────────────────────────────────────────
  function escHtml(s) {
    if (s==null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function parseFecha(s) {
    if (!s) return null;
    const m1 = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return new Date(+m1[3],+m1[2]-1,+m1[1]);
    const m2 = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return new Date(+m2[1],+m2[2]-1,+m2[3]);
    return null;
  }
  function esHoy(s) {
    const d=parseFecha(s), h=new Date();
    return d && d.getDate()===h.getDate() && d.getMonth()===h.getMonth() && d.getFullYear()===h.getFullYear();
  }
  function esFuturo(s) {
    const d=parseFecha(s);
    return d && d >= new Date(new Date().setHours(0,0,0,0));
  }

  // ─── ACTIVOS ESTÁTICOS ────────────────────────────────────────────────────
  document.getElementById('header-logo').src  = CONFIG.IMG_LOGO;
  document.getElementById('player-cover').src = CONFIG.IMG_LOGO;
  document.querySelector('.hero').style.backgroundImage =
    `linear-gradient(rgba(139,0,0,0.7),rgba(139,0,0,0.7)),url('${CONFIG.IMG_HERO}')`;

  // ─── ARRANQUE ─────────────────────────────────────────────────────────────
  initConfig().then(cfg => {
    initRedesPanel(cfg);
    // WA con número del Sheets si está disponible
    const waNum = cfg['whatsapp_numero'] || CONFIG.WHATSAPP_NUM;
    const waMsg = cfg['whatsapp_mensaje'] || CONFIG.WHATSAPP_MSG;
    document.getElementById('wa-btn').href = `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`;
  });

  renderWidgets();
  renderYouTube();
  renderProgramacion();
  renderAudioteca();
  renderGaleria();
});
