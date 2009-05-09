// Custom Track and Playlist renderers
MODELS.Track.prototype.toHTML = function () {
    return '<a href="#" class="handle">⬍</a> '
        + '<a href="#" class="remove">╳</a>'
        + '<a href="#" class="item">'
            + '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
            + '</span>'
        + '</a>';
};
MODELS.Playlist.prototype.toHTML = function () {
    return '<a href="#" class="edit_playlist">edit</a>'
        + '<a href="#" class="playlist">' + this.name + '</a>'
        + '<form style="display: none;" class="edit_playlist_form">'
            + '<input type="text" name="name" value="' + this.name + '" class="playlist_name">'
            + '<input type="submit" value="save">'
        + '</form>';
};

var PLAYLICK = {
    current_playlist: null,
    start_button_text: $('#add_track_button').val(),
    create_playlist_title: $('#playlistTitle').html(),
    add_button_text: 'Add',
    // Create a new empty playlist
    new_playlist: function  () {
        PLAYLICK.current_playlist = new MODELS.Playlist('playlist', {
            onCreate: function () {
                if (!$('#' + this.get_dom_id()).size()) {
                    this.element.appendTo($('#playlist_stash'));
                    $('#playlistTitle').html(this.toString());
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
    stash_current: function () {
        if (Playdar.client) {
            Playdar.client.cancel_resolve();
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
    },
    playdar_track_handler: function (track) {
        var uuid = Playdar.Util.generate_uuid();
        Playdar.client.register_results_handler(function (response, final_answer) {
            var list_item = $(track.element).parents('li.p_t');
            var playlist_track = list_item.data('playlist_track');
            if (final_answer) {
                if (response.results.length) {
                    var result = response.results[0];
                    if (result.score == 1) {
                        list_item.css('background', '#92c137');
                        // Update track
                        playlist_track.track.name = result.track;
                        playlist_track.track.artist = result.artist;
                        playlist_track.track.duration = result.duration;
                        playlist_track.render();
                        playlist_track.playlist.save();
                    } else {
                        list_item.css('background', '#c0e95b');
                    }
                    // Register stream
                    Playdar.player.register_stream(result);
                    playlist_track.element.data('sid', result.sid);
                } else {
                    list_item.css('background', '');
                }
            } else {
                list_item.css('background', '#e8f9bb');
            }
        }, uuid);
        return uuid;
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
    handle: 'a.handle',
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
    PLAYLICK.stash_current();
    PLAYLICK.new_playlist();
    $('#playlistTitle').html(PLAYLICK.create_playlist_title);
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

// Remove from playlist
$('#playlist').click(function (e) {
    var target = $(e.target);
    if (target.is('a.remove')) {
        e.preventDefault();
        target.parents('li.p_t').data('playlist_track').remove();
    }
    if (target.is('li.p_t a.item')) {
        var sid = target.parent('li.p_t').data('sid');
        if (sid) {
            Playdar.player.play_stream(sid);
        }
        return false;
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
        $('#playlistTitle').html(PLAYLICK.current_playlist.toString());
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
            $('#playlistTitle').html(playlist.toString());
        }
    }
});