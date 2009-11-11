IMPORTERS = {
    /**
     * getJson(url, params, callback, exception[, exceptionHandler])
     * - url (String): URL to a JSON document
     * - params (Object): Query parameters for the URL
     * - callback(JSON) (Function): Function to be called if the request successfully completes.
     *      Takes a JSON object as its only argument
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * - exceptionHandler(exception) (Function): Function to be called on error
     *      Takes an exception object as its only argument
     * 
     * Wraps jQuery.getJSON with response, exception and timeout handling.
    **/
    getJson: function (url, params, callback, exception, exceptionHandler) {
        var params = params || {};
        var exceptionHandler = exceptionHandler || IMPORTERS.defaultExceptionHandler;
        // Setup a 2 second timeout for the JSONP request
        var hasTimedOut = false;
        var callTimeout = setTimeout(function () {
            hasTimedOut = true;
            exceptionHandler(exception('Request timed out', {
                url: url,
                params: params
            }));
        }, 4000);
        $.getJSON(url, params, function (json) {
            if (hasTimedOut) {
                return;
            }
            // Cancel the timeout
            clearTimeout(callTimeout);
            // Check the response, call the callback and handle any exceptions
            try {
                IMPORTERS.checkResponse.call(this, json, exception);
                callback.call(this, json);
            } catch (e) {
                exceptionHandler(e);
            }
        });
    },
    /**
     * getJsonFomXml(url, callback, exception[, exceptionHandler])
     * - url (String): URL to an XML document to be converted to JSON
     * - callback(JSON) (Function): Function to be called if the request successfully completes.
     *      Takes a JSON object as its only argument
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * - exceptionHandler(exception) (Function): Function to be called on error
     *      Takes an exception object as its only argument
     * 
     * Fetches a JSON response from a URL to an XML document using YQL
     * http://developer.yahoo.com/yql/
    **/
    getJsonFomXml: function (url, callback, exception, exceptionHandler) {
        IMPORTERS.getJson("http://query.yahooapis.com/v1/public/yql?callback=?", {
            q: 'select * from xml where url="' + url + '"',
            format: 'json'
        }, function (json) {
            if (!json.query || !json.query.results) {
                throw exception('Invalid URL');
            }
            callback.call(this, json);
        }, exception, exceptionHandler);
    },
    /**
     * createPlaylistFromJspf(jspf, metadata, exception) -> MODELS.Playlist
     * - jspf (Object): JSON object representation of an XSPF
     * - metadata (Object): Extra metadata about the playlist
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * 
     * Creates a playlist from a JSON representation of an XSPF. A JSPF if you will.
    **/
    createPlaylistFromJspf: function (jspf, metadata, exception) {
        if (!jspf.trackList || !jspf.trackList.track) {
            throw exception('No tracks in JSPF response', jspf);
        }
        var metadata = metadata || {};
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(jspf.trackList.track);
        if (!trackList.length) {
            throw exception('No tracks in JSPF', jspf.trackList);
        }
        // Create the playlist
        var playlist = PLAYLICK.create_playlist({
            name: jspf.title
        });
        // Load tracks
        $.each(trackList, function (i, data) {
            if (data.title && data.creator) {
                var trackDoc = {
                    name: data.title,
                    artist: data.creator,
                    album: data.album,
                    duration: Math.round(data.duration/1000)
                };
                if (data.location) {
                    trackDoc.url = data.location;
                }
                playlist.add_track(new MODELS.Track(trackDoc));
            }
        });
        // Save metadata
        playlist.image = metadata.image;
        playlist.description = metadata.description;
        playlist.save();
        return playlist;
    },
    createPlaylistFromPodcast: function (podcast, exception) {
        if (!podcast.item) {
            throw exception('No tracks in Podcast response', podcast);
        }
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(podcast.item);
        if (!trackList.length) {
            throw exception('No tracks in Podcast', jspf.trackList);
        }
        // Create the playlist
        var playlist = PLAYLICK.create_playlist({
            name: podcast.title
        });
        // Load tracks
        $.each(trackList, function (i, data) {
            var trackDoc = {
                name: data.title,
                artist: data.author
            };
            if (data.enclosure && data.enclosure.url) {
                trackDoc.url = data.enclosure.url;
            }
            playlist.add_track(new MODELS.Track(trackDoc));
        });
        // Save
        playlist.save();
        return playlist;
    },
    defaultExceptionHandler: function (exception) {
        if (PLAYLICK.debug) {
            console.warn(exception);
            exception.diagnose();
        }
    },
    checkResponse: function (json, exception) {
        if (!json) {
            throw exception('No JSON', this.url);
        }
        if (json.error) {
            throw exception(json.error.description, json);
        }
    }
};
(function () {
    //= require "importers/exception"
    
    //= require "importers/url"
    //= require "importers/spotify"
    //= require "importers/lastfm"
    
    // Expose
    IMPORTERS.Url = Url;
    IMPORTERS.Spotify = Spotify;
    IMPORTERS.LastFm = LastFm;
})();
