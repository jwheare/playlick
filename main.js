// Custom Track and Playlist renderers
MODELS.Track.prototype.toHTML = function () {
    return '<a href="#" class="remove" title="Remove from playlist">╳</a>'
        + '<a href="#" class="show_sources">sources</a>'
        + '<a href="#" class="item">'
            + '<span class="status">'
                + '&nbsp;'
                + '<span class="play">▸</span>'
                + '<span class="scanning">'
                    + '<img src="/track_scanning.gif" width="16" height="16" alt="Scanning for sources">'
                + '</span>'
                + '&nbsp;'
            + '</span>'
            + '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
            + '</span>'
        + '</a>'
        + '<div class="sources"></div>';
};
MODELS.Playlist.prototype.toHTML = function () {
    return '<a href="#" class="delete_playlist" title="Delete playlist">╳</a>'
        + '<a href="#" class="edit_playlist">' + PLAYLICK.edit_playlist_text + '</a>'
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
    edit_playlist_text: 'edit',
    cancel_edit_playlist_text: 'cancel',
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
    onResultPlay: function () {
        var trackItem = $('#sid' + this.sID).data('track_item');
        trackItem.addClass('playing');
        trackItem.removeClass('paused');
    },
    onResultPause: function () {
        var trackItem = $('#sid' + this.sID).data('track_item');
        trackItem.removeClass('playing');
        trackItem.addClass('paused');
    },
    onResultStop: function () {
        Playdar.player.stop_all();
        var progress = $('#progress' + this.sID);
        progress.html('');
        
        var trackItem = $('#sid' + this.sID).data('track_item');
        trackItem.removeClass('playing');
        trackItem.css('background-position', '0 0');
    },
    onResultFinish: function () {
        PLAYLICK.onResultStop.call(this);
        var next_track = $('#sid' + this.sID).data('track_item').nextAll('li.match');
        var playlist_track = next_track.data('playlist_track');
        PLAYLICK.play_track(playlist_track);
    },
    updatePlaybackProgress: function () {
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
        var trackItem = $('#sid' + this.sID).data('track_item');
        trackItem.css('background-position', Math.round(portion_played * 570) + 'px 0');
    },
    
    update_track: function (playlist_track, result, copy_details) {
        if (copy_details) {
            playlist_track.track.name = result.track;
            playlist_track.track.artist = result.artist;
            playlist_track.track.duration = result.duration;
            playlist_track.element.find('span.fn').html(result.track);
            playlist_track.element.find('span.contributor').html(result.artist);
        }
        playlist_track.sid = result.sid;
        playlist_track.playlist.save();
    },
    
    play_track: function (playlist_track) {
        if (playlist_track.sid) {
            Playdar.player.play_stream(playlist_track.sid);
        }
    },
    
    playdar_track_handler: function (track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            var list_item = $(track.element).parents('li.p_t');
            var playlist_track = list_item.data('playlist_track');
            if (final_answer) {
                list_item.removeClass('scanning');
                if (response.results.length) {
                    list_item.removeClass('scanning noMatch perfectMatch');
                    list_item.addClass('match');
                    var result = response.results[0];
                    if (result.score == 1) {
                        list_item.addClass('perfectMatch');
                    }
                    PLAYLICK.update_track(playlist_track, result);
                    var results = PLAYLICK.build_results_table(response, list_item);
                    var sources = list_item.children('.sources');
                    sources.html(results);
                } else {
                    list_item.removeClass('scanning match perfectMatch');
                    list_item.addClass('noMatch');
                }
            } else {
                list_item.removeClass('noMatch match perfectMatch');
                list_item.addClass('scanning');
            }
        }, uuid);
        return uuid;
    },
    build_results_table: function (response, list_item) {
        var score_cell, result;
        var results = $('<table cellspacing="0"></table>');
        for (var i = 0; i < response.results.length; i++) {
            result = response.results[i];
            var sound = Playdar.player.register_stream(result, {
                onplay: PLAYLICK.onResultPlay,
                onpause: PLAYLICK.onResultPause,
                onresume: PLAYLICK.onResultPlay,
                onstop: PLAYLICK.onResultStop,
                onfinish: PLAYLICK.onResultFinish,
                whileplaying: PLAYLICK.updatePlaybackProgress
            });
            
            var checked = '';
            if (result.score < 0) {
                score_cell = '<td class="score">&nbsp;</td>';
            } else if (result.score == 1) {
                score_cell = '<td class="score perfect">★</td>';
                checked = ' checked="checked"';
            } else {
                score_cell = '<td class="score">' + result.score.toFixed(3) + '</td>';
            }
            var tbody_html = '<tbody class="result" id="sid' + result.sid + '">'
                + '<tr class="track">'
                    + '<td class="choice">'
                        + '<input type="radio" name="choice" value="' + result.sid + '"' + checked + '>'
                    + '</td>'
                    + '<td class="name" colspan="3">'
                        + result.track + ' - ' + result.artist
                    + '</td>'
                    + '<td class="progress" id="progress' + result.sid + '"></td>'
                + '</tr>'
                + '<tr class="info">'
                    + score_cell
                    + '<td class="source">' + result.source + '</td>'
                    + '<td class="bitrate">' + result.bitrate + ' kbps</td>'
                    + '<td class="size">' + (result.size/1000000).toFixed(1) + 'MB</td>'
                    + '<td class="time">' + UTIL.mmss(result.duration) + '</td>'
                + '</tr>'
            + '</tbody>';
            var result_tbody = $(tbody_html).data('result', result);
            if (result.score == 1) {
                result_tbody.addClass('choice');
            }
            result_tbody.data('track_item', list_item);
            results.append(result_tbody);
        }
        results = results.wrap('<form></form>').parent();
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
    var track_item = target.closest('li.p_t');
    if (track_item.size()) {
        var playlist_track = track_item.data('playlist_track');
        
        // Clicks to playdar results
        var tbody = target.closest('tbody.result');
        if (tbody.size()) {
            e.preventDefault();
            var radio = tbody.find('input[name=choice]');
            radio.attr('checked', true);
            tbody.siblings().removeClass('choice');
            tbody.addClass('choice');
            var result = tbody.data('result');
            PLAYLICK.update_track(playlist_track, result, true);
            PLAYLICK.play_track(playlist_track);
        }
        // Clicks to the remove button
        if (target.is('a.remove')) {
            playlist_track.remove();
            return false;
        }
        // Clicks to the remove button
        if (target.is('a.show_sources')) {
            track_item.toggleClass('open');
            return false;
        }
        // Clicks to the main track name
        var track_link = target.closest('li.p_t a.item');
        if (track_link.size()) {
            e.preventDefault();
            if (playlist_track.sid) {
                PLAYLICK.play_track(playlist_track);
            } else {
                Playdar.client.autodetect(PLAYLICK.playdar_track_handler, playlist_track.element[0]);
            }
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
        if (target.html() == PLAYLICK.cancel_edit_playlist_text) {
            target.html(PLAYLICK.edit_playlist_text);
        } else {
            target.html(PLAYLICK.cancel_edit_playlist_text);
        }
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