/**
 * class MODELS.Playlist
 * Playlist objects have an array of PlaylistTracks, and associated metadata
**/
function Playlist (options) {
    this.saved = false;
    this.persisted = false;
    this.published = false;
    this.tracks = [];
    
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
    this.type = this.options.type || 'playlist';
    this.date = this.options.date ? new Date(this.options.date) : new Date();
    this.artist = this.options.artist || '';
    this.album = this.options.album || '';
    this.title = this.options.title;
    this.image = this.options.image || '';
    this.subtitle = this.options.subtitle || '';
    this.description = this.options.description || '';
    this.url = this.options.url || '';
    this.source = this.options.source || '';
    this.copyright = this.options.copyright || '';
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
    remove_track: function (playlist_track) {
        var i = $.inArray(playlist_track, this.tracks);
        this.tracks.splice(i, 1);
        // Refactor view
        playlist_track.element.remove();
        // AUTOSAVE
        this.save();
    },
    reset_tracks: function (playlist_tracks) {
        this.tracks = playlist_tracks;
        // AUTOSAVE
        this.save();
    },
    /**
     * Playlist management
    **/
    isAlbum: function () {
        return this.type == 'album';
    },
    albumToString: function () {
        return this.artist + ' - ' + this.album;
    },
    toString: function () {
        if (this.title) {
            return this.title;
        }
        if (this.isAlbum()) {
            return this.albumToString();
        }
        return "Playlist: " + this.date.toLocaleString();
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
        element_name = element_name || 'li';
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
        var applescript = 'set playlist_name to "' + this.toString() + '"\n'
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
    onSave: function () {
        if (!this.persisted && this.options.onCreate) {
            this.options.onCreate.call(this);
        }
        if (this.options.onSave) {
            this.options.onSave.call(this);
        }
        this.saved = true;
    },
    save: function () {
        // Persist in CouchDB
        if (MODELS.couch_up) {
            try {
                var result = MODELS.couch.save(this.get_doc());
                // console.dir(result);
                if (result.ok) {
                    this.set_doc_ref(result.id, result.rev);
                    this.onSave();
                    this.persisted = true;
                    // console.info('[saved] ' + result.id + ' [' + result.rev + ']');
                }
            } catch (result) {
                MODELS.couch_down_handler('save', result);
            }
        }
        if (!MODELS.couch_up && !this.persisted) {
            this.onSave();
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
    publish: function () {
        this.published = true;
        // AUTOSAVE
        this.save();
    },
    make_private: function () {
        this.published = false;
        // AUTOSAVE
        this.save();
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
            type: this.type,
            date: this.date.getTime(),
            title: this.title,
            artist: this.artist,
            album: this.album,
            image: this.image,
            subtitle: this.subtitle,
            description: this.description,
            url: this.url,
            source: this.source,
            copyright: this.copyright,
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