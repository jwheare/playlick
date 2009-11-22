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
**/
Url.XspfException = Url.Exception;
Url.XspfException.prototype.name = 'UrlXspfException';
Url.PodcastException = Url.Exception;
Url.PodcastException.prototype.name = 'UrlPodcastException';
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
    IMPORTERS.getJsonFomXml(source, function (json) {
        var podcast = json.query.results.rss ? json.query.results.rss : '';
        var jspf = json.query.results.lfm ? json.query.results.lfm.playlist : json.query.results.playlist;
        if (!podcast && !jspf) {
            throw exception('Invalid Podcast/XSPF', json.query.results);
        }
        if (podcast) {
            var playlist = IMPORTERS.createPlaylistFromPodcast(
                source,
                podcast,
                callback,
                new Url.PodcastException(source)
            );
        } else if (jspf) {
            var metadata = {};
            var playlist = IMPORTERS.createPlaylistFromJspf(
                source,
                jspf,
                metadata,
                callback,
                new Url.XspfException(source)
            );
        }
    }, exception, exceptionHandler);
};
