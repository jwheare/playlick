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
            track_item.removeClass('open');
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
            if (track_item.is('li.open')) {
                track_item.removeClass('open');
            } else if (track_item.is('li.perfectMatch') && playlist_track.track.playdar_sid) {
                PLAYDAR.playTrack(playlist_track);
            } else if (track_item.is('li.match')) {
                track_item.toggleClass('open');
            } else if (playlist_track.track.playdar_qid) {
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
$('#lastfm_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#lastfm_input').val('').select();
    PLAYLICK.fetchLastFmUserPlaylists(params.username);
});
$('#lastfm_playlists').click(function (e) {
    var target = $(e.target);
    var playlist_item = target.closest('li.playlist');
    var checkbox = playlist_item.children('input[type=checkbox]');
    if (playlist_item.size()) {
        playlist_item.toggleClass('selected');
        if (!target.is('input[type=checkbox]')) {
            checkbox.attr('checked', !checkbox.attr('checked'));
        }
    }
});
$('#lastfm_playlists_form').submit(function (e) {
    e.preventDefault();
    PLAYLICK.importSetup('lastfm');
    PLAYLICK.importedPlaylists = {};
    // Parse the form
    var params = UTIL.serializeForm(this);
    for (var k in params) {
        var lovedMatches = k.match(/loved_(.*)/);
        if (lovedMatches) {
            PLAYLICK.fetchLastFmLovedTracks(lovedMatches[1], PLAYLICK.lastFmImportDone);
        } else {
            PLAYLICK.importLastfmUserPlaylists(PLAYLICK.playlistsToImport[k], PLAYLICK.lastFmImportDone);
        }
    }
});
$('#lastfm_playlists_all').click(function (e) {
    e.preventDefault();
    $('#lastfm_playlists li.playlist').addClass('selected');
    $('#lastfm_playlists input[type=checkbox]').attr('checked', true);
});
$('#lastfm_playlists_none').click(function (e) {
    e.preventDefault();
    $('#lastfm_playlists li.playlist').removeClass('selected');
    $('#lastfm_playlists input[type=checkbox]').attr('checked', false);
});

/**
 * Last.fm add album autocomplete
**/
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

/**
 * Spotify Add album autocomplete
**/

IMPORTERS.autocompleteFromXml(
    $("#spotify_album_import_input"),
    IMPORTERS.Spotify.SEARCH_ROOT + "album",
    function () {
        return {
            q: $("#spotify_album_import_input").val()
        };
    },
    function parse (json) {
        var parsed = [];
        if (json && json.query.results && json.query.results.albums && json.query.results.albums.album) {
            // YQL APIs return single item lists as single items
            var albums = $.makeArray(json.query.results.albums.album);
            $.each(albums, function (i, album) {
                parsed.push({
                    data: album,
                    value: album.name,
                    result: (album.artist.name || album.artist[0].name) + " - " + album.name
                });
            });
        }
        return parsed;
    },
    function formatItem (album, position, length, value) {
        return (album.artist.name || album.artist[0].name) + " - " + album.name;
    }
);
// Add spotify album autocomplete select
$("#spotify_album_import_input").result(function (e, album, formatted) {
    $("#spotify_album_import_url").val(album.href);
    $('#spotify_album_import_input').submit();
});
// Import spotify album playlist form submit
$('#spotify_album_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the inputs and refocus
    $("#spotify_album_import_url").val('');
    $("#spotify_album_import_input").val('').select();
    // Load the Album URL
    PLAYLICK.fetchSpotifyAlbum(params.spotifyUrl);
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

// Spotify URL import form
$('#spotify_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#spotify_input').val('').select();
    PLAYLICK.fetchSpotify(params.url);
});

// Last.fm Battle form submit
$('#lastfm_battle_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the inputs and refocus
    $("#lastfm_battle_input_they").val('');
    $("#lastfm_battle_input_you").val('').select();
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
