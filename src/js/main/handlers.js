/* Current playlist handlers */

// Playlist reordering behaviour
CONTROLLERS.Playlist.trackListElem.sortable({
    axis: 'y',
    cursor: 'move',
    opacity: 0.5,
    delay: 100,
    placeholder: 'placeholder',
    forcePlaceholderSize: true,
    update: function (e, ui) {
        var tracks = $.map($('#playlist li'), function (playlist_item, i) {
            return $(playlist_item).data('playlist_track');
        });
        CONTROLLERS.Playlist.current.reset_tracks(tracks);
    }
});
// Click handlers for currently loaded playlist
CONTROLLERS.Playlist.trackListElem.click(function (e) {
    var target = $(e.target);
    var track_item = target.closest('li.p_t');
    if (track_item.size()) {
        var playlist_track = track_item.data('playlist_track');
        
        // Clicks to playdar results
        var tbody = target.closest('tbody.result');
        if (tbody.size()) {
            track_item.removeClass('open');
            PLAYDAR.playSource(playlist_track, tbody);
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
            } else if (track_item.is('li.perfectMatch')) {
                PLAYDAR.playTrack(playlist_track);
            } else if (track_item.is('li.match')) {
                track_item.toggleClass('open');
            } else if (playlist_track.playdar_qid) {
                PLAYDAR.recheck_track(playlist_track);
            } else {
                PLAYDAR.resolve_track(playlist_track, true);
            }
        }
    }
});

/*  Add track handlers */

CONTROLLERS.Playlist.addTrackButton.click(function (e) {
    e.preventDefault();
    if (CONTROLLERS.Playlist.current && !CONTROLLERS.Playlist.current.persisted) {
        CONTROLLERS.Playlist.addTrackTable.show();
        CONTROLLERS.Playlist.addTrackSearchInput.focus().select();
    } else {
        CONTROLLERS.Playlist.addTrackTable.toggle();
    }
});
CONTROLLERS.Playlist.addTrackCancel.click(function (e) {
    e.preventDefault();
    CONTROLLERS.Playlist.addTrackTable.hide();
});

// Add track autocomplete
CONTROLLERS.Playlist.addTrackSearchInput.autocomplete(IMPORTERS.LastFm.WS_ROOT + "/2.0/?callback=?", {
    multiple: false,
    delay: 200,
    dataType: "jsonp",
    extraParams: {
        method: "track.search",
        track: function () {
            return CONTROLLERS.Playlist.addTrackSearchInput.val();
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
CONTROLLERS.Playlist.addTrackSearchInput.result(function (e, track, formatted) {
    CONTROLLERS.Playlist.addTrackTable.show();
    $("#addTrackTrackInput").val(track.name).focus().select();
    $("#addTrackArtistInput").val(track.artist);
    $("#addTrackSearchInput").val('');
});
// Add to loaded playlist form submit
CONTROLLERS.Playlist.addTrackForm.submit(function (e) {
    e.preventDefault();
    // Parse the form and add tracks
    var params = UTIL.serializeForm(this);
    if (params.trackName) {
        if (params.albumName) {
            $('#addTrackTrackInput').focus().select();
        } else {
            $('#addTrackArtistInput').focus().select();
        }
        CONTROLLERS.Playlist.addTrack(params.artistName, params.trackName, params.albumName, params.url);
    }
});

/* Sidebar handlers */

// Click handler to start a new blank playlist
CONTROLLERS.Playlist.createLink.click(function (e) {
    e.preventDefault();
    CONTROLLERS.Playlist.create();
});
// Capture ESC while toggling playlist editing
CONTROLLERS.Playlist.playlistSidebarLists.keydown(function (e) {
    var target = $(e.target);
    // Capture ESC
    if (target.is('input.playlist_name') && e.keyCode == 27) {
        CONTROLLERS.Playlist.toggleSidebarEditName(target.parents('li.p'));
    }
});
// Click handlers for playlists in the sidebar
CONTROLLERS.Playlist.playlistSidebarLists.click(function (e) {
    var target = $(e.target);
    var playlist_item = target.closest('li.p');
    // Load the clicked playlist
    if (target.is('li.p a.playlist, li.p a.playlist span, li.p a.playlist img')) {
        e.preventDefault();
        target.blur();
        CONTROLLERS.Playlist.loadItem(playlist_item);
    }
    // Delete the playlist
    if (target.is('li.p a.delete_playlist')) {
        e.preventDefault();
        CONTROLLERS.Playlist.remove(playlist_item.data('playlist'));
    }
    // Toggle play
    if (target.is('li.p a.playlist_playing')) {
        e.preventDefault();
        target.blur();
        PLAYDAR.playTrack(CONTROLLERS.Playlist.playingTrack);
    }
    // Toggle playlist name editing
    if (target.is('li.p a.edit_playlist')) {
        e.preventDefault();
        target.blur();
        CONTROLLERS.Playlist.toggleSidebarEditName(playlist_item);
    }
    // Update playlist name
    if (target.is('li.p form.edit_playlist_form input[type=submit]')) {
        e.preventDefault();
        var form = target.parents('form');
        var params = UTIL.serializeForm(form);
        var playlist = playlist_item.data('playlist');
        playlist_item.data('playlist').title = params.name;
        playlist_item.data('playlist').save();
        CONTROLLERS.Playlist.toggleSidebarEditName(playlist_item);
    }
});

/* Import handlers */

// Import Last.fm playlist form
$('#lastfm_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#lastfm_input').val('').focus().select();
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
    $("#album_import_input").val('').focus().select();
    // Load the XSPF
    PLAYLICK.fetchLastFmAlbum(params.artist_name, params.album_name);
});

/**
 * Spotify Add album autocomplete
**/

// XSPF/Podcast URL import form
$('#url_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#url_input').val('').focus().select();
    PLAYLICK.fetchUrl(params.url);
});

// Spotify URL import form
$('#spotify_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the input and refocus
    $('#spotify_input').val('').focus().select();
    PLAYLICK.fetchSpotify(params.url);
});

// Last.fm Battle form submit
$('#lastfm_battle_form').submit(function (e) {
    e.preventDefault();
    // Parse the form
    var params = UTIL.serializeForm(this);
    // Clear the inputs and refocus
    $("#lastfm_battle_input_they").val('');
    $("#lastfm_battle_input_you").val('').focus().select();
    // Generate the playlist
    PLAYLICK.generateLastFmUsersPlaylist(params.you, params.they);
});

/* Keyboard shortcuts */
$(document).keydown(function (e) {
    var target = $(e.target);
    // Don't capture on keyboardable inputs
    if (target.is('input[type=text], textarea, select')) {
        return true;
    }
    // Don't capture with any modifiers
    if (e.metaKey || e.altKey || e.ctrlKey) {
        return true;
    }
    var current_track, previous_track, next_track;
    switch (e.keyCode) {
    case 80: // p
        e.preventDefault();
        current_track = CONTROLLERS.Playlist.playingTrack;
        if (!current_track) {
            // Get the first perfect match
            current_track = $('#playlist li.perfectMatch').data('playlist_track');
        }
        PLAYDAR.playTrack(current_track);
        break;
    case 219: // [ / {
        e.preventDefault();
        if (CONTROLLERS.Playlist.playingTrack) {
            if (e.shiftKey) {
                // Back a source
                PLAYDAR.playPreviousSource(CONTROLLERS.Playlist.playingTrack.element.find('tbody.choice'));
            } else {
                // Back a track
                PLAYDAR.playPreviousTrack(CONTROLLERS.Playlist.playingTrack.element);
            }
        }
        break;
    case 221: // ] / }
        e.preventDefault();
        if (CONTROLLERS.Playlist.playingTrack) {
            if (e.shiftKey) {
                // Next source
                PLAYDAR.playNextSource(CONTROLLERS.Playlist.playingTrack.element.find('tbody.choice'));
            } else {
                // Next track
                PLAYDAR.playNextTrack(CONTROLLERS.Playlist.playingTrack.element);
            }
        }
        break;
    }
});
