/**
 * class MODELS.Playlist
 * Playlist objects have a name, array of Tracks and duration
**/
function Playlist (options) {
    this.saved = false;
    this.persisted = false;
    this.published = false;
    this.tracks = [];
    this.duration = 0;
    
    this.options = options || {};
    
    // If ref values were passed in, set them
    if (this.set_doc_ref(this.options._id, this.options._rev)) {
        this.persisted = true;
    } else {
        // Otherwise get a new UUID
        if (MODELS.couch_up) {
            try {
                this.set_id(CouchDB.newUuids(1)[0]);
            } catch (result) {
                MODELS.couch_down_handler('uuid', result);
            }
        }
        if (!MODELS.couch_up) {
            this.set_id(MODELS.next_playlist_id++);
        }
    }
    this.name = this.options.name || "Playlist: " + new Date().toLocaleString();
    this.image = this.options.image || '';
    this.description = this.options.description || '';
    this.url = this.options.url || '';
    this.source = this.options.source || '';
    this.addOptions(Playlist.DefaultOptions);
    
    // Create the DOM element
    this.set_element(this.options.dom_element);
};
// Override this
Playlist.DefaultOptions = {};
Playlist.prototype = {
    addOptions: function (options) {
        $.extend(this.options, options);
    },
    /**
     * State management
    **/
    add_track: function (track, options) {
        var playlist_track = new PlaylistTrack(this, track, options);
        this.tracks.push(playlist_track);
        return playlist_track;
    },
    remove_track: function (playlist_track, onSave) {
        var i = $.inArray(playlist_track, this.tracks);
        this.tracks.splice(i, 1);
        // AUTOSAVE
        this.save(function () {
            // Remove from the DOM
            playlist_track.element.remove();
        });
    },
    reset_tracks: function (playlist_tracks, onSave) {
        this.tracks = playlist_tracks;
        // AUTOSAVE
        this.save(onSave);
    },
    /**
     * Playlist management
    **/
    set_name: function (name, onSave) {
        this.name = name;
        // AUTOSAVE
        this.save(onSave);
    },
    update_duration: function () {
        var duration = 0;
        $.each(this.tracks, function (i, playlist_track) {
            if (playlist_track.track.duration) {
                duration += playlist_track.track.duration;
            }
        });
        this.set_duration(duration);
    },
    set_duration: function (duration) {
        this.duration = duration;
        if (this.options.onSetDuration) {
            this.options.onSetDuration.call(this);
        }
    },
    get_duration: function () {
        return Playdar.Util.mmss(this.duration);
    },
    toString: function () {
        return this.name;
    },
    /**
     * Fetch tracks from Couch
    **/
    fetchTracks: function () {
        try {
            var response = MODELS.couch.view("playlist/all", {
                "key": this._id
            });
            MODELS.couch_up_handler('fetchTracks', response);
            var row = response.rows[0];
            var value = row.value;
            // Load tracks
            var playlist = this;
            var elements = $.map(value.tracks, function (track_data, i) {
                var playlist_track = playlist.add_track(new MODELS.Track(track_data.track));
                // Build DOM element
                return playlist_track.element.get();
            });
            return elements;
        } catch (result) {
            MODELS.couch_down_handler('fetchTracks', result);
        }
    },
    /**
     * Load tracks to the DOM, fetching from Couch if needed
    **/
    load: function () {
        var elements;
        if (!this.tracks.length) {
            // Fetch from Couch
            elements = this.fetchTracks();
        } else {
            // Already fetched, just build DOM elements
            elements = this.loadDom();
        }
        return elements;
    },
    /**
     * Load and unload PlaylistTracks from the DOM
    **/
    loadDom: function () {
        var elements = $.map(this.tracks, function (playlist_track, i) {
            return playlist_track.load().get();
        });
        return elements;
    },
    unload: function () {
        $.each(this.tracks, function (i, playlist_track) {
            playlist_track.unload();
        });
        if (this.options.onUnload) {
            this.options.onUnload.call(this);
        }
    },
    /**
     * Build a DOMElement for the Playlist
    **/
    set_element: function (element_name) {
        var element_name = element_name || 'li';
        this.element = $('<' + element_name + ' class="p">')
            .attr('id', this.get_dom_id())
            .data('playlist', this)
            .html(this.toHTML());
    },
    get_dom_id: function () {
        return "p_" + this.get_id();
    },
    toHTML: function () {
        return this.toString();
    },
    titleHTML: function () {
        return this.toString();
    },
    get_urls: function () {
        var urls = [];
        $.each(this.tracks, function (i, playlist_track) {
            if (playlist_track.track.playdar_url) {
                urls.push(playlist_track.track.playdar_url);
            }
        });
        return urls;
    },
    /**
     * Build an applescript for exporting to iTunes
    **/
    toApplescript: function () {
        var track_records = $.map(this.tracks, function (playlist_track, i) {
            return '{'
                + 'artist: "' + playlist_track.track.artist.replace(/"/g, '\\"') + '",'
                + 'track: "' + playlist_track.track.name.replace(/"/g, '\\"') + '"'
                + '}';
        });
        var applescript = 'set playlist_name to "' + this.name + '"\n'
        + 'tell application "iTunes"\n'
        + '    set new_playlist to (make playlist with properties {name:playlist_name})\n'
        + '    set l to source "Library"\n'
        + '    set tracks_to_search to {'
               + track_records.join(',')
            + '}\n'
        + '    repeat with t in tracks_to_search\n'
        + '        duplicate ('
                   + 'every file track of l '
                   + 'whose artist contains (artist of t) '
                   + 'and name contains (track of t)'
                + ') to new_playlist\n'
        + '    end repeat\n'
        + '    reveal new_playlist\n'
        + '    activate\n'
        + 'end tell';
        return "applescript://com.apple.scripteditor?action=new&script=" + encodeURIComponent(applescript);
    },
    /**
     * Track accessors
    **/
    get_track_by_id: function (playlist_track_id) {
        var that = this;
        $.each(this.tracks, function (i, playlist_track) {
            if (playlist_track.id == playlist_track_id) {
                return false;
            }
        });
        return playlist_track;
    },
    get_track_at_position: function (position) {
        var i = position - 1;
        return this.tracks[i];
    },
    /**
     * Persistance
    **/
    onSave: function (callback) {
        if (!this.persisted && this.options.onCreate) {
            this.options.onCreate.call(this);
        }
        if (callback) {
            callback.call(this);
        }
        if (this.options.onSave) {
            this.options.onSave.call(this);
        }
        this.saved = true;
    },
    save: function (callback) {
        // Persist in CouchDB
        if (MODELS.couch_up) {
            try {
                var result = MODELS.couch.save(this.get_doc());
                // console.dir(result);
                if (result.ok) {
                    this.set_doc_ref(result.id, result.rev);
                    this.onSave(callback);
                    this.persisted = true;
                    // console.info('[saved] ' + result.id + ' [' + result.rev + ']');
                }
            } catch (result) {
                MODELS.couch_down_handler('save', result);
            }
        }
        if (!MODELS.couch_up && !this.persisted) {
            this.onSave(callback);
        }
    },
    onRemove: function () {
        // Remove from the DOM
        this.element.remove();
        // onDelete Callback
        if (this.options.onDelete) {
            this.options.onDelete.call(this);
        }
    },
    remove: function () {
        if (MODELS.couch_up) {
            try {
                var result = MODELS.couch.deleteDoc(this.get_doc_ref());
                // console.dir(result);
                if (result.ok) {
                    this.onRemove();
                    this.persisted = false;
                    // console.info('[delete] ' + result.id + ' [' + result.rev + ']');
                }
            } catch (result) {
                MODELS.couch_down_handler('delete', result);
            }
        }
        if (!MODELS.couch_up && !this.persisted) {
            this.onRemove();
        }
    },
    publish: function (onSave) {
        this.published = true;
        // AUTOSAVE
        this.save(onSave);
    },
    make_private: function (onSave) {
        this.published = false;
        // AUTOSAVE
        this.save(onSave);
    },
    share: function (person) {
        // TODO
        // Fire off AJAX request to share Playlist with email address or user
    },
    /**
     * CouchDB Representation
    **/
    set_id: function (id) {
        this._id = id;
        return id;
    },
    get_id: function () {
        return this._id;
    },
    set_rev: function (rev) {
        this._rev = rev;
        return rev;
    },
    get_rev: function () {
        return this._rev;
    },
    set_doc_ref: function (id, rev) {
        return this.set_id(id) && this.set_rev(rev);
    },
    get_doc_ref: function () {
        var doc_ref = {
            _id: this.get_id(),
            _rev: this.get_rev()
        };
        return doc_ref;
    },
    get_doc: function () {
        var doc = $.extend(this.get_doc_ref(), {
            published: this.published,
            type: 'playlist',
            name: this.name,
            duration: this.duration,
            image: this.image,
            description: this.description,
            url: this.url,
            source: this.source,
            tracks: $.map(this.tracks, function (playlist_track, i) {
                return playlist_track.get_doc();
            })
        });
        return doc;
    }
};
/**
 * Fetch all playlists from Couch
**/
Playlist.fetchAll = function (callback) {
    try {
        var response = MODELS.couch.view("playlist/all");
        MODELS.couch_up_handler('Playlist.fetchAll', response);
        var playlists = $.map(response.rows, function (row, i) {
            var data = row.value;
            var playlist = new Playlist(row.value);
            if (callback) {
                callback(playlist);
            }
            return playlist;
        });
        return playlists;
    } catch (result) {
        MODELS.couch_down_handler('Playlist.fetchAll', result);
    }
};