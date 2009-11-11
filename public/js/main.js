var PLAYLICK = {

    lastfm_api_key: "b25b959554ed76058ac220b7b2e0a026",
    lastfm_ws_url: "http://ws.audioscrobbler.com",


    start_button_text: $('#add_track_button').val(),
    add_button_text: 'Add',
    edit_playlist_text: 'edit',
    loading_flash_text: $('#playdar').html(),
    loading_flash_error_text: 'Flash player unavailable',
    loading_playdar_text: 'Checking for Playdar…',
    connect_to_playdar_text: 'Connect to Playdar',
    disconnect_from_playdar_text: 'Disconnect from Playdar',
    playdar_unavailable_text: '<a href="http://www.playdar.org/">Playdar unavailable</a>. <a href="#" onclick="$(\'#playdar\').html(PLAYLICK.loading_playdar_text); Playdar.client.init(); return false;">retry</a>',
    cancel_edit_playlist_text: 'cancel',
    create_playlist_title: $('#playlistTitle').html(),
    loading_playlists_text: $('#loading_playlists').html(),


    init: function () {
        PLAYLICK.check_url_params();
        PLAYLICK.fetch_playlists();
    },

    check_url_params: function () {
        var hash_parts = PLAYLICK.get_hash_parts();
        if (hash_parts.xspf) {
            PLAYLICK.fetchXspf(hash_parts.xspf);
        }
        if (hash_parts.podcast) {
            PLAYLICK.fetchPodcast(hash_parts.podcast);
        }
        if (hash_parts.lastfm_playlists) {
            PLAYLICK.fetchLastFmUserPlaylists(hash_parts.lastfm_playlists);
        }
        if (hash_parts.lastfm_loved) {
            PLAYLICK.fetchLastFmLovedTracks(hash_parts.lastfm_loved);
        }
        if (hash_parts.artist && hash_parts.album) {
            PLAYLICK.fetchLastFmAlbum(hash_parts.artist, hash_parts.album);
        }
        if (hash_parts.lastfm_you && hash_parts.lastfm_they) {
            $('#import p.messages').hide();
            $('#generate_loading_artists').show();
            PLAYLICK.generate_playlist(hash_parts.lastfm_you, hash_parts.lastfm_they, true);
        }
        if (hash_parts.artist && hash_parts.track) {
            PLAYLICK.blank_playlist();
            PLAYLICK.add_track(hash_parts.artist, hash_parts.track);
        }
        if (hash_parts.spotify_album) {
            IMPORTERS.Spotify.album(hash_parts.spotify_album, PLAYLICK.load_playlist);
        }
        if (hash_parts.spotify_track) {
            IMPORTERS.Spotify.track(hash_parts.spotify_track, PLAYLICK.load_playlist);
        }
    },


    soundmanager_ready: function (status) {
        if (status.success) {
            $('#playdar').html(PLAYLICK.loading_playdar_text);
            Playdar.setup_player(soundManager); // soundManager is global at this point
            Playdar.client.init();
        } else {
            $('#playdar').html(PLAYLICK.loading_flash_error_text);
        }
    },

    playdar_listeners: {
        onStat: function (detected) {
            if (detected) {
                if (!detected.authenticated) {
                    var connect_link = Playdar.client.get_auth_link_html(
                        PLAYLICK.connect_to_playdar_text
                    );
                    PLAYLICK.update_playdar_status(connect_link);
                }
            } else {
                PLAYLICK.update_playdar_status(PLAYLICK.playdar_unavailable_text);
            }
        },
        onAuth: function () {
            var disconnect_link = Playdar.client.get_disconnect_link_html(
                PLAYLICK.disconnect_from_playdar_text
            );
            PLAYLICK.update_playdar_status(disconnect_link);
            PLAYLICK.resolve_current_playlist();
        },
        onAuthClear: function () {
            var connect_link = Playdar.client.get_auth_link_html(
                PLAYLICK.connect_to_playdar_text
            );
            PLAYLICK.update_playdar_status(connect_link);
            PLAYLICK.cancel_playdar_resolve();
        },
        onResolveIdle: function () {
            if (PLAYLICK.current_playlist && PLAYLICK.batch_save) {
                PLAYLICK.current_playlist.save();
                PLAYLICK.batch_save = false;
            }
        }
    },
    update_playdar_status: function (message) {
        $('#playdar').html(
            '<img src="/playdar_logo_16x16.png" width="16" height="16"> '
            + message
        );
    },
    build_results_table: function (response, list_item) {
        var tbody_class,
            score_cell, choice_radio, album_art, name_cell,
            track_row, info_row, result_tbody;

        var results_form = $('<form>');
        var results_table = $('<table cellspacing="0"></table>');
        var found_perfect = false;

        $.each(response.results, function (i, result) {
            if (result.sid) {
                Playdar.player.register_stream(result, {
                    chained: true,
                    onload: PLAYLICK.onResultLoad,
                    onplay: PLAYLICK.onResultStart,
                    onpause: PLAYLICK.onResultPause,
                    onresume: PLAYLICK.onResultPlay,
                    onstop: PLAYLICK.onResultStop,
                    onfinish: PLAYLICK.onResultFinish,
                    whileplaying: PLAYLICK.updatePlaybackProgress
                });
            } else if (result.url) {
                result.sid = Playdar.Util.generate_uuid();
                Playdar.player.soundmanager.createSound({
                    id: 's_' + result.sid,
                    url: result.url,
                    onload: PLAYLICK.onResultLoad,
                    onplay: PLAYLICK.onResultStart,
                    onpause: PLAYLICK.onResultPause,
                    onresume: PLAYLICK.onResultPlay,
                    onstop: PLAYLICK.onResultStop,
                    onfinish: PLAYLICK.onResultFinish,
                    whileplaying: PLAYLICK.updatePlaybackProgress,
                    whileloading: function () {
                        PLAYLICK.update_stream_duration(this.sID, this.durationEstimate);
                    },
                    onload: function () {
                        PLAYLICK.update_stream_duration(this.sID, this.duration);
                    }
                });
            }
            tbody_class = 'result';
            score_cell = $('<td class="score">');
            choice_radio = $('<input type="radio" name="choice">').val(result.sid);
            if (result.score > 0.99) {
                score_cell.text('★').addClass('perfect');
                if (!found_perfect) {
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
                album_art = PLAYLICK.lastfm_ws_url + "/2.0/?" + $.param({
                    artist: result.artist,
                    album: result.album,
                    method: "album.imageredirect",
                    size: "small",
                    api_key: PLAYLICK.lastfm_api_key
                });
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
    load_track_results: function (playlist_track, response, final_answer) {
        var list_item = playlist_track.element;
        list_item.removeClass('scanning noMatch match perfectMatch');
        playlist_track.track.playdar_qid = response.qid;
        if (final_answer) {
            if (response.results.length) {
                playlist_track.track.playdar_response = response;
                list_item.addClass('match');
                var results_table = PLAYLICK.build_results_table(response, list_item);
                var result = response.results[0];
                if (result.score > 0.99) {
                    PLAYLICK.update_track(playlist_track, result, true);
                }
                var sources = list_item.children('.sources');
                sources.html(results_table);
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
            source: PLAYLICK.parse_domain(playlist_track.track.url),
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
    playdar_track_handler: function (playlist_track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            if (final_answer && playlist_track.track.url) {
                PLAYLICK.splice_url_result(playlist_track, response);
            }
            PLAYLICK.load_track_results(playlist_track, response, final_answer);
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
                PLAYLICK.load_track_results(playlist_track, track.playdar_response, true);
            } else {
                var qid = PLAYLICK.playdar_track_handler(playlist_track);
                Playdar.client.resolve(track.artist, track.album, track.name, qid, track.url);
            }
        }
    },
    resolve_current_playlist: function () {
        if (Playdar.client && Playdar.client.is_authed() && PLAYLICK.current_playlist) {
            $.each(PLAYLICK.current_playlist.tracks, function (i, playlist_track) {
                PLAYLICK.resolve_track(playlist_track);
            });
        }
    },
    cancel_playdar_resolve: function () {
        if (Playdar.client) {
            Playdar.client.cancel_resolve();
        }
        $('#playlist').find('li').removeClass('scanning');
    },


    current_playlist: null,
    create_playlist: function (data) {
        data = data || {};
        var playlist = new MODELS.Playlist({
            doc_ref: {
                id: data._id,
                rev: data._rev
            },
            name: data.name,
            image: data.image,
            description: data.description,
            onSave: function () {
                if (this == PLAYLICK.current_playlist) {
                    PLAYLICK.update_playlist_title(this.titleHTML());
                    PLAYLICK.update_playlist_applescript(this);
                }
            },
            onCreate: function () {
                $('#playlists').append(this.element);
            },
            onDelete: function () {
                if (this == PLAYLICK.current_playlist) {
                    PLAYLICK.show_import();
                }
            },
            onSetDuration: function () {
                if (this == PLAYLICK.current_playlist) {
                    PLAYLICK.update_playlist_title(this.titleHTML());
                }
            }
        });
        PLAYLICK.last_playlist = playlist;
        return playlist;
    },
    update_playlist_title: function (title) {
        $('#playlistTitle').html(title);
    },
    update_playlist_applescript: function (playlist) {
        $('#playlistApplescript').attr('href', playlist.toApplescript());
    },
    toggle_playlist_edit: function (playlist_item) {
        playlist_item.find('a.playlist').toggle();
        playlist_item.find('form.edit_playlist_form').toggle();
        var button = playlist_item.find('a.edit_playlist');
        if (button.html() == PLAYLICK.cancel_edit_playlist_text) {
            button.html(PLAYLICK.edit_playlist_text);
        } else {
            button.html(PLAYLICK.cancel_edit_playlist_text);
            var edit_input = playlist_item.find('input.playlist_name');
            edit_input.val(playlist_item.data('playlist').name);
            setTimeout(function () {
                edit_input.select();
            }, 1);
        }
    },
    delete_playlist: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.name)) {
            playlist.remove();
        }
    },
    set_current_playlist_item: function (playlist_item) {
        $('#playlists').find('li').removeClass('current');
        playlist_item.addClass('current');
    },
    set_playing_playlist_item: function (playlist_item) {
        $('#playlists').find('li.p').removeClass('playing');
        if (playlist_item) {
            playlist_item.addClass('playing');
        }
    },
    blank_playlist: function () {
        PLAYLICK.cancel_playdar_resolve();
        PLAYLICK.set_current_playlist_item($('#create_playlist').parent('li'));
        $('#playlist').empty();
        PLAYLICK.update_playlist_title(PLAYLICK.create_playlist_title);
        $('#add_track_button').val(PLAYLICK.start_button_text);
        $('#import').hide();
        $('#manage').show();
        setTimeout(function () {
            $('#add_track_input').select();
        }, 1);
        PLAYLICK.current_playlist = PLAYLICK.create_playlist();
    },
    show_import: function () {
        PLAYLICK.cancel_playdar_resolve();
        PLAYLICK.set_current_playlist_item($('#import_playlist').parent('li'));
        $('#manage').hide();
        $('#import p.messages').hide();
        $('#import').show();
        setTimeout(function () {
            $('#import_playlist_input').select();
        }, 1);
    },
    add_track: function (artist, track) {
        var new_track = new MODELS.Track({
            artist: artist,
            name: track
        });
        var playlist_track = PLAYLICK.current_playlist.add_track(new_track);
        PLAYLICK.current_playlist.save();
        $('#playlist').append(playlist_track.element);
        if (playlist_track.position == 1) {
            $('#add_track_button').val(PLAYLICK.add_button_text);
        }
        PLAYLICK.resolve_track(playlist_track);
    },
    update_track: function (playlist_track, result, batch) {
        var track  = playlist_track.track;
        if (!PLAYLICK.compare_string(track.name, result.track)
         || !PLAYLICK.compare_string(track.artist, result.artist)
         || !PLAYLICK.compare_string(track.album, result.album)) {
            track.name = result.track;
            track.artist = result.artist;
            track.album = result.album;
            if (batch) {
                PLAYLICK.batch_save = true;
            } else {
                playlist_track.playlist.save();
            }
            playlist_track.element.find('.fn')
                .text(PLAYLICK.truncate_string(track.name))
                .attr('title', track.name);
            playlist_track.element.find('.contributor')
                .text(PLAYLICK.truncate_string(track.artist))
                .attr('title', track.artist);
        }
        if (track.duration != result.duration) {
            playlist_track.set_track_duration(result.duration);
            playlist_track.element.find('.elapsed').text(track.get_duration_string());
        }
        if (playlist_track.track.playdar_sid && playlist_track.track.playdar_sid != result.sid) {
            Playdar.player.stop_stream(playlist_track.track.playdar_sid);
        }
        playlist_track.track.playdar_sid = result.sid;
        playlist_track.track.playdar_url = result.url;
    },
    retry_couch: function () {
        $('#loading_playlists').removeClass('unavailable');
        $('#loading_playlists').html(PLAYLICK.loading_playlists_text);
        $('#loading_playlists').show();
        if (PLAYLICK.fetch_playlists_done) {
            MODELS.stat_couch();
        } else {
            PLAYLICK.fetch_playlists();
        }
    },
    fetch_playlists: function () {
        try {
            var response = MODELS.couch.view("playlist/all");
            MODELS.couch_up_handler('fetch_playlists', response);
            PLAYLICK.fetch_playlists_done = true;
            var elements = $.map(response.rows, function (row, i) {
                var data = row.value;
                var playlist = PLAYLICK.create_playlist(data);
                return playlist.element.get();
            });
            $('#playlists').append(elements);
        } catch (result) {
            MODELS.couch_down_handler('fetch_playlists', result);
        }
    },
    fetch_playlist_tracks: function (playlist) {
        try {
            var response = MODELS.couch.view("playlist/all", {
                "key": playlist._id
            });
            MODELS.couch_up_handler('fetch_playlist_tracks', response);
            var row = response.rows[0];
            var value = row.value;
            var elements = $.map(value.tracks, function (track_data, i) {
                var playlist_track = playlist.add_track(new MODELS.Track(track_data.track));
                return playlist_track.element.get();
            });
            return elements;
        } catch (result) {
            MODELS.couch_down_handler('fetch_playlist_tracks', result);
        }
    },
    load_playlist: function (playlist) {
        PLAYLICK.load_playlist_item(playlist.element);
    },
    load_playlist_item: function (playlist_item) {
        PLAYLICK.cancel_playdar_resolve();
        if (PLAYLICK.current_playlist) {
            PLAYLICK.current_playlist.unload();
        }
        PLAYLICK.set_current_playlist_item(playlist_item);
        PLAYLICK.current_playlist = playlist_item.data('playlist');
        PLAYLICK.update_playlist_title(PLAYLICK.current_playlist.titleHTML());
        $('#add_track_button').val(PLAYLICK.add_button_text);
        var elements;
        $('#tracksLoading').show();
        $('#tracksError').hide();
        if (!PLAYLICK.current_playlist.tracks.length) {
            elements = PLAYLICK.fetch_playlist_tracks(PLAYLICK.current_playlist);
        } else {
            elements = PLAYLICK.current_playlist.load();
        }
        PLAYLICK.update_playlist_applescript(PLAYLICK.current_playlist);
        $('#tracksLoading').hide();
        if (elements) {
            $('#playlist').append(elements);
            PLAYLICK.resolve_current_playlist();
        } else {
            $('#tracksError').show();
        }
        $('#import').hide();
        $('#manage').show();
    },


    onResultLoad: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            if (this.readyState == 2) { // failed/error
                PLAYLICK.resetResult.call(this);
                track_item.addClass('error');
            }
        }
        return track_item;
    },
    onResultStart: function () {
        var track_item = PLAYLICK.onResultPlay.call(this);
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            PLAYLICK.now_playing = playlist_track;
            PLAYLICK.set_playing_playlist_item(playlist_track.playlist.element);
        }
    },
    onResultPause: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            track_item.removeClass('playing');
            track_item.addClass('paused');
        }
        return track_item;
    },
    onResultPlay: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
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
            track_item.removeClass('playing');
            track_item.css('background-position', '0 0');
            var progress = track_item.find('.elapsed');
            progress.text(playlist_track.track.get_duration_string());
        }
        return track_item;
    },
    onResultStop: function () {
        var track_item = PLAYLICK.resetResult.call(this);
        if (track_item) {
            track_item.removeClass('paused');
        }
        PLAYLICK.now_playing = null;
        Playdar.player.stop_current();
        return track_item;
    },
    onResultFinish: function () {
        var track_item = PLAYLICK.onResultStop.call(this);
        if (track_item) {
            var next_playlist_track = track_item.nextAll('li.perfectMatch').data('playlist_track');
            if (next_playlist_track) {
                PLAYLICK.play_track(next_playlist_track);
                return true;
            }
        }
        Playdar.player.stop_current(true);
        PLAYLICK.set_playing_playlist_item();
        return track_item;
    },
    updatePlaybackProgress: function () {
        var track_item = $('#' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            var progress = track_item.find('.elapsed');
            var elapsed = '<strong>' + Playdar.Util.mmss(Math.round(this.position/1000)) + '</strong>';
            if (playlist_track.track.duration) {
                elapsed += ' / ' + playlist_track.track.get_duration_string();
            }
            progress.html(elapsed);
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
    update_stream_duration: function (sid, duration) {
        var track_item = $('#' + sid).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            playlist_track.set_track_duration(Math.round(duration/1000));
        }
        return track_item;
    },
    play_track: function (playlist_track) {
        if (playlist_track && playlist_track.track.playdar_sid) {
            Playdar.player.play_stream(playlist_track.track.playdar_sid);
        }
    },

    fetchXspf: function (url) {
        $('#import p.messages').hide();
        $('#xspf_loading').show();
        IMPORTERS.Url.xspf(
            url,
            function callback (playlist) {
                $('#import p.messages').hide();
                $('#xspf_title').text(playlist.name);
                $('#xspf_count').text(playlist.tracks.length);
                $('#xspf_done').show();
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                $('#xspf_input').val(url);
                $('#import p.messages').hide();
                var escapedUrl = $('<b>').text('URL: ' + url);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedUrl);
                $('#xspf_error').html(errorMessage);
                $('#xspf_error').show();
            }
        );
    },
    fetchPodcast: function (url) {
        $('#import p.messages').hide();
        $('#podcast_loading').show();
        IMPORTERS.Url.podcast(
            url,
            function callback (playlist) {
                $('#import p.messages').hide();
                $('#podcast_title').text(playlist.name);
                $('#podcast_count').text(playlist.tracks.length);
                $('#podcast_done').show();
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                $('#podcast_input').val(url);
                $('#import p.messages').hide();
                var escapedUrl = $('<b>').text('URL: ' + url);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedUrl);
                $('#podcast_error').html(errorMessage);
                $('#podcast_error').show();
            }
        );
    },
    fetchLastFmAlbum: function (artist, album) {
        $('#import p.messages').hide();
        $('#album_loading').show();
        $('#import_error').empty();
        IMPORTERS.LastFm.album(
            artist, album,
            function callback (playlist) {
                $('#import p.messages').hide();
                var escapedAlbum = $('<b>').text(playlist.name);
                $('#album_name').html(escapedAlbum);
                $('#album_done').show();
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                $('#import p.messages').hide();
                var escapedAlbum = $('<b>').text('Artist: ' + artist + ' Album: ' + album);
                var escapedSignature = $('<small>').text(exception.signature);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedAlbum)
                             .append('<br>')
                             .append(escapedSignature);
                $('#album_error').html(errorMessage);
                $('#album_error').show();
            }
        );
    },
    fetchLastFmUserPlaylists: function (username) {
        $('#import p.messages').hide();
        $('#import_loading').show();
        $('#import_error').empty();
        IMPORTERS.LastFm.userPlaylists(
            username,
            function callback (playlists) {
                $('#import p.messages').hide();
                $('#import_count').text(playlists.length);
                $('#import_done').show();
            },
            function exceptionHandler (exception) {
                $('#import_playlist_input').val(username);
                $('#import p.messages').hide();
                var escapedName = $('<b>').text('Username: ' + username);
                var escapedSignature = $('<small>').text(exception.signature);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedName)
                             .append('<br>')
                             .append(escapedSignature);
                $('#import_error').html(errorMessage);
                $('#import_error').show();
            },
            function noPlaylistHandler () {
                $('#import_playlist_input').val(username);
                $('#import p.messages').hide();
                $('#import_error_no_playlists').show();
            }
        );
    },
    fetchLastFmLovedTracks: function (username) {
        $('#import p.messages').hide();
        $('#loved_loading').show();
        $('#loved_error').empty();
        IMPORTERS.LastFm.lovedTracks(
            username,
            function callback (playlist) {
                $('#import p.messages').hide();
                $('#loved_done').show();
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                $('#loved_input').val(username);
                $('#import p.messages').hide();
                var escapedName = $('<b>').text('Username: ' + username);
                var escapedSignature = $('<small>').text(exception.signature);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedName)
                             .append('<br>')
                             .append(escapedSignature);
                $('#loved_error').html(errorMessage);
                $('#loved_error').show();
            }
        );
    },
    get_random_top_tracks: function (artists, callback) {
        PLAYLICK.random_tracks = {};
        $.each(artists, function (i, artist) {
            var artist = artist.name;
            PLAYLICK.random_tracks[artist] = false;
            $.getJSON(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
                method: "artist.getTopTracks",
                artist: artist,
                api_key: PLAYLICK.lastfm_api_key,
                format: 'json'
            }, function (json) {
                if (json.error) {
                    delete PLAYLICK.random_tracks[artist];
                } else {
                    var tracks = PLAYLICK.shuffle(json.toptracks.track);
                    PLAYLICK.random_tracks[artist] = tracks[0];
                }
                var done_loading = true;
                for (var artist_name in PLAYLICK.random_tracks) {
                    if (PLAYLICK.random_tracks[artist_name] === false) {
                        done_loading = false;
                        break;
                    }
                };
                if (done_loading) {
                    callback(PLAYLICK.random_tracks);
                }
            });
        });
    },
    generate_callback: function (you, they, tracks, auto_switch) {
        var title = you + ' and ' + they;
        var playlist = PLAYLICK.create_playlist({
            name: title
        });
        for (var artist_name in tracks) {
            var track_data = tracks[artist_name];
            if (track_data.name && track_data.artist) {
                var track_doc = {
                    name: track_data.name,
                    artist: track_data.artist.name
                };
                playlist.add_track(new MODELS.Track(track_doc));
            }
        };
        if (playlist.tracks.length) {
            playlist.description = 'A playlist based on your shared artists';
            playlist.save();
            if (auto_switch) {
                PLAYLICK.load_playlist(playlist);
            }
            return true;
        }
        return false;
    },
    generate_playlist: function (you, they, auto_switch) {
        $.getJSON(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
            method: "tasteometer.compare",
            type1: 'user',
            value1: you,
            type2: 'user',
            value2: they,
            limit: 20,
            api_key: PLAYLICK.lastfm_api_key,
            format: 'json'
        }, function (json) {
            var escapedInput = $('<b>').text('You ' + you + ' They ' + they);
            var escapedRequest = $('<small>').text(this.url);
            if (json.error) {
                $('#import p.messages').hide();
                var errorMessage = $('<p>').text('Error ' + json.error + ': ' + json.message);
                errorMessage.append('<br>')
                             .append(escapedInput)
                             .append('<br>')
                             .append(escapedRequest);
                $('#generate_error').html(errorMessage);
                $('#generate_error').show();
            } else {
                var artists = PLAYLICK.shuffle(json.comparison.result.artists.artist);
                PLAYLICK.get_random_top_tracks(artists, function (tracks) {
                    var success = PLAYLICK.generate_callback(you, they, tracks, auto_switch);
                    if (success) {
                        $('#import p.messages').hide();
                        $('#generate_done').show();
                    } else {
                        $('#import p.messages').hide();
                        var errorMessage = $('<p>').text("Couldn't find enough tracks to make a playlist.");
                        errorMessage.append('<br>')
                                     .append(escapedInput)
                                     .append('<br>')
                                     .append(escapedRequest);
                        $('#generate_error').html(errorMessage);
                        $('#generate_error').show();
                    }
                });
                $('#import p.messages').hide();
                $('#generate_loading_tracks').show();
            }
        });
    },


    track_toHTML: function () {
        var remove_link = $('<a href="#" class="remove" title="Remove from playlist">').text('╳');
        var source_link = $('<a href="#" class="show_sources" title="Show track sources">').text('sources');
        var item_name = $('<span class="haudio">')
            .append($('<span class="contributor">').text(PLAYLICK.truncate_string(this.artist)).attr('title', this.artist))
            .append($('<strong class="fn">').text(PLAYLICK.truncate_string(this.name)).attr('title', this.name));
        var elapsed = $('<span class="elapsed">').text(this.get_duration_string());
        var status = $('<span class="status">');
        var item_link   = $('<a href="#" class="item">')
            .append(elapsed)
            .append(status)
            .append(item_name);
        var sources = $('<div class="sources">');
        return $('<div>')
            .append(remove_link)
            .append(source_link)
            .append(item_link)
            .append(sources)
            .html();
    },
    playlist_toHTML: function () {
        var play_indicator = $('<a href="#" class="playlist_playing" title="Playing">');
        var delete_link = $('<a href="#" class="delete_playlist" title="Delete playlist">').text('╳');
        var edit_link   = $('<a href="#" class="edit_playlist">').text(PLAYLICK.edit_playlist_text);
        var name        = $('<a href="#" class="playlist">').text(PLAYLICK.truncate_string(this.name));
        var edit_form   = $('<form style="display: none;" class="edit_playlist_form">')
            .append('<input type="text" name="name" class="playlist_name">')
            .append('<input type="submit" value="save">');
        return $('<div>')
            .append(play_indicator)
            .append(delete_link)
            .append(edit_link)
            .append(name)
            .append(edit_form)
            .html();
    },
    autolink_regexp: new RegExp(/((https?\:\/\/)|spotify:)[^"\s\<\>]*[^.,;'">\:\s\<\>\)\]\!]/g),
    playlist_titleHTML: function () {
        var wrapper = $('<div>');
        if (this.image) {
            wrapper.append($('<img>').attr('src', this.image));
        }
        wrapper.append(this.toString());
        if (this.description) {
            var description = $('<small>');
            $.each(this.description.split(/[ \n]/), function (i, word) {
                var matches = PLAYLICK.autolink_regexp.exec(word);
                if (matches) {
                    description.append($('<a>').attr('href', word).text(word));
                } else {
                    description.append(' '+word+' ');
                }
            });
            wrapper.append('<br>')
                .append(description);
        }
        return wrapper.html();
    },
    couch_down_handler: function (action, result) {
        MODELS.couch_up = false;

        $('#loading_playlists').addClass('unavailable');
        $('#loading_playlists').html(
            '<b>Database unavailable.</b>'
            + '<br>Your changes will not be saved. '
            + '<a href="#" onclick="PLAYLICK.retry_couch(); return false;">retry</a>'
        );
        $('#loading_playlists').show();
    },
    couch_up_handler: function (action, response) {
        MODELS.couch_up = true;
        $('#loading_playlists').hide();
        $('#tracksError').hide();
    },


    shuffle: function (array) {
        var copy = $.makeArray(array);
        copy.sort(function () {
            return 0.5 - Math.random();
        });
        return copy;
    },
    truncate_string: function (name, length, truncation) {
        length = length || 30;
        truncation = (typeof truncation == 'undefined') ? '…' : truncation;
        if (name.length > length) {
            return name.slice(0, length - truncation.length) + truncation;
        }
        return String(name);
    },
    serialize_form: function (form) {
        var params = {};
        $.each($(form).serializeArray(), function (i, item) {
            params[item.name] = item.value;
        });
        return params;
    },
    compare_string: function (string_1, string_2) {
        return string_1.toUpperCase() == string_2.toUpperCase();
    },
    domain_regex: new RegExp(/.*:\/\/([^\/]*)\/?.*/),
    parse_domain: function (url) {
        var matches = PLAYLICK.domain_regex.exec(url);
        if (matches && matches[1]) {
            return matches[1];
        }
        return url;
    },

    get_hash_parts: function () {
        var hash_sections = window.location.hash.replace(/^#(.*)/, '$1').split(';');
        var hash_parts = {};
        $.each(hash_sections, function (i, section) {
            var kv = section.split('=');
            if (kv[0] && kv[1]) {
                hash_parts[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
            }
        });
        return hash_parts;
    }

};


MODELS.Track.prototype.toHTML = PLAYLICK.track_toHTML;
MODELS.Playlist.prototype.toHTML = PLAYLICK.playlist_toHTML;
MODELS.Playlist.prototype.titleHTML = PLAYLICK.playlist_titleHTML;
MODELS.couch_down_handler = PLAYLICK.couch_down_handler;
MODELS.couch_up_handler = PLAYLICK.couch_up_handler;


$('#playlist').sortable({
    axis: 'y',
    cursor: 'move',
    opacity: 0.5,
    delay: 100,
    placeholder: 'placeholder',
    update: function (e, ui) {
        var tracks = $.map($('#playlist li'), function (playlist_item, i) {
            return $(playlist_item).data('playlist_track');
        });
        PLAYLICK.current_playlist.reset_tracks(tracks);
    }
});
$('#playlist').click(function (e) {
    var target = $(e.target);
    var track_item = target.closest('li.p_t');
    if (track_item.size()) {
        var playlist_track = track_item.data('playlist_track');

        var tbody = target.closest('tbody.result');
        if (tbody.size()) {
            var radio = tbody.find('input[name=choice]');
            radio.attr('checked', true);
            tbody.siblings().removeClass('choice');
            tbody.addClass('choice');
            var result = tbody.data('result');
            PLAYLICK.update_track(playlist_track, result);
            if (!Playdar.player.is_now_playing()) {
                PLAYLICK.play_track(playlist_track);
            }
            track_item.addClass('perfectMatch');
        }

        if (target.is('a.remove')) {
            playlist_track.remove();
            return false;
        }

        if (target.is('a.show_sources')) {
            track_item.toggleClass('open');
            return false;
        }

        var track_link = target.closest('li.p_t a.item');
        if (track_link.size()) {
            e.preventDefault();
            if (track_item.is('li.perfectMatch') && playlist_track.track.playdar_sid) {
                PLAYLICK.play_track(playlist_track);
            } else if (track_item.is('li.match')) {
                track_item.toggleClass('open');
            } else if (playlist_track.track.playdar_qid) {
                playlist_track.element.addClass('scanning');
                PLAYLICK.recheck_track(playlist_track);
            } else {
                PLAYLICK.resolve_track(playlist_track, true);
            }
        }
    }
});



$("#add_track_input").autocomplete(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
    multiple: false,
    delay: 200,
    dataType: "jsonp",
    extraParams: {
        method: "track.search",
        track: function () {
            return $("#add_track_input").val();
        },
        api_key: PLAYLICK.lastfm_api_key,
        format: "json"
    },
    cacheLength: 1,
    parse: function (json) {
        var parsed = [];
        if (json && json.results && json.results.trackmatches && json.results.trackmatches.track) {
            var tracks = $.makeArray(json.results.trackmatches.track);
            $.each(tracks, function (i, track) {
                parsed.push({
                    data: track,
                    value: track.name,
                    result: track.artist + " - " + track.name
                });
            });
        }
        return parsed;
    },
    formatItem: function (track, position, length, value) {
        return track.artist + " - " + track.name;
    }
});
$("#add_track_input").result(function (e, track, formatted) {
    $("#add_track_name").val(track.name);
    $("#add_track_artist").val(track.artist);
    $('#add_to_playlist').submit();
});
$('#add_to_playlist').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    if (params.track_name && params.artist_name) {
        $('#add_track_artist').val('');
        $('#add_track_track').val('');
        $('#add_track_input').val('').focus();
        PLAYLICK.add_track(params.artist_name, params.track_name);
    }
});


$('#create_playlist').click(function (e) {
    e.preventDefault();
    PLAYLICK.blank_playlist();
});
$('#import_playlist').click(function (e) {
    e.preventDefault();
    PLAYLICK.show_import();
});
$('#playlists').keydown(function (e) {
    var target = $(e.target);
    if (target.is('input.playlist_name') && e.keyCode == 27) {
        PLAYLICK.toggle_playlist_edit(target.parents('li.p'));
    }
});
$('#playlists').click(function (e) {
    var target = $(e.target);
    var playlist_item = target.closest('li.p');
    if (target.is('li.p a.playlist')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.load_playlist_item(playlist_item);
    }
    if (target.is('li.p a.delete_playlist')) {
        e.preventDefault();
        PLAYLICK.delete_playlist(playlist_item.data('playlist'));
    }
    if (target.is('li.p a.playlist_playing')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.play_track(PLAYLICK.now_playing);
    }
    if (target.is('li.p a.edit_playlist')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.toggle_playlist_edit(playlist_item);
    }
    if (target.is('li.p form.edit_playlist_form input[type=submit]')) {
        e.preventDefault();
        var form = target.parents('form');
        var params = PLAYLICK.serialize_form(form);
        var playlist = playlist_item.data('playlist');
        playlist.set_name(params.name, function () {
            playlist_item.find('a.playlist').text(PLAYLICK.truncate_string(params.name));
            PLAYLICK.toggle_playlist_edit(playlist_item);
        });
    }
});


$('#import_playlist_form').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    $('#import_playlist_input').val('').select();
    PLAYLICK.fetchLastFmUserPlaylists(params.username);
});
$('#loved_form').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    $('#loved_input').val('').select();
    PLAYLICK.fetchLastFmLovedTracks(params.username);
});

$("#album_import_input").autocomplete(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
    multiple: false,
    delay: 200,
    dataType: "jsonp",
    extraParams: {
        method: "album.search",
        album: function () {
            return $("#album_import_input").val();
        },
        api_key: PLAYLICK.lastfm_api_key,
        format: "json"
    },
    cacheLength: 1,
    parse: function (json) {
        var parsed = [];
        if (json && json.results && json.results.albummatches && json.results.albummatches.album) {
            var albums = $.makeArray(json.results.albummatches.album);
            $.each(albums, function (i, album) {
                parsed.push({
                    data: album,
                    value: album.name,
                    result: album.artist + " - " + album.name
                });
            });
        }
        return parsed;
    },
    formatItem: function (album, position, length, value) {
        return album.artist + " - " + album.name;
    }
});
$("#album_import_input").result(function (e, album, formatted) {
    $("#album_import_name").val(album.name);
    $("#album_import_artist").val(album.artist);
    $('#album_import_input').submit();
});
$('#album_form').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    $("#album_import_artist").val('');
    $("#album_import_name").val('');
    $("#album_import_input").val('').select();
    PLAYLICK.fetchLastFmAlbum(params.artist_name, params.album_name);
});

$('#xspf_form').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    $('#xspf_input').val('').select();
    PLAYLICK.fetchXspf(params.xspf);
});

$('#podcast_form').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    $('#podcast_input').val('').select();
    PLAYLICK.fetchPodcast(params.podcast);
});

$('#generate_form').submit(function (e) {
    e.preventDefault();
    var params = PLAYLICK.serialize_form(this);
    $("#generate_input_they").val('');
    $("#generate_input_you").val('').select();
    $('#import p.messages').hide();
    $('#generate_loading_artists').show();
    PLAYLICK.generate_playlist(params.you, params.they);
});

$(document).keydown(function (e) {
    var target = $(e.target);
    if (target.is('input[type=text], textarea, select')) {
        return true;
    }
    if (e.metaKey || e.shiftKey || e.altKey || e.ctrlKey) {
        return true;
    }
    var current_track, previous_track, next_track;
    switch (e.keyCode) {
    case 80: // p
        e.preventDefault();
        current_track = PLAYLICK.now_playing;
        if (!current_track) {
            current_track = $('#playlist li.perfectMatch').data('playlist_track');
        }
        PLAYLICK.play_track(current_track);
        break;
    case 219: // [
        e.preventDefault();
        if (PLAYLICK.now_playing) {
            previous_track = PLAYLICK.now_playing.element.prevAll('li.perfectMatch');
            PLAYLICK.play_track(previous_track.data('playlist_track'));
        }
        break;
    case 221: // ]
        e.preventDefault();
        if (PLAYLICK.now_playing) {
            next_track = PLAYLICK.now_playing.element.nextAll('li.perfectMatch');
            PLAYLICK.play_track(next_track.data('playlist_track'));
        }
        break;
    }
});
