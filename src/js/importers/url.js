/**
 * Url
 * Methods and Exceptions for importing playlists from HTTP URLs
**/
var Url = {};
/**
 * class Url.Exception < Exception
 * 
 * new Url.Exception(url[, message][, diagnostics]) -> Function(message[, diagnostics])
 * - url (String): URL
 * - message (String): Error message that describes the exception
 * - diagnostics (Object): Any object that might aid in diagnosing the exception
 * 
 * Base class for URL import exceptions.
 * The constructor takes a URL and uses the partialException pattern
 * 
 * Available subclasses:
 * Url.XspfException
 * Url.PodcastException
 * Url.AtomPodcastException
**/
Url.Exception = function (url, message, diagnostics) {
    this.url = url;
    this.message = message;
    this.diagnostics = diagnostics;
    return partialException(this);
};
Url.Exception.prototype = new Exception;
Url.Exception.prototype.name = 'UrlException';
Url.Exception.prototype.toString = function () {
    return this.name + ': ' + this.message + ' (' + this.url + ')';
};
/**
 * class Url.XspfException < Url.Exception
 * class Url.PodcastException < Url.Exception
 * class Url.AtomPodcastException < Url.Exception
**/
Url.XspfException = Url.Exception;
Url.XspfException.prototype.name = 'UrlXspfException';
Url.PodcastException = Url.Exception;
Url.PodcastException.prototype.name = 'UrlPodcastException';
Url.AtomPodcastException = Url.Exception;
Url.AtomPodcastException.prototype.name = 'UrlAtomPodcastException';
/**
 * Url.url(url[, callback][, exceptionHandler])
 * - url (String): URL to import the playlist from
 * - callback(playlist) (Function): Function to be called if a playlist is successfully created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Creates a playlist from a Podcast or XSPF URL
**/
Url.url = function (source, callback, exceptionHandler) {
    var exception = new Url.XspfException(source);
    IMPORTERS.getJsonFomXml(source, function (json, requestUrl, requestParams) {
        var root = json.query.results;
        var podcast = root.rss ? root.rss.channel : '';
        var atom = root.feed;
        var jspf = root.lfm ? root.lfm.playlist : root.playlist;
        if (!podcast && !atom && !jspf) {
            throw exception('Invalid Podcast/XSPF', root);
        }
        var playlist;
        var metadata = {
            type: 'subscription',
            subscription: {
                namespace: 'Url',
                method: 'url',
                arguments: [source],
                incremental: true
            }
        };
        if (jspf) {
            playlist = IMPORTERS.createPlaylistFromJspf(
                source,
                jspf,
                metadata,
                callback,
                new Url.XspfException(source)
            );
        } else if (podcast) {
            playlist = IMPORTERS.createPlaylistFromPodcast(
                source,
                podcast,
                metadata,
                callback,
                new Url.PodcastException(source)
            );
        } else if (atom) {
            playlist = IMPORTERS.createPlaylistFromAtomPodcast(
                source,
                atom,
                metadata,
                callback,
                new Url.AtomPodcastException(source)
            );
        }
    }, exception, exceptionHandler);
};
