/**
 * Custom Track and Playlist renderers
**/

MODELS.Track.prototype.toHTML = function () {
    var remove_link = $('<a href="#" class="remove" title="Remove from playlist">').text('╳');
    var source_link = $('<a href="#" class="show_sources" title="Show track sources">').text('sources');
    var item_name = $('<span class="haudio">')
        .append($('<span class="contributor">').text(PLAYLICK.truncate_string(this.artist)).attr('title', this.artist))
        .append(' ')
        .append($('<strong class="fn">').text(PLAYLICK.truncate_string(this.name)).attr('title', this.name));
    var item_link   = $('<a href="#" class="item">')
        .append($('<span class="elapsed">').text(this.get_duration_string()))
        .append('<span class="status">')
        .append(item_name);
    var sources = $('<div class="sources">');
    // Wrap in a div so we can return its innerHTML as a string
    return $('<div>')
        .append(remove_link)
        .append(source_link)
        .append(item_link)
        .append(sources)
        .html();
};
MODELS.Playlist.prototype.toHTML = function () {
    var play_indicator = $('<a href="#" class="playlist_playing" title="Playing">');
    var delete_link = $('<a href="#" class="delete_playlist" title="Delete playlist">').text('╳');
    var edit_link   = $('<a href="#" class="edit_playlist">').text(PLAYLICK.edit_playlist_text);
    var name        = $('<a href="#" class="playlist">').text(PLAYLICK.truncate_string(this.name));
    var edit_form   = $('<form style="display: none;" class="edit_playlist_form">')
        .append('<input type="text" name="name" class="playlist_name">')
        .append('<input type="submit" value="save">');
    // Wrap in a div so we can return its innerHTML as a string
    return $('<div>')
        .append(play_indicator)
        .append(delete_link)
        .append(edit_link)
        .append(name)
        .append(edit_form)
        .html();
};
var autolink_regexp = new RegExp(/https?\:\/\/[^"\s\<\>]*[^.,;'">\:\s\<\>\)\]\!]/g);
MODELS.Playlist.prototype.titleHTML = function () {
    var wrapper = $('<div>');
    // Add an image
    if (this.image) {
        wrapper.append($('<img>').attr('src', this.image));
    }
    wrapper.append(this.toString());
    // Autolink description
    if (this.description) {
        var description = $('<small>');
        $.each(this.description.split(/[ \n]/), function (i, word) {
            var matches = autolink_regexp.exec(word);
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
};

MODELS.couch_down_handler = function (action, result) {
    MODELS.couch_up = false;
    // var message = "couchdb unavailable";
    // if (result.error && result.error != 'unknown') {
    //     message = result.error+': '+result.reason;
    // }
    // console.warn('['+action+'] '+message);
    // console.warn(result);
    
    $('#loading_playlists').addClass('unavailable');
    $('#loading_playlists').html(
        '<b>Database unavailable.</b>'
        + '<br>Your changes will not be saved. '
        + '<a href="#" onclick="PLAYLICK.retry_couch(); return false;">retry</a>'
    );
    $('#loading_playlists').show();
};

MODELS.couch_up_handler = function (action, response) {
    MODELS.couch_up = true;
    $('#loading_playlists').hide();
    $('#tracksError').hide();
};

var PLAYLICK = {
    
    /**
     * Config
    **/
    
    lastfm_api_key: "b25b959554ed76058ac220b7b2e0a026",
    lastfm_ws_url: "http://ws.audioscrobbler.com",
    
    /**
     * Strings
    **/
    
    start_button_text: $('#add_track_button').val(),
    add_button_text: 'Add',
    edit_playlist_text: 'edit',
    loading_playdar_text: $('#playdar').html(),
    connect_to_playdar_text: 'Connect to Playdar',
    disconnect_from_playdar_text: 'Disconnect from Playdar',
    cancel_edit_playlist_text: 'cancel',
    create_playlist_title: $('#playlistTitle').html(),
    loading_playlists_text: $('#loading_playlists').html(),
    
    /**
     * Utility
    **/
    
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
    
    /**
     * Init
    **/
    
    init: function () {
        // Start with a blank playlist
        PLAYLICK.blank_playlist();
        
        // Focus add track input
        $("#add_track_input").focus();
        
        // Load playlists
        PLAYLICK.fetch_playlists();
    },
    
    /**
     * Playdar
    **/
    
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
                PLAYLICK.update_playdar_status('Playdar unavailable. <a href="#" onclick="$(\'#playdar\').html(PLAYLICK.loading_playdar_text); Playdar.client.init(); return false;">retry</a>');
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
                    onplay: PLAYLICK.onResultPlay,
                    onpause: PLAYLICK.onResultPause,
                    onresume: PLAYLICK.onResultResume,
                    onstop: PLAYLICK.onResultStop,
                    onfinish: PLAYLICK.onResultFinish,
                    whileplaying: PLAYLICK.updatePlaybackProgress
                });
            } else if (result.url) {
                // HACK: Handle non playdar streams separately
                result.sid = Playdar.Util.generate_uuid();
                Playdar.player.soundmanager.createSound({
                    id: result.sid,
                    url: result.url,
                    onplay: PLAYLICK.onResultPlay,
                    onpause: PLAYLICK.onResultPause,
                    onresume: PLAYLICK.onResultResume,
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
                // ENDHACK
            }
            // Build result table item
            tbody_class = 'result';
            score_cell = $('<td class="score">');
            choice_radio = $('<input type="radio" name="choice">').val(result.sid);
            if (result.score == 1) {
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
            album_art = PLAYLICK.lastfm_ws_url + "/2.0/?" + $.param({
                artist: result.artist,
                album: result.album,
                method: "album.coverredirect",
                size: "small",
                api_key: PLAYLICK.lastfm_api_key
            });
            name_cell = $('<td class="name" colspan="4">');
            var artist_album = result.artist;
            if (result.album) {
                artist_album += ' - ' + result.album;
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
                .attr('id', 'sid' + result.sid)
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
        // Comment this out so we always resolve, rather than recheck
        // playlist_track.track.playdar_qid = response.qid;
        if (final_answer) {
            if (response.results.length) {
                playlist_track.track.playdar_response = response;
                list_item.addClass('match');
                var results_table = PLAYLICK.build_results_table(response, list_item);
                var result = response.results[0];
                if (result.score == 1) {
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
    // Generate a query ID and a results handler for a track
    playdar_track_handler: function (playlist_track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            // HACK - Add the URL as a source
            if (final_answer && playlist_track.track.url) {
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
                    if (result.score != 1) {
                        highest_non_perfect = i;
                        return false;
                    }
                });
                if (typeof highest_non_perfect != 'undefined') {
                    response.results.splice(highest_non_perfect, 0, url_result);
                } else {
                    response.results.push(url_result);
                }
            }
            // ENDHACK
            PLAYLICK.load_track_results(playlist_track, response, final_answer);
        }, uuid);
        return uuid;
    },
    resolve_track: function (playlist_track, force) {
        if (Playdar.client && Playdar.client.is_authed()) {
            var track = playlist_track.track;
            if (!force && track.playdar_response) {
                PLAYLICK.load_track_results(playlist_track, track.playdar_response, true);
            } else {
                if (track.playdar_qid) {
                    Playdar.client.recheck_results(track.playdar_qid);
                } else {
                    var qid = PLAYLICK.playdar_track_handler(playlist_track);
                    Playdar.client.resolve(track.artist, track.album, track.name, qid, track.url);
                }
            }
        }
    },
    resolve_current_playlist: function () {
        if (Playdar.client && Playdar.client.is_authed()) {
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
    
    /**
     * Playlist state
    **/
    
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
                }
            },
            onCreate: function () {
                // Add to sidebar
                $('#playlists').append(this.element);
            },
            onDelete: function () {
                if (this == PLAYLICK.current_playlist) {
                    PLAYLICK.blank_playlist();
                }
            },
            onSetDuration: function () {
                if (this == PLAYLICK.current_playlist) {
                    PLAYLICK.update_playlist_title(this.titleHTML());
                }
            }
        });
        return playlist;
    },
    // Update the playlist title (when loading a playlist or updating the duration)
    update_playlist_title: function (title) {
        $('#playlistTitle').html(title);
    },
    // Show/hide edit mode for playlist in sidebar
    toggle_playlist_edit: function (playlist_item) {
        // Toggle playlist link and form
        playlist_item.find('a.playlist').toggle();
        playlist_item.find('form.edit_playlist_form').toggle();
        // Update button
        var button = playlist_item.find('a.edit_playlist');
        if (button.html() == PLAYLICK.cancel_edit_playlist_text) {
            button.html(PLAYLICK.edit_playlist_text);
        } else {
            button.html(PLAYLICK.cancel_edit_playlist_text);
            // Update input and select
            var edit_input = playlist_item.find('input.playlist_name');
            edit_input.val(playlist_item.data('playlist').name);
            setTimeout(function () {
                edit_input.select();
            }, 1);
        }
    },
    // Remove a playlist
    delete_playlist: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.name)) {
            playlist.remove();
        }
    },
    // Highlight the current playlist in the sidebar
    set_current_playlist_item: function (playlist_item) {
        $('#playlists').find('li').removeClass('current');
        playlist_item.addClass('current');
    },
    // Highlight the currently playing playlist in the sidebar
    set_playing_playlist_item: function (playlist_item) {
        $('#playlists').find('li.p').removeClass('playing');
        if (playlist_item) {
            playlist_item.addClass('playing');
        }
    },
    // Create a new empty playlist
    blank_playlist: function () {
        // Cancel Playdar
        PLAYLICK.cancel_playdar_resolve();
        // Update current sidebar item
        PLAYLICK.set_current_playlist_item($('#create_playlist').parent('li'));
        // Reset the playlist view
        $('#playlist').empty();
        PLAYLICK.update_playlist_title(PLAYLICK.create_playlist_title);
        $('#add_track_button').val(PLAYLICK.start_button_text);
        // Show manage screen
        $('#import').hide();
        $('#manage').show();
        // Select input
        setTimeout(function () {
            $('#add_track_input').select();
        }, 1);
        // Create the playlist object
        PLAYLICK.current_playlist = PLAYLICK.create_playlist();
    },
    // Update a track's data and persist
    update_track: function (playlist_track, result, batch) {
        var track  = playlist_track.track;
        // If the track name or artist changed, update it and persist
        if (!PLAYLICK.compare_string(track.name, result.track)
         || !PLAYLICK.compare_string(track.artist, result.artist)
         || !PLAYLICK.compare_string(track.album, result.album)) {
            track.name = result.track;
            track.artist = result.artist;
            track.album = result.album;
            // Persist
            if (batch) {
                PLAYLICK.batch_save = true;
            } else {
                playlist_track.playlist.save();
            }
            // Update DOM
            playlist_track.element.find('.fn')
                .text(PLAYLICK.truncate_string(track.name))
                .attr('title', track.name);
            playlist_track.element.find('.contributor')
                .text(PLAYLICK.truncate_string(track.artist))
                .attr('title', track.artist);
        }
        // If the duration changed, update it
        if (track.duration != result.duration) {
            playlist_track.set_track_duration(result.duration);
            playlist_track.element.find('.elapsed').text(track.get_duration_string());
        }
        // If the sid has changed, stop the stream if it's playing
        if (playlist_track.track.playdar_sid && playlist_track.track.playdar_sid != result.sid) {
            Playdar.player.stop_stream(playlist_track.track.playdar_sid);
        }
        playlist_track.track.playdar_sid = result.sid;
        // URL to the actual file, for making a local playlist
        // For streaming, construct the url from the sid
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
    // Fetch playlists from Couch
    fetch_playlists: function () {
        try {
            var response = MODELS.couch.view("playlist/all");
            MODELS.couch_up_handler('fetch_playlists', response);
            PLAYLICK.fetch_playlists_done = true;
            var elements = $.map(response.rows, function (row, i) {
                // console.log(row);
                var data = row.value;
                // Create the playlist object
                var playlist = PLAYLICK.create_playlist(data);
                // Add to the sidebar
                return playlist.element.get();
            });
            $('#playlists').append(elements);
        } catch (result) {
            MODELS.couch_down_handler('fetch_playlists', result);
        }
    },
    // Fetch playlist tracks from Couch
    fetch_playlist_tracks: function (playlist) {
        try {
            var response = MODELS.couch.view("playlist/all", {
                "key": playlist._id
            });
            MODELS.couch_up_handler('fetch_playlist_tracks', response);
            var row = response.rows[0];
            var value = row.value;
            // Load tracks
            var elements = $.map(value.tracks, function (track_data, i) {
                var playlist_track = playlist.add_track(new MODELS.Track(track_data.track));
                // Build DOM element
                return playlist_track.element.get();
            });
            return elements;
        } catch (result) {
            MODELS.couch_down_handler('fetch_playlist_tracks', result);
        }
    },
    // Load a playlist from the sidebar
    load_playlist_item: function (playlist_item) {
        // Cancel Playdar
        PLAYLICK.cancel_playdar_resolve();
        // Update current sidebar item
        PLAYLICK.set_current_playlist_item(playlist_item);
        // Unload the current playlist
        PLAYLICK.current_playlist.unload();
        // Update the current playlist object
        PLAYLICK.current_playlist = playlist_item.data('playlist');
        // Update the title
        PLAYLICK.update_playlist_title(PLAYLICK.current_playlist.titleHTML());
        // Switch the add track button text
        $('#add_track_button').val(PLAYLICK.add_button_text);
        // Load tracks
        var elements;
        // Hide error message
        $('#tracksLoading').show();
        $('#tracksError').hide();
        if (!PLAYLICK.current_playlist.tracks.length) {
            // Fetch from Couch
            elements = PLAYLICK.fetch_playlist_tracks(PLAYLICK.current_playlist);
        } else {
            // Already fetched, just build DOM elements
            elements = PLAYLICK.current_playlist.load();
        }
        $('#tracksLoading').hide();
        if (elements && elements.length) {
            // Add to the DOM
            $('#playlist').append(elements);
            // Resolve tracks with Playdar
            PLAYLICK.resolve_current_playlist();
        } else {
            $('#tracksError').show();
        }
        // Show manage screen
        $('#import').hide();
        $('#manage').show();
    },
    
    /**
     * Playback
    **/
    
    onResultPlay: function () {
        PLAYLICK.onResultResume.call(this);
    },
    onResultPause: function () {
        var track_item = $('#sid' + this.sID).data('track_item');
        if (track_item) {
            // Switch track highlight in the playlist
            track_item.removeClass('playing');
            track_item.addClass('paused');
        }
    },
    onResultResume: function () {
        var track_item = $('#sid' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Update the now playing track
            PLAYLICK.now_playing = playlist_track;
            // Highlight the playlist in the sidebar
            PLAYLICK.set_playing_playlist_item(playlist_track.playlist.element);
            // Highlight the track in the playlist
            track_item.removeClass('paused');
            track_item.addClass('playing');
        }
    },
    onResultStop: function () {
        var track_item = $('#sid' + this.sID).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Remove track highlight in the playlist
            track_item.removeClass('playing');
            track_item.removeClass('paused');
            // Reset progress bar
            track_item.css('background-position', '0 0');
            // Reset elapsed counter
            var progress = track_item.find('.elapsed');
            progress.text(playlist_track.track.get_duration_string());
        }
        // Clear the now playing track
        PLAYLICK.now_playing = null;
        Playdar.player.stop_all();
    },
    onResultFinish: function () {
        PLAYLICK.onResultStop.call(this);
        // Chain playback to the next perfect match
        var playlist_track = $('#sid' + this.sID).data('track_item');
        if (playlist_track) {
            var next_playlist_track = playlist_track.nextAll('li.perfectMatch').data('playlist_track');
            if (next_playlist_track) {
                PLAYLICK.play_track(next_playlist_track);
                return true;
            }
        }
        // Remove the playlist highlight from the sidebar
        PLAYLICK.set_playing_playlist_item();
        return false;
    },
    updatePlaybackProgress: function () {
        var track_item = $('#sid' + this.sID).data('track_item');
        if (track_item) {
            track_item.addClass('playing');
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
    },
    update_stream_duration: function (sid, duration) {
        var track_item = $('#sid' + sid).data('track_item');
        if (track_item) {
            var playlist_track = track_item.data('playlist_track');
            // Update the track duration
            playlist_track.set_track_duration(Math.round(duration/1000));
        }
    },
    play_track: function (playlist_track) {
        if (playlist_track && playlist_track.track.playdar_sid) {
            Playdar.player.play_stream(playlist_track.track.playdar_sid);
        }
    },
    
    /**
     * Import
    **/
    
    // Parse XSPF JSON into a playlist
    create_from_jspf: function (jspf, metadata) {
        // console.dir(jspf);
        var title = jspf.title;
        // Create the playlist
        var playlist = PLAYLICK.create_playlist({
            name: title
        });
        // Load tracks
        $.each(jspf.trackList.track, function (i, track) {
            var track_doc = {
                name: track.title,
                artist: track.creator,
                album: track.album,
                duration: Math.round(track.duration/1000)
            };
            if (track.location) {
                track_doc.url = track.location;
            }
            playlist.add_track(new MODELS.Track(track_doc));
        });
        // Save metadata
        playlist.image = metadata.image;
        playlist.description = metadata.description;
        playlist.save();
        return playlist;
    },
    // Parse podcast JSON into a playlist
    create_from_podcast: function (podcast) {
        // console.dir(podcast);
        var title = podcast.title;
        // Create the playlist
        var playlist = PLAYLICK.create_playlist({
            name: title
        });
        // Load tracks
        $.each(podcast.item, function (i, track) {
            var track_doc = {
                name: track.title,
                artist: track.author
            };
            if (track.enclosure && track.enclosure.url) {
                track_doc.url = track.enclosure.url;
            }
            playlist.add_track(new MODELS.Track(track_doc));
        });
        playlist.save();
    },
    // Fetch an XSPF as JSON via YQL
    fetch_xspf: function (xspf_url) {
        $.getJSON("http://query.yahooapis.com/v1/public/yql?callback=?", {
            q: 'select * from xml where url="' + xspf_url + '"',
            format: 'json'
        }, function (json) {
            // console.dir(json);
            var error_text;
            if (json) {
                if (json.error) {
                    error_text = json.error.description;
                } else if (json.query && json.query.results) {
                    var jspf = json.query.results.lfm ? json.query.results.lfm.playlist : json.query.results.playlist;
                    if (jspf && jspf.trackList && jspf.trackList.track) {
                        // console.dir(jspf);
                        if (jspf.trackList.track.length) {
                            var metadata = {
                                description: jspf.annotation,
                                image: jspf.image
                            };
                            var playlist = PLAYLICK.create_from_jspf(jspf, metadata);
                            // Update messages
                            $('#import p.messages').hide();
                            $('#xspf_title').text(jspf.title);
                            $('#xspf_count').text(jspf.trackList.track.length);
                            $('#xspf_done').show();
                            return true;
                        } else {
                            error_text = 'No tracks';
                        }
                    } else {
                        error_text = 'Invalid XSPF';
                    }
                } else {
                    error_text = 'Invalid URL';
                }
            } else {
                error_text = 'No response';
            }
            $('#xspf_input').val(xspf_url);
            $('#import p.messages').hide();
            var escaped_url = $('<b>').text('URL: ' + xspf_url);
            var escaped_request = $('<small>').text(this.url);
            var error_message = $('<p>').text(error_text);
            error_message.append('<br>')
                         .append(escaped_url)
                         .append('<br>')
                         .append(escaped_request);
            $('#xspf_error').html(error_message);
            $('#xspf_error').show();
        });
    },
    // Fetch a podcast as JSON via YQL
    fetch_podcast: function (podcast_url) {
        $.getJSON("http://query.yahooapis.com/v1/public/yql?callback=?", {
            q: 'select * from xml where url="' + podcast_url + '"',
            format: 'json'
        }, function (json) {
            // console.dir(json);
            var error_text;
            if (json) {
                if (json.error) {
                    error_text = json.error.description;
                } else if (json.query && json.query.results && json.query.results.rss) {
                    var podcast = json.query.results.rss.channel;
                    if (podcast.length) {
                        if (podcast.item) {
                            PLAYLICK.create_from_podcast(podcast);
                            // Update messages
                            $('#import p.messages').hide();
                            $('#podcast_title').text(podcast.title);
                            $('#podcast_count').text(podcast.item.length);
                            $('#podcast_done').show();
                            return true;
                        } else {
                            error_text = 'No tracks';
                        }
                    } else {
                        error_text = 'Invalid Podcast';
                    }
                } else {
                    error_text = 'Invalid URL';
                }
            } else {
                error_text = 'No response';
            }
            $('#podcast_input').val(podcast_url);
            $('#import p.messages').hide();
            var escaped_url = $('<b>').text('URL: ' + podcast_url);
            var escaped_request = $('<small>').text(this.url);
            var error_message = $('<p>').text(error_text);
            error_message.append('<br>')
                         .append(escaped_url)
                         .append('<br>')
                         .append(escaped_request);
            $('#podcast_error').html(error_message);
            $('#podcast_error').show();
        });
    },
    // Fetch a Last.fm album playlist as JSON
    fetch_lastfm_album: function (artist, album) {
        // Fetch the playlist URL
        $.getJSON(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
            method: "album.getinfo",
            artist: artist,
            album: album,
            api_key: PLAYLICK.lastfm_api_key,
            format: "json"
        }, function (album_json) {
            if (album_json.error) {
                $('#import p.messages').hide();
                var escaped_album = $('<b>').text('Artist: ' + artist + ' Album: ' + album);
                var escaped_request = $('<small>').text(this.url);
                var error_message = $('<p>').text('Error ' + album_json.error + ': ' + album_json.message);
                error_message.append('<br>')
                             .append(escaped_album)
                             .append('<br>')
                             .append(escaped_request);
                $('#album_error').html(error_message);
                $('#album_error').show();
            } else {
                // Fetch the playlist XSPF
                var playlist_url = "lastfm://playlist/album/" + album_json.album.id;
                var escaped_playlist = $('<b>').text('Album Playlist: ' + playlist_url);
                var metadata = {};
                var image = $.grep(album_json.album.image, function (value, i) {
                    return value.size == 'medium';
                });
                if (image[0]) {
                    metadata.image = image[0]['#text'];
                }
                var playlist = PLAYLICK.fetch_lastfm_playlist(
                    playlist_url,
                    metadata,
                    function onDone () {
                        $('#import p.messages').hide();
                        var escaped_album = $('<b>').text('Artist: '+album_json.album.artist+' Album: '+album_json.album.name);
                        $('#album_name').html(escaped_album);
                        $('#album_done').show();
                    },
                    function onError (error_message) {
                        $('#import p.messages').hide();
                        var escaped_request = $('<small>').text(this.url);
                        error_message.append('<br>')
                                     .append(escaped_album)
                                     .append('<br>')
                                     .append(escaped_playlist)
                                     .append('<br>')
                                     .append(escaped_request);
                        $('#album_error').html(error_message);
                        $('#album_error').show();
                    }
                );
            }
        });
    },
    // Fetch a Last.fm user's playlists as JSON
    fetch_lastfm_user_playlists: function (username) {
        $.getJSON(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
            method: "user.getplaylists",
            user: username,
            api_key: PLAYLICK.lastfm_api_key,
            format: 'json'
        }, function (json) {
            // console.dir(json);
            if (json.error) {
                // Reset input
                $('#import_playlist_input').val(username);
                // Show error message
                $('#import p.messages').hide();
                var escaped_name = $('<b>').text('Username: ' + username);
                var escaped_request = $('<small>').text(this.url);
                var error_message = $('<p>').text('Error ' + json.error + ': ' + json.message);
                error_message.append('<br>')
                             .append(escaped_name)
                             .append('<br>')
                             .append(escaped_request);
                $('#import_error').html(error_message);
                $('#import_error').show();
            } else {
                $('#import_error').empty();
                // Last.fm APIs return single item lists as single items
                var playlists = $.makeArray(json.playlists.playlist);
                if (playlists.length) {
                    PLAYLICK.playlist_done = {};
                    $.each(playlists, function (i, playlist_data) {
                        // console.dir(playlist_data);
                        var playlist_url = "lastfm://playlist/" + playlist_data.id;
                        var escaped_playlist = $('<b>').text('Playlist: ' + playlist_url);
                        var metadata = {
                            description: playlist_data.description
                        };
                        var image = $.grep(playlist_data.image, function (value, i) {
                            return value.size == 'medium';
                        });
                        if (image[0]) {
                            metadata.image = image[0]['#text'];
                        }
                        var playlist = PLAYLICK.fetch_lastfm_playlist(
                            playlist_url,
                            metadata,
                            function onDone () {
                                $('#import p.messages').hide();
                                $('#import_count').text(playlists.length);
                                $('#import_done').show();
                            },
                            function onError (error_message) {
                                // Reset input
                                $('#import_playlist_input').val(username);
                                // Show error message
                                $('#import p.messages').hide();
                                var escaped_request = $('<small>').text(this.url);
                                error_message.append('<br>')
                                             .append(escaped_name)
                                             .append('<br>')
                                             .append(escaped_playlist)
                                             .append('<br>')
                                             .append(escaped_request);
                                $('#import_error').html(error_message);
                                $('#import_error').show();
                            }
                        );
                    });
                } else {
                    // No playlists
                    $('#import p.messages').hide();
                    $('#import_error_no_playlists').show();
                }
            }
        });
    },
    // Fetch a Last.fm playlist as JSON
    fetch_lastfm_playlist: function (playlist_url, metadata, onDone, onError) {
        if (PLAYLICK.playlist_done) {
            PLAYLICK.playlist_done[playlist_url] = false;
        }
        // Get the tracklist for each playlist
        $.getJSON(PLAYLICK.lastfm_ws_url + "/2.0/?callback=?", {
            method: "playlist.fetch",
            playlistURL: playlist_url,
            api_key: PLAYLICK.lastfm_api_key,
            format: 'json'
        }, function (playlist_json) {
            // console.dir(playlist_json);
            if (playlist_json.error) {
                if (onError) {
                    var error_message = $('<p>').text('Error ' + playlist_json.error + ': ' + playlist_json.message);
                    onError.call(this, error_message);
                }
            } else {
                // Last.fm APIs return single item lists as single items
                var playlist_data = playlist_json.playlist;
                playlist_data.trackList.track = $.makeArray(playlist_data.trackList.track);
                if (playlist_data.trackList.track.length) {
                    var playlist = PLAYLICK.create_from_jspf(playlist_data, metadata);
                    if (onDone) {
                        if (PLAYLICK.playlist_done) {
                            PLAYLICK.playlist_done[playlist_url] = true;
                            var done_loading = true;
                            for (var k in PLAYLICK.playlist_done) {
                                if (PLAYLICK.playlist_done[k] === false) {
                                    done_loading = false;
                                    break;
                                }
                            };
                            if (done_loading) {
                                PLAYLICK.playlist_done = null;
                                onDone.call(this);
                            }
                        } else {
                            onDone.call(this);
                        }
                    }
                    return playlist;
                } else if (onError) {
                    var error_message = $('<p>').text('No tracks');
                    onError.call(this, error_message);
                }
            }
        });
    }
};

/**
 * Current playlist handlers
**/

// Playlist reordering behaviour
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
// Click handlers for currently loaded playlist
$('#playlist').click(function (e) {
    var target = $(e.target);
    var track_item = target.closest('li.p_t');
    if (track_item.size()) {
        var playlist_track = track_item.data('playlist_track');
        
        // Clicks to playdar results
        var tbody = target.closest('tbody.result');
        if (tbody.size()) {
            // Check radio button
            var radio = tbody.find('input[name=choice]');
            radio.attr('checked', true);
            // Highlight result
            tbody.siblings().removeClass('choice');
            tbody.addClass('choice');
            // Update track with result data
            var result = tbody.data('result');
            PLAYLICK.update_track(playlist_track, result);
            if (!Playdar.player.is_now_playing()) {
                PLAYLICK.play_track(playlist_track);
            }
            track_item.addClass('perfectMatch');
        }
        
        // Remove track from playlist
        if (target.is('a.remove')) {
            playlist_track.remove();
            return false;
        }
        
        // Toggle sources
        if (target.is('a.show_sources')) {
            track_item.toggleClass('open');
            return false;
        }
        
        // Clicks to the main track name
        var track_link = target.closest('li.p_t a.item');
        if (track_link.size()) {
            e.preventDefault();
            if (track_item.is('li.perfectMatch') && playlist_track.track.playdar_sid) {
                PLAYLICK.play_track(playlist_track);
            } else if (track_item.is('li.match')) {
                track_item.toggleClass('open');
            } else {
                PLAYLICK.resolve_track(playlist_track, true);
            }
        }
    }
});


/**
 * Add track handlers
**/

// Add track autocomplete
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
            // Last.fm APIs return single item lists as single items
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
// Add track autocomplete select
$("#add_track_input").result(function (e, track, formatted) {
    $("#add_track_name").val(track.name);
    $("#add_track_artist").val(track.artist);
    $('#add_to_playlist').submit();
});
// Add to loaded playlist form submit
$('#add_to_playlist').submit(function (e) {
    e.preventDefault();
    // Parse the form and add tracks
    var params = PLAYLICK.serialize_form(this);
    if (params.track_name && params.artist_name) {
        // Clear the inputs and refocus
        $('#add_track_artist').val('');
        $('#add_track_track').val('');
        $('#add_track_input').val('').focus();
        var track = new MODELS.Track({
            name: params.track_name,
            artist: params.artist_name
        });
        var playlist_track = PLAYLICK.current_playlist.add_track(track);
        PLAYLICK.current_playlist.save();
        $('#playlist').append(playlist_track.element);
        if (playlist_track.position == 1) {
            $('#add_track_button').val(PLAYLICK.add_button_text);
        }
        PLAYLICK.resolve_track(playlist_track);
    }
});

/**
 * Sidebar handlers
**/

// Click handler to start a new blank playlist
$('#create_playlist').click(function (e) {
    e.preventDefault();
    PLAYLICK.blank_playlist();
});
// Click handler to show import screen
$('#import_playlist').click(function (e) {
    e.preventDefault();
    var target = $(e.target);
    // Update current sidebar item
    PLAYLICK.set_current_playlist_item($('#import_playlist').parent('li'));
    // Show Import screen
    $('#manage').hide();
    $('#import p.messages').hide();
    $('#import').show();
    // Select input
    setTimeout(function () {
        $('#import_playlist_input').select();
    }, 1);
});
// Capture ESC while toggling playlist editing
$('#playlists').keydown(function (e) {
    // console.dir(e);
    var target = $(e.target);
    // Capture ESC
    if (target.is('input.playlist_name') && e.keyCode == 27) {
        PLAYLICK.toggle_playlist_edit(target.parents('li.p'));
    }
});
// Click handlers for playlists in the sidebar
$('#playlists').click(function (e) {
    var target = $(e.target);
    var playlist_item = target.closest('li.p');
    // Load the clicked playlist
    if (target.is('li.p a.playlist')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.load_playlist_item(playlist_item);
    }
    // Delete the playlist
    if (target.is('li.p a.delete_playlist')) {
        e.preventDefault();
        PLAYLICK.delete_playlist(playlist_item.data('playlist'));
    }
    // Toggle play
    if (target.is('li.p a.playlist_playing')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.play_track(PLAYLICK.now_playing);
    }
    // Toggle playlist name editing
    if (target.is('li.p a.edit_playlist')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.toggle_playlist_edit(playlist_item);
    }
    // Update playlist name
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

/**
 * Import handlers
**/

// Import Last.fm playlist form
$('#import_playlist_form').submit(function (e) {
    e.preventDefault();
    // Show a loading icon
    $('#import p.messages').hide();
    $('#import_loading').show();
    // Parse the form
    var params = PLAYLICK.serialize_form(this);
    // Clear the input and refocus
    $('#import_playlist_input').val('').select();
    // Get this user's playlists
    PLAYLICK.fetch_lastfm_user_playlists(params.username);
});

// Add album autocomplete
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
            // Last.fm APIs return single item lists as single items
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
// Add album autocomplete select
$("#album_import_input").result(function (e, album, formatted) {
    $("#album_import_name").val(album.name);
    $("#album_import_artist").val(album.artist);
    $('#album_import_input').submit();
});
// Import album playlist form submit
$('#album_form').submit(function (e) {
    e.preventDefault();
    // Show a loading icon
    $('#import p.messages').hide();
    $('#album_loading').show();
    // Parse the form
    var params = PLAYLICK.serialize_form(this);
    // Clear the inputs and refocus
    $("#album_import_artist").val('');
    $("#album_import_name").val('');
    $("#album_import_input").val('').select();
    // Load the XSPF
    PLAYLICK.fetch_lastfm_album(params.artist_name, params.album_name);
});

// Import XSPF form
$('#xspf_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = PLAYLICK.serialize_form(this);
    // Clear the input and refocus
    $('#xspf_input').val('').select();
    // Show a loading icon
    $('#import p.messages').hide();
    $('#xspf_loading').show();
    // Load the XSPF
    var xspf_url = params.xspf;
    PLAYLICK.fetch_xspf(xspf_url);
});

// Import Podcast form
$('#podcast_form').submit(function (e) {
    e.preventDefault();
    // Show a loading icon
    $('#import p.messages').hide();
    $('#podcast_loading').show();
    // Parse the form
    var params = PLAYLICK.serialize_form(this);
    // Clear the input and refocus
    $('#podcast_input').val('').select();
    // Load the podcast
    PLAYLICK.fetch_podcast(params.podcast);
});

/**
 * Keyboard shortcuts
**/
$(document).keydown(function (e) {
    // console.dir(e);
    var target = $(e.target);
    // Don't capture on keyboardable inputs
    if (target.is('input[type=text], textarea, select')) {
        return true;
    }
    // Don't capture with any modifiers
    if (e.metaKey || e.shiftKey || e.altKey || e.ctrlKey) {
        return true;
    }
    switch (e.keyCode) {
    case 80: // p
        e.preventDefault();
        var current_track = PLAYLICK.now_playing;
        if (!current_track) {
            // Get the first perfect match
            current_track = $('#playlist li.perfectMatch').data('playlist_track');
        }
        PLAYLICK.play_track(current_track);
        break;
    case 219: // [
        // Back a track
        e.preventDefault();
        var current_track = $('#playlist li.playing, #playlist li.paused');
        var previous_track = current_track.prevAll('li.perfectMatch');
        PLAYLICK.play_track(previous_track.data('playlist_track'));
        break;
    case 221: // ]
        // Skip track
        e.preventDefault();
        var current_track = $('#playlist li.playing, #playlist li.paused');
        var next_track = current_track.nextAll('li.perfectMatch');
        PLAYLICK.play_track(next_track.data('playlist_track'));
        break;
    }
});
