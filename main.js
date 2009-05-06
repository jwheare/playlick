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
        $('#add_track_track').select();
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
                    playlist_track.element.bind('click', function (e) {
                        Playdar.player.play_stream(result.sid);
                        return false;
                    });
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

// Setup playlist reordering behaviour
$('#playlist').sortable({
    axis: 'y',
    cursor: 'move',
    handle: 'a.handle',
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
$('#create_playlist').bind('click', function (e) {
    if (Playdar.client) {
        Playdar.client.cancel_resolve();
    }
    PLAYLICK.stash_current();
    PLAYLICK.new_playlist();
    $('#playlistTitle').empty();
    return false;
});

// Add to loaded playlist
$('#add_to_playlist').bind('submit', function (e) {
    // Parse the form and add tracks
    var params = {};
    $.each($(this).serializeArray(), function (index, item) {
        params[item.name] = item.value;
    });
    if (params.track && params.artist) {
        $('#add_track_track').select();
        var track = new MODELS.Track(params.track, params.artist);
        var playlist_track = PLAYLICK.current_playlist.add_track(track);
        if (playlist_track.position == 1) {
            $('#add_track_button').val(PLAYLICK.add_button_text);
        }
        if (Playdar.client) {
            Playdar.client.autodetect(PLAYLICK.playdar_track_handler, playlist_track.element[0]);
        }
    }
    return false;
});

// Remove from playlist
$('#playlist').bind('click', function (e) {
    var target = $(e.target);
    if (target.is('a.remove')) {
        target.parents('li.p_t').data('playlist_track').remove();
        return false;
    }
});

$('#playlist_stash').bind('click', function (e) {
    // Load the clicked playlist
    var target = $(e.target);
    if (target.is('li.p a.playlist')) {
        target.blur();
        PLAYLICK.stash_current();
        PLAYLICK.current_playlist = target.parents('li.p').data('playlist');
        PLAYLICK.current_playlist.load_tracks(DATA.playlists[PLAYLICK.current_playlist.id].tracks);
        $('#playlistTitle').html(PLAYLICK.current_playlist.toString());
        $('#add_track_button').val(PLAYLICK.add_button_text);
        if (Playdar.client) {
            Playdar.client.autodetect(PLAYLICK.playdar_track_handler);
        }
        return false;
    }
    // Edit the playlist name
    if (target.is('li.p a.edit_playlist')) {
        target.blur();
        target.siblings('.playlist').toggle();
        target.siblings('form').toggle();
        target.siblings('form').find(':text').select();
        return false;
    }
    if (target.is('#playlist_stash form.edit_playlist_form input[type=submit]')) {
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
        return false;
    }
});