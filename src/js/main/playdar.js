/* Playdar */
var PLAYDAR = {
    sm2Container: $('#sm2-container'),
    maxVideoWidth: 556,
    soundmanager_ready: function (status) {
        if (status.success) {
            Playdar.client.go();
            // Check URL hash
            PLAYLICK.checkUrlHash();
            // Load playlists
            CONTROLLERS.Playlist.fetchAll();
        } else {
            PLAYDAR.update_status(STRINGS.loading_flash_error_text);
        }
    },
    
    playdar_listeners: {
        onStartStat: function () {
            PLAYDAR.update_status(STRINGS.loading_playdar_text);
        },
        onStat: function (detected) {
            if (detected) {
                if (!detected.authenticated) {
                    var connect_link = Playdar.client.get_auth_link_html(
                        STRINGS.connect_to_playdar_text
                    );
                    PLAYDAR.update_status('<strong>' + connect_link + '</strong>');
                }
            } else {
                PLAYDAR.update_status(
                    STRINGS.playdar_unavailable_text
                  + ' ' + Playdar.client.get_stat_link_html()
                  + ' ' + STRINGS.download_playdar_text
                );
            }
        },
        onAuth: function () {
            var disconnect_link = Playdar.client.get_disconnect_link_html(
                STRINGS.disconnect_from_playdar_text
            );
            PLAYDAR.update_status('<strong>' + STRINGS.connected_to_playdar_text + '</strong> ' + disconnect_link);
            PLAYDAR.resolve_current_playlist();
        },
        onResolveIdle: function () {
            if (CONTROLLERS.Playlist.current && PLAYLICK.batch_save) {
                CONTROLLERS.Playlist.current.save();
                PLAYLICK.batch_save = false;
            }
        }
    },
    update_status: function (message) {
        $('#playdarStatus').html(message);
    },
    // Load playdar resolution results
    loadTrackResults: function (playlist_track, response) {
        playlist_track.playdar_qid = response.qid;
        playlist_track.playdar_response = response;
        PLAYDAR.buildResultsTable(playlist_track, response);
    },
    // Render playdar results table
    buildResultsTable: function (playlist_track, response) {
        var listItem = playlist_track.element;
        listItem.removeClass('scanning');
        if (!response.results.length) {
            listItem.addClass('noMatch');
            return false;
        }
        listItem.addClass('match');
        var resultsForm = $('<form>');
        var resultsTable = $('<table cellspacing="0"></table>');
        var foundPerfect = false;
        
        UTIL.sortByProperty(response.results, 'score', true);
        $.each(response.results, function (i, result) {
            // Check mimetype
            var mimetype = result.mimetype || '';
            var video = mimetype.match(/^video/);
            // Register sound
            Playdar.player.register_stream(result, {
                chained: true,
                video: video,
                onload: PLAYDAR.onResultLoad,
                onmetadata: PLAYDAR.onResultMetadata,
                onplay: PLAYDAR.onResultStart,
                onpause: PLAYDAR.onResultPause,
                onresume: PLAYDAR.onResultPlay,
                onstop: PLAYDAR.onResultStop,
                onfinish: PLAYDAR.onResultFinish,
                whileplaying: PLAYDAR.updatePlaybackProgress,
                whileloading: PLAYDAR.updateLoadProgress
            });
            // Build result table item
            var scoreCell = $('<td class="score">');
            var choiceRadio = $('<input type="radio" name="choice">').val(result.sid);
            var perfectMatch = result.score > 0.99;
            if (perfectMatch) {
                // Perfect scores get a star and a highlight
                scoreCell.text('★').addClass('perfect');
            } else if (result.score > 0) {
                scoreCell.text(result.score.toFixed(3));
            } else {
                scoreCell.html('&nbsp;');
            }
            var nameCell = $('<td class="name" colspan="5">');
            var artistAlbum = result.artist;
            if (result.album) {
                artistAlbum += ' - ' + result.album;
                var albumArt = IMPORTERS.LastFm.getAlbumArt(result.artist, result.album);
                nameCell.append($('<img width="34" height="34">').attr('src', albumArt));
            }
            nameCell.append($('<span>').text(result.track));
            nameCell.append('<br>' + artistAlbum);
            var trackRow = $('<tr class="track">')
                .append($('<td class="choice">')
                    .append(choiceRadio))
                .append(nameCell);
            var duration = result.duration ? Playdar.Util.mmss(result.duration) : '';
            var size = result.size ? ((result.size/1000000).toFixed(1) + 'MB') : '';
            var bitrate = result.bitrate ? (result.bitrate + ' kbps') : '';
            var source = result.source || '';
            var sourceCell = $('<td class="source">');
            if (result.url) {
                sourceCell.append(
                    $('<a>')
                        .attr('href', result.url)
                        .text(source)
                );
            } else {
                sourceCell.text(source);
            }
            
            var infoRow = $('<tr class="info">')
                .append(scoreCell)
                .append(sourceCell)
                .append($('<td class="time">').text(duration))
                .append($('<td class="size">').text(size))
                .append($('<td class="mimetype">').text(mimetype))
                .append($('<td class="bitrate">').text(bitrate));
            var resultTbody = $('<tbody>')
                .attr('id', 's_' + result.sid)
                .append(trackRow)
                .append(infoRow)
                .data('result', result)
                .data('track_item', listItem)
                .addClass('result');
            // Add video classes to the tbody and main track list item
            if (video) {
                resultTbody.addClass('video');
                listItem.addClass('video');
            }
            resultsTable.append(resultTbody);
            // We need to save the perfect result till after it's been added
            // to the DOM so we can call PLAYDAR.selectSource on it
            if (perfectMatch && !foundPerfect) {
                foundPerfect = resultTbody;
            }
        });
        // Add to the DOM
        resultsForm.append(resultsTable);
        var sources = listItem.children('.sources');
        sources.html(resultsForm);
        // Select perfect result
        if (foundPerfect) {
            PLAYDAR.selectSource(playlist_track, foundPerfect);
        }
    },
    buildUrlResponse: function (playlist_track) {
        var urlResponse = {
            qid: Playdar.Util.generate_uuid(),
            results: [{
                score: 1,
                preference: 80,
                url: playlist_track.track.url,
                artist: playlist_track.track.artist,
                album: playlist_track.track.album,
                track: playlist_track.track.name,
                source: Playdar.Util.location_from_url(playlist_track.track.url).host,
                duration: playlist_track.track.duration,
                size: playlist_track.track.size,
                mimetype: playlist_track.track.mimetype
            }]
        };
        return urlResponse;
    },
    // Generate a query ID and a results handler for a track
    track_handler: function (playlist_track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            if (final_answer) {
                PLAYDAR.loadTrackResults(playlist_track, response);
            }
        }, uuid);
        return uuid;
    },
    recheck_track: function (playlist_track) {
        if (Playdar.client && Playdar.client.isAvailable() && Playdar.client.is_authed()) {
            if (playlist_track.playdar_qid) {
                playlist_track.element.addClass('scanning');
                Playdar.client.recheck_results(playlist_track.playdar_qid);
            }
        }
    },
    resolve_track: function (playlist_track, force) {
        var track = playlist_track.track;
        if (!force && playlist_track.playdar_response) {
            PLAYDAR.loadTrackResults(playlist_track, playlist_track.playdar_response);
        } else if (track.url) {
            PLAYDAR.loadTrackResults(playlist_track, PLAYDAR.buildUrlResponse(playlist_track));
        } else {
            var qid = PLAYDAR.track_handler(playlist_track);
            if (Playdar.client && Playdar.client.isAvailable() && Playdar.client.is_authed()) {
                playlist_track.element.removeClass('noMatch match perfectMatch video');
                playlist_track.element.addClass('scanning');
                Playdar.client.resolve(track.artist, track.name, track.album, qid);
            } else {
                playlist_track.element.removeClass('noMatch match perfectMatch video');
                playlist_track.element.addClass('scanning');
                PLAYDAR.aolResolve(track.artist, track.name, track.album, qid);
            }
        }
    },
    aolResolve: function (artist, track, album, qid) {
        var response = {
            qid: qid,
            query: {
                artist: artist,
                track: track,
                album: album
            },
            solved: false,
            results: []
        };
        
        if (!artist || !track) {
            Playdar.client.handleResultsCallback(response, true);
            return;
        }
        var aolUrl = 'http://music.aol.com/api/audio/search?c=?';
        $.getJSON(aolUrl, {
            start: 0,
            count: 5,
            artistName: artist,
            songTitle: track
        }, function (json) {
            if (json.response.data) {
                response.results = $.map(json.response.data.assets, function (result, i) {
                    var score = 0.8;
                    if (UTIL.compareString(result.artistname, artist)
                     && UTIL.compareString(result.songtitle, track)) {
                         score = 1;
                         response.solved = true;
                    }
                    return {
                        artist: result.artistname,
                        track: result.songtitle,
                        album: result.albumname,
                        duration: result.duration - 0,
                        url: result.enclosure,
                        source: Playdar.Util.location_from_url(result.enclosure).host,
                        score: score,
                        preference: 80
                    };
                });
            }
            Playdar.client.handleResultsCallback(response, true);
        });
    },
    resolve_current_playlist: function () {
        if (CONTROLLERS.Playlist.current) {
            $.each(CONTROLLERS.Playlist.current.tracks, function (i, playlist_track) {
                PLAYDAR.resolve_track(playlist_track);
            });
        }
    },
    cancel_playdar_resolve: function () {
        if (Playdar.client) {
            Playdar.client.cancel_resolve();
        }
        CONTROLLERS.Playlist.trackListElem.find('li').removeClass('scanning');
    },
    
    /* Playback */
    
    // Not called when served from cache
    onResultLoad: function () {
        if (this.duration) {
            PLAYDAR.updateStreamDuration(this.sID, this.duration);
        }
        var trackSource = $('#' + this.sID);
        var track_item = trackSource.data('track_item');
        if (this.readyState == 2 || !this.duration) {
            // Loading failed
            if (track_item) {
                // Playlist currently loaded
                // Mark the source as an error and try the next available source
                trackSource.addClass('error');
                if (PLAYDAR.playNextSource(trackSource)) {
                    return track_item;
                }
                // No sources remaining
                // Mark the track as an error and try the next available track
                track_item.addClass('error');
                if (PLAYDAR.playNextTrack(track_item)) {
                    return track_item;
                }
            }
            // No tracks remain to play in the currently loaded playlist.
            // Stop the session
            PLAYDAR.stopPlaySession();
        }
        return track_item;
    },
    onResultMetadata: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            track_item.removeClass('loading');
            PLAYDAR.positionVideo.call(this);
        }
    },
    onResultStart: function () {
        var track_item = PLAYDAR.onResultPlay.call(this);
        if (track_item) {
            track_item.addClass('loading');
            var playlist_track = track_item.data('playlist_track');
            // Update Playlist state
            CONTROLLERS.Playlist.setPlaying(playlist_track);
            // Update the playback meter
            PLAYDAR.updatePlaybackProgress.call(this);
        }
    },
    onResultPause: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            // Switch track highlight in the playlist
            track_item.removeClass('playing');
            track_item.addClass('paused');
        }
        return track_item;
    },
    onResultPlay: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            // Highlight the track in the playlist
            track_item.removeClass('paused');
            track_item.removeClass('error');
        }
        return track_item;
    },
    showSM2Container: function () {
        PLAYDAR.sm2Container.css('visibility', 'visible');
    },
    hideSM2Container: function () {
        PLAYDAR.sm2Container.css('visibility', 'hidden');
    },
    positionVideo: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item && this.width && this.height) {
            var videoShim = track_item.find('.videoShim');
            if (videoShim.size()) {
                var width = this.width;
                var height = this.height;
                if (width > PLAYDAR.maxVideoWidth) {
                    var aspectRatio = height / width;
                    width = PLAYDAR.maxVideoWidth;
                    height = aspectRatio * width;
                }
                videoShim
                    .width(width)
                    .height(height)
                    .show();
                var position = videoShim.offset();
                videoShim.width('100%');
                PLAYDAR.positionSM2Container(position, width, height);
            }
        }
    },
    positionSM2Container: function (position, width, height) {
        if (PLAYDAR.sm2Container.css('visibility') == 'hidden') {
            var contentOffset = $('#content').offset();
            PLAYDAR.sm2Container
                .width(width)
                .height(height)
                .css({
                    top: position.top - contentOffset.top - 1,
                    left: position.left - contentOffset.left
                });
            PLAYDAR.showSM2Container();
        }
    },
    resetSM2Container: function () {
        CONTROLLERS.Playlist.trackListElem.find('.videoShim').hide();
        PLAYDAR.sm2Container
            .width(PLAYDAR.originalSM2Width)
            .height(PLAYDAR.originalSM2Height)
            .css({
                top: PLAYDAR.originalSM2Top,
                left: PLAYDAR.originalSM2Left
            });
        PLAYDAR.hideSM2Container();
    },
    resetResult: function () {
        this.width = this.height = null;
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Hide video and reset sm2 position
            PLAYDAR.resetSM2Container();
            // Remove track status classes
            track_item
                .removeClass('playing')
                .removeClass('paused')
                .removeClass('loading')
                // Reset progress bar
                .css('background-position', '0 0');
            // Reset elapsed counter
            var progress = track_item.find('.elapsed');
            progress.text(playlist_track.track.get_duration_string());
            // Reset loading bar
            var loading = track_item.find('.loading');
            loading.width(0);
        }
        return track_item;
    },
    onResultStop: function () {
        // Reset the track
        var track_item = PLAYDAR.resetResult.call(this);
        return track_item;
    },
    stopPlaySession: function () {
        // Stop the player
        Playdar.player.stop_current(true);
        // Update Playlist state
        CONTROLLERS.Playlist.setPlaying();
    },
    onResultFinish: function () {
        // Reset the track
        var track_item = PLAYDAR.resetResult.call(this);
        // Chain playback to the next perfect match
        if (track_item) {
            if (PLAYDAR.playNextTrack(track_item)) {
                return true;
            }
        }
        // Otherwise hard stop play session
        PLAYDAR.stopPlaySession();
        return track_item;
    },
    updatePlaybackProgress: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Position video if we can
            PLAYDAR.positionVideo.call(this);
            // Update the track progress
            var progress = track_item.find('.elapsed');
            var elapsed = '';
            if (this.position) {
                elapsed += '<strong>' + Playdar.Util.mmss(Math.round(this.position/1000)) + '</strong>';
                if (playlist_track.track.duration) {
                    elapsed += ' / ';
                }
            }
            if (playlist_track.track.duration) {
                elapsed += playlist_track.track.get_duration_string();
            }
            progress.html(elapsed);
            // Update the playback progress bar
            var duration;
            if (this.readyState == 3) { // loaded/success
                duration = this.duration;
            } else {
                duration = this.durationEstimate;
            }
            var portion_played = this.position / duration;
            track_item.css('background-position', Math.round(portion_played * track_item.width()) + 'px 0');
            track_item.addClass('playing');
        }
        return track_item;
    },
    updateLoadProgress: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            if (!playlist_track.playdar_result.video) {
                track_item.removeClass('loading');
            }
            var loading = track_item.find('.loading');
            var loaded = this.bytesLoaded/this.bytesTotal * 100;
            loading.width(loaded + "%");
            PLAYDAR.updateStreamDuration(this.sID, this.durationEstimate, loaded < 100);
        }
    },
    updateStreamDuration: function (sid, duration, estimate) {
        var track_item = $('#' + sid).data('track_item');
        if (track_item) {
            var progress = track_item.find('.elapsed');
            if (estimate) {
                progress.addClass('estimate');
            } else {
                progress.removeClass('estimate');
            }
            var playlist_track = track_item.data('playlist_track');
        }
        return track_item;
    },
    playTrack: function (playlist_track) {
        if (playlist_track && playlist_track.play()) {
            playlist_track.element.effect('highlight', {
                color: '#6ea31e'
            }, 100);
        }
    },
    playNextTrack: function (track_item) {
        var next_playlist_track = track_item.nextAll('li.perfectMatch').data('playlist_track');
        if (next_playlist_track) {
            PLAYDAR.playTrack(next_playlist_track);
            return true;
        }
        return false;
    },
    playPreviousTrack: function (track_item) {
        var next_playlist_track = track_item.prevAll('li.perfectMatch').data('playlist_track');
        if (next_playlist_track) {
            PLAYDAR.playTrack(next_playlist_track);
            return true;
        }
        return false;
    },    
    selectSource: function (playlist_track, tbody) {
        // Check radio button
        var radio = tbody.find('input[name=choice]');
        radio.attr('checked', true);
        // Highlight result
        tbody.siblings().removeClass('choice');
        tbody.addClass('choice');
        // Highlight track
        playlist_track.element.addClass('perfectMatch');
        // Update track with result data
        var result = tbody.data('result');
        // Update the duration, but don't persist
        playlist_track.set_track_duration(result.duration);
        playlist_track.element.find('.elapsed').text(playlist_track.track.get_duration_string());
        // If the result changed, stop the stream if it's playing
        if (playlist_track.playdar_result && (playlist_track.playdar_result.sid != result.sid)) {
            playlist_track.stop();
        }
        // Set result
        // Update the result
        playlist_track.playdar_result = result;
    },
    playSource: function (playlist_track, trackSource) {
        PLAYDAR.selectSource(playlist_track, trackSource);
        if (!Playdar.player.is_now_playing()) {
            PLAYDAR.playTrack(playlist_track);
        }
    },
    playNextSource: function (trackSource) {
        var track_item = trackSource.data('track_item');
        var nextSource = trackSource.nextAll('tbody:not(.error):first');
        if (nextSource.size()) {
            PLAYDAR.playSource(track_item.data('playlist_track'), nextSource);
            return true;
        }
        return false;
    },
    playPreviousSource: function (trackSource) {
        var track_item = trackSource.data('track_item');
        var previousSource = trackSource.prevAll('tbody:not(.error):first');
        if (previousSource.size()) {
            PLAYDAR.playSource(track_item.data('playlist_track'), previousSource);
            return true;
        }
        return false;
    }
};

PLAYDAR.originalSM2Width = PLAYDAR.sm2Container.width();
PLAYDAR.originalSM2Height = PLAYDAR.sm2Container.height();
PLAYDAR.originalSM2Top = PLAYDAR.sm2Container.css('top');
PLAYDAR.originalSM2Left = PLAYDAR.sm2Container.css('left');