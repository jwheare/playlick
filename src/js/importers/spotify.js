/**
 * Spotify
 * Methods and Exceptions for importing playlists from the Spotify Lookup API
 * http://developer.spotify.com/en/metadata-api/lookup/
**/
var Spotify = {
    LOOKUP_ROOT: "http://ws.spotify.com/lookup/1/"
};
/**
 * class Spotify.Exception < Exception
 * 
 * new Spotify.Exception(url[, message][, diagnostics]) -> Function(message[, diagnostics])
 * - url (String): Spotify URL that lead to the exception
 * - message (String): Error message that describes the exception
 * - diagnostics (Object): Any object that might aid in diagnosing the exception
 * 
 * Base class for Spotify import exceptions
 * The constructor takes a Spotify URL and uses the partialException pattern.
 * 
 * Available subclasses:
 * Spotify.AlbumException
 * Spotify.TrackException
**/
Spotify.Exception = function (url, message, diagnostics) {
    this.url = url;
    this.message = message;
    this.diagnostics = diagnostics;
    return partialException(this);
};
Spotify.Exception.prototype = new Exception;
Spotify.Exception.prototype.name = 'SpotifyException';
Spotify.Exception.prototype.toString = function () {
    return this.name + ': ' + this.message + ' (' + this.url + ')';
};
/**
 * class Spotify.UrlException < Spotify.Exception
 * class Spotify.AlbumException < Spotify.Exception
 * class Spotify.TrackException < Spotify.Exception
**/
Spotify.UrlException = Spotify.Exception;
Spotify.UrlException.prototype.name = 'SpotifyUrlException';
Spotify.AlbumException = Spotify.Exception;
Spotify.AlbumException.prototype.name = 'SpotifyAlbumException';
Spotify.TrackException = Spotify.Exception;
Spotify.TrackException.prototype.name = 'SpotifyTrackException';

/**
 * Spotify.getLookupUrl(queryParams) -> String
 * 
 * Get a URL to the lookup service with the given query params
**/
Spotify.getLookupUrl = function (queryParams) {
    var lookupUrl = Spotify.LOOKUP_ROOT + '?' + Playdar.Util.toQueryString(queryParams);
    return lookupUrl;
};
/**
 * Spotify.convertUrlToHttp(url) -> String
 * 
 * Take a spotify protocol style url and turn it into an http://open.spotify.com one
**/
Spotify.convertUrlToHttp = function (url) {
    var httpUrl = url.replace(/(?:spotify:\/+)?spotify:(track|album):(.*)/, 'http://open.spotify.com/$1/$2');
    return httpUrl;
};
/**
 * Spotify.url(url[, callback][, exceptionHandler])
 * - url (String): Spotify album or track URL to lookup metadata for
 * - callback(playlist) (Function): Function to be called if a playlist is successfully created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Wrapper for Spotify.album and Spotify.track.
**/
Spotify.url = function (url, callback, exceptionHandler) {
    if (url.indexOf('track') !== -1) {
        return Spotify.track(url, callback, exceptionHandler);
    } else if (url.indexOf('album') !== -1) {
        return Spotify.album(url, callback, exceptionHandler);
    } else {
        exceptionHandler(new Spotify.UrlException(url, 'Only spotify album or track URLs supported'));
    }
};
/**
 * Spotify.album(url[, callback][, exceptionHandler])
 * - url (String): Spotify album URL to lookup metadata for
 * - callback(playlist) (Function): Function to be called if a playlist is successfully created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Creates a playlist from a Spotify album URL retrieved from the Lookup API with extras=trackdetail
 * http://developer.spotify.com/en/metadata-api/lookup/album/
**/
Spotify.album = function (url, callback, exceptionHandler) {
    url = Spotify.convertUrlToHttp(url);
    var albumLookupUrl = Spotify.getLookupUrl({
        uri: url,
        extras: 'trackdetail'
    });
    var exception = new Spotify.AlbumException(url);
    IMPORTERS.getJsonFomXml(albumLookupUrl, function (json) {
        if (!json.query.results.album) {
            throw exception('No album', json);
        }
        var album = json.query.results.album;
        if (!album.artist || !album.name) {
            throw exception('Invalid album', album);
        }
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(album.tracks.track);
        if (!trackList.length) {
            throw exception('No tracks', album);
        }
        // Create the playlist
        var playlist = new MODELS.Playlist({
            name: (album.artist.name || album.artist[0].name) + ' - ' + album.name,
            description: url
        });
        // Load tracks
        $.each(trackList, function (i, trackData) {
            if (trackData.name && trackData.artist) {
                var trackDoc = {
                    name: trackData.name,
                    artist: trackData.artist.name || trackData.artist[0].name,
                    album: album.name,
                    duration: Math.round(trackData.length)
                };
                if (trackData.href) {
                    trackDoc.url = trackData.href;
                }
                playlist.add_track(new MODELS.Track(trackDoc));
            }
        });
        // Save
        playlist.save();
        // Call the Spotify.album callback
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
/**
 * Spotify.track(url[, callback][, exceptionHandler])
 * - url (String): Spotify track URL to lookup metadata for
 * - callback(playlist) (Function): Function to be called if a playlist is successfully created
 *      Passed the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Passed the exception object as the only argument
 * 
 * Creates a playlist from a Spotify track URL retrieved from the Lookup API
 * http://developer.spotify.com/en/metadata-api/lookup/track/
**/
Spotify.track = function (url, callback, exceptionHandler) {
    url = Spotify.convertUrlToHttp(url);
    var trackLookupUrl = Spotify.getLookupUrl({
        uri: url
    });
    var exception = new Spotify.TrackException(url);
    IMPORTERS.getJsonFomXml(trackLookupUrl, function (json) {
        if (!json.query || !json.query.results || !json.query.results.track) {
            throw exception('No track', json);
        }
        var track = json.query.results.track;
        if (!track.artist || !track.name) {
            throw exception('Invalid track', album);
        }
        // Create a playlist
        var playlist = new MODELS.Playlist({
            name: (track.artist.name || track.artist[0].name) + ' - ' + track.name,
            description: url
        });
        var trackDoc = {
            name: track.name,
            artist: track.artist.name || track.artist[0].name,
            album: track.album.name,
            duration: Math.round(track.length)
        };
        if (track.href) {
            trackDoc.url = track.href;
        }
        playlist.add_track(new MODELS.Track(trackDoc));
        // Save
        playlist.save();
        // Call the Spotify.track callback
        if (callback) {
            callback(playlist);
        }
    }, exception, exceptionHandler);
};
