
/* BOCA 360° · Aplicación de hinchas */
(() => {
'use strict';

const $ = selector => document.querySelector(selector);
const ROOT = $('#app-content');

const PAGES = [
  ['inicio','Inicio','home'],
  ['partidos','Partidos','calendar'],
  ['posiciones','Tabla','list'],
  ['plantel','Plantel','users'],
  ['noticias','Noticias','news'],
  ['estadisticas','Estadísticas','chart'],
  ['historia','Historia','trophy'],
  ['ajustes','Más','settings']
];

const ICONS = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 1-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20V7M2 21h21"/>',
  news:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h10M14 12h3"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>'
};

const icon = key =>
  `<svg aria-hidden="true" viewBox="0 0 24 24">${ICONS[key] || ICONS.home}</svg>`;

const esc = v => String(v ?? '').replace(
  /[&<>"']/g,
  c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c])
);

const link = v =>
  /^https:\/\//i.test(String(v || '')) ? esc(v) : '#';

const fmtDate = (v, opts) => {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone:'America/Argentina/Buenos_Aires',
      ...opts
    }).format(new Date(v));
  } catch {
    return 'A confirmar';
  }
};

const isoDate = value => {
  const d = new Date(value);
  return Number.isFinite(+d) ? d : null;
};

const localTime = value =>
  value
    ? fmtDate(value, {
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      })
    : 'A confirmar';

const shortDate = value =>
  value
    ? fmtDate(value, {day:'numeric',month:'short'})
    : 'S/F';

const dayNum = value =>
  value ? fmtDate(value,{day:'2-digit'}) : '—';

const mon = value =>
  value
    ? fmtDate(value,{month:'short'}).replace('.','').toUpperCase()
    : '---';

const clamp = (v,max=90) =>
  String(v || '').slice(0,max);

let data = window.BOCA_SEED_DATA || {
  meta:{},
  matches:[],
  standings:[],
  roster:[],
  news:[]
};

let state = {
  page:'inicio',
  fixture:'Todos',
  competition:'Todas',
  zone:'Todas',
  position:'Todos',
  search:'',
  favorites:loadFavorites()
};

let deferredInstall = null;

function loadFavorites() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem('boca360-favorites') || '[]')
    );
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(
      'boca360-favorites',
      JSON.stringify([...state.favorites])
    );
  } catch {}
}

function toast(message) {
  const t = $('#toast');
  if (!t) return;

  t.textContent = message;
  t.classList.add('show');

  clearTimeout(window._bocaToast);

  window._bocaToast = setTimeout(
    () => t.classList.remove('show'),
    3000
  );
}

function timeStatus() {
  const meta = data.meta || {};
  const good = !!meta.updatedAt;

  const date = good
    ? fmtDate(meta.updatedAt,{
        day:'2-digit',
        month:'2-digit',
        hour:'2-digit',
        minute:'2-digit'
      })
    : '02/11/2026';

  $('#freshness-pill').className =
    'fresh-pill' + (good ? ' live' : '');

  $('#freshness-pill').innerHTML =
    `<i class="status-dot"></i>${
      good ? 'Actualizado ' + esc(date) : 'Datos iniciales'
    }`;

  $('#foot-date').textContent = good
    ? `Última sincronización exitosa: ${date}`
    : 'Datos iniciales: 02/11/2026';
}

function nav() {
  $('#desktop-nav').innerHTML = PAGES.map(
    ([key,name]) =>
      `<button type="button" data-page="${key}"
        class="${state.page === key ? 'active' : ''}">
        ${name}
      </button>`
  ).join('');

  const mobile = [
    ...PAGES.slice(0,5),
    PAGES.find(p => p[0] === 'ajustes')
  ];

  $('#mobile-nav').innerHTML = mobile.map(
    ([key,name]) =>
      `<button type="button"
        aria-label="${name}"
        data-page="${key}"
        class="${
          state.page === key ||
          (
            ['historia','estadisticas'].includes(state.page) &&
            key === 'ajustes'
          )
          ? 'active'
          : ''
        }">
        ${icon(PAGES.find(p => p[0] === key)?.[2] || 'home')}
        <span>${name}</span>
      </button>`
  ).join('');
}

const heading = (text,to,label='Ver más') =>
  `<div class="section-title">
    <h2>${esc(text)}</h2>
    ${
      to
        ? `<button class="text-link" type="button"
             data-page="${to}">
             ${esc(label)} →
           </button>`
        : ''
    }
  </div>`;

const empty = (title,detail) =>
  `<div class="empty">
    <b>${esc(title)}</b>
    ${esc(detail)}
  </div>`;

function updateNote(section='') {
  const key =
    section === 'matches' ? 'matchesAt' :
    section === 'roster' ? 'rosterAt' :
    section === 'standings' ? 'standingsAt' :
    section === 'news' ? 'newsAt' :
    'updatedAt';

  const last = data.meta?.[key];

  return `<div class="update-note">
    <span>${
      last
        ? 'Fuente consultada ' + esc(fmtDate(last,{
            day:'numeric',
            month:'short',
            hour:'2-digit',
            minute:'2-digit'
          }))
        : 'Datos iniciales al 2/11/2026'
    }</span>
    <button type="button"
      class="secondary-link"
      data-refresh="1">
      ↻ Revisar datos
    </button>
  </div>`;
}

/* PARTIDOS: CORRECCIÓN DE FECHAS Y ESTADOS */

function validMatches() {
  return [...(data.matches || [])]
    .filter(m => m && m.date && isoDate(m.date));
}

function isUpcoming(m) {
  const timestamp = new Date(m.date).getTime();

  return Number.isFinite(timestamp) &&
    timestamp >= Date.now() &&
    m.status !== 'final' &&
    m.status !== 'in';
}

function filteredMatches(type) {
  const arr = validMatches().sort(
    (a,b) => new Date(a.date) - new Date(b.date)
  );

  if (type === 'next') {
    return arr.filter(isUpcoming).slice(0,8);
  }

  if (type === 'last') {
    return arr
      .filter(m => m.status === 'final')
      .reverse()
      .slice(0,10);
  }

  return arr.reverse();
}

function isBoca(s) {
  return /boca juniors|^boca$|cabj/i.test(s || '');
}

function opponent(match) {
  return isBoca(match.home?.name)
    ? match.away?.name
    : match.home?.name;
}

function matchTitle(m) {
  return (m.home?.name || 'Local') +
    ' vs ' +
    (m.away?.name || 'Visitante');
}

function competition(m) {
  return m.competition || 'Competición a confirmar';
}

function isWin(m) {
  if (m.status !== 'final') return false;

  const a = m.home?.score;
  const b = m.away?.score;

  if (a == null || b == null) return false;

  return isBoca(m.home?.name)
    ? Number(a) > Number(b)
    : Number(b) > Number(a);
}

function matchRow(m) {
  const result =
    m.status === 'final' &&
    m.home?.score != null &&
    m.away?.score != null
      ? `${esc(m.home.score)} – ${esc(m.away.score)}`
      : m.status === 'in'
        ? `EN JUEGO · ${esc(m.home?.score ?? '0')} – ${esc(m.away?.score ?? '0')}`
        : localTime(m.date);

  const badge =
    m.status === 'final'
      ? 'scorebox' + (isWin(m) ? ' won' : '')
      : m.status === 'in'
        ? 'scorebox'
        : '';

  return `<div class="match-row">
    <div class="datebox">
      <b>${esc(dayNum(m.date))}</b>
      <small>${esc(mon(m.date))}</small>
    </div>

    <div>
      <div class="match-name">
        ${esc(matchTitle(m))}
      </div>
      <div class="match-competition">
        ${esc(competition(m))}
        ${m.venue ? ' · ' + esc(clamp(m.venue,50)) : ''}
      </div>
    </div>

    <div class="time ${badge}">
      ${esc(result)}
    </div>
  </div>`;
}

function matchCard(m) {
  if (!m) {
    return empty(
      'Sin resultados confirmados',
      'Los datos se cargarán cuando se sincronice la fuente deportiva.'
    );
  }

  const final = m.status === 'final';
  const home = m.home || {};
  const away = m.away || {};

  function team(t) {
    return `<div class="club">
      ${
        t.logo && /^https:\/\//.test(t.logo)
          ? `<img alt="" loading="lazy" src="${link(t.logo)}">`
          : '<div class="circle-logo">⚽</div>'
      }
      <b>${esc(clamp(t.name,35))}</b>
    </div>`;
  }

  return `<div class="dark-panel">
    <div class="result-head">
      <span>
        ${esc(competition(m))} · ${esc(shortDate(m.date))}
      </span>
      <span class="tag">
        ${
          final
            ? 'FINAL'
            : m.status === 'in'
              ? 'EN JUEGO'
              : 'PROGRAMADO'
        }
      </span>
    </div>

    <div class="teams">
      ${team(home)}

      <div class="score ${final ? '' : 'future'}">
        ${
          final || m.status === 'in'
            ? `${esc(home.score ?? '–')} – ${esc(away.score ?? '–')}`
            : esc(localTime(m.date))
        }
      </div>

      ${team(away)}
    </div>

    <div class="result-sub">
      ${esc(m.venue || 'Horario argentino · Sede a confirmar')}
      ${
        m.sourceUrl
          ? ` · <a href="${link(m.sourceUrl)}"
               target="_blank"
               rel="noopener noreferrer"
               style="color:#ffdd72;text-decoration:underline">
               Detalles ↗
             </a>`
          : ''
      }
    </div>
  </div>`;
}

/* INDICADORES DE INICIO */

function statKpis() {
  const recent = filteredMatches('last');
  const next = filteredMatches('next');
  const wins = recent.filter(isWin).length;

  const row = (data.standings || [])
    .flatMap(g => g.teams || [])
    .find(t => isBoca(t.name));

  const position = row?.rank
    ? `${row.rank}°`
    : '—';

  const pts = row?.points ?? '—';

  return `<div class="kpis">
    <div class="kpi">
      <div class="label">Posición</div>
      <strong>${esc(position)}</strong>
      <small>${esc(row?.group || 'Tabla disponible al sincronizar')}</small>
    </div>

    <div class="kpi">
      <div class="label">Puntos</div>
      <strong>${esc(pts)}</strong>
      <small>Clasificación publicada</small>
    </div>

    <div class="kpi">
      <div class="label">Próximo partido</div>
      <strong>
        ${next.length ? esc(dayNum(next[0].date)) : '—'}
      </strong>
      <small>
        ${
          next.length
            ? esc(mon(next[0].date) + ' · ' + localTime(next[0].date))
            : 'Por confirmar'
        }
      </small>
    </div>

    <div class="kpi">
      <div class="label">Últimos 10</div>
      <strong>${wins}</strong>
      <small>Victorias confirmadas (${recent.length} PJ)</small>
    </div>
  </div>`;
}

function dashboard() {
  const last = filteredMatches('last')[0];
  const next = filteredMatches('next');

  return `<div class="hero">
    <div>
      <div class="eyebrow">XENEIZE POR SIEMPRE</div>
      <h1>ESTO ES<br><span>BOCA.</span></h1>

      <p>
        Todos los días, toda la pasión.
        Partidos, resultados, plantel, noticias
        y la historia azul y oro en un solo lugar.
      </p>

      <div class="hero-actions">
        <button class="btn primary" data-page="partidos">
          ${icon('calendar')} Ver partidos
        </button>
        <button class="btn secondary" data-page="noticias">
          ${icon('news')} Novedades
        </button>
      </div>
    </div>

    <div class="hero-art">
      <img src="./icon.svg" alt="Emblema CABJ">
    </div>
  </div>

  <div class="content">
    ${statKpis()}
    ${updateNote('matches')}

    <div class="grid2">
      <section>
        ${heading('Último resultado','partidos','Resultados')}
        ${matchCard(last)}
      </section>

      <section>
        ${heading('Próximos partidos','partidos','Calendario')}
        ${
          next.length
            ? `<div class="panel match-list">
                 ${next.slice(0,3).map(matchRow).join('')}
               </div>`
            : empty(
                'Sin próximos partidos confirmados',
                'La fuente todavía no publicó encuentros futuros disponibles.'
              )
        }
      </section>
    </div>

    ${heading('Posiciones','posiciones','Ver tabla')}
    ${standingsBlock(true)}

    ${heading('Últimas noticias','noticias','Todas')}
    ${newsBlock(2)}

    <div class="notice">
      <strong>Actualización automática:</strong>
      GitHub consulta los datos aproximadamente cada hora.
      No equivale a un marcador en vivo minuto a minuto.
    </div>
  </div>`;
}

function controls(name,options,current) {
  return `<div class="filter-list">
    ${options.map(item => `
      <button
        class="filter ${item === current ? 'selected' : ''}"
        type="button"
        data-filter-key="${name}"
        data-filter-value="${esc(item)}">
        ${esc(item)}
      </button>
    `).join('')}
  </div>`;
}

/* CALENDARIO CORREGIDO */

function fixtures() {
  const available = [...new Set(
    (data.matches || [])
      .map(m => m.competition)
      .filter(Boolean)
  )];

  const comps = ['Todas',...available];

  const arr = validMatches()
    .filter(m => {
      const matchesFilter =
        state.fixture === 'Todos' ||
        (
          state.fixture === 'Próximos' &&
          isUpcoming(m)
        ) ||
        (
          state.fixture === 'Resultados' &&
          m.status === 'final'
        );

      const matchesCompetition =
        state.competition === 'Todas' ||
        m.competition === state.competition;

      return matchesFilter && matchesCompetition;
    })
    .sort((a,b) =>
      state.fixture === 'Próximos'
        ? new Date(a.date) - new Date(b.date)
        : new Date(b.date) - new Date(a.date)
    );

  return `<div class="content">
    <div class="page-heading">
      <h1>Partidos y resultados</h1>
      <p>
        Competencias nacionales e internacionales.
        Horarios de Argentina (UTC−3).
      </p>
    </div>

    ${controls(
      'fixture',
      ['Todos','Próximos','Resultados'],
      state.fixture
    )}

    ${controls('competition',comps,state.competition)}

    <div class="matches-stack">
      ${
        arr.length
          ? arr.map(matchRow).join('')
          : empty(
              'No hay partidos para este filtro',
              'Probá otra competencia o revisá la última actualización.'
            )
      }
    </div>

    ${updateNote('matches')}

    <p class="smallprint">
      Los horarios y sedes pueden cambiar.
      Confirmá antes de viajar al estadio.
    </p>
  </div>`;
}

/* TABLA DE POSICIONES ORDENADA */

function standingsBlock(limited=false) {
  const groups = data.standings || [];

  if (!groups.length) {
    return empty(
      'Tabla no disponible',
      'La tabla aparecerá cuando la fuente confirme los datos.'
    );
  }

  const zone =
    groups.find(x => x.name === state.zone) ||
    groups[0];

  const ordered = [...(zone.teams || [])].sort((a,b) => {
    const ra = Number(a.rank);
    const rb = Number(b.rank);

    const validA = Number.isFinite(ra) && ra > 0;
    const validB = Number.isFinite(rb) && rb > 0;

    if (validA && validB) {
      return ra - rb;
    }

    if (validA) return -1;
    if (validB) return 1;

    return (
      Number(b.points || 0) - Number(a.points || 0) ||
      Number(b.diff || 0) - Number(a.diff || 0)
    );
  });

  const teams = limited
    ? ordered.slice(0,6)
    : ordered;

  if (!teams.length) {
    return empty(
      'Sin clasificación',
      'No se recibieron posiciones para este torneo.'
    );
  }

  return `<div class="panel table-scroll">
    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Equipo</th>
          <th>PJ</th>
          <th>DG</th>
          <th>PTS</th>
        </tr>
      </thead>

      <tbody>
        ${teams.map((t,i) => `
          <tr class="${isBoca(t.name) ? 'boca-tr' : ''}">
            <td>
              <span class="pos-badge">
                ${esc(t.rank ?? i + 1)}
              </span>
            </td>

            <td>
              <span class="team-cell">
                ${
                  t.logo && /^https:\/\//.test(t.logo)
                    ? `<img src="${link(t.logo)}"
                         alt=""
                         loading="lazy">`
                    : ''
                }
                ${esc(t.name)}
              </span>
            </td>

            <td>${esc(t.played ?? '—')}</td>
            <td>${esc(t.diff ?? '—')}</td>
            <td><b>${esc(t.points ?? '—')}</b></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function standings() {
  const groups = data.standings || [];

  return `<div class="content">
    <div class="page-heading">
      <h1>Tabla de posiciones</h1>
      <p>
        ${esc(data.meta?.standingsCompetition || 'Liga argentina')}
        · Clasificación recibida de la fuente.
      </p>
    </div>

    ${
      groups.length > 1
        ? controls(
            'zone',
            groups.map(x => x.name),
            state.zone === 'Todas'
              ? groups[0].name
              : state.zone
          )
        : ''
    }

    ${standingsBlock(false)}
    ${updateNote('standings')}

    <p class="smallprint">
      No se informa una zona o clasificación
      si la fuente no la indica expresamente.
    </p>
  </div>`;
}

/* PLANTEL */

function playerCard(p) {
  const id = p.id || p.name;
  const isFav = state.favorites.has(id);

  return `<div class="player">
    <div class="number">
      ${esc(p.number || '—')}
    </div>

    <div class="player-info">
      <b>${esc(p.name)}</b>
      <small>${esc(p.position || 'Plantel')}</small>
    </div>

    <button
      class="star ${isFav ? 'active' : ''}"
      type="button"
      aria-label="${isFav ? 'Quitar' : 'Agregar'} favorito"
      data-favorite="${esc(id)}">
      ★
    </button>
  </div>`;
}

function roster() {
  const positions = [
    'Todos',
    ...new Set(
      (data.roster || [])
        .map(p => p.position)
        .filter(Boolean)
    ),
    'Favoritos'
  ];

  return `<div class="content">
    <div class="page-heading">
      <h1>Plantel profesional</h1>
      <p>
        Jugadores publicados por la fuente deportiva.
        Marcá tus favoritos con la estrella.
      </p>
    </div>

    <input
      id="player-search"
      class="search"
      type="search"
      value="${esc(state.search)}"
      placeholder="Buscar jugador…"
      autocomplete="off"
      aria-label="Buscar jugador">

    ${controls('position',positions,state.position)}

    <div id="players-list" class="players-grid"></div>

    ${updateNote('roster')}
  </div>`;
}

function rosterResults() {
  const players = (data.roster || []).filter(p => {
    const matchesPosition =
      state.position === 'Todos' ||
      (
        state.position === 'Favoritos'
          ? state.favorites.has(p.id || p.name)
          : p.position === state.position
      );

    const matchesSearch = String(p.name || '')
      .toLowerCase()
      .includes(state.search.toLowerCase());

    return matchesPosition && matchesSearch;
  });

  $('#players-list').innerHTML = players.length
    ? players.map(playerCard).join('')
    : empty(
        data.roster?.length
          ? 'Sin jugadores para este filtro'
          : 'Esperando datos del plantel',
        data.roster?.length
          ? 'Probá buscar otro nombre.'
          : 'La nómina aparecerá cuando se sincronice la fuente.'
      );
}

/* NOTICIAS */

function newsBlock(max) {
  const list = (data.news || []).slice(0,max || 30);

  if (!list.length) {
    return empty(
      'Aún no llegaron noticias',
      'Las novedades se cargarán al realizar la primera sincronización.'
    );
  }

  return `<div class="news-grid">
    ${list.map(n => `
      <a class="news-card"
        href="${link(n.url)}"
        target="_blank"
        rel="noopener noreferrer">

        <div>
          <span class="source-label">
            ${esc(clamp(n.source || 'Noticias',36))}
          </span>

          <h3>${esc(clamp(n.title,180))}</h3>
        </div>

        <small>
          ${
            n.published
              ? esc(fmtDate(n.published,{
                  day:'numeric',
                  month:'short',
                  hour:'2-digit',
                  minute:'2-digit'
                }))
              : 'Fecha no indicada'
          }
          · Abrir noticia ↗
        </small>
      </a>
    `).join('')}
  </div>`;
}

function news() {
  return `<div class="content">
    <div class="page-heading">
      <h1>Últimas noticias</h1>
      <p>
        Enlaces a notas de medios sobre Boca.
        Cada noticia se abre en su publicación original.
      </p>
    </div>

    ${newsBlock(30)}
    ${updateNote('news')}

    <p class="smallprint">
      Los titulares corresponden a sus medios originales.
      Boca 360° no respalda todas las afirmaciones de terceros.
    </p>
  </div>`;
}

/* HISTORIA */

function history() {
  return `<div class="content">
    <div class="page-heading">
      <h1>Historia xeneize</h1>
      <p>Desde 1905, una pasión que cruza generaciones.</p>
    </div>

    <div class="dark-panel" style="padding:30px">
      <div class="result-head">
        CLUB ATLÉTICO BOCA JUNIORS · LA BOCA
      </div>

      <h2 style="font-size:32px;margin:18px 0 7px;letter-spacing:-1px">
        EL CLUB DEL PUEBLO
      </h2>

      <div style="color:#c1d4f1;font-size:12px">
        Fundado el 3 de abril de 1905 ·
        Estadio Alberto J. Armando, La Bombonera.
      </div>
    </div>

    ${heading('Una vitrina histórica')}

    <div class="history">
      <div class="history-card">
        <strong>6</strong>
        <span>Copas Libertadores</span>
      </div>

      <div class="history-card">
        <strong>3</strong>
        <span>Copas Intercontinentales</span>
      </div>

      <div class="history-card">
        <strong>1905</strong>
        <span>Año de fundación</span>
      </div>
    </div>

    ${heading('Grandes nombres')}

    <div class="info-card">
      <p>
        Juan Román Riquelme, Martín Palermo, Diego Maradona,
        Carlos Tevez, Guillermo Barros Schelotto y
        Ángel Clemente Rojas son algunos de los nombres
        que marcaron la historia del club.
      </p>

      <p>
        Para estadísticas históricas oficiales, consultá
        <a href="https://www.bocajuniors.com.ar/"
           target="_blank"
           rel="noopener noreferrer">
          el sitio del club ↗
        </a>.
      </p>
    </div>
  </div>`;
}

/* ESTADÍSTICAS */

function statistics() {
  const games = filteredMatches('last');
  const wins = games.filter(isWin).length;

  const draws = games.filter(m =>
    m.home?.score != null &&
    m.away?.score != null &&
    Number(m.home.score) === Number(m.away.score)
  ).length;

  const losses = games.length - wins - draws;

  let goals = 0;
  let conceded = 0;

  for (const m of games) {
    const ours = isBoca(m.home?.name)
      ? m.home
      : m.away;

    const theirs = isBoca(m.home?.name)
      ? m.away
      : m.home;

    goals += Number(ours?.score || 0);
    conceded += Number(theirs?.score || 0);
  }

  return `<div class="content">
    <div class="page-heading">
      <h1>Estadísticas</h1>
      <p>
        Datos calculados a partir de los últimos
        ${games.length} partidos disponibles.
      </p>
    </div>

    <div class="kpis" style="margin-top:18px">
      <div class="kpi">
        <div class="label">Ganados</div>
        <strong>${wins}</strong>
        <small>Últimos ${games.length}</small>
      </div>

      <div class="kpi">
        <div class="label">Empatados</div>
        <strong>${draws}</strong>
        <small>Últimos ${games.length}</small>
      </div>

      <div class="kpi">
        <div class="label">Perdidos</div>
        <strong>${losses}</strong>
        <small>Últimos ${games.length}</small>
      </div>

      <div class="kpi">
        <div class="label">Goles</div>
        <strong>${goals}:${conceded}</strong>
        <small>Favor : contra</small>
      </div>
    </div>

    ${heading('Racha reciente')}

    ${
      games.length
        ? `<div class="panel match-list">
             ${games.slice(0,8).map(matchRow).join('')}
           </div>`
        : empty(
            'Sin estadísticas suficientes',
            'Los resultados aparecerán cuando la fuente proporcione partidos finalizados.'
          )
    }

    ${heading('Goleadores y estadísticas oficiales')}

    <div class="info-card">
      <p>
        Para evitar datos incorrectos, esta versión no calcula
        autores de gol que la fuente no suministra.
        Consultá
        <a target="_blank"
           rel="noopener noreferrer"
           href="https://www.espn.com/soccer/team/stats/_/id/5/boca-juniors">
          los goleadores y estadísticas en ESPN ↗
        </a>.
      </p>
    </div>

    ${updateNote('matches')}
  </div>`;
}

/* CONFIGURACIÓN */

function settings() {
  const sources = [
    ['Partidos',data.meta?.matchesAt,(data.matches || []).length],
    ['Posiciones',data.meta?.standingsAt,(data.standings || []).length],
    ['Plantel',data.meta?.rosterAt,(data.roster || []).length],
    ['Noticias',data.meta?.newsAt,(data.news || []).length]
  ];

  return `<div class="content">
    <div class="page-heading">
      <h1>La app y sus datos</h1>
      <p>
        Instalación, fuentes deportivas,
        estado de sincronización y publicación.
      </p>
    </div>

    <div class="filter-list">
      <button class="filter selected"
        data-page="estadisticas"
        type="button">
        Ver estadísticas
      </button>

      <button class="filter"
        data-page="historia"
        type="button">
        Historia y títulos
      </button>
    </div>

    ${heading('Estado de actualización')}

    <div class="source-grid">
      ${sources.map(([name,time,count]) => `
        <div class="source-card">
          <b>${esc(name)} · ${esc(count)} registros</b>
          <small>
            ${
              time
                ? esc('Fuente sincronizada: ' + fmtDate(time,{
                    day:'numeric',
                    month:'short',
                    hour:'2-digit',
                    minute:'2-digit'
                  }))
                : 'Sin sincronización automática confirmada'
            }
          </small>
        </div>
      `).join('')}
    </div>

    ${heading('Instalala en tu celular')}

    <div class="info-card">
      <h3>En iPhone (Safari)</h3>
      <p>
        Abrí la app con Safari → Compartir →
        <b>Agregar a pantalla de inicio</b> → Agregar.
      </p>

      <h3>En Android (Chrome)</h3>
      <p>
        Abrí la app → menú ⋮ →
        <b>Instalar app</b> o
        <b>Agregar a pantalla principal</b>.
      </p>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary"
          id="install-btn"
          type="button">
          Instalar app
        </button>

        <button class="btn"
          style="background:#e9eff9;color:#194d99"
          id="share-btn"
          type="button">
          Compartir
        </button>
      </div>
    </div>

    ${heading('Cómo se actualiza')}

    <div class="info-card">
      <p>
        GitHub Pages + GitHub Actions ejecuta un sincronizador
        aproximadamente una vez por hora.
      </p>

      <p>
        La app consulta los datos periódicamente cuando
        está abierta. Las fuentes externas pueden retrasarse
        o fallar.
      </p>

      <p>
        <b>Fuentes:</b>
        feeds públicos no oficiales de ESPN y
        RSS de Google Noticias.
        <a href="https://www.espn.com/soccer/team/_/id/5/boca-juniors"
           target="_blank"
           rel="noopener noreferrer">
          Ver ESPN ↗
        </a>
      </p>
    </div>

    <div class="notice">
      Esta es una aplicación no oficial de hinchas.
      Confirmá los horarios en fuentes oficiales.
    </div>
  </div>`;
}

/* NAVEGACIÓN Y RENDERIZADO */

function render(scroll=false) {
  nav();
  timeStatus();

  const page = state.page;

  ROOT.innerHTML =
    page === 'inicio' ? dashboard() :
    page === 'partidos' ? fixtures() :
    page === 'posiciones' ? standings() :
    page === 'plantel' ? roster() :
    page === 'noticias' ? news() :
    page === 'estadisticas' ? statistics() :
    page === 'historia' ? history() :
    settings();

  if (page === 'plantel') {
    rosterResults();

    $('#player-search').addEventListener('input',e => {
      state.search = e.target.value;
      rosterResults();
    });
  }

  if (scroll) {
    window.scrollTo({
      top:0,
      behavior:'smooth'
    });
  }
}

function go(page) {
  if (!PAGES.some(p => p[0] === page)) {
    page = 'inicio';
  }

  state.page = page;
  render(true);
}

/* ACTUALIZACIÓN AUTOMÁTICA */

async function refresh(silent=false) {
  const button = $('#refresh-btn');

  if (button) button.disabled = true;

  try {
    const response = await fetch(
      `./boca.json?t=${Date.now()}`,
      {cache:'no-store'}
    );

    if (!response.ok) {
      throw new Error('Sin datos disponibles');
    }

    const fresh = await response.json();

    if (
      !fresh ||
      !Array.isArray(fresh.matches) ||
      !fresh.meta
    ) {
      throw new Error('Formato inválido');
    }

    const changed =
      JSON.stringify(fresh) !== JSON.stringify(data);

    data = fresh;
    render();

    if (!silent) {
      toast(
        changed
          ? 'Información recargada'
          : 'Ya tenés la última versión disponible'
      );
    }

  } catch (e) {
    console.error('Error actualizando Boca 360:',e);

    if (!silent) {
      toast(
        'Sin conexión o sin actualización publicada. Seguís viendo los últimos datos guardados.'
      );
    }

  } finally {
    if (button) button.disabled = false;
  }
}

/* INSTALACIÓN */

window.addEventListener('beforeinstallprompt',e => {
  e.preventDefault();
  deferredInstall = e;
});

/* EVENTOS */

ROOT.addEventListener('click',e => {
  const page = e.target.closest('[data-page]');

  if (page) {
    go(page.dataset.page);
    return;
  }

  const refreshBtn = e.target.closest('[data-refresh]');

  if (refreshBtn) {
    refresh();
    return;
  }

  const filter = e.target.closest('[data-filter-key]');

  if (filter) {
    const key = filter.dataset.filterKey;
    const value = filter.dataset.filterValue;

    if (key === 'zone') {
      state.zone = value;
    } else if (key === 'position') {
      state.position = value;
    } else if (key === 'fixture') {
      state.fixture = value;
    } else if (key === 'competition') {
      state.competition = value;
    }

    render();
    return;
  }

  const fav = e.target.closest('[data-favorite]');

  if (fav) {
    const id = fav.dataset.favorite;

    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }

    saveFavorites();
    rosterResults();
    return;
  }

  if (e.target.closest('#install-btn')) {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall = null;
    } else {
      toast(
        'En iPhone: Safari → Compartir → Agregar a pantalla de inicio'
      );
    }
    return;
  }

  if (e.target.closest('#share-btn')) {
    if (navigator.share) {
      navigator.share({
        title:'Boca 360°',
        url:location.href
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href)
        .then(() => toast('Enlace copiado'))
        .catch(() => toast('Copiá la dirección del navegador'));
    } else {
      toast('Copiá la dirección del navegador');
    }
  }
});

$('#desktop-nav').addEventListener('click',e => {
  const x = e.target.closest('[data-page]');
  if (x) go(x.dataset.page);
});

$('#mobile-nav').addEventListener('click',e => {
  const x = e.target.closest('[data-page]');
  if (x) go(x.dataset.page);
});

$('#refresh-btn').addEventListener('click',() => refresh());

window.addEventListener('hashchange',() => {
  const hash = location.hash.slice(1);

  if (
    hash !== state.page &&
    PAGES.some(p => p[0] === hash)
  ) {
    go(hash);
  }
});

/* SERVICE WORKER */

if (
  'serviceWorker' in navigator &&
  location.protocol === 'https:'
) {
  window.addEventListener('load',() => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch(() => {});
  });
}

/* INICIO */

if (PAGES.some(p => p[0] === location.hash.slice(1))) {
  state.page = location.hash.slice(1);
}

render();
refresh(true);

/* RECARGAR DATOS CADA 10 MINUTOS */

setInterval(() => {
  if (
    document.visibilityState === 'visible' &&
    navigator.onLine
  ) {
    refresh(true);
  }
},10 * 60 * 1000);

})();
