/* Current playlist handlers */

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
            PLAYLICK.selectSource(playlist_track, tbody);
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
                PLAYDAR.playTrack(playlist_track);
            } else if (track_item.is('li.match')) {
                track_item.toggleClass('open');
            } else if (playlist_track.track.playdar_qid) {
                playlist_track.element.addClass('scanning');
                PLAYDAR.recheck_track(playlist_track);
            } else {
                PLAYDAR.resolve_track(playlist_track, true);
            }
        }
    }
});

/*  Add track handlers */

// Add track autocomplete
$("#add_track_input").autocomplete(IMPORTERS.LastFm.WS_ROOT + "/2.0/?callback=?", {
    multiple: false,
    delay: 200,
    dataType: "jsonp",
    extraParams: {
        method: "track.search",
        track: function () {
            return $("#add_track_input").val();
        },
        api_key: IMPORTERS.LastFm.API_KEY,
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
    var params = UTIL.serializeForm(this);
    if (params.track_name && params.artist_name) {
        // Clear the inputs and refocus
        $('#add_track_artist').val('');
        $('#add_track_track').val('');
        $('#add_track_input').val('').focus();
        PLAYLICK.add_track(params.artist_name, params.track_name);
    }
});

/* Sidebar handlers */

// Click handler to start a new blank playlist
$('#create_playlist').click(function (e) {
    e.preventDefault();
    PLAYLICK.blank_playlist();
});
// Click handler to show import screen
$('#import_playlist').click(function (e) {
    e.preventDefault();
    PLAYLICK.show_import();
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
        PLAYDAR.playTrack(PLAYLICK.now_playing);
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
        var params = UTIL.serializeForm(form);
        var playlist = playlist_item.data('playlist');
        playlist.set_name(params.name, function () {
            playlist_item.find('a.playlist').text(UTIL.truncateString(params.name));
            PLAYLICK.toggle_playlist_edit(playlist_item);
        });
    }
});

/* Import handlers */

// Import Last.fm playlist form
$('#import_playlist_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#import_playlist_input').val('').select();
    PLAYLICK.fetchLastFmUserPlaylists(params.username);
});
// Import Last.fm playlist form
$('#loved_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#loved_input').val('').select();
    PLAYLICK.fetchLastFmLovedTracks(params.username);
});

// Add album autocomplete
$("#album_import_input").autocomplete(IMPORTERS.LastFm.WS_ROOT + "/2.0/?callback=?", {
    multiple: false,
    delay: 200,
    dataType: "jsonp",
    extraParams: {
        method: "album.search",
        album: function () {
            return $("#album_import_input").val();
        },
        api_key: IMPORTERS.LastFm.API_KEY,
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
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the inputs and refocus
    $("#album_import_artist").val('');
    $("#album_import_name").val('');
    $("#album_import_input").val('').select();
    // Load the XSPF
    PLAYLICK.fetchLastFmAlbum(params.artist_name, params.album_name);
});

// XSPF/Podcast URL import form
$('#url_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#url_input').val('').select();
    PLAYLICK.fetchUrl(params.url);
});

// Generate playlist form submit
$('#generate_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the inputs and refocus
    $("#generate_input_they").val('');
    $("#generate_input_you").val('').select();
    // Generate the playlist
    PLAYLICK.generateLastFmUsersPlaylist(params.you, params.they);
});

/* Keyboard shortcuts */
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
    var current_track, previous_track, next_track;
    switch (e.keyCode) {
    case 80: // p
        e.preventDefault();
        current_track = PLAYLICK.now_playing;
        if (!current_track) {
            // Get the first perfect match
            current_track = $('#playlist li.perfectMatch').data('playlist_track');
        }
        PLAYDAR.playTrack(current_track);
        break;
    case 219: // [
        // Back a track
        e.preventDefault();
        if (PLAYLICK.now_playing) {
            previous_track = PLAYLICK.now_playing.element.prevAll('li.perfectMatch');
            PLAYDAR.playTrack(previous_track.data('playlist_track'));
        }
        break;
    case 221: // ]
        // Skip track
        e.preventDefault();
        if (PLAYLICK.now_playing) {
            next_track = PLAYLICK.now_playing.element.nextAll('li.perfectMatch');
            PLAYDAR.playTrack(next_track.data('playlist_track'));
        }
        break;
    }
});
