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
 * Url.xspf(url[, callback][, exceptionHandler])
 * - url (String): URL to import the playlist from
 * - callback(playlist) (Function): Function to be called if a playlist is successfully created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Creates a playlist from an XSPF URL
**/
Url.xspf = function (source, callback, exceptionHandler) {
    var exception = new Url.XspfException(source);
    IMPORTERS.getJsonFomXml(source, function (json) {
        var jspf = json.query.results.lfm ? json.query.results.lfm.playlist : json.query.results.playlist;
        if (!jspf) {
            throw exception('Invalid XSPF', json.query.results);
        }
        var metadata = {};
        var playlist = IMPORTERS.createPlaylistFromJspf(source, jspf, metadata, callback, exception);
    }, exception, exceptionHandler);
};
/**
 * Url.podcast(url[, callback][, exceptionHandler])
 * - url (String): URL to import the playlist from
 * - callback(playlist) (Function): Function to be called if a playlist is successfully created
 *      Takes the playlist object as the only argument
 * - exceptionHandler(exception) (Function): Function to be called in case of an import exception
 *      Takes the exception object as the only argument
 * 
 * Creates a playlist from a Podcast URL
**/
Url.podcast = function (source, callback, exceptionHandler) {
    var exception = new Url.XspfException(source);
    IMPORTERS.getJsonFomXml(source, function (json) {
        var podcast = json.query.results.rss.channel;
        if (!podcast) {
            throw exception('Invalid Podcast', json.query.results);
        }
        var playlist = IMPORTERS.createPlaylistFromPodcast(source, podcast, callback, exception);
    }, exception, exceptionHandler);
};
