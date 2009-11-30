//= require "main/strings"
//= require "main/playdar"

var PLAYLICK = {
    /**
     * Init
    **/
    
    init: function () {
        // Prefill URLs
        PLAYLICK.check_url_params();
        // Load playlists
        PLAYLICK.fetchPlaylists();
    },
    retryCouch: function () {
        $('#loading_playlists').removeClass('unavailable');
        $('#loading_playlists').html(STRINGS.loading_playlists_text);
        $('#loading_playlists').show();
        if (PLAYLICK.fetchPlaylistsDone) {
            MODELS.stat_couch();
        } else {
            PLAYLICK.fetchPlaylists();
        }
    },
    
    check_url_params: function () {
        var hash_parts = UTIL.getHashParts();
        var url = hash_parts.url || hash_parts.xspf || hash_parts.podcast;
        if (url) {
            PLAYLICK.fetchUrl(url);
        }
        if (hash_parts.lastfm_playlists) {
            PLAYLICK.fetchLastFmUserPlaylists(hash_parts.lastfm_playlists);
        }
        if (hash_parts.lastfm_loved) {
            PLAYLICK.fetchLastFmLovedTracks(
                hash_parts.lastfm_loved,
                function callback (playlistId, playlist) {
                    // Load playlist
                    PLAYLICK.load_playlist(playlist);
                }
            );
        }
        if (hash_parts.artist && hash_parts.album) {
            PLAYLICK.fetchLastFmAlbum(hash_parts.artist, hash_parts.album);
        }
        if (hash_parts.lastfm_you && hash_parts.lastfm_they) {
            PLAYLICK.generateLastFmUsersPlaylist(hash_parts.lastfm_you, hash_parts.lastfm_they, true);
        }
        if (hash_parts.artist && hash_parts.track) {
            // Make a new playlist
            PLAYLICK.blank_playlist();
            // Add a track to it
            PLAYLICK.add_track(hash_parts.artist, hash_parts.track);
        }
        if (hash_parts.spotify_album) {
            IMPORTERS.Spotify.album(hash_parts.spotify_album, PLAYLICK.load_playlist);
        }
        if (hash_parts.spotify_track) {
            IMPORTERS.Spotify.track(hash_parts.spotify_track, PLAYLICK.load_playlist);
        }
    },
    
    /**
     * Playlist state
    **/
    
    current_playlist: null,
    registerPlaylist: function (playlist) {
        PLAYLICK.last_playlist = playlist;
    },
    createPlaylist: function (data) {
        var playlist = new MODELS.Playlist(data);
        PLAYLICK.registerPlaylist(playlist);
        return playlist;
    },
    // Update the playlist title (when loading a playlist or updating the duration)
    update_playlist_title: function (title) {
        $('#playlistTitle').html(title);
    },
    // Update the playlist iTunes export AppleScript (when loading a playlist or saving)
    update_playlist_applescript: function (playlist) {
        $('#playlistApplescript').attr('href', playlist.toApplescript());
    },
    // Show/hide edit mode for playlist in sidebar
    toggle_playlist_edit: function (playlist_item) {
        // Toggle playlist link and form
        playlist_item.find('a.playlist').toggle();
        playlist_item.find('form.edit_playlist_form').toggle();
        // Update button
        var button = playlist_item.find('a.edit_playlist');
        if (button.html() == STRINGS.cancel_edit_playlist_text) {
            button.html(STRINGS.edit_playlist_text);
        } else {
            button.html(STRINGS.cancel_edit_playlist_text);
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
        PLAYDAR.cancel_playdar_resolve();
        // Update current sidebar item
        PLAYLICK.set_current_playlist_item($('#create_playlist').parent('li'));
        // Reset the playlist view
        $('#playlist').empty();
        PLAYLICK.update_playlist_title(STRINGS.create_playlist_title);
        $('#add_track_button').val(STRINGS.start_button_text);
        // Show manage screen
        $('#import').hide();
        $('#manage').show();
        // Select input
        setTimeout(function () {
            $('#add_track_input').select();
        }, 1);
        // Create the playlist object
        PLAYLICK.current_playlist = PLAYLICK.createPlaylist();
    },
    show_import: function () {
        // Cancel Playdar
        PLAYDAR.cancel_playdar_resolve();
        // Update current sidebar item
        PLAYLICK.set_current_playlist_item($('#import_playlist').parent('li'));
        // Show Import screen
        $('#manage').hide();
        $('#import').show();
        // Select input
        setTimeout(function () {
            $('#lastfm_input').select();
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
            $('#add_track_button').val(STRINGS.add_button_text);
        }
        PLAYDAR.resolve_track(playlist_track);
    },
    selectSource: function (playlist_track, tbody) {
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
            PLAYDAR.playTrack(playlist_track);
        }
        playlist_track.element.addClass('perfectMatch');
    },
    // Update a track's data and persist
    update_track: function (playlist_track, result, batch) {
        var track  = playlist_track.track;
        // If the track name or artist changed, update it and persist
        if (!UTIL.compareString(track.name, result.track)
         || !UTIL.compareString(track.artist, result.artist)
         || !UTIL.compareString(track.album, result.album)) {
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
                .text(UTIL.truncateString(track.name))
                .attr('title', track.name);
            playlist_track.element.find('.contributor')
                .text(UTIL.truncateString(track.artist))
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
    // Fetch playlists from Couch
    fetchPlaylists: function () {
        var elements = [];
        var playlists = MODELS.Playlist.fetchAll(function callback (playlist) {
            PLAYLICK.registerPlaylist(playlist);
            elements.push(playlist.element.get()[0]);
        });
        $('#playlists').append(elements);
        if (typeof(playlists) !== 'undefined') {
            PLAYLICK.fetchPlaylistsDone = true;
        }
    },
    load_playlist: function (playlist) {
        PLAYLICK.load_playlist_item(playlist.element);
    },
    // Load a playlist from the sidebar
    load_playlist_item: function (playlist_item) {
        // Cancel Playdar
        PLAYDAR.cancel_playdar_resolve();
        // Unload the current playlist
        if (PLAYLICK.current_playlist) {
            PLAYLICK.current_playlist.unload();
        }
        // Update current sidebar item
        PLAYLICK.set_current_playlist_item(playlist_item);
        // Update the current playlist object
        PLAYLICK.current_playlist = playlist_item.data('playlist');
        // Update the title
        PLAYLICK.update_playlist_title(PLAYLICK.current_playlist.titleHTML());
        // Switch the add track button text
        $('#add_track_button').val(STRINGS.add_button_text);
        $('#tracksLoading').show();
        // Hide error message
        $('#tracksError').hide();
        // Load tracks
        var elements = PLAYLICK.current_playlist.load();
        // Update the AppleScript link
        PLAYLICK.update_playlist_applescript(PLAYLICK.current_playlist);
        $('#tracksLoading').hide();
        if (elements) {
            // Add to the DOM
            $('#playlist').append(elements);
            setTimeout(function () {
                var nowPlayingSound = Playdar.player.getNowPlaying();
                if (nowPlayingSound) {
                    PLAYDAR.updatePlaybackProgress.call(nowPlayingSound);
                }
            });
            // Resolve tracks with Playdar
            PLAYDAR.resolve_current_playlist();
        } else {
            $('#tracksError').show();
        }
        // Show manage screen
        $('#import').hide();
        $('#manage').show();
    },
    
    /**
     * Import
    **/
    importSetup: function (type) {
        // Hide existing errors
        $('p.messages').hide();
        // Show a loading message
        $('#' + type + '_loading').show();
        // Empty error message
        $('#' + type + '_error').empty();
    },
    // Import a playlist from an XSPF or Podcast URL
    fetchUrl: function (url) {
        PLAYLICK.importSetup('url');
        IMPORTERS.Url.url(
            url,
            function callback (playlist) {
                // Register playlist
                PLAYLICK.registerPlaylist(playlist);
                // Update messages
                $('p.messages').hide();
                $('#url_title').text(playlist.name);
                $('#url_count').text(playlist.tracks.length);
                $('#url_done').show();
                // Load playlist
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                // Reset input
                $('#url_input').val(url);
                // Show error message
                $('p.messages').hide();
                var escapedUrl = $('<b>').text('URL: ' + url);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedUrl);
                $('#url_error').html(errorMessage);
                $('#url_error').show();
            }
        );
    },
    // Fetch the metadata from a Spotify Album or Track URL
    fetchSpotify: function (url) {
        PLAYLICK.importSetup('spotify');
        IMPORTERS.Spotify.url(
            url,
            function callback (playlist) {
                // Register playlist
                PLAYLICK.registerPlaylist(playlist);
                // Update messages
                $('p.messages').hide();
                $('#spotify_title').text(playlist.name);
                $('#spotify_done').show();
                // Load playlist
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                // Reset input
                $('#spotify_input').val(url);
                // Show error message
                $('p.messages').hide();
                var escapedUrl = $('<b>').text('URL: ' + url);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedUrl);
                $('#spotify_error').html(errorMessage);
                $('#spotify_error').show();
            }
        );
    },
    // Fetch a Last.fm album playlist as JSON
    fetchLastFmAlbum: function (artist, album) {
        PLAYLICK.importSetup('album');
        IMPORTERS.LastFm.album(
            artist, album,
            function callback (playlist) {
                // Register playlist
                PLAYLICK.registerPlaylist(playlist);
                // Update messages
                $('p.messages').hide();
                var escapedAlbum = $('<b>').text(playlist.name);
                $('#album_name').html(escapedAlbum);
                $('#album_done').show();
                // Load playlist
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                // Show error message
                $('p.messages').hide();
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
    lastFmImportDone: function (processedUrl, playlist) {
        // TODO - message exceptions. One example is if the user has no loved tracks
        // Probably better to check this first I guess.
        for (playlistUrl in PLAYLICK.importedPlaylists) {
            if (PLAYLICK.importedPlaylists[playlistUrl] === false) {
                return;
            }
        }
        // All playlists are processed
        $('p.messages').hide();
        $('#lastfm_imported').show();
    },
    fetchLastFmLovedTracks: function (username, callback) {
        var playlistId = 'loved_' + username;
        PLAYLICK.importedPlaylists[playlistId] = false;
        IMPORTERS.LastFm.lovedTracks(
            username,
            function lovedTracksCallback (playlist) {
                PLAYLICK.importedPlaylists[playlistId] = playlist;
                PLAYLICK.registerPlaylist(playlist);
                callback(playlistId, playlist);
            },
            function exceptionHandler (exception) {
                PLAYLICK.importedPlaylists[playlistId] = exception;
                callback(playlistId, exception);
            }
        );
    },
    importLastfmUserPlaylists: function (data, callback) {
        var playlistId = data.id;
        PLAYLICK.importedPlaylists[playlistId] = false;
        IMPORTERS.LastFm.getUserPlaylist(
            data,
            function playlistCallback (playlist) {
                PLAYLICK.importedPlaylists[playlistId] = playlist;
                PLAYLICK.registerPlaylist(playlist);
                callback(playlistId, playlist);
            },
            function playlistExceptionHandler (exception) {
                PLAYLICK.importedPlaylists[playlistId] = exception;
                callback(playlistId, exception);
            }
        );
    },
    // Fetch a Last.fm user's playlists as JSON
    fetchLastFmUserPlaylists: function (username) {
        PLAYLICK.importSetup('lastfm');
        // Remove existing playlists
        $('#lastfm_playlists li.playlist').remove();
        PLAYLICK.playlistsToImport = {};
        function addPlaylist (title, tracks, name) {
            var listItem = $('<li>')
                .append($('<input>').attr('type', 'checkbox').attr('checked', true).attr('name', name))
                .append(' ')
                .append($('<span>').append(tracks))
                .append(UTIL.truncateString(title))
                .addClass('playlist selected')
                .attr('title', title);
            $('#lastfm_playlists').append(listItem);
        }
        function addLovedTracks () {
            addPlaylist('Loved Tracks', '<img src="lastfm_loved.png" width="11" height="9">', 'loved_' + username);
        }
        IMPORTERS.LastFm.userPlaylists(
            username,
            function callback (playlists) {
                // Update messages
                $('p.messages').hide();
                $('#lastfm_done').show();
                var s = (playlists.length === 1) ? '' : 's';
                $('#lastfm_playlists_count').text(playlists.length + ' Playlist' + s + ' found');
                // Add loved tracks and playlists to the checkbox list and show
                addLovedTracks();
                $.each(playlists, function (i, data) {
                    PLAYLICK.playlistsToImport[data.id] = data;
                    addPlaylist(data.title, data.size, data.id);
                });
                $('#lastfm_playlists_form').show();
            },
            function noPlaylistHandler () {
                // Show message
                $('p.messages').hide();
                $('#lastfm_error_no_playlists').show();
                // Add loved tracks to the checkbox list and show
                addLovedTracks();
                $('#lastfm_playlists_form').show();
            },
            function exceptionHandler (exception) {
                // Reset input
                $('#lastfm_input').val(username);
                // Show error message
                $('p.messages').hide();
                var escapedName = $('<b>').text('Username: ' + username);
                var escapedSignature = $('<small>').text(exception.signature);
                var errorMessage = $('<span>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedName);
                if (PLAYLICK.debug) {
                    errorMessage.append('<br>')
                                .append(escapedSignature);
                }
                $('#lastfm_error').html(errorMessage);
                $('#lastfm_error').show();
            }
        );
    },
    // Generate a playlist given two Last.fm usernames
    generateLastFmUsersPlaylist: function (you, they) {
        PLAYLICK.importSetup('generate');
        IMPORTERS.LastFm.generateUsersPlaylist(
            you,
            they,
            function callback (playlist) {
                // Register playlist
                PLAYLICK.registerPlaylist(playlist);
                // Update messages
                $('p.messages').hide();
                $('#generate_done').show();
                // Load playlist
                PLAYLICK.load_playlist(playlist);
            },
            function exceptionHandler (exception) {
                // Reset input
                $("#generate_input_you").val(you);
                $("#generate_input_they").val(they);
                // Show error message
                $('p.messages').hide();
                var escapedInput = $('<b>').text('You: ' + you + ' They: ' + they);
                var escapedSignature = $('<small>').text(exception.signature);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedInput)
                             .append('<br>')
                             .append(escapedSignature);
                $('#generate_error').html(errorMessage);
                $('#generate_error').show();
            }
        );
    }
};

//= require "main/models"
//= require "main/handlers"
