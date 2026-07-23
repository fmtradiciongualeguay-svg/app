document.addEventListener('DOMContentLoaded', () => {

  // ─── 1. ACTIVOS ESTÁTICOS ─────────────────────────────────────────────────
  document.getElementById('header-logo').src  = CONFIG.IMG_LOGO;
  document.getElementById('player-cover').src = CONFIG.IMG_LOGO;
  document.querySelector('.hero').style.backgroundImage =
    `linear-gradient(rgba(139,0,0,0.7),rgba(139,0,0,0.7)),url('${CONFIG.IMG_HERO}')`;
  document.getElementById('wa-btn').href =
    `https://wa.me/${CONFIG.WHATSAPP_NUM}?text=${encodeURIComponent(CONFIG.WHATSAPP_MSG)}`;

  // ─── 2. REPRODUCTOR DE AUDIO ──────────────────────────────────────────────
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

  audio.addEventListener('error', () => {
    playerStatus.textContent = 'Sin señal — reintentando...';
    playerStatus.classList.remove('live');
    btnPlay.textContent = '▶';
    isPlaying = false;
  });

  audio.addEventListener('ended', () => {
    playerStatus.textContent = 'PAUSADO';
    playerStatus.classList.remove('live');
    btnPlay.textContent = '▶';
    isPlaying = false;
  });

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'FM Tradición 97.1', artist: 'Tu radio amiga',
      artwork: [{ src: CONFIG.IMG_LOGO, sizes: '512x512', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play',  () => {
      audio.play(); btnPlay.textContent='⏸';
      playerStatus.textContent='🔴 EN VIVO'; playerStatus.classList.add('live'); isPlaying=true;
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause(); btnPlay.textContent='▶';
      playerStatus.textContent='PAUSADO'; playerStatus.classList.remove('live'); isPlaying=false;
    });
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
    } catch (err) {
      console.error(`Error cargando ${sheetName}:`, err);
      return [];
    }
  }

  // ─── 5. SLIDER DE PUBLICIDADES ────────────────────────────────────────────
  let pubTimer = null;
  let pubIdx   = 0;

  async function renderPublicidades() {
    const data  = await fetchData('publicidades');
    const wrap  = document.getElementById('pub-slider');
    const track = document.getElementById('pub-track');
    const dots  = document.getElementById('pub-dots');

    // Solo mostrar si hay publicidades activas
    const activas = data.filter(p => p.imagen_url && p.imagen_url.trim());
    if (activas.length === 0) { wrap.style.display = 'none'; return; }

    wrap.style.display = 'block';
    track.innerHTML = '';
    dots.innerHTML  = '';

    activas.forEach((pub, i) => {
      // Slide
      const slide = document.createElement('a');
      slide.className = 'pub-slide';
      slide.href      = pub.link_url && pub.link_url.trim() ? pub.link_url.trim() : '#';
      slide.target    = pub.link_url && pub.link_url.trim() ? '_blank' : '_self';
      slide.rel       = 'noopener';
      slide.innerHTML = `<img src="${escHtml(pub.imagen_url)}" alt="${escHtml(pub.anunciante || 'Publicidad')}">`;
      // Evitar navegar si no hay link
      if (!pub.link_url || !pub.link_url.trim()) {
        slide.addEventListener('click', e => e.preventDefault());
      }
      track.appendChild(slide);

      // Dot
      const dot = document.createElement('button');
      dot.className   = 'pub-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Publicidad ${i + 1}`);
      dot.addEventListener('click', () => goToPub(i));
      dots.appendChild(dot);
    });

    goToPub(0);

    // Auto-avance cada 4 segundos
    if (pubTimer) clearInterval(pubTimer);
    pubTimer = setInterval(() => {
      pubIdx = (pubIdx + 1) % activas.length;
      goToPub(pubIdx);
    }, 4000);
  }

  function goToPub(idx) {
    pubIdx = idx;
    const track = document.getElementById('pub-track');
    const dots  = document.querySelectorAll('.pub-dot');
    if (!track) return;
    track.style.transform = `translateX(${-idx * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  // ─── 6. BANNER LIVE YOUTUBE ───────────────────────────────────────────────
  // Detecta si hay algún video de YouTube marcado como "en_vivo" en el Sheets
  // y activa el banner rojo pulsante arriba de todo.

  function activarBannerLive(video) {
    const banner = document.getElementById('live-banner');
    const title  = document.getElementById('live-banner-title');
    const sub    = document.getElementById('live-banner-sub');
    const btn    = document.getElementById('live-cta-btn');

    title.textContent = (video.titulo || 'FM TRADICIÓN EN VIVO').toUpperCase();
    sub.textContent   = video.descripcion || 'Tocá para ver la transmisión en YouTube';
    banner.style.display = 'block';

    // Click en el banner: ir a la pestaña YouTube y cargar el video
    btn.onclick = () => {
      // Activar pestaña YouTube
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector('[data-target="youtube"]').classList.add('active');
      document.getElementById('youtube').classList.add('active');
      // Cargar el stream en el reproductor embebido
      loadYouTubePlayer(video.video_id, video.titulo, true);
    };
  }

  // ─── 7. SECCIÓN YOUTUBE ───────────────────────────────────────────────────
  async function renderYouTube() {
    const data = await fetchData('youtube');
    if (data.length === 0) return;

    const enVivo   = data.filter(v => v.tipo === 'en_vivo');
    const grabados = data.filter(v => v.tipo === 'grabado');

    // ── Banner live si hay stream activo ──
    if (enVivo.length > 0) {
      activarBannerLive(enVivo[0]);
    }

    // ── Tab EN VIVO ──
    const liveList = document.getElementById('yt-live-list');
    liveList.innerHTML = '';

    if (enVivo.length === 0) {
      liveList.innerHTML = '<p class="empty-msg">No hay streams en vivo en este momento.<br>Seguí el banner rojo cuando haya transmisión.</p>';
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
            <div class="yt-card-desc">${escHtml(v.descripcion || '')}</div>
            <div class="yt-card-actions">
              <button class="yt-btn-watch">▶ Ver en la app</button>
              <a class="yt-btn-yt" href="https://youtube.com/watch?v=${escHtml(v.video_id)}" target="_blank" rel="noopener">↗ YouTube</a>
            </div>
          </div>`;
        card.querySelector('.yt-btn-watch').addEventListener('click', () => {
          loadYouTubePlayer(v.video_id, v.titulo, true);
        });
        card.querySelector('.yt-thumb-wrap').addEventListener('click', () => {
          loadYouTubePlayer(v.video_id, v.titulo, true);
        });
        liveList.appendChild(card);
      });
    }

    // ── Tab GRABADOS ──
    const recGrid = document.getElementById('yt-recorded-list');
    recGrid.innerHTML = '';

    if (grabados.length === 0) {
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
            <div class="yt-card-meta">${escHtml(v.fecha || '')} ${v.duracion ? '· ' + escHtml(v.duracion) : ''}</div>
            <div class="yt-card-desc">${escHtml(v.descripcion || '')}</div>
          </div>`;
        card.querySelector('.yt-thumb-wrap').addEventListener('click', () => {
          loadYouTubePlayer(v.video_id, v.titulo, false);
        });
        card.addEventListener('click', () => {
          loadYouTubePlayer(v.video_id, v.titulo, false);
        });
        recGrid.appendChild(card);
      });
    }

    // ── Tabs dentro de YouTube ──
    document.querySelectorAll('.yt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.yt-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ytab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('ytab-' + tab.dataset.ytab).classList.add('active');
      });
    });
  }

  // ─── Reproductor YouTube embebido ─────────────────────────────────────────
  function loadYouTubePlayer(videoId, titulo, isLive) {
    const wrapper = document.getElementById('yt-player-wrapper');
    const container = document.getElementById('yt-container');
    const label   = document.getElementById('yt-playing-label');
    const closeBtn = document.getElementById('yt-close-btn');

    // Pausar radio si está sonando
    if (isPlaying) {
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO (YouTube activo)';
      playerStatus.classList.remove('live');
      isPlaying = false;
    }

    const autoplay = isLive ? 1 : 0;
    container.innerHTML = `
      <iframe id="yt-iframe" width="100%" height="100%"
        src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${autoplay}&origin=${encodeURIComponent(window.location.origin)}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>`;

    label.textContent = isLive ? `🔴 EN VIVO — ${titulo}` : `▶ ${titulo}`;
    label.className   = 'yt-playing-label' + (isLive ? ' is-live' : '');
    wrapper.style.display = 'block';

    // Scroll suave hasta el reproductor
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });

    closeBtn.onclick = () => {
      container.innerHTML = '';
      wrapper.style.display = 'none';
    };
  }

  function pauseYouTubePlayer() {
    const iframe = document.getElementById('yt-iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'
      );
    }
  }

  // ─── 8. WIDGETS: CLIMA + RÍOS + FARMACIA ─────────────────────────────────
  async function renderWidgets() {
    let wd = null;
    try {
      const r = await fetch(`${CONFIG.APPS_SCRIPT_URL}?hoja=widget_info`);
      if (r.ok) wd = await r.json();
    } catch(e) { console.error('widget_info:', e); }

    renderWidgetClima(wd?.clima, wd?.error_clima);
    renderWidgetRios(wd?.rios, wd?.error_rios);
    renderClimaSectionExt(wd?.clima);
    renderRiosSectionExt(wd?.rios, wd?.error_rios);

    const farmData   = await fetchData('farmacia_turno');
    renderWidgetFarmacia(farmData);
    renderFarmaciaSectionExt(farmData);

    const rioManual  = await fetchData('rios_manual');
    renderRiosManual(rioManual);
  }

  function renderWidgetClima(clima, error) {
    const el = document.getElementById('widget-clima');
    if (error || !clima) { el.innerHTML = `<div class="widget-error">🌡️ Sin datos</div>`; return; }
    el.innerHTML = `
      <div class="widget-icon">${clima.icono}</div>
      <div class="widget-body">
        <div class="widget-label">Gualeguay</div>
        <div class="widget-value">${clima.temperatura}°C</div>
        <div class="widget-sub">${clima.descripcion}</div>
      </div>`;
  }

  function renderWidgetRios(rios, error) {
    const el = document.getElementById('widget-rios');
    if (error || !rios || !rios.length) { el.innerHTML = `<div class="widget-error">🌊 Sin datos</div>`; return; }
    const r = rios[0];
    el.innerHTML = `
      <div class="widget-icon">${r.emoji}</div>
      <div class="widget-body">
        <div class="widget-label">${r.estacion}</div>
        <div class="widget-value">${r.altura}</div>
        <div class="widget-sub estado-${r.estado}">${estadoLabel(r.estado)}</div>
      </div>`;
  }

  function renderWidgetFarmacia(data) {
    const el  = document.getElementById('widget-farmacia');
    const hoy = data.find(f => esHoy(f.fecha)) || null;
    if (!hoy) { el.innerHTML = `<div class="widget-error">💊 Sin turno hoy</div>`; return; }
    el.innerHTML = `
      <div class="widget-icon">💊</div>
      <div class="widget-body">
        <div class="widget-label">Farmacia de turno</div>
        <div class="widget-value" style="font-size:.82rem;line-height:1.2">${escHtml(hoy.nombre)}</div>
        <div class="widget-sub">${escHtml(hoy.telefono || '')}</div>
      </div>`;
  }

  function renderClimaSectionExt(clima) {
    const el = document.getElementById('clima-ext-content');
    if (!clima) { el.innerHTML = '<p class="empty-msg">No disponible.</p>'; return; }
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
      <p class="info-source" style="margin-top:8px">Fuente: Open-Meteo · Sin costo · Sin API key</p>`;
  }

  function renderRiosSectionExt(rios, error) {
    const el = document.getElementById('rios-ext-content');
    if (error || !rios || !rios.length) { el.innerHTML = `<p class="empty-msg">Datos no disponibles. ${error||''}</p>`; return; }
    el.innerHTML = rios.map(r => `
      <div class="rio-item estado-border-${r.estado}">
        <div class="rio-header">
          <span class="rio-nombre">${escHtml(r.estacion)}</span>
          <span class="rio-estado estado-${r.estado}">${r.emoji} ${estadoLabel(r.estado)}</span>
        </div>
        <div class="rio-altura">${escHtml(r.altura)}</div>
        <div class="rio-fecha">Actualizado: ${escHtml(r.fecha)}</div>
      </div>`).join('');
  }

  function renderRiosManual(data) {
    const el = document.getElementById('rios-manual-content');
    if (!data || !data.length) { el.innerHTML = '<p class="empty-msg">Sin registros manuales.</p>'; return; }
    el.innerHTML = [...data].reverse().slice(0,5).map(r => `
      <div class="rio-item">
        <div class="rio-header">
          <span class="rio-nombre">${escHtml(r.estacion || r.lugar || '—')}</span>
          <span class="rio-fecha">${escHtml(r.fecha || '')}</span>
        </div>
        <div class="rio-altura">${escHtml(r.altura || '')} ${escHtml(r.unidad || 'cm')}</div>
        ${r.observacion ? `<div class="rio-obs">${escHtml(r.observacion)}</div>` : ''}
      </div>`).join('');
  }

  function renderFarmaciaSectionExt(data) {
    const el = document.getElementById('farmacia-ext-content');
    if (!data || !data.length) { el.innerHTML = '<p class="empty-msg">Sin datos. Cargalos en el Sheets.</p>'; return; }
    const hoy      = data.filter(f => esHoy(f.fecha));
    const proximos = data.filter(f => !esHoy(f.fecha) && esFuturo(f.fecha)).slice(0, 4);
    let html = hoy.length > 0
      ? `<div class="farmacia-hoy">${hoy.map(f => tarjetaFarmacia(f, true)).join('')}</div>`
      : `<p class="empty-msg">Sin farmacia de turno para hoy.</p>`;
    if (proximos.length > 0)
      html += `<h4 class="subsection-title">Próximos turnos</h4>${proximos.map(f => tarjetaFarmacia(f, false)).join('')}`;
    el.innerHTML = html;
  }

  function tarjetaFarmacia(f, esHoyFlag) {
    return `<div class="farmacia-card ${esHoyFlag ? 'farmacia-hoy-card' : ''}">
      ${esHoyFlag ? '<div class="farmacia-badge">HOY</div>' : `<div class="farmacia-fecha">${escHtml(f.fecha)}</div>`}
      <div class="farmacia-nombre">${escHtml(f.nombre)}</div>
      <div class="farmacia-dir">📍 ${escHtml(f.direccion || '')}</div>
      ${f.telefono ? `<a class="farmacia-tel" href="tel:${escHtml(f.telefono)}">📞 ${escHtml(f.telefono)}</a>` : ''}
      ${f.horario  ? `<div class="farmacia-horario">🕐 ${escHtml(f.horario)}</div>` : ''}
      ${f.observacion ? `<div class="farmacia-obs">${escHtml(f.observacion)}</div>` : ''}
    </div>`;
  }

  // ─── 9. PROGRAMACIÓN ──────────────────────────────────────────────────────
  async function renderProgramacion() {
    const data = await fetchData('programacion');
    const el   = document.getElementById('prog-list');
    el.innerHTML = '';
    if (!data.length) { el.innerHTML = '<p class="empty-msg">No hay programación disponible.</p>'; return; }
    const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const now   = new Date();
    const today = dias[now.getDay()];
    const cur   = now.getHours() + now.getMinutes() / 60;
    data.forEach(item => {
      const dArr = (item.dias_emision || '').split(',').map(d => d.trim());
      let live = false;
      if (dArr.includes(today) && item.hora_inicio && item.hora_fin) {
        const [sh,sm] = item.hora_inicio.split(':').map(Number);
        const [eh,em] = item.hora_fin.split(':').map(Number);
        let s = sh+sm/60, e = eh+em/60;
        if (e<s) e+=24;
        if (cur>=s && cur<e) live = true;
      }
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${escHtml(item.programa)} ${live ? '<span class="live-badge">● EN VIVO</span>' : ''}</h3>
        <p><strong>Locutor/a:</strong> ${escHtml(item.locutor)}</p>
        <p class="meta">${escHtml(item.dias_emision)} | ${escHtml(item.hora_inicio)} – ${escHtml(item.hora_fin)}</p>
        <p>${escHtml(item.descripcion)}</p>`;
      el.appendChild(div);
    });
  }

  // ─── 10. AUDIOTECA ────────────────────────────────────────────────────────
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
        <p class="meta">${escHtml(item.fecha)} | ⏱ ${escHtml(item.duracion)}</p>
        <audio controls style="width:100%;margin-top:8px;" src="${escHtml(item.url_audio)}"></audio>
        <p style="margin-top:8px;">${escHtml(item.descripcion)}</p>`;
      el.appendChild(div);
    });
  }

  // ─── 11. GALERÍA ──────────────────────────────────────────────────────────
  async function renderGaleria() {
    const data = await fetchData('galeria');
    const el   = document.getElementById('gallery-container');
    el.innerHTML = '';
    if (!data.length) { el.innerHTML = '<p class="empty-msg">No hay imágenes disponibles.</p>'; return; }
    const idx = {};
    data.forEach((item, i) => {
      if (!item.url_imagen) return;
      const urls = item.url_imagen.split(',').map(u => u.trim()).filter(Boolean);
      const wrap = document.createElement('div');
      wrap.className = 'slider-wrapper'; wrap.id = `slider-${i}`;
      if (urls.length === 1) {
        wrap.innerHTML = `<img src="${urls[0]}" alt="${escHtml(item.pie_de_foto)}" style="width:100%;display:block;">
          <div class="slider-caption">${escHtml(item.pie_de_foto)}</div>`;
      } else {
        idx[i] = 0;
        wrap.innerHTML = `
          <div class="slider-track">${urls.map(u=>`<div class="slider-slide"><img src="${u}" alt="Galería"></div>`).join('')}</div>
          <button class="slider-btn prev">❮</button>
          <button class="slider-btn next">❯</button>
          <div class="slider-caption">${escHtml(item.pie_de_foto)}</div>`;
        const track = wrap.querySelector('.slider-track');
        const slides = track.querySelectorAll('.slider-slide');
        wrap.querySelector('.prev').addEventListener('click', () => { idx[i]=Math.max(0,idx[i]-1); track.style.transform=`translateX(${-idx[i]*100}%)`; });
        wrap.querySelector('.next').addEventListener('click', () => { idx[i]=Math.min(slides.length-1,idx[i]+1); track.style.transform=`translateX(${-idx[i]*100}%)`; });
      }
      el.appendChild(wrap);
    });
  }

  // ─── UTILIDADES ───────────────────────────────────────────────────────────
  function escHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function estadoLabel(e) { return {normal:'Normal',precaucion:'⚠️ Precaución',evacuacion:'🚨 Evacuación'}[e]||e; }
  function parseFecha(s) {
    if (!s) return null;
    const m1 = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return new Date(+m1[3],+m1[2]-1,+m1[1]);
    const m2 = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return new Date(+m2[1],+m2[2]-1,+m2[3]);
    return null;
  }
  function esHoy(s) {
    const d = parseFecha(s), h = new Date();
    return d && d.getDate()===h.getDate() && d.getMonth()===h.getMonth() && d.getFullYear()===h.getFullYear();
  }
  function esFuturo(s) {
    const d = parseFecha(s);
    return d && d >= new Date(new Date().setHours(0,0,0,0));
  }

  // ─── ARRANQUE ─────────────────────────────────────────────────────────────
  renderPublicidades();
  renderWidgets();
  renderYouTube();
  renderProgramacion();
  renderAudioteca();
  renderGaleria();
});
