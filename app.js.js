document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicialización de Activos Estáticos
  document.getElementById('header-logo').src = CONFIG.IMG_LOGO;
  document.getElementById('player-cover').src = CONFIG.IMG_LOGO;
  document.querySelector('.hero').style.backgroundImage = `linear-gradient(rgba(139, 0, 0, 0.7), rgba(139, 0, 0, 0.7)), url('${CONFIG.IMG_HERO}')`;
  
  const waLink = `https://wa.me/${CONFIG.WHATSAPP_NUM}?text=${encodeURIComponent(CONFIG.WHATSAPP_MSG)}`;
  document.getElementById('wa-btn').href = waLink;

  // 2. Gestión del Reproductor de Audio
  const audio = document.getElementById('audio-stream');
  audio.src = CONFIG.STREAM_URL;
  const btnPlay = document.getElementById('btn-play');
  const playerStatus = document.getElementById('player-status');
  let isPlaying = false;

  btnPlay.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO';
      playerStatus.classList.remove('live');
      isPlaying = false;
    } else {
      audio.play().catch(e => console.error("Error de reproducción:", e));
      btnPlay.textContent = '⏸';
      playerStatus.textContent = '🔴 EN VIVO';
      playerStatus.classList.add('live');
      isPlaying = true;
      setupMediaSession();
    }
  });

  // Media Session API (Segundo plano en iOS/Android)
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'FM Tradición 97.1',
        artist: 'Tu radio amiga',
        artwork: [{ src: CONFIG.IMG_LOGO, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => { audio.play(); btnPlay.textContent = '⏸'; isPlaying = true; });
      navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); btnPlay.textContent = '▶'; isPlaying = false; });
    }
  }

  // 3. Navegación por Pestañas
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // 4. Fetch de Datos desde Apps Script
  async function fetchData(sheetName) {
    try {
      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?hoja=${sheetName}`);
      const data = await response.json();
      return data.error ? [] : data;
    } catch (error) {
      console.error(`Error al cargar ${sheetName}:`, error);
      return [];
    }
  }

  // 5. Renderizado de Secciones
  async function renderApp() {
    // Programación
    const progData = await fetchData('programacion');
    const progList = document.getElementById('prog-list');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const today = days[new Date().getDay()];
    const currentHour = new Date().getHours();
    const currentMin = new Date().getMinutes();
    const currentTimeVal = currentHour + (currentMin / 60);

    progData.forEach(item => {
      const daysArray = item.dias_emision ? item.dias_emision.split(',').map(d => d.trim()) : [];
      const isToday = daysArray.includes(today);
      
      // Lógica simple de "EN VIVO" para la grilla
      let isLive = false;
      if (isToday && item.hora_inicio && item.hora_fin) {
        const [startH, startM] = item.hora_inicio.split(':').map(Number);
        const [endH, endM] = item.hora_fin.split(':').map(Number);
        const startVal = startH + (startM / 60);
        let endVal = endH + (endM / 60);
        if (endVal < startVal) endVal += 24; // Cruce de medianoche
        
        if (currentTimeVal >= startVal && currentTimeVal < endVal) {
          isLive = true;
        }
      }

      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${item.programa} ${isLive ? '<span style="color:#ff3b30; font-size:0.8em;">● EN VIVO</span>' : ''}</h3>
        <p><strong>Locutor:</strong> ${item.locutor}</p>
        <p class="meta">${item.dias_emision} | ${item.hora_inicio} - ${item.hora_fin}</p>
        <p>${item.descripcion}</p>
      `;
      progList.appendChild(div);
    });

    // Audioteca
    const audioData = await fetchData('audioteca');
    const audioList = document.getElementById('audio-list');
    audioData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <h3>${item.titulo}</h3>
        <p class="meta">${item.fecha} | ⏱ ${item.duracion}</p>
        <audio controls style="width:100%; margin-top:8px;" src="${item.url_audio}"></audio>
        <p style="margin-top:8px;">${item.descripcion}</p>
      `;
      audioList.appendChild(div);
    });

    // Galería (con lógica de Slider)
    const galleryData = await fetchData('galeria');
    const galleryContainer = document.getElementById('gallery-container');
    galleryData.forEach((item, index) => {
      if (!item.url_imagen) return;
      // Limpieza agresiva de espacios fantasma
      const urls = item.url_imagen.split(',').map(url => url.trim()).filter(url => url.length > 0);
      
      if (urls.length === 1) {
        galleryContainer.innerHTML += `
          <div class="slider-wrapper">
            <img src="${urls[0]}" alt="${item.pie_de_foto}" style="width:100%; border-radius:8px;">
            <div class="slider-caption">${item.pie_de_foto}</div>
          </div>`;
      } else {
        let slidesHtml = urls.map(url => `<div class="slider-slide"><img src="${url}" alt="Galería"></div>`).join('');
        galleryContainer.innerHTML += `
          <div class="slider-wrapper" id="slider-${index}">
            <button class="slider-btn prev" onclick="moveSlide(${index}, -1)">❮</button>
            <div class="slider-track" style="transform: translateX(0%);">${slidesHtml}</div>
            <button class="slider-btn next" onclick="moveSlide(${index}, 1)">❯</button>
            <div class="slider-caption">${item.pie_de_foto}</div>
          </div>`;
      }
    });
  }

  // Función global para sliders (adjunta a window para onclick en HTML)
  window.moveSlide = function(sliderIndex, direction) {
    const track = document.querySelector(`#slider-${sliderIndex} .slider-track`);
    const slides = track.querySelectorAll('.slider-slide');
    let currentTransform = track.style.transform;
    let currentPercent = currentTransform ? parseInt(currentTransform.replace(/[^0-9\-]/g, '')) || 0 : 0;
    let newPercent = currentPercent - (direction * 100);
    
    // Límites
    if (newPercent > 0) newPercent = 0;
    if (newPercent < -((slides.length - 1) * 100)) newPercent = -((slides.length - 1) * 100);
    
    track.style.transform = `translateX(${newPercent}%)`;
  };

  // 6. Regla de Oro: Muteo Cruzado con YouTube
  // Inyectamos el iframe de YouTube dinámicamente para controlar el evento
  const ytContainer = document.getElementById('yt-container');
  // REEMPLACE 'VIDEO_ID' con el ID real del video en vivo de FM Tradición
  const ytVideoId = "LIVE_VIDEO_ID_AQUI"; 
  ytContainer.innerHTML = `<iframe id="yt-player" width="100%" height="100%" src="https://www.youtube.com/embed/${ytVideoId}?enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

  // Escuchar interacción con el contenedor de YouTube para pausar la radio
  ytContainer.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      btnPlay.textContent = '▶';
      playerStatus.textContent = 'PAUSADO (YouTube)';
      playerStatus.classList.remove('live');
      isPlaying = false;
    }
  });

  // Escuchar el botón de play de la radio para pausar YouTube (inyectando postMessage)
  btnPlay.addEventListener('click', () => {
    if (!isPlaying) { // Si vamos a reproducir la radio
      const iframe = document.getElementById('yt-player');
      if (iframe) {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      }
    }
  });

  // Iniciar carga de datos
  renderApp();
});