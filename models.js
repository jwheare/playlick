/**
 * MODELS
 * Model namespace
**/
var MODELS = {
    next_playlist_id: 0,
    next_playlist_track_id: 0,
    load_playlist: function (tracks, container, options) {
        var playlist = new MODELS.Playlist(container, options);
        playlist.load_tracks(tracks);
        return playlist;
    }
};
(function () {
    /**
     * class MODELS.Track
     * Track objects have a name, artist and duration
    **/
    var Track = function (name, artist, duration) {
        this.name = name;
        this.artist = artist;
        this.duration = duration;
    };
    Track.prototype = {
        get_duration_string: function () {
            if (typeof this.duration != 'undefined') {
                return UTIL.mmss(this.duration);
            }
            return '';
        },
        toString: function () {
            var duration = this.get_duration_string();
            if (duration) {
                duration = ' (' + duration + ')';
            }
            return this.name + ' - ' + this.artist + duration;
        },
        toHTML: function () {
            var duration = this.get_duration_string();
            if (duration) {
                duration = ' (<span class="duration">' + duration + '</span>)';
            }
            return '<span class="haudio">'
                + '<span class="fn">' + this.name + '</span>'
                + ' - '
                + '<span class="contributor">' + this.artist + '</span>'
                + duration;
        }
    };
    
    /**
     * class MODELS.Playlist
     * Playlist objects have a name, array of Tracks and duration
    **/
    var Playlist = function (container, options) {
        this.options = options || {};
        
        this.id = this.options.id || MODELS.next_playlist_id++;
        this.container = $('#' + container);
        var date = new Date();
        this.name = this.options.name || "Playlist: " + date.toLocaleString();
        this.published = false;
        this.saved = false;
        
        this.initialise();
        
        this.render();
    };
    Playlist.prototype = {
        /**
         * State management
        **/
        initialise: function () {
            this.tracks = [];
            this.container.empty();
            this.duration = 0;
        },
        add_track: function (track) {
            var playlist_track = new PlaylistTrack(this, track);
            this.tracks.push(playlist_track);
            // AUTOSAVE
            this.save();
            return playlist_track;
        },
        remove_track: function (playlist_track) {
            var index = $.inArray(playlist_track, this.tracks);
            this.tracks.splice(index, 1);
            // AUTOSAVE
            this.save();
        },
        load_tracks: function (tracks) {
            this.initialise();
            
            this.start_batch();
            var playlist = this;
            $.each(tracks, function (index, item) {
                playlist.add_track(item);
            });
            this.stop_batch();
        },
        reset_tracks: function (playlist_tracks) {
            this.tracks = playlist_tracks;
            // AUTOSAVE
            this.save();
        },
        /**
         * MODELS.Playlist->_rebuild()
         * Update track positions and playlist duration
        **/
        _rebuild: function () {
            var duration = 0;
            $.each(this.tracks, function (index, item) {
                item.position = index + 1;
                if (typeof item.track.duration != 'undefined') {
                    duration += item.track.duration;
                }
            });
            this.duration = duration;
        },
        /**
         * Batch operations
        **/
        batch: false,
        start_batch: function () {
            this.batch = true;
        },
        stop_batch: function () {
            this.batch = false;
            // AUTOSAVE
            this.save();
        },
        /**
         * Playlist management
        **/
        set_name: function (name) {
            this.name = name;
            // AUTOSAVE
            this.save();
        },
        get_duration: function () {
            return UTIL.mmss(this.duration);
        },
        toString: function () {
            var duration = this.get_duration();
            if (duration) {
                duration = ' (' + duration + ')';
            }
            return this.name + duration;
        },
        render: function (element_name) {
            var element_name = element_name || 'li';
            if (!this.element) {
                this.element = $(
                    '<' + element_name + ' class="p" id="' + this.get_dom_id() + '">'
                  + '</' + element_name + '>'
                ).data('playlist', this);
            }
            this.element.html(this.toHTML());
        },
        get_dom_id: function () {
            return "p_" + this.id;
        },
        toHTML: function () {
            return this.toString();
        },
        /**
         * Track accessors
        **/
        get_track_by_id: function (playlist_track_id) {
            var that = this;
            var playlist_track;
            $.each(this.tracks, function (index, item) {
                if (item.id == playlist_track_id) {
                    playlist_track = item;
                    return false;
                }
            });
            return track;
        },
        get_track_at_position: function (position) {
            var index = position - 1;
            return this.tracks[index];
        },
        /**
         * Persistance
        **/
        save: function () {
            this._rebuild();
            
            if (this.options.onSave) {
                this.options.onSave.call(this);
            }
            
            if (!this.batch) {
                if (!this.saved && this.options.onCreate) {
                    this.options.onCreate.call(this);
                }
                this.saved = true;
                // TODO
                // Fire off AJAX request to persist Playlist
                // console.info('Saved', this);
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
        }
    };
    
    /**
     * class MODELS.PlaylistTrack
     * PlaylistTrack objects join a Playlist with a Track
     * and have a position and element
    **/
    var PlaylistTrack = function (playlist, track) {
        this.id = MODELS.next_playlist_track_id++;
        this.playlist = playlist;
        this.track = track;
        
        // Add to DOM
        this.render();
        this.element.appendTo(this.playlist.container);
    };
    PlaylistTrack.prototype = {
        remove: function () {
            // Remove from the DOM
            this.destroy();
            // Update playlist state
            this.playlist.remove_track(this);
        },
        /**
         * Render the PlaylistTrack to a DOMElement
        **/
        render: function (element_name) {
            var element_name = element_name || 'li';
            if (!this.element) {
                this.element = $(
                    '<' + element_name + ' class="p_t" id="' + this.get_dom_id() + '">'
                  + '</' + element_name + '>'
                ).data('playlist_track', this);
            }
            this.element.html(this.track.toHTML());
        },
        destroy: function () {
            this.element.remove();
        },
        get_dom_id: function () {
            return "p_t_" + this.playlist.id + '_' + this.id;
        },
        get_position: function () {
            return $.inArray(this, this.playlist.tracks) + 1;
        }
    };
    
    MODELS.Track = Track;
    MODELS.Playlist = Playlist;
    MODELS.PlaylistTrack = PlaylistTrack;
})();