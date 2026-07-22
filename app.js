document.addEventListener('DOMContentLoaded', () => {

  // ─── 1. ACTIVOS ESTÁTICOS ────────────────────────────────────────────────
  document.getElementById('header-logo').src = CONFIG.IMG_LOGO;
  document.getElementById('player-cover').src = CONFIG.IMG_LOGO;
  document.querySelector('.hero').style.backgroundImage =
    `linear-gradient(rgba(139,0,0,0.7), rgba(139,0,0,0.7)), url('${CONFIG.IMG_HERO}')`;

  const waLink = `https://wa.me/${CONFIG.WHATSAPP_NUM}?text=${encodeURIComponent(CONFIG.WHATSAPP_MSG)}`;
  document.getElementById('wa-btn').href = waLink;

  // ─── 2. REPRODUCTOR DE AUDIO ─────────────────────────────────────────────
  // FIX: src asignado exclusivamente en JS; se llama audio.load() para iOS
  const audio = document.getElementById('audio-stream');
  audio.src = CONFIG.STREAM_URL;
  audio.load(); // FIX: fuerza que iOS reconozca el src antes del primer play

  const btnPlay     = document.getElementById('btn-play');
  const playerStatus = document.getElementById('player-status');
  let isPlaying = false;

  // FIX: un único listener; la lógica de mute cruzado con YouTube está aquí,
  //      usando el valor de isPlaying ANTES de modificarlo.
  btnPlay.addEventListener('click', () => {
    if (isPlaying) {
      // --- Pausar radio ---
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO';
      playerStatus.classList.remove('live');
      isPlaying = false;
    } else {
      // --- Reproducir radio: primero pausar YouTube ---
      pauseYouTube();
      audio.play().catch(e => {
        console.error('Error de reproducción:', e);
        playerStatus.textContent = 'Error de conexión';
      });
      btnPlay.textContent = '⏸';
      playerStatus.textContent = '🔴 EN VIVO';
      playerStatus.classList.add('live');
      isPlaying = true;
      setupMediaSession();
    }
  });

  // FIX: manejo de error de red del stream
  audio.addEventListener('error', () => {
    playerStatus.textContent = 'Sin señal — reintentando...';
    playerStatus.classList.remove('live');
    btnPlay.textContent = '▶';
    isPlaying = false;
  });

  // FIX: detección automática cuando el audio se detiene (corte de stream)
  audio.addEventListener('ended', () => {
    playerStatus.textContent = 'PAUSADO';
    playerStatus.classList.remove('live');
    btnPlay.textContent = '▶';
    isPlaying = false;
  });

  // Media Session API (controles en pantalla de bloqueo iOS/Android)
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  'FM Tradición 97.1',
      artist: 'Tu radio amiga',
      artwork: [{ src: CONFIG.IMG_LOGO, sizes: '512x512', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play', () => {
      audio.play();
      btnPlay.textContent = '⏸';
      playerStatus.textContent = '🔴 EN VIVO';
      playerStatus.classList.add('live');
      isPlaying = true;
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO';
      playerStatus.classList.remove('live');
      isPlaying = false;
    });
  }

  // ─── 3. NAVEGACIÓN POR PESTAÑAS ──────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // ─── 4. FETCH DESDE APPS SCRIPT ──────────────────────────────────────────
  async function fetchData(sheetName) {
    try {
      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?hoja=${sheetName}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.error ? [] : data;
    } catch (error) {
      console.error(`Error al cargar ${sheetName}:`, error);
      return [];
    }
  }

  // ─── 5. RENDERIZADO ──────────────────────────────────────────────────────
  async function renderApp() {

    // --- Programación ---
    const progData = await fetchData('programacion');
    const progList  = document.getElementById('prog-list');
    progList.innerHTML = ''; // FIX: limpiar antes de renderizar
    const days    = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const now     = new Date();
    const today   = days[now.getDay()];
    const curVal  = now.getHours() + now.getMinutes() / 60;

    if (progData.length === 0) {
      progList.innerHTML = '<p class="empty-msg">No hay programación disponible.</p>';
    }

    progData.forEach(item => {
      const daysArray = item.dias_emision
        ? item.dias_emision.split(',').map(d => d.trim())
        : [];
      const isToday = daysArray.includes(today);

      let isLive = false;
      if (isToday && item.hora_inicio && item.hora_fin) {
        const [sh, sm] = item.hora_inicio.split(':').map(Number);
        const [eh, em] = item.hora_fin.split(':').map(Number);
        let startVal = sh + sm / 60;
        let endVal   = eh + em / 60;
        if (endVal < startVal) endVal += 24; // cruce de medianoche
        if (curVal >= startVal && curVal < endVal) isLive = true;
      }

      // FIX: createElement en lugar de innerHTML += (evita destruir listeners existentes)
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${escHtml(item.programa)} ${isLive ? '<span class="live-badge">● EN VIVO</span>' : ''}</h3>
        <p><strong>Locutor:</strong> ${escHtml(item.locutor)}</p>
        <p class="meta">${escHtml(item.dias_emision)} | ${escHtml(item.hora_inicio)} - ${escHtml(item.hora_fin)}</p>
        <p>${escHtml(item.descripcion)}</p>
      `;
      progList.appendChild(div);
    });

    // --- Audioteca ---
    const audioData = await fetchData('audioteca');
    const audioList  = document.getElementById('audio-list');
    audioList.innerHTML = ''; // FIX: limpiar

    if (audioData.length === 0) {
      audioList.innerHTML = '<p class="empty-msg">No hay audios disponibles.</p>';
    }

    audioData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${escHtml(item.titulo)}</h3>
        <p class="meta">${escHtml(item.fecha)} | ⏱ ${escHtml(item.duracion)}</p>
        <audio controls style="width:100%;margin-top:8px;" src="${escHtml(item.url_audio)}"></audio>
        <p style="margin-top:8px;">${escHtml(item.descripcion)}</p>
      `;
      audioList.appendChild(div);
    });

    // --- Galería ---
    const galleryData      = await fetchData('galeria');
    const galleryContainer = document.getElementById('gallery-container');
    galleryContainer.innerHTML = ''; // FIX: limpiar

    // FIX: índice de slide por slider guardado en array (no parseando CSS transform)
    const sliderIndexes = {};

    if (galleryData.length === 0) {
      galleryContainer.innerHTML = '<p class="empty-msg">No hay imágenes disponibles.</p>';
    }

    galleryData.forEach((item, index) => {
      if (!item.url_imagen) return;
      const urls = item.url_imagen.split(',').map(u => u.trim()).filter(Boolean);

      const wrapper = document.createElement('div');
      wrapper.className = 'slider-wrapper';
      wrapper.id = `slider-${index}`;

      if (urls.length === 1) {
        wrapper.innerHTML = `
          <img src="${urls[0]}" alt="${escHtml(item.pie_de_foto)}" style="width:100%;border-radius:8px;display:block;">
          <div class="slider-caption">${escHtml(item.pie_de_foto)}</div>`;
      } else {
        sliderIndexes[index] = 0; // FIX: estado del slide en variable JS, no en DOM
        const slidesHtml = urls.map(url =>
          `<div class="slider-slide"><img src="${url}" alt="Galería"></div>`
        ).join('');
        wrapper.innerHTML = `
          <div class="slider-track">${slidesHtml}</div>
          <button class="slider-btn prev" aria-label="Anterior">❮</button>
          <button class="slider-btn next" aria-label="Siguiente">❯</button>
          <div class="slider-caption">${escHtml(item.pie_de_foto)}</div>`;

        const track  = wrapper.querySelector('.slider-track');
        const slides = track.querySelectorAll('.slider-slide');

        // FIX: event listeners directos, no onclick en HTML
        wrapper.querySelector('.prev').addEventListener('click', () => {
          sliderIndexes[index] = Math.max(0, sliderIndexes[index] - 1);
          track.style.transform = `translateX(${-sliderIndexes[index] * 100}%)`;
        });
        wrapper.querySelector('.next').addEventListener('click', () => {
          sliderIndexes[index] = Math.min(slides.length - 1, sliderIndexes[index] + 1);
          track.style.transform = `translateX(${-sliderIndexes[index] * 100}%)`;
        });
      }
      galleryContainer.appendChild(wrapper);
    });
  }

  // ─── 6. YOUTUBE CON MUTE CRUZADO ─────────────────────────────────────────
  // FIX: se usa CONFIG.YT_VIDEO_ID en lugar del placeholder hardcodeado
  const ytContainer = document.getElementById('yt-container');
  const iframe = document.createElement('iframe');
  iframe.id = 'yt-player';
  iframe.width  = '100%';
  iframe.height = '100%';
  iframe.src    = `https://www.youtube.com/embed/${CONFIG.YT_VIDEO_ID}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  iframe.frameBorder = '0';
  iframe.allow  = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  ytContainer.innerHTML = '';
  ytContainer.appendChild(iframe);

  // FIX: pausar radio al interactuar con YouTube (solo si está reproduciendo)
  ytContainer.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO (YouTube activo)';
      playerStatus.classList.remove('live');
      isPlaying = false;
    }
  });

  function pauseYouTube() {
    const yt = document.getElementById('yt-player');
    if (yt && yt.contentWindow) {
      yt.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    }
  }

  // ─── 7. UTILIDADES ───────────────────────────────────────────────────────
  // FIX: escape de HTML para evitar XSS con datos de la hoja
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── INICIO ──────────────────────────────────────────────────────────────
  renderApp();
});
