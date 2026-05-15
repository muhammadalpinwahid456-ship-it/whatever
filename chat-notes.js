/* ===== INSTAGRAM-STYLE NOTES WITH SYNCED LYRICS ===== */

class InstagramNoteViewer {
    constructor() {
        this.currentNote = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.lyrics = [];
        this.youtubePlayer = null;
        this.animationFrameId = null;
        this.ytApiLoading = false;
        this._lyricsCache = {};
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== FETCH LYRICS dari MULTIPLE SOURCES =====
    async fetchLyrics(songTitle, artistName, videoId) {
        const cacheKey = videoId || (songTitle + artistName);
        if (this._lyricsCache[cacheKey]) {
            console.log('📦 Using cached lyrics');
            return this._lyricsCache[cacheKey];
        }

        const query = [songTitle, artistName].filter(Boolean).join(' ').trim();
        if (!query) {
            console.log('⚠️ Empty query, skipping lyrics');
            return [];
        }

        console.log('🎵 Fetching lyrics for:', query);

        // Try multiple sources in order
        let lyrics = [];
        
        // Source 1: LRCLIB (Primary)
        lyrics = await this._fetchFromLRCLIB(query);
        if (lyrics.length > 0) {
            console.log('✅ Got lyrics from LRCLIB');
            this._lyricsCache[cacheKey] = lyrics;
            return lyrics;
        }

        // Source 2: Try with YouTube metadata if available
        if (videoId) {
            lyrics = await this._fetchFromYouTubeMetadata(videoId);
            if (lyrics.length > 0) {
                console.log('✅ Got lyrics from YouTube');
                this._lyricsCache[cacheKey] = lyrics;
                return lyrics;
            }
        }

        // Source 3: GENIUS API (Backup)
        lyrics = await this._fetchFromGenius(songTitle, artistName);
        if (lyrics.length > 0) {
            console.log('✅ Got lyrics from GENIUS');
            this._lyricsCache[cacheKey] = lyrics;
            return lyrics;
        }

        // Source 4: Local fallback
        console.log('⚠️ No lyrics found from any source, using fallback');
        lyrics = this._generateFallbackLyrics(songTitle, artistName);
        this._lyricsCache[cacheKey] = lyrics;
        return lyrics;
    }

    // ===== SOURCE 1: LRCLIB =====
    async _fetchFromLRCLIB(query) {
        try {
            console.log('🔗 LRCLIB: Searching for:', query);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                console.warn('⚠️ LRCLIB HTTP error:', res.status);
                return [];
            }

            const results = await res.json();
            if (!results || results.length === 0) {
                console.warn('⚠️ LRCLIB: No results found');
                return [];
            }

            // Find best match with synced lyrics
            for (const result of results) {
                if (result.syncedLyrics) {
                    const parsed = this.parseSyncedLyrics(result.syncedLyrics);
                    if (parsed.length > 0) return parsed;
                }
            }

            // Fallback to plain lyrics
            for (const result of results) {
                if (result.plainLyrics) {
                    const parsed = this.parsePlainLyrics(result.plainLyrics);
                    if (parsed.length > 0) return parsed;
                }
            }

            console.warn('⚠️ LRCLIB: Results found but no lyrics content');
            return [];
        } catch (err) {
            console.error('❌ LRCLIB error:', err.message);
            return [];
        }
    }

    // ===== SOURCE 2: YOUTUBE METADATA =====
    async _fetchFromYouTubeMetadata(videoId) {
        try {
            console.log('🔗 YouTube: Fetching metadata for:', videoId);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Try noembed (no API key needed)
            const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, 
                { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) return [];

            const data = await res.json();
            if (data.description && data.description.includes('lyrics')) {
                console.log('📝 Found lyrics mention in description');
                return this.parsePlainLyrics(data.description);
            }

            return [];
        } catch (err) {
            console.warn('⚠️ YouTube metadata error:', err.message);
            return [];
        }
    }

    // ===== SOURCE 3: GENIUS API (Backup) =====
    async _fetchFromGenius(songTitle, artistName) {
        try {
            console.log('🔗 GENIUS: Searching for:', songTitle, artistName);
            
            // GENIUS memerlukan API key, tapi kita bisa coba dengan simple approach
            // Catatan: Ini adalah demo, untuk production perlu backend proxy
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const query = `${songTitle} ${artistName}`.trim();
            const url = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
            
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                console.warn('⚠️ GENIUS HTTP error:', res.status);
                return [];
            }

            const data = await res.json();
            // Parse if needed - GENIUS API memiliki struktur berbeda
            console.log('✅ GENIUS response received');
            return [];

        } catch (err) {
            console.warn('⚠️ GENIUS error:', err.message);
            return [];
        }
    }

    // ===== FALLBACK: Generate Simple Lyrics =====
    _generateFallbackLyrics(songTitle, artistName) {
        console.log('💡 Generating fallback lyrics...');
        
        const lines = [
            '🎵 ' + (songTitle || 'Lagu'),
            '🎤 ' + (artistName || 'Artis'),
            '',
            '🎧 Sedang diputar...',
            '',
            '(Lirik tidak tersedia)',
            'Nikmati musiknya! 🎶'
        ];

        return lines.map((text, i) => ({
            time: i * 3,
            text: text
        }));
    }

    parseSyncedLyrics(raw) {
        const parsed = [];
        try {
            raw.split('\n').forEach(line => {
                const m = line.match(/\[(\d+):(\d+\.?\d*)\](.*)/);
                if (m) {
                    const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
                    const text = m[3].trim();
                    if (text) parsed.push({ time, text });
                }
            });
            if (parsed.length === 0) {
                console.warn('⚠️ No synced lyrics parsed');
            }
        } catch (err) {
            console.error('❌ Parse synced lyrics error:', err);
        }
        return parsed;
    }

    parsePlainLyrics(raw) {
        try {
            const lines = raw.split('\n').filter(l => l.trim());
            return lines.slice(0, 100).map((text, i) => ({
                time: i * 4,
                text: text.trim()
            }));
        } catch (err) {
            console.error('❌ Parse plain lyrics error:', err);
            return [];
        }
    }

    // ===== RENDER LYRICS dengan scroll aktif ke tengah =====
    renderLyrics(currentTime) {
        const container = document.getElementById('insta-lyrics-container');
        if (!container) return;
        
        if (this.lyrics.length === 0) {
            container.innerHTML = '<p class="no-lyrics-message">😔 Lirik tidak tersedia</p>';
            return;
        }

        let activeIdx = 0;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (currentTime >= this.lyrics[i].time) activeIdx = i;
            else break;
        }

        container.innerHTML = '';
        this.lyrics.forEach((line, i) => {
            const el = document.createElement('div');
            el.className = 'lyrics-line' + (i === activeIdx ? ' active' : i < activeIdx ? ' past' : ' upcoming');
            el.textContent = line.text;
            container.appendChild(el);
        });

        // Scroll baris aktif ke tengah (Instagram style)
        const activeEl = container.querySelectorAll('.lyrics-line')[activeIdx];
        if (activeEl) {
            const mid = container.offsetHeight / 2;
            container.scrollTo({ top: activeEl.offsetTop - mid + activeEl.offsetHeight / 2, behavior: 'smooth' });
        }
    }

    // ===== YOUTUBE IFRAME API =====
    loadYouTubeAPI() {
        return new Promise((resolve) => {
            if (window.YT && window.YT.Player) { 
                resolve(); 
                return; 
            }
            if (this.ytApiLoading) {
                const chk = setInterval(() => { 
                    if (window.YT && window.YT.Player) { 
                        clearInterval(chk); 
                        resolve(); 
                    } 
                }, 100);
                return;
            }
            this.ytApiLoading = true;
            window.onYouTubeIframeAPIReady = () => { 
                this.ytApiLoading = false; 
                resolve(); 
            };
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        });
    }

    async initPlayer(videoId) {
        await this.loadYouTubeAPI();
        if (this.youtubePlayer && this.youtubePlayer.destroy) {
            try { 
                this.youtubePlayer.destroy(); 
            } catch(e) {}
        }
        this.youtubePlayer = null;
        return new Promise((resolve) => {
            this.youtubePlayer = new YT.Player('insta-yt-player', {
                height: '1', 
                width: '1', 
                videoId,
                playerVars: { 
                    autoplay: 0, 
                    controls: 0, 
                    origin: location.origin 
                },
                events: {
                    onReady: (e) => {
                        this.duration = e.target.getDuration();
                        const durEl = document.getElementById('insta-duration');
                        if (durEl) durEl.textContent = this.formatTime(this.duration);
                        resolve();
                    },
                    onStateChange: (e) => {
                        if (e.data === YT.PlayerState.PLAYING) {
                            this.isPlaying = true; 
                            this._tick(); 
                            this._updatePlayBtn(true);
                        } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                            this.isPlaying = false; 
                            cancelAnimationFrame(this.animationFrameId); 
                            this._updatePlayBtn(false);
                        }
                    },
                    onError: (e) => { 
                        console.error('🔴 YT error:', e.data); 
                        this._fallback(videoId); 
                        resolve(); 
                    }
                }
            });
        });
    }

    _fallback(videoId) {
        const w = document.getElementById('insta-yt-wrapper');
        if (w) w.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1" width="100%" height="60" frameborder="0" allow="autoplay;encrypted-media" style="border-radius:8px;position:relative;opacity:1;pointer-events:auto;width:100%;height:60px;"></iframe>`;
    }

    _tick() {
        if (!this.youtubePlayer || !this.isPlaying) return;
        try { 
            this.currentTime = this.youtubePlayer.getCurrentTime() || 0; 
        } catch(e) { 
            return; 
        }
        const ctEl = document.getElementById('insta-current-time');
        if (ctEl) ctEl.textContent = this.formatTime(this.currentTime);
        const prog = document.getElementById('insta-progress');
        if (prog && this.duration > 0) prog.style.width = ((this.currentTime / this.duration) * 100) + '%';
        this.renderLyrics(this.currentTime);
        this.animationFrameId = requestAnimationFrame(() => this._tick());
    }

    _updatePlayBtn(playing) {
        const btn = document.getElementById('insta-play-btn');
        if (!btn) return;
        btn.innerHTML = playing
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;
    }

    togglePlay() {
        if (!this.youtubePlayer) return;
        if (this.isPlaying) this.youtubePlayer.pauseVideo();
        else this.youtubePlayer.playVideo();
    }

    // ===== BUKA MODAL =====
    async open(userId, note) {
        this.close();
        this.currentNote = { userId, ...note };
        this.isPlaying = false; 
        this.currentTime = 0; 
        this.lyrics = [];

        const modal = document.createElement('div');
        modal.id = 'insta-note-modal';
        modal.className = 'insta-note-overlay';
        modal.innerHTML = this._buildHTML(userId, note);
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { 
            if (e.target === modal) this.close(); 
        });

        const songTitle = note.songTitle || note.text || '';
        const artistName = note.artistName || '';

        console.log('🎬 Opening note viewer...');
        console.log('  Song:', songTitle);
        console.log('  Artist:', artistName);
        console.log('  Video ID:', note.youtubeId);

        // Fetch lyrics dan init player secara paralel
        const [lyrics] = await Promise.all([
            this.fetchLyrics(songTitle, artistName, note.youtubeId),
            note.youtubeId ? this.initPlayer(note.youtubeId).catch(e => { 
                console.error('Player init error:', e); 
                this._fallback(note.youtubeId); 
            }) : Promise.resolve()
        ]);

        this.lyrics = lyrics || [];
        this.renderLyrics(0);
    }

    _buildHTML(userId, note) {
        const likeCount = Object.keys(note.likes || {}).length;
        const replyCount = Object.keys(note.replies || {}).length;
        const liked = note.likes && window._currentUserId && note.likes[window._currentUserId];
        const songTitle = this.escapeHtml(note.songTitle || note.text || 'Judul tidak diketahui');
        const artistName = this.escapeHtml(note.artistName || 'Artis tidak diketahui');
        const timeAgo = window._formatTimeAgo ? window._formatTimeAgo(note.updatedAt) : '';

        return `
        <div class="insta-note-card">
            <div class="insta-note-header">
                <img class="insta-avatar" src="${this.escapeHtml(note.userPhoto||'https://via.placeholder.com/40')}" onerror="this.src='https://via.placeholder.com/40'" alt="">
                <div class="insta-user-info">
                    <div class="insta-username">${this.escapeHtml(note.userName||'User')}</div>
                    <div class="insta-time">${timeAgo}</div>
                </div>
                <button class="insta-close-btn" onclick="window.instagramNoteViewer.close()">✕</button>
            </div>

            <div class="insta-song-info">
                <span class="insta-song-icon">🎵</span>
                <div>
                    <div class="insta-song-title">${songTitle}</div>
                    <div class="insta-song-artist">${artistName}</div>
                </div>
            </div>

            <div class="insta-lyrics-wrap">
                <div class="insta-lyrics-container" id="insta-lyrics-container">
                    <p class="no-lyrics-message">⏳ Memuat lirik...</p>
                </div>
                <div class="insta-lyrics-fade-top"></div>
                <div class="insta-lyrics-fade-bottom"></div>
            </div>

            <div class="insta-player-wrap">
                <div class="insta-time-row">
                    <span id="insta-current-time">0:00</span>
                    <span id="insta-duration">0:00</span>
                </div>
                <div class="insta-progress-bar" id="insta-progress-bar" onclick="window.instagramNoteViewer._seekClick(event)">
                    <div class="insta-progress-fill" id="insta-progress"></div>
                </div>
                <div class="insta-controls">
                    <button class="insta-play-btn" id="insta-play-btn" onclick="window.instagramNoteViewer.togglePlay()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                    </button>
                </div>
                <div id="insta-yt-wrapper" style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;">
                    <div id="insta-yt-player"></div>
                </div>
            </div>

            <div class="insta-note-actions">
                <button class="insta-action-btn ${liked?'liked':''}" onclick="window.instagramNoteViewer._toggleLike('${userId}')">
                    ${liked?'❤️':'🤍'} <span id="insta-like-count">${likeCount}</span> Suka
                </button>
                <button class="insta-action-btn" onclick="window.instagramNoteViewer._focusReply()">
                    💬 ${replyCount} Balas
                </button>
                <button class="insta-action-btn insta-dm-btn" onclick="window.instagramNoteViewer._replyViaDM('${userId}')">
                    ✉️ DM
                </button>
            </div>

            <div class="insta-reply-wrap">
                <input type="text" id="insta-reply-input" class="insta-reply-input"
                       placeholder="Balas di sini atau kirim DM..." maxlength="100"
                       onkeypress="if(event.key==='Enter') window.instagramNoteViewer._sendReply('${userId}')">
                <button class="insta-reply-send" onclick="window.instagramNoteViewer._sendReply('${userId}')">Kirim</button>
            </div>
        </div>`;
    }

    _seekClick(e) {
        if (!this.youtubePlayer || !this.duration) return;
        const bar = document.getElementById('insta-progress-bar');
        const rect = bar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const seekTo = pct * this.duration;
        this.youtubePlayer.seekTo(seekTo, true);
    }

    async _toggleLike(userId) {
        if (!window._currentUserId) return;
        const likeRef = window._dbRef(window._database, `notes/${userId}/likes/${window._currentUserId}`);
        try {
            const snap = await window._dbGet(likeRef);
            await window._dbSet(likeRef, snap.exists() ? null : true);
            const snap2 = await window._dbGet(window._dbRef(window._database, `notes/${userId}/likes`));
            const likes = snap2.exists() ? snap2.val() : {};
            const count = Object.keys(likes).length;
            const liked = !!likes[window._currentUserId];
            const btn = document.querySelector('#insta-note-modal .insta-action-btn');
            if (btn) {
                btn.className = `insta-action-btn ${liked?'liked':''}`;
                btn.innerHTML = `${liked?'❤️':'🤍'} <span id="insta-like-count">${count}</span> Suka`;
            }
        } catch(err) { 
            console.error('Like error:', err); 
        }
    }

    _focusReply() {
        const el = document.getElementById('insta-reply-input');
        if (el) el.focus();
    }

    async _sendReply(userId) {
        if (!window._currentUserId) return;
        const input = document.getElementById('insta-reply-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;
        try {
            await window._dbPush(window._dbRef(window._database, `notes/${userId}/replies`), {
                userId: window._currentUserId,
                userName: window._currentUserName || 'User',
                userPhoto: window._currentUserPhoto || '',
                text, 
                timestamp: Date.now()
            });
            if (input) input.value = '';
        } catch(err) { 
            alert('❌ Gagal kirim balasan: ' + err.message); 
        }
    }

    _replyViaDM(userId) {
        if (!this.currentNote) return;
        const note = this.currentNote;
        this.close();
        if (window.openDMWithNote) {
            window.openDMWithNote(userId, note);
        } else {
            console.warn('openDMWithNote not available');
        }
    }

    close() {
        cancelAnimationFrame(this.animationFrameId);
        this.isPlaying = false;
        if (this.youtubePlayer) { 
            try { 
                this.youtubePlayer.stopVideo(); 
            } catch(e) {} 
        }
        const modal = document.getElementById('insta-note-modal');
        if (modal) modal.remove();
        this.lyrics = []; 
        this.currentTime = 0;
    }
}

window.instagramNoteViewer = new InstagramNoteViewer();
