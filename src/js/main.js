//= require "main/strings"
//= require "main/playdar"

var PLAYLICK = {
    /**
     * Init
    **/
    
    init: function () {
        // Start a new playlist
        CONTROLLERS.Playlist.create();
        // Load playlists
        CONTROLLERS.Playlist.fetchAll();
        // Create appLauncher iframe
        PLAYLICK.createAppLauncherFrame();
    },
    appLauncherId: 'appLauncher',
    createAppLauncherFrame: function () {
        var iframe = $('<iframe width="0" height="0" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" scrolling="no" allowtransparency="true">')
            .attr('id', PLAYLICK.appLauncherId)
            .attr('name', PLAYLICK.appLauncherId);
        $('body').append(iframe);
        iframe.attr('src', 'about:blank');
    },
    
    checkUrlHash: function () {
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
                    CONTROLLERS.Playlist.load(playlist);
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
            CONTROLLERS.Playlist.create();
            // Add a track to it
            CONTROLLERS.Playlist.addTrack(hash_parts.artist, hash_parts.track);
        }
        if (hash_parts.spotify_album) {
            IMPORTERS.Spotify.album(hash_parts.spotify_album, CONTROLLERS.Playlist.load);
        }
        if (hash_parts.spotify_track) {
            IMPORTERS.Spotify.track(hash_parts.spotify_track, CONTROLLERS.Playlist.load);
        }
    },
    
    /**
     * Playlist state
    **/
    
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
        if (track.playdar_sid && track.playdar_sid != result.sid) {
            Playdar.player.stop_stream(track.playdar_sid);
        }
        track.playdar_sid = result.sid;
        track.video = result.video;
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
                // Update messages
                $('p.messages').hide();
                $('#url_title').text(playlist.name);
                $('#url_count').text(playlist.tracks.length);
                $('#url_done').show();
                // Register playlist
                CONTROLLERS.Playlist.register(playlist);
                // Load playlist
                CONTROLLERS.Playlist.load(playlist);
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
    // Fetch the metadata from a Spotify Album URL retrieved from autocomplete
    fetchSpotifyAlbum: function (url) {
        PLAYLICK.importSetup('spotify_album');
        IMPORTERS.Spotify.url(
            url,
            function callback (playlist) {
                // Update messages
                $('p.messages').hide();
                var escapedAlbum = $('<b>').text(playlist.name);
                $('#spotify_album_name').html(escapedAlbum);
                $('#spotify_album_done').show();
                // Register playlist
                CONTROLLERS.Playlist.register(playlist);
                // Load playlist
                CONTROLLERS.Playlist.load(playlist);
            },
            function exceptionHandler (exception) {
                // Show error message
                $('p.messages').hide();
                var escapedAlbum = $('<b>').text('URL: ' + url);
                var escapedSignature = $('<small>').text(exception.signature);
                var errorMessage = $('<p>').text(exception.message);
                errorMessage.append('<br>')
                             .append(escapedAlbum)
                             .append('<br>')
                             .append(escapedSignature);
                $('#spotify_album_error').html(errorMessage);
                $('#spotify_album_error').show();
            }
        );
    },
    // Fetch the metadata from a Spotify Album or Track URL
    fetchSpotify: function (url) {
        PLAYLICK.importSetup('spotify');
        IMPORTERS.Spotify.url(
            url,
            function callback (playlist) {
                // Update messages
                $('p.messages').hide();
                $('#spotify_title').text(playlist.name);
                $('#spotify_done').show();
                // Register playlist
                CONTROLLERS.Playlist.register(playlist);
                // Load playlist
                CONTROLLERS.Playlist.load(playlist);
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
                // Update messages
                $('p.messages').hide();
                var escapedAlbum = $('<b>').text(playlist.name);
                $('#album_name').html(escapedAlbum);
                $('#album_done').show();
                // Register playlist
                CONTROLLERS.Playlist.register(playlist);
                // Load playlist
                CONTROLLERS.Playlist.load(playlist);
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
                CONTROLLERS.Playlist.register(playlist);
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
                CONTROLLERS.Playlist.register(playlist);
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
                // Update messages
                $('p.messages').hide();
                $('#generate_done').show();
                // Register playlist
                CONTROLLERS.Playlist.register(playlist);
                // Load playlist
                CONTROLLERS.Playlist.load(playlist);
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
