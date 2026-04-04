/*!
 * Moose AI Reviews Widget v1.0
 * Embeds Google, Yelp & Facebook reviews on any website
 * Usage: <script src="/reviews-widget.js" data-key="YOUR_EMBED_KEY"></script>
 * Or via: window._mooseReviews = { key, mode, position }
 */
(function() {
  'use strict';

  // ── Config from script tag OR window variable ────────────────────────────
  var scriptTag = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var cfg = window._mooseReviews || {};
  var KEY      = cfg.key      || scriptTag.getAttribute('data-key')      || '';
  var MODE     = cfg.mode     || scriptTag.getAttribute('data-mode')     || 'carousel';
  var POSITION = cfg.position || scriptTag.getAttribute('data-position') || 'bottom-left';

  if (!KEY) { console.warn('[Moose Reviews] No embed key provided.'); return; }

  // ── API base — auto-detect same origin ─────────────────────────────────
  var API_BASE = cfg.apiBase || scriptTag.src.replace('/reviews-widget.js', '');

  // ── Fetch reviews from API ──────────────────────────────────────────────
  function fetchReviews(callback) {
    var url = API_BASE + '/api/reviews/embed?key=' + encodeURIComponent(KEY);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try { callback(null, JSON.parse(xhr.responseText)); }
        catch(e) { callback(e); }
      } else if (xhr.status === 403) {
        // Widget disabled — payment gate
        callback(new Error('DISABLED'));
      } else {
        callback(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.send();
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  function injectStyles(primaryColor, theme) {
    var dark = theme === 'dark';
    var bg   = dark ? '#18181b' : '#ffffff';
    var text = dark ? '#f4f4f5' : '#111111';
    var sub  = dark ? '#a1a1aa' : '#6b7280';
    var border = dark ? 'rgba(255,255,255,.1)' : '#e5e7eb';

    var css = [
      '.moose-rw-badge{position:fixed;z-index:99999;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transition:transform .2s}',
      '.moose-rw-badge.bottom-left{bottom:20px;left:20px}',
      '.moose-rw-badge.bottom-right{bottom:20px;right:20px}',
      '.moose-rw-badge-inner{background:'+bg+';border:1px solid '+border+';border-radius:14px;padding:10px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 24px rgba(0,0,0,.15);min-width:180px}',
      '.moose-rw-badge:hover .moose-rw-badge-inner{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.2)}',
      '.moose-rw-badge-stars{display:flex;gap:2px}',
      '.moose-rw-badge-star{width:16px;height:16px;fill:#f59e0b;color:#f59e0b}',
      '.moose-rw-badge-star.empty{fill:none;color:#e5e7eb}',
      '.moose-rw-badge-info{flex:1}',
      '.moose-rw-badge-rating{font-size:18px;font-weight:900;color:'+text+';line-height:1}',
      '.moose-rw-badge-count{font-size:11px;color:'+sub+';margin-top:2px}',
      '.moose-rw-badge-logos{display:flex;gap:4px;align-items:center}',
      '.moose-rw-badge-logo{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px}',

      '.moose-rw-panel{position:fixed;z-index:99998;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:'+bg+';border:1px solid '+border+';border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,.2);width:380px;max-height:520px;overflow:hidden;display:flex;flex-direction:column;transition:all .3s}',
      '.moose-rw-panel.bottom-left{bottom:90px;left:20px}',
      '.moose-rw-panel.bottom-right{bottom:90px;right:20px}',
      '.moose-rw-panel.hidden{opacity:0;pointer-events:none;transform:translateY(10px)}',
      '.moose-rw-panel-head{padding:16px 18px;border-bottom:1px solid '+border+';display:flex;align-items:center;gap:10px}',
      '.moose-rw-panel-name{font-size:14px;font-weight:700;color:'+text+';flex:1}',
      '.moose-rw-panel-avg{font-size:13px;font-weight:700;color:#f59e0b}',
      '.moose-rw-panel-close{background:none;border:none;cursor:pointer;color:'+sub+';font-size:20px;padding:0;line-height:1}',
      '.moose-rw-list{overflow-y:auto;flex:1;padding:12px}',
      '.moose-rw-card{background:'+( dark ? 'rgba(255,255,255,.05)' : '#f9fafb' )+';border:1px solid '+border+';border-radius:12px;padding:14px;margin-bottom:10px}',
      '.moose-rw-card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
      '.moose-rw-avatar{width:36px;height:36px;border-radius:50%;background:'+primaryColor+';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0;overflow:hidden}',
      '.moose-rw-avatar img{width:100%;height:100%;object-fit:cover}',
      '.moose-rw-name{font-size:13px;font-weight:700;color:'+text+'}',
      '.moose-rw-date{font-size:11px;color:'+sub+';margin-top:1px}',
      '.moose-rw-platform{margin-left:auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}',
      '.moose-rw-stars{display:flex;gap:2px;margin-bottom:8px}',
      '.moose-rw-star{width:13px;height:13px}',
      '.moose-rw-text{font-size:13px;color:'+text+';line-height:1.65;font-style:italic}',
      '.moose-rw-response{margin-top:10px;background:'+(dark?'rgba(255,255,255,.04)':'#fff')+';border-left:3px solid '+primaryColor+';padding:8px 12px;border-radius:0 8px 8px 0}',
      '.moose-rw-response-label{font-size:10px;font-weight:700;color:'+primaryColor+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}',
      '.moose-rw-response-text{font-size:12px;color:'+text+';line-height:1.55}',
      '.moose-rw-powered{padding:10px 16px;border-top:1px solid '+border+';text-align:center;font-size:10px;color:'+sub+'}',
      '.moose-rw-powered a{color:'+primaryColor+';text-decoration:none;font-weight:600}',

      /* Carousel */
      '.moose-rw-carousel{overflow:hidden;position:relative}',
      '.moose-rw-carousel-track{display:flex;transition:transform .4s ease;will-change:transform}',
      '.moose-rw-carousel-slide{flex:0 0 100%;padding:0 4px;box-sizing:border-box}',
      '.moose-rw-carousel-nav{display:flex;justify-content:center;gap:6px;padding:8px}',
      '.moose-rw-carousel-dot{width:7px;height:7px;border-radius:50%;background:#e5e7eb;cursor:pointer;transition:background .2s}',
      '.moose-rw-carousel-dot.active{background:'+primaryColor+'}',

      /* Grid inline */
      '.moose-rw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:16px}',
      '.moose-rw-grid .moose-rw-card{margin:0}',

      /* List inline */
      '.moose-rw-list-inline{display:flex;flex-direction:column;gap:12px;padding:16px}',

      /* Responsive */
      '@media(max-width:480px){.moose-rw-panel{width:calc(100vw - 32px) !important;left:16px !important;right:16px !important}.moose-rw-badge{bottom:12px;left:12px;right:auto}}',
    ].join('\n');

    var el = document.createElement('style');
    el.id  = 'moose-rw-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── SVG Star ─────────────────────────────────────────────────────────────
  function starSVG(filled) {
    return '<svg class="moose-rw-star" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"' +
      ' fill="' + (filled ? '#f59e0b' : 'none') + '"' +
      ' stroke="' + (filled ? '#f59e0b' : '#d1d5db') + '"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function starsHTML(rating) {
    var html = '<div class="moose-rw-stars">';
    for (var i = 1; i <= 5; i++) html += starSVG(i <= rating);
    html += '</div>';
    return html;
  }

  // ── Platform badge ────────────────────────────────────────────────────────
  var PLATFORM_COLORS = { google:'#4285f4', yelp:'#d32323', facebook:'#1877f2' };
  var PLATFORM_ICONS  = { google:'G', yelp:'Y', facebook:'f' };
  var PLATFORM_BG     = { google:'#eff6ff', yelp:'#fef2f2', facebook:'#eff6ff' };
  var PLATFORM_LABELS = { google:'Google', yelp:'Yelp', facebook:'Facebook' };

  function platformBadge(platform) {
    var color = PLATFORM_COLORS[platform] || '#6b7280';
    var bg    = PLATFORM_BG[platform] || '#f3f4f6';
    var label = PLATFORM_LABELS[platform] || platform;
    return '<span class="moose-rw-platform" style="background:' + bg + ';color:' + color + '">' + label + '</span>';
  }

  // ── Render a single review card ───────────────────────────────────────────
  function renderCard(review, settings) {
    var initials = (review.reviewer_name || '?')[0].toUpperCase();
    var avatarContent = review.reviewer_avatar && settings.show_reviewer_photo
      ? '<img src="' + review.reviewer_avatar + '" alt="" onerror="this.style.display=\'none\'">'
      : initials;
    var date = '';
    if (settings.show_date && review.reviewed_at) {
      var d = new Date(review.reviewed_at);
      date = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
    }
    var responseHTML = '';
    if (settings.show_response && review.response_text) {
      responseHTML = '<div class="moose-rw-response">' +
        '<div class="moose-rw-response-label">Response</div>' +
        '<div class="moose-rw-response-text">' + escapeHTML(review.response_text) + '</div>' +
        '</div>';
    }
    return '<div class="moose-rw-card">' +
      '<div class="moose-rw-card-head">' +
        '<div class="moose-rw-avatar" style="background:' + (PLATFORM_COLORS[review.platform] || '#E8551A') + '">' + avatarContent + '</div>' +
        '<div><div class="moose-rw-name">' + escapeHTML(review.reviewer_name || 'Anonymous') + '</div>' +
        (date ? '<div class="moose-rw-date">' + date + '</div>' : '') + '</div>' +
        (settings.show_platform_icons ? platformBadge(review.platform) : '') +
      '</div>' +
      starsHTML(review.star_rating) +
      '<div class="moose-rw-text">"' + escapeHTML(review.review_text || '') + '"</div>' +
      responseHTML +
      '</div>';
  }

  function escapeHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── BADGE MODE ────────────────────────────────────────────────────────────
  function buildBadge(data) {
    var s = data.settings;
    var position = s.badge_position || POSITION;
    var avg = parseFloat(s.avg_rating) || 0;
    var count = s.total_reviews || data.reviews.length;
    var platforms = [...new Set(data.reviews.map(function(r){ return r.platform; }))].slice(0,3);

    // Badge element
    var badge = document.createElement('div');
    badge.className = 'moose-rw-badge ' + position;
    badge.id = 'moose-rw-badge';

    var starsFull = Math.round(avg);
    var starsRow = '';
    for (var i = 1; i <= 5; i++) starsRow += starSVG(i <= starsFull);

    var logosHTML = platforms.map(function(p) {
      return '<div class="moose-rw-badge-logo" style="background:' + PLATFORM_BG[p] + ';color:' + PLATFORM_COLORS[p] + ';font-weight:700;font-size:10px">' + PLATFORM_ICONS[p] + '</div>';
    }).join('');

    badge.innerHTML =
      '<div class="moose-rw-badge-inner">' +
        '<div>' +
          '<div class="moose-rw-badge-stars">' + starsRow + '</div>' +
          '<div class="moose-rw-badge-rating">' + (avg > 0 ? avg.toFixed(1) : '—') + '</div>' +
        '</div>' +
        '<div class="moose-rw-badge-info">' +
          '<div style="font-size:12px;font-weight:700;color:#111;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHTML(s.business_name || '') + '</div>' +
          '<div class="moose-rw-badge-count">' + count + ' reviews</div>' +
        '</div>' +
        '<div class="moose-rw-badge-logos">' + logosHTML + '</div>' +
      '</div>';

    // Panel (shown on click)
    var panel = document.createElement('div');
    panel.className = 'moose-rw-panel ' + position + ' hidden';
    panel.id = 'moose-rw-panel';

    var listHTML = data.reviews.slice(0, 10).map(function(r) {
      return renderCard(r, s);
    }).join('');

    panel.innerHTML =
      '<div class="moose-rw-panel-head">' +
        '<div class="moose-rw-panel-name">' + escapeHTML(s.business_name || 'Reviews') + '</div>' +
        '<div class="moose-rw-panel-avg">' + (avg > 0 ? avg.toFixed(1) + '★' : '') + '</div>' +
        '<button class="moose-rw-panel-close" id="moose-rw-close">×</button>' +
      '</div>' +
      '<div class="moose-rw-list">' + listHTML + '</div>' +
      '<div class="moose-rw-powered">Powered by <a href="https://mooseai.com" target="_blank">Moose AI</a></div>';

    document.body.appendChild(badge);
    document.body.appendChild(panel);

    // Toggle panel
    badge.addEventListener('click', function() {
      panel.classList.toggle('hidden');
    });
    document.getElementById('moose-rw-close').addEventListener('click', function(e) {
      e.stopPropagation();
      panel.classList.add('hidden');
    });
    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!badge.contains(e.target) && !panel.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });
  }

  // ── CAROUSEL MODE ─────────────────────────────────────────────────────────
  function buildCarousel(container, data) {
    var s = data.settings;
    var reviews = data.reviews;
    var current = 0;

    var cardsHTML = reviews.map(function(r) {
      return '<div class="moose-rw-carousel-slide">' + renderCard(r, s) + '</div>';
    }).join('');

    var dotsHTML = reviews.map(function(_, i) {
      return '<div class="moose-rw-carousel-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></div>';
    }).join('');

    container.innerHTML =
      '<div class="moose-rw-carousel">' +
        '<div class="moose-rw-carousel-track" id="moose-rw-track">' + cardsHTML + '</div>' +
      '</div>' +
      '<div class="moose-rw-carousel-nav" id="moose-rw-nav">' + dotsHTML + '</div>';

    var track = document.getElementById('moose-rw-track');
    var nav   = document.getElementById('moose-rw-nav');

    function goTo(idx) {
      current = (idx + reviews.length) % reviews.length;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      var dots = nav.querySelectorAll('.moose-rw-carousel-dot');
      dots.forEach(function(d, i) { d.classList.toggle('active', i === current); });
    }

    nav.addEventListener('click', function(e) {
      var dot = e.target.closest('.moose-rw-carousel-dot');
      if (dot) goTo(parseInt(dot.getAttribute('data-idx')));
    });

    // Auto-advance every 5 seconds
    setInterval(function() { goTo(current + 1); }, 5000);
  }

  // ── GRID MODE ─────────────────────────────────────────────────────────────
  function buildGrid(container, data) {
    var s = data.settings;
    container.innerHTML = '<div class="moose-rw-grid">' +
      data.reviews.map(function(r) { return renderCard(r, s); }).join('') +
      '</div>';
  }

  // ── LIST MODE ─────────────────────────────────────────────────────────────
  function buildList(container, data) {
    var s = data.settings;
    container.innerHTML = '<div class="moose-rw-list-inline">' +
      data.reviews.map(function(r) { return renderCard(r, s); }).join('') +
      '</div>';
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init(data) {
    var s = data.settings;
    var mode = s.display_mode || MODE;
    var primaryColor = s.primary_color || '#E8551A';

    injectStyles(primaryColor, s.theme || 'light');

    if (mode === 'badge') {
      buildBadge(data);
      return;
    }

    // For non-badge modes, find or create a container div
    var container = document.getElementById('moose-reviews-widget');
    if (!container) {
      container = document.createElement('div');
      container.id = 'moose-reviews-widget';
      // Insert before the script tag if possible
      if (scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag);
      } else {
        document.body.appendChild(container);
      }
    }

    if (mode === 'carousel') buildCarousel(container, data);
    else if (mode === 'grid')  buildGrid(container, data);
    else                       buildList(container, data);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    fetchReviews(function(err, data) {
      if (err) {
        if (err.message === 'DISABLED') {
          console.log('[Moose Reviews] Widget is currently disabled.');
        } else {
          console.warn('[Moose Reviews] Failed to load:', err.message);
        }
        return;
      }
      if (!data || !data.reviews) return;
      init(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
