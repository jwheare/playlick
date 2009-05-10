// Custom Track and Playlist renderers
MODELS.Track.prototype.toHTML = function () {
    return '<a href="#" class="remove">╳</a>'
        + '<a href="#" class="item">'
            + '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
            + '</span>'
        + '</a>'
        + '<div class="sources">'
            + '<p class="sourcesEmpty">Loading results…</p>'
        + '</div>';
};
MODELS.Playlist.prototype.toHTML = function () {
    return '<a href="#" class="delete_playlist">╳</a>'
        + '<a href="#" class="edit_playlist">edit</a>'
        + '<a href="#" class="playlist">' + this.name + '</a>'
        + '<form style="display: none;" class="edit_playlist_form">'
            + '<input type="text" name="name" value="' + this.name + '" class="playlist_name">'
            + '<input type="submit" value="save">'
        + '</form>';
};

var PLAYLICK = {
    current_playlist: null,
    start_button_text: $('#add_track_button').val(),
    add_button_text: 'Add',
    // Create a new empty playlist
    new_playlist: function  () {
        PLAYLICK.current_playlist = new MODELS.Playlist('playlist', {
            onCreate: function () {
                if (!this.is_in_dom()) {
                    this.element.appendTo($('#playlist_stash'));
                    PLAYLICK.update_playlist_title(this.toString());
                    DATA.playlists[this.id] = {
                        name: this.name,
                        tracks: this.tracks
                    };
                }
            }
        });
        $('#add_track_button').val(PLAYLICK.start_button_text);
        $('#add_track_input').select();
    },
    create_playlist_title: $('#playlistTitle').html(),
    update_playlist_title: function (title) {
        $('#playlistTitle').html(title);
    },
    stash_current: function (title) {
        if (Playdar.client) {
            Playdar.client.cancel_resolve();
        }
        if (Playdar.player) {
            Playdar.player.stop_all();
        }
        // Stash the current data
        if (PLAYLICK.current_playlist.tracks.length) {
            DATA.playlists[PLAYLICK.current_playlist.id] = {
                name: PLAYLICK.current_playlist.name,
                tracks: $.map(PLAYLICK.current_playlist.tracks, function (item, index) {
                    return item.track;
                })
            };
        }
        if (title) {
            PLAYLICK.update_playlist_title(title);
        }
    },
    delete_playlist: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.name)) {
            if (PLAYLICK.current_playlist == playlist) {
                PLAYLICK.update_playlist_title(PLAYLICK.create_playlist_title);
            }
            delete DATA.playlists[playlist.id];
            playlist.initialise();
            if (playlist.is_in_dom()) {
                playlist.element.remove();
            }
        }
    },
    setResultPlaying: function () {
        var result = $('#sid' + this.sID);
        result.addClass('playing');
        result.removeClass('paused');
        
        var trackItem = result.parents('li.p_t');
        trackItem.addClass('playing');
        trackItem.removeClass('paused');
    },
    setResultPaused: function () {
        var result = $('#sid' + this.sID);
        result.addClass('paused');
        result.removeClass('playing');
        
        var trackItem = result.parents('li.p_t');
        trackItem.removeClass('playing');
        trackItem.addClass('paused');
    },
    setResultStopped: function () {
        Playdar.player.stop_all();
        var result = $('#sid' + this.sID);
        result.removeClass('paused');
        result.removeClass('playing');
        
        var progress = $('#progress' + this.sID);
        progress.html('');
        
        var trackItem = result.parents('li.p_t');
        trackItem.removeClass('playing');
        trackItem.css('background-position', '0 0');
    },
    updatePlaybackProgress: function () {
        var result = $('#sid' + this.sID);
        var progress = $('#progress' + this.sID);
        // Update the track progress
        progress.html(UTIL.mmss(Math.round(this.position/1000)));
        // Update the playback progress bar
        var duration;
        if (this.readyState == 3) { // loaded/success
            duration = this.duration;
        } else {
            duration = this.durationEstimate;
        }
        var portion_played = this.position / duration;
        var trackItem = result.parents('li.p_t');
        trackItem.css('background-position', Math.round(portion_played * 570) + 'px 0');
    },
    
    playdar_track_handler: function (track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            var list_item = $(track.element).parents('li.p_t');
            var playlist_track = list_item.data('playlist_track');
            if (final_answer) {
                list_item.removeClass('loading');
                if (response.results.length) {
                    var result = response.results[0];
                    if (result.score == 1) {
                        list_item.addClass('perfectMatch');
                        // Update track
                        playlist_track.track.name = result.track;
                        playlist_track.track.artist = result.artist;
                        playlist_track.track.duration = result.duration;
                        playlist_track.render();
                        playlist_track.playlist.save();
                    } else {
                        list_item.addClass('match');
                    }
                    var results = PLAYLICK.build_results_table(response);
                    var sources = list_item.children('.sources');
                    sources.html(results);
                    sources.show();
                    playlist_track.element.find('a.item').data('sid', result.sid);
                } else {
                    list_item.addClass('noMatch');
                }
            } else {
                list_item.addClass('loading');
            }
        }, uuid);
        return uuid;
    },
    build_results_table: function (response) {
        var score_cell, result;
        var results = $('<table cellspacing="0"></table>');
        for (var i = 0; i < response.results.length; i++) {
            result = response.results[i];
            var sound = Playdar.player.register_stream(result, {
                onplay: PLAYLICK.setResultPlaying,
                onpause: PLAYLICK.setResultPaused,
                onresume: PLAYLICK.setResultPlaying,
                onstop: PLAYLICK.setResultStopped,
                onfinish: PLAYLICK.setResultStopped,
                whileplaying: PLAYLICK.updatePlaybackProgress
            });
            
            if (result.score < 0) {
                score_cell = '<td class="score">&nbsp;</td>';
            } else if (result.score == 1) {
                score_cell = '<td class="score perfect">★</td>';
            } else {
                score_cell = '<td class="score">' + result.score.toFixed(3) + '</td>';
            }
            var tbody_html = '<tbody class="result" id="sid' + result.sid + '">'
                + '<tr class="track">'
                    + '<td class="play"><span>▸</span></td>'
                    + '<td class="name">'
                        + result.artist + ' - ' + result.track
                    + '</td>'
                    + '<td class="progress" id="progress' + result.sid + '"></td>'
                    + '<td class="time">' + UTIL.mmss(result.duration) + '</td>'
                + '</tr>'
                + '<tr class="info">'
                    + score_cell
                    + '<td class="source">' + result.source + '</td>'
                    + '<td class="bitrate">' + result.bitrate + ' kbps</td>'
                    + '<td class="size">' + (result.size/1000000).toFixed(1) + 'MB</td>'
                + '</tr>'
            + '</tbody>';
            var result_tbody = $(tbody_html).data('sid', result.sid);
            results.append(result_tbody);
        }
        return results;
    }
};

$("#add_track_input").autocomplete("http://ws.audioscrobbler.com/2.0/?callback=?", {
    multiple: false,
    delay: 200,
    dataType: "jsonp",
    extraParams: {
        api_key: "b25b959554ed76058ac220b7b2e0a026",
        format: "json",
        method: "track.search",
        track: function () {
            return $("#add_track_input").val();
        }
    },
    cacheLength: 1,
    // mustMatch: true,
    parse: function (json) {
        var parsed = [];
        if (json && json.results.trackmatches.track) {
            var tracks = json.results.trackmatches.track;
            if (!$.isArray(tracks)) {
                tracks = [tracks];
            }
            $.each(tracks, function (index, track) {
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
$("#add_track_input").focus();

// Setup playlist reordering behaviour
$('#playlist').sortable({
    axis: 'y',
    cursor: 'move',
    opacity: 0.5,
    placeholder: 'placeholder',
    update: function (e, ui) {
        var ids = $('#playlist').sortable('toArray');
        var tracks = [];
        $.each(ids, function (index, id) {
            tracks.push($('#' + id).data('playlist_track'));
        });
        PLAYLICK.current_playlist.reset_tracks(tracks);
    }
});

// Load playlist stash
$('#loading_playlists').hide();
$.each(DATA.playlists, function (key, value) {
    var playlist = new MODELS.Playlist('playlist', {
        id: key,
        name: value.name
    });
    playlist.element.appendTo($('#playlist_stash'));
});

// Create a new playlist
PLAYLICK.new_playlist();

// Setup event handlers
$('#create_playlist').click(function (e) {
    e.preventDefault();
    if (Playdar.client) {
        Playdar.client.cancel_resolve();
    }
    PLAYLICK.stash_current(PLAYLICK.create_playlist_title);
    PLAYLICK.new_playlist();
});

// Add to loaded playlist
$('#add_to_playlist').submit(function (e) {
    e.preventDefault();
    // Parse the form and add tracks
    var params = {};
    $.each($(this).serializeArray(), function (index, item) {
        params[item.name] = item.value;
    });
    if (params.track_name && params.artist_name) {
        $('#add_track_input').val('');
        $('#add_track_artist').val('');
        $('#add_track_track').val('');
        $('#add_track_input').select();
        var track = new MODELS.Track(params.track_name, params.artist_name);
        var playlist_track = PLAYLICK.current_playlist.add_track(track);
        if (playlist_track.position == 1) {
            $('#add_track_button').val(PLAYLICK.add_button_text);
        }
        if (Playdar.client) {
            Playdar.client.autodetect(PLAYLICK.playdar_track_handler, playlist_track.element[0]);
        }
    }
});

$('#playlist').click(function (e) {
    var target = $(e.target);
    // Clicks to playdar results
    var tbody = target.closest('tbody.result');
    if (tbody.size()) {
        e.preventDefault();
        var sid = tbody.data('sid');
        if (sid) {
            Playdar.player.play_stream(sid);
        }
    }
    // Clicks to the remove button
    if (target.is('a.remove')) {
        target.parents('li.p_t').data('playlist_track').remove();
        return false;
    }
    // Clicks to the main track name
    var track_item = target.closest('li.p_t a.item');
    if (track_item.size()) {
        e.preventDefault();
        var sid = track_item.data('sid');
        if (sid) {
            Playdar.player.play_stream(sid);
        }
    }
});

$('#playlist_stash').click(function (e) {
    // Load the clicked playlist
    var target = $(e.target);
    if (target.is('li.p a.playlist')) {
        e.preventDefault();
        target.blur();
        PLAYLICK.stash_current();
        PLAYLICK.current_playlist = target.parents('li.p').data('playlist');
        PLAYLICK.current_playlist.load_tracks(DATA.playlists[PLAYLICK.current_playlist.id].tracks);
        PLAYLICK.update_playlist_title(PLAYLICK.current_playlist.toString());
        $('#add_track_button').val(PLAYLICK.add_button_text);
        if (Playdar.client) {
            Playdar.client.autodetect(PLAYLICK.playdar_track_handler);
        }
    }
    // Edit the playlist name
    if (target.is('li.p a.edit_playlist')) {
        e.preventDefault();
        target.blur();
        target.siblings('.playlist').toggle();
        target.siblings('form').toggle();
        setTimeout(function () {
            target.siblings('form').find(':text').select();
        }, 1);
    }
    if (target.is('li.p a.delete_playlist')) {
        e.preventDefault();
        PLAYLICK.delete_playlist(target.parents('li.p').data('playlist'));
    }
    if (target.is('#playlist_stash form.edit_playlist_form input[type=submit]')) {
        e.preventDefault();
        var form = target.parents('form');
        form.hide();
        form.siblings('.playlist').show();
        var stash_row = form.parents('li.p');
        var playlist = stash_row.data('playlist');
        var name = form.serializeArray()[0].value;
        form.siblings('.playlist').html(name);
        playlist.set_name(name);
        if (PLAYLICK.current_playlist == playlist) {
            PLAYLICK.update_playlist_title(playlist.toString());
        }
    }
});