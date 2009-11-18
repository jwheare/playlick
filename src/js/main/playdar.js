/* Playdar */
var PLAYDAR = {
    soundmanager_ready: function (status) {
        if (status.success) {
            $('#playdar').html(STRINGS.loading_playdar_text);
            Playdar.setupPlayer(soundManager); // soundManager is global at this point
            Playdar.client.go();
        } else {
            $('#playdar').html(STRINGS.loading_flash_error_text);
        }
    },
    
    playdar_listeners: {
        onStat: function (detected) {
            if (detected) {
                if (!detected.authenticated) {
                    var connect_link = Playdar.client.get_auth_link_html(
                        STRINGS.connect_to_playdar_text
                    );
                    PLAYDAR.update_status(connect_link);
                }
            } else {
                PLAYDAR.update_status(STRINGS.playdar_unavailable_text);
            }
        },
        onAuth: function () {
            var disconnect_link = Playdar.client.get_disconnect_link_html(
                STRINGS.disconnect_from_playdar_text
            );
            PLAYDAR.update_status(disconnect_link);
            PLAYDAR.resolve_current_playlist();
        },
        onAuthClear: function () {
            var connect_link = Playdar.client.get_auth_link_html(
                STRINGS.connect_to_playdar_text
            );
            PLAYDAR.update_status(connect_link);
            PLAYDAR.cancel_playdar_resolve();
        },
        onResolveIdle: function () {
            if (PLAYLICK.current_playlist && PLAYLICK.batch_save) {
                PLAYLICK.current_playlist.save();
                PLAYLICK.batch_save = false;
            }
        }
    },
    update_status: function (message) {
        $('#playdar').html(
            '<img src="/playdar_logo_16x16.png" width="16" height="16"> '
            + message
        );
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
            if (result.sid) {
                Playdar.player.register_stream(result, {
                    chained: true,
                    onload: PLAYDAR.onResultLoad,
                    onplay: PLAYDAR.onResultStart,
                    onpause: PLAYDAR.onResultPause,
                    onresume: PLAYDAR.onResultPlay,
                    onstop: PLAYDAR.onResultStop,
                    onfinish: PLAYDAR.onResultFinish,
                    whileplaying: PLAYDAR.updatePlaybackProgress
                });
            } else if (result.url) {
                // HACK: Handle non playdar streams separately
                result.sid = Playdar.Util.generate_uuid();
                Playdar.player.soundmanager.createSound({
                    id: 's_' + result.sid,
                    url: result.url,
                    onload: PLAYDAR.onResultLoad,
                    onplay: PLAYDAR.onResultStart,
                    onpause: PLAYDAR.onResultPause,
                    onresume: PLAYDAR.onResultPlay,
                    onstop: PLAYDAR.onResultStop,
                    onfinish: PLAYDAR.onResultFinish,
                    whileplaying: PLAYDAR.updatePlaybackProgress,
                    whileloading: function () {
                        PLAYDAR.updateStreamDuration(this.sID, this.durationEstimate);
                    },
                    onload: function () {
                        PLAYDAR.updateStreamDuration(this.sID, this.duration);
                    }
                });
                // ENDHACK
            }
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
            name_cell = $('<td class="name" colspan="4">');
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
            var size = '';
            var bitrate = '';
            if (result.duration) {
                duration = Playdar.Util.mmss(result.duration);
            }
            if (result.size) {
                size = (result.size/1000000).toFixed(1) + 'MB';
            }
            if (result.bitrate) {
                bitrate = result.bitrate + ' kbps';
            }
            info_row = $('<tr class="info">')
                .append(score_cell)
                .append($('<td class="source">').text(result.source + ' (' + result.preference + ')'))
                .append($('<td class="time">').text(duration))
                .append($('<td class="size">').text(size))
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
        list_item.removeClass('scanning noMatch match perfectMatch');
        playlist_track.track.playdar_qid = response.qid;
        if (final_answer) {
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
            } else {
                list_item.addClass('noMatch');
            }
        } else {
            list_item.addClass('scanning');
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
            duration: playlist_track.track.duration
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
        if (playlist_track.track.playdar_qid) {
            Playdar.client.recheck_results(playlist_track.track.playdar_qid);
        }
    },
    resolve_track: function (playlist_track, force) {
        if (Playdar.client && Playdar.client.is_authed()) {
            var track = playlist_track.track;
            if (!force && track.playdar_response) {
                PLAYDAR.load_track_results(playlist_track, track.playdar_response, true);
            } else {
                var qid = PLAYDAR.track_handler(playlist_track);
                var resultObject;
                if (track.url) {
                    resultObject = {
                        artist: track.artist,
                        track: track.name,
                        album: track.album,
                        url: track.url,
                        source: Playdar.Util.location_from_url(track.url).host
                    };
                    if (track.duration) {
                        resultObject.duration = track.duration;
                    }
                }
                Playdar.client.resolve(track.artist, track.name, track.album, qid, [resultObject]);
            }
        }
    },
    resolve_current_playlist: function () {
        if (Playdar.client && Playdar.client.is_authed() && PLAYLICK.current_playlist) {
            $.each(PLAYLICK.current_playlist.tracks, function (i, playlist_track) {
                PLAYDAR.resolve_track(playlist_track);
            });
        }
    },
    cancel_playdar_resolve: function () {
        if (Playdar.client) {
            Playdar.client.cancel_resolve();
        }
        $('#playlist').find('li').removeClass('scanning');
    },
    
    /* Playback */
    
    // Not called when served from cache
    onResultLoad: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            if (this.readyState == 2) { // failed/error
                // Switch track highlight in the playlist
                PLAYDAR.resetResult.call(this);
                track_item.addClass('error');
            }
        }
        return track_item;
    },
    onResultStart: function () {
        var track_item = PLAYDAR.onResultPlay.call(this);
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Update the now playing track
            PLAYLICK.now_playing = playlist_track;
            // Highlight the playlist in the sidebar
            PLAYLICK.set_playing_playlist_item(playlist_track.playlist.element);
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
            track_item.addClass('playing');
        }
        return track_item;
    },
    resetResult: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Remove track highlight in the playlist
            track_item.removeClass('playing');
            // Reset progress bar
            track_item.css('background-position', '0 0');
            // Reset elapsed counter
            var progress = track_item.find('.elapsed');
            progress.text(playlist_track.track.get_duration_string());
        }
        return track_item;
    },
    onResultStop: function () {
        var track_item = PLAYDAR.resetResult.call(this);
        if (track_item) {
            track_item.removeClass('paused');
        }
        // Clear the now playing track
        PLAYLICK.now_playing = null;
        Playdar.player.stop_current();
        return track_item;
    },
    onResultFinish: function () {
        var track_item = PLAYDAR.onResultStop.call(this);
        // Chain playback to the next perfect match
        if (track_item) {
            var next_playlist_track = track_item.nextAll('li.perfectMatch').data('playlist_track');
            if (next_playlist_track) {
                PLAYDAR.playTrack(next_playlist_track);
                return true;
            }
        }
        // Otherwise hard stop play session and remove the playlist highlight from the sidebar
        Playdar.player.stop_current(true);
        PLAYLICK.set_playing_playlist_item();
        return track_item;
    },
    updatePlaybackProgress: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Update the track progress
            var progress = track_item.find('.elapsed');
            var elapsed = '<strong>' + Playdar.Util.mmss(Math.round(this.position/1000)) + '</strong>';
            if (playlist_track.track.duration) {
                elapsed += ' / ' + playlist_track.track.get_duration_string();
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
        }
        return track_item;
    },
    updateStreamDuration: function (sid, duration) {
        var track_item = $('#' + sid).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Update the track duration
            playlist_track.set_track_duration(Math.round(duration/1000));
        }
        return track_item;
    },
    playTrack: function (playlist_track) {
        if (playlist_track && playlist_track.track.playdar_sid) {
            Playdar.player.play_stream(playlist_track.track.playdar_sid);
        }
    }
};
