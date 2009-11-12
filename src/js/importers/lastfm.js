/**
 * Last.fm
 * Methods and Exceptions for importing playlists from the Last.fm API
 * http://www.last.fm/api
**/
var LastFm = {
    API_KEY: "b25b959554ed76058ac220b7b2e0a026",
    WS_ROOT: "http://ws.audioscrobbler.com"
};
/**
 * class LastFm.Exception < Exception
 * 
 * new LastFm.Exception(signature[, message][, diagnostics]) -> Function(message[, diagnostics])
 * - signature (String): Last.fm API method signature that lead to the exception
 * - message (String): Error message that describes the exception
 * - diagnostics (Object): Any object that might aid in diagnosing the exception
 * 
 * Base class for Last.fm import exceptions.
 * The constructor takes a Last.fm method signature and uses the partialException pattern
**/
LastFm.Exception = function (signature, message, diagnostics) {
    this.signature = signature;
    this.message = message;
    this.diagnostics = diagnostics;
    return partialException(this);
};
LastFm.Exception.prototype = new Exception;
LastFm.Exception.prototype.name = 'LastFmException';
LastFm.Exception.prototype.toString = function () {
    return this.name + ': ' + this.message + ' (' + this.signature + ')';
};
/**
 * LastFm.getJson(method, params, callback, exception[, exceptionHandler])
 * - method (String): Last.fm API method
 * - params (Object): Parameters needed for this method call
 * - callback(JSON) (Function): Function to be called if the request successfully completes.
 *      Takes a JSON object as its only argument
 * - exception (Exception): Partially initialised exception object to be thrown on error
 * - exceptionHandler(exception) (Function): Function to be called on error
 *      Takes an exception object as its only argument
 * 
 * Wraps getJson with Last.fm specifics
**/
LastFm.getJson = function (method, params, callback, exception, exceptionHandler) {
    var params = params || {};
    params.method = method;
    IMPORTERS.getJson(LastFm.WS_ROOT + "/2.0/?callback=?", $.extend(params, {
        api_key: LastFm.API_KEY,
        format: 'json'
    }), callback, exception, exceptionHandler);
};
/**
 * LastFm.generateSignature(method[, params]) -> String
 * - method (String): Last.fm API method
 * - params (Object): Parameters needed for this method call
 * 
 * Generates a method signature for a Last.fm API call
 * 
 * e.g.
 * LastFm.generateSignature('track.getInfo', { artist: 'James Wheare', track: 'Take Control' });
 * -> 'user.getInfo --artist=James%20Wheare --track=Take%20Control'
**/
LastFm.generateSignature = function (method, params) {
    var signature = method;
    var params = params || {};
    for (k in params) {
        signature += " --" + k + "=" + encodeURIComponent(params[k]);
    }
    return signature;
};
/**
 * LastFm.getPlaylist(url[, callback][, exceptionHandler])
 * 
 * Imports a playlist URL from Last.fm
 * http://www.last.fm/api/playlists
 * http://www.last.fm/api/show?service=271
**/
LastFm.getPlaylist = function (url, metadata, callback, exceptionHandler) {
    var method = "playlist.fetch";
    var params = {
        playlistURL: url
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        var playlist = IMPORTERS.createPlaylistFromJspf(json.playlist, metadata, callback, exception);
    }, exception, exceptionHandler);
};
/**
 * LastFm.userPlaylists(user[, callback][, finalCallback][, exceptionHandler][, noPlaylistHandler])
 * - user (String): Last.fm username to fetch playlists for
 * - callback(playlist) (Function): Function to be called for each playlist that's successfully created
 *      Takes the playlist object as the only argument
 * - finalCallback(playlists) (Function): Function to be called after all playlists have been successfully created
 *      Takes an array of playlist objects as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * - noPlaylistHandler() (Function): Function to be called when the user has no playlists
 * 
 * Imports user playlists from Last.fm
 * http://www.last.fm/api/show?service=313
**/
LastFm.userPlaylists = function (user, callback, finalCallback, exceptionHandler, noPlaylistHandler) {
    var method = "user.getplaylists";
    var params = {
        user: user
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.playlists) {
            throw exception('No playlists in response', json);
        }
        if (!json.playlists.playlist) {
            return noPlaylistHandler();
        }
        
        // Last.fm APIs return single item lists as single items
        var playlists = $.makeArray(json.playlists.playlist);
        var importedPlaylists = {};
        // Callback to loop through importedPlaylists to check if we're still waiting for results
        // called on LastFm.getPlaylist success and failure
        function playlistDone (processedUrl, playlist) {
            for (url in importedPlaylists) {
                if (importedPlaylists[url] === false) {
                    return;
                }
            }
            // All playlists are processed, call the LastFm.userPlaylists finalCallback
            finalCallback(importedPlaylists);
        }
        // Create a playlist for each in the API response
        // Requires a separate call to LastFm.getPlaylist for each
        $.each(playlists, function (i, data) {
            var url = "lastfm://playlist/" + data.id;
            importedPlaylists[url] = false;
            // Extract other metadata from playlist info
            var metadata = {};
            var image = $.grep(data.image, function (value, i) {
                return value.size == 'medium';
            });
            if (image[0]) {
                metadata.image = image[0]['#text'];
            }
            // Fetch the tracklist
            LastFm.getPlaylist(
                url,
                metadata,
                function playlistCallback (playlist) {
                    importedPlaylists[url] = playlist;
                    callback(playlist);
                    playlistDone(url, playlist);
                },
                function playlistExceptionHandler (exception) {
                    importedPlaylists[url] = exception;
                    playlistDone(url, exception);
                }
            );
        });
    }, exception, exceptionHandler);
};
/**
 * LastFm.lovedTracks(user[, callback][, exceptionHandler])
 * - user (String): User to get loved tracks for
 * - callback(playlist) (Function): Function to be called once the loved tracks playlist has been created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Import a user's loved tracks from Last.fm
 * http://www.last.fm/api/show?service=329
**/
LastFm.lovedTracks = function (user, callback, exceptionHandler) {
    var method = "user.getLovedTracks";
    var params = {
        user: user
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.lovedtracks || !json.lovedtracks.track) {
            throw exception('No loved tracks in response', json);
        }
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(json.lovedtracks.track);
        if (!trackList.length) {
            throw exception('No loved tracks', jspf.trackList);
        }
        // Create the playlist
        var playlist = new MODELS.Playlist({
            name: 'Loved tracks for ' + json.lovedtracks['@attr'].user
        });
        // Load tracks
        $.each(trackList, function (i, data) {
            var trackDoc = {
                name: data.name,
                artist: data.artist.name
            };
            playlist.add_track(new MODELS.Track(trackDoc));
        });
        if (callback) {
            callback(playlist);
        }
        // Save
        playlist.save();
    }, exception, exceptionHandler);
};
/**
 * LastFm.album(artist, album[, callback][, exceptionHandler])
 * - artist (String): Artist who authored the album
 * - album (String): Album name
 * - callback(playlist) (Function): Function to be called once the album playlist has been created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Import an Album playlist from Last.fm
 * http://www.last.fm/api/show?service=290
**/
LastFm.album = function (artist, album, callback, exceptionHandler) {
    var method = "album.getInfo";
    var params = {
        artist: artist,
        album: album
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.album) {
            throw exception('No album data', json);
        }
        var url = "lastfm://playlist/album/" + json.album.id;
        // Extract other metadata from album info
        var description = json.album.url;
        if (json.album.wiki) {
            description += " " + $('<div/>').html(json.album.wiki.summary).text();
        }
        var metadata = {
            description: description
        };
        var image = $.grep(json.album.image, function (value, i) {
            return value.size == 'medium';
        });
        if (image[0]) {
            metadata.image = image[0]['#text'];
        }
        // Fetch the album tracklist
        LastFm.getPlaylist(url, metadata, callback, exceptionHandler);
    }, exception, exceptionHandler);
};

LastFm.getTopTracks = function (artist, callback, exceptionHandler) {
    var method = "artist.getTopTracks";
    var params = {
        artist: artist
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.toptracks || !json.toptracks.track) {
            throw exception('No top tracks for ' + artist, json);
        }
        callback(json.toptracks.track);
    }, exception, exceptionHandler);
};

LastFm.generateUsersPlaylist = function (userA, userB, callback, exceptionHandler) {
    var method = "tasteometer.compare";
    var params = {
        type1: 'user',
        value1: userA,
        type2: 'user',
        value2: userB,
        limit: 20
    };
    var exception = new LastFm.Exception(LastFm.generateSignature(method, params));
    LastFm.getJson(method, params, function (json) {
        if (!json.comparison || !json.comparison.result || !json.comparison.result.artists || !json.comparison.result.artists.artist) {
            throw exception("No shared artists found", json);
        }
        var artists = UTIL.shuffle(json.comparison.result.artists.artist);
        // Create the playlist
        var playlist = new MODELS.Playlist({
            name: userA + ' and ' + userB,
            description: 'A playlist based on your shared artists'
        });
        var playlistTracks = {};
        // Callback to loop through playlistTracks to check if we're still waiting for results
        // called on LastFm.getTopTracks success and failure
        function randomTopTrackDone (processedArtist, tracks) {
            for (artist in playlistTracks) {
                if (playlistTracks[artist] === false) {
                    return;
                }
            }
            // Playlist is filled with tracks, check length
            if (!playlist.tracks.length) {
                return exceptionHandler(exception("No valid tracks found for artists", playlistTracks));
            }
            // Call the LastFm.generateUsersPlaylist callback
            if (callback) {
                callback(playlist);
            }
            // Save
            playlist.save();
        }
        // Get a random top track for each in the tasteometer shared artists response
        // Requires a separate call to LastFm.getTopTracks for each
        $.each(artists, function (i, artist) {
            var artist_name = artist.name;
            playlistTracks[artist_name] = false;
            LastFm.getTopTracks(
                artist_name,
                function callback (tracks) {
                    // Pick a random track
                    var tracks = UTIL.shuffle(tracks);
                    var track = tracks[0];
                    var trackDoc = {
                        name: track.name,
                        artist: track.artist.name
                    };
                    // Add to the playlist and callback
                    playlist.add_track(new MODELS.Track(trackDoc));
                    playlistTracks[artist_name] = track;
                    randomTopTrackDone(artist_name, tracks);
                },
                function exceptionHandler (exception) {
                    playlistTracks[artist_name] = exception;
                    randomTopTrackDone(artist_name, exception);
                }
            );
        });
    }, exception, exceptionHandler);
};

LastFm.getAlbumArt = function (artist, album) {
    return LastFm.WS_ROOT + "/2.0/?" + $.param({
        artist: artist,
        album: album,
        method: "album.imageredirect",
        size: "small",
        api_key: LastFm.API_KEY
    });
};
