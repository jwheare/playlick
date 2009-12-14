IMPORTERS = {
    YQL_URL: "http://query.yahooapis.com/v1/public/yql?callback=?",
    yqlSelectXML: function (url) {
        return 'select * from xml where url="' + url + '"';
    },
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
        params = params || {};
        exceptionHandler = exceptionHandler || IMPORTERS.defaultExceptionHandler;
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
        IMPORTERS.getJson(IMPORTERS.YQL_URL, {
            q: IMPORTERS.yqlSelectXML(url),
            format: 'json'
        }, function (json) {
            if (!json.query || !json.query.results) {
                throw exception('Invalid URL', json);
            }
            callback.call(this, json);
        }, exception, exceptionHandler);
    },
    autocompleteFromXml: function (element, url, params, parse, formatItem) {
        element.autocomplete(IMPORTERS.YQL_URL, {
            multiple: false,
            delay: 200,
            dataType: "jsonp",
            extraParams: {
                q: function () {
                    var queryUrl = url;
                    if (params) {
                        queryUrl += '?' + Playdar.Util.toQueryString(params());
                    }
                    return IMPORTERS.yqlSelectXML(queryUrl);
                },
                format: 'json'
            },
            cacheLength: 1,
            parse: parse,
            formatItem: formatItem
        });
    },
    /**
     * getAbsoluteUrl(url[, root=window.location.href]) -> String
     * - url (String): URL to make absolute
     * - root (String): Root that the URL is relative to
     * 
     * Convert a relative URL to absolute with a given root.
    **/
    getAbsoluteUrl: function (url, base) {
        base = base || window.location.href;
        // Check for a relative URL and an absolute http base URL
        if (url && !url.match(/^https?:\/\//) && base.match(/^https?:\/\//)) {
            if (url.indexOf('/') === 0) {
                // Add the relative URL to the base URL's root
                var baseLocation = Playdar.Util.location_from_url(base);
                url = baseLocation.protocol + '//' + baseLocation.host + url;
            } else {
                // Add the relative URL to the base URL's last part
                url = base.replace(/(\/[^\/]*)$/, '') + '/' + url;
            }
        }
        return url;
    },
    /**
     * createPlaylistFromJspf(url, jspf, metadata, callback, exception) -> MODELS.Playlist
     * - url (String): URL from which the XSPF was fetched
     * - jspf (Object): JSON object representation of an XSPF
     * - metadata (Object): Extra metadata about the playlist
     * - callback(playlist) (Function): Function to be called if a playlist is successfully created
     * - exception (Exception): Partially initialised exception object to be thrown on error
     * 
     * Creates a playlist from a JSON representation of an XSPF. A JSPF if you will.
    **/
    createPlaylistFromJspf: function (source, jspf, metadata, callback, exception) {
        if (!jspf.trackList || !jspf.trackList.track) {
            throw exception('No tracks in JSPF response', jspf);
        }
        metadata = metadata || {};
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(jspf.trackList.track);
        if (!trackList.length) {
            throw exception('No tracks in JSPF', jspf.trackList);
        }
        // Create the playlist
        var title = jspf.title || jspf.info;
        var url = metadata.url || jspf.info;
        var description = metadata.description || jspf.annotation || jspf.info;
        if (description == title || description == url) {
            description = '';
        }
        var playlist = new MODELS.Playlist({
            name: title,
            image: IMPORTERS.getAbsoluteUrl(metadata.image || jspf.image, source),
            description: description,
            url: IMPORTERS.getAbsoluteUrl(url, source),
            source: source
        });
        // Load tracks
        $.each(trackList, function (i, data) {
            if (data.title) {
                var trackDoc = {
                    name: data.title,
                    artist: data.creator,
                    album: data.album
                };
                if (data.duration) {
                    trackDoc.duration = Math.round(data.duration/1000);
                }
                if (data.location) {
                    trackDoc.url = IMPORTERS.getAbsoluteUrl(data.location, source);
                }
                playlist.add_track(new MODELS.Track(trackDoc));
            }
        });
        // Save
        playlist.save();
        // Call the IMPORTERS.createPlaylistFromJspf callback
        if (callback) {
            callback(playlist);
        }
        return playlist;
    },
    getStringItem: function (field) {
        var fields = $.makeArray(field);
        return $.grep(fields, function (value, i) {
            return typeof value == 'string';
        })[0];
    },
    createPlaylistFromPodcast: function (source, podcast, callback, exception) {
        if (!podcast.item) {
            throw exception('No tracks in Podcast response', podcast);
        }
        // XML to JSON converters often return single item lists as single items
        var trackList = $.makeArray(podcast.item);
        if (!trackList.length) {
            throw exception('No tracks in Podcast', jspf.trackList);
        }
        // Create the playlist
        var image = podcast.image ? podcast.image.href : (podcast.thumbnail ? podcast.thumbnail.url : '');
        var subtitle = IMPORTERS.getStringItem(podcast.subtitle);
        var description = IMPORTERS.getStringItem(podcast.description);
        if (description == subtitle) {
            description = '';
        }
        var playlist = new MODELS.Playlist({
            name: IMPORTERS.getStringItem(podcast.title),
            subtitle: subtitle,
            description: description,
            copyright: IMPORTERS.getStringItem(podcast.copyright),
            image: IMPORTERS.getAbsoluteUrl(image),
            url: IMPORTERS.getStringItem(podcast.link),
            source: source
        });
        // Load tracks
        $.each(trackList, function (i, data) {
            var trackDoc = {
                name: data.title,
                artist: data.author || podcast.author
            };
            // TODO support media:content alternative
            // e.g. <media:content url="blah.mp3" fileSize="46669578" type="audio/mpeg">
            if (data.enclosure && data.enclosure.url) {
                trackDoc.url = data.enclosure.url;
                trackDoc.size = data.enclosure['length'];
                trackDoc.mimetype = data.enclosure.type;
            }
            playlist.add_track(new MODELS.Track(trackDoc));
        });
        // Save
        playlist.save();
        // Call the IMPORTERS.createPlaylistFromPodcast callback
        if (callback) {
            callback(playlist);
        }
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
            throw exception(json.error.description || json.error.message || json.message, json);
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
