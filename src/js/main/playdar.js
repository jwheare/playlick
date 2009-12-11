/* Playdar */
var PLAYDAR = {
    sm2Container: $('#sm2-container'),
    maxVideoWidth: 556,
    soundmanager_ready: function (status) {
        if (status.success) {
            Playdar.client.go();
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
    // Render playdar results table
    build_results_table: function (response, list_item) {
        var tbody_class,
            score_cell, choice_radio, album_art, name_cell,
            track_row, info_row, result_tbody;
        
        var results_form = $('<form>');
        var results_table = $('<table cellspacing="0"></table>');
        var found_perfect = false;
        
        $.each(response.results, function (i, result) {
            // Register sound
            Playdar.player.register_stream(result, {
                chained: true,
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
            tbody_class = 'result';
            score_cell = $('<td class="score">');
            choice_radio = $('<input type="radio" name="choice">').val(result.sid);
            if (result.score > 0.99) {
                // Perfect scores get a star and a highlight
                score_cell.text('★').addClass('perfect');
                if (!found_perfect) {
                    // The first perfect score is checked and its tbody is given a highlight
                    tbody_class += ' choice';
                    choice_radio.attr('checked', true);
                }
                found_perfect = true;
            } else if (result.score > 0) {
                score_cell.text(result.score.toFixed(3));
            } else {
                score_cell.html('&nbsp;');
            }
            name_cell = $('<td class="name" colspan="5">');
            var artist_album = result.artist;
            if (result.album) {
                artist_album += ' - ' + result.album;
                album_art = IMPORTERS.LastFm.getAlbumArt(result.artist, result.album);
                name_cell.append($('<img width="34" height="34">').attr('src', album_art));
            }
            name_cell.append($('<span>').text(result.track));
            name_cell.append('<br>' + artist_album);
            track_row = $('<tr class="track">')
                .append($('<td class="choice">').append(choice_radio))
                .append(name_cell);
            var duration = '';
            if (result.duration) {
                duration = Playdar.Util.mmss(result.duration);
            }
            var size = '';
            if (result.size) {
                size = (result.size/1000000).toFixed(1) + 'MB';
            }
            var mimetype = '';
            if (result.mimetype) {
                mimetype = result.mimetype;
                if (mimetype.match(/^video/)) {
                    result.video = true;
                    tbody_class += ' video';
                }
            }
            var bitrate = '';
            if (result.bitrate) {
                bitrate = result.bitrate + ' kbps';
            }
            info_row = $('<tr class="info">')
                .append(score_cell)
                .append($('<td class="source">').text((result.source ? result.source : '')/* + (result.preference ? ' (' + result.preference + ')' : '')*/))
                .append($('<td class="time">').text(duration))
                .append($('<td class="size">').text(size))
                .append($('<td class="mimetype">').text(mimetype))
                .append($('<td class="bitrate">').text(bitrate));
            result_tbody = $('<tbody>')
                .attr('id', 's_' + result.sid)
                .addClass(tbody_class)
                .append(track_row)
                .append(info_row)
                .data('result', result)
                .data('track_item', list_item);
            results_table.append(result_tbody);
        });
        results_form.append(results_table);
        return results_form;
    },
    // Load playdar resolution results
    load_track_results: function (playlist_track, response, final_answer) {
        var list_item = playlist_track.element;
        playlist_track.track.playdar_qid = response.qid;
        if (final_answer) {
            list_item.removeClass('scanning');
            if (response.results.length) {
                playlist_track.track.playdar_response = response;
                list_item.addClass('match');
                var results_table = PLAYDAR.build_results_table(response, list_item);
                var result = response.results[0];
                if (result.score > 0.99) {
                    PLAYLICK.update_track(playlist_track, result, true);
                }
                var sources = list_item.children('.sources');
                sources.html(results_table);
                // Highlight the list item
                if (playlist_track.track.playdar_sid) {
                    list_item.addClass('perfectMatch');
                }
                if (playlist_track.track.video) {
                    list_item.addClass('video');
                }
            } else {
                list_item.addClass('noMatch');
            }
        }
    },
    splice_url_result: function (playlist_track, response) {
        var url_result = {
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
        };
        var highest_non_perfect;
        $.each(response.results, function (i, result) {
            if (result.score < 0.99) {
                highest_non_perfect = i;
                return false;
            }
        });
        if (typeof highest_non_perfect != 'undefined') {
            response.results.splice(highest_non_perfect, 0, url_result);
        } else {
            response.results.push(url_result);
        }
    },
    // Generate a query ID and a results handler for a track
    track_handler: function (playlist_track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            // HACK - Add the URL as a source
            if (final_answer && playlist_track.track.url) {
                PLAYDAR.splice_url_result(playlist_track, response);
            }
            // ENDHACK
            PLAYDAR.load_track_results(playlist_track, response, final_answer);
        }, uuid);
        return uuid;
    },
    recheck_track: function (playlist_track) {
        if (Playdar.client && Playdar.client.isAvailable() && Playdar.client.is_authed()) {
            if (playlist_track.track.playdar_qid) {
                playlist_track.element.addClass('scanning');
                Playdar.client.recheck_results(playlist_track.track.playdar_qid);
            }
        }
    },
    resolve_track: function (playlist_track, force) {
        var track = playlist_track.track;
        if (!force && track.playdar_response) {
            PLAYDAR.load_track_results(playlist_track, track.playdar_response, true);
        } else {
            var qid = PLAYDAR.track_handler(playlist_track);
            var results;
            if (track.url) {
                results = [{
                    artist: track.artist,
                    track: track.name,
                    album: track.album,
                    url: track.url,
                    duration: track.duration,
                    size: track.size,
                    bitrate: track.bitrate,
                    type: track.type,
                    source: Playdar.Util.location_from_url(track.url).host
                }];
            }
            if (Playdar.client && Playdar.client.isAvailable() && Playdar.client.is_authed()) {
                playlist_track.element.removeClass('noMatch match perfectMatch video');
                playlist_track.element.addClass('scanning');
                Playdar.client.resolve(track.artist, track.name, track.album, qid, results);
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
            count: 20,
            artistName: artist,
            songTitle: track
        }, function (json) {
            if (json.response.data) {
                response.results = $.map(json.response.data.assets.slice(0, 5), function (result, i) {
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
        if (this.options.external && this.duration) {
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
        PLAYDAR.positionVideo.call(this);
    },
    onResultStart: function () {
        var track_item = PLAYDAR.onResultPlay.call(this);
        if (track_item) {
            track_item.addClass('loading');
            var playlist_track = track_item.data('playlist_track');
            // Update the now playing track
            CONTROLLERS.Playlist.playingTrack = playlist_track;
            // Highlight the playlist in the sidebar
            PLAYLICK.set_playing_playlist_item(playlist_track.playlist.element);
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
                PLAYDAR.positionSM2Container(videoShim);
            }
        }
    },
    positionSM2Container: function (videoShim) {
        if (PLAYDAR.sm2Container.css('visibility') == 'hidden') {
            var position = videoShim.offset();
            var contentOffset = $('#content').offset();
            PLAYDAR.sm2Container
                .width(videoShim.width())
                .height(videoShim.height())
                .css({
                    top: position.top - contentOffset.top,
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
        // Clear the now playing track
        CONTROLLERS.Playlist.playingTrack = null;
        // Remove the playlist highlight from the sidebar
        PLAYLICK.set_playing_playlist_item();
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
            track_item.removeClass('loading');
            var loading = track_item.find('.loading');
            var loaded = this.bytesLoaded/this.bytesTotal * 100;
            loading.width(loaded + "%");
        }
        if (this.options.external) {
            PLAYDAR.updateStreamDuration(this.sID, this.durationEstimate, true);
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
            // Update the track duration
            playlist_track.set_track_duration(Math.round(duration/1000));
        }
        return track_item;
    },
    playTrack: function (playlist_track) {
        if (playlist_track && playlist_track.track.playdar_sid) {
            var list_item = playlist_track.element;
            list_item.effect('highlight', {
                color: '#6ea31e'
            }, 100);
            Playdar.player.play_stream(playlist_track.track.playdar_sid);
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
    playNextSource: function (trackSource) {
        var track_item = trackSource.data('track_item');
        var nextSource = trackSource.nextAll('tbody:not(.error):first');
        if (nextSource.size()) {
            PLAYLICK.selectSource(track_item.data('playlist_track'), nextSource);
            return true;
        }
        return false;
    },
    playPreviousSource: function (trackSource) {
        var track_item = trackSource.data('track_item');
        var previousSource = trackSource.prevAll('tbody:not(.error):first');
        if (previousSource.size()) {
            PLAYLICK.selectSource(track_item.data('playlist_track'), previousSource);
            return true;
        }
        return false;
    }
};

PLAYDAR.originalSM2Width = PLAYDAR.sm2Container.width();
PLAYDAR.originalSM2Height = PLAYDAR.sm2Container.height();
PLAYDAR.originalSM2Top = PLAYDAR.sm2Container.css('top');
PLAYDAR.originalSM2Left = PLAYDAR.sm2Container.css('left');