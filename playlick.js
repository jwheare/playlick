/**
 * PLAYLICK
 * Playlick global namespace
**/
var PLAYLICK = {
    next_playlist_id: 0,
    next_playlist_track_id: 0,
    mmss: function (secs) {
        var s = secs % 60;
        if (s < 10) {
            s = "0" + s;
        }
        return Math.floor(secs/60) + ":" + s;
    },
    load_playlist: function (tracks, container, options) {
        var playlist = new PLAYLICK.Playlist(container, options);
        playlist.start_batch();
        $.each(tracks, function (index, item) {
            new PLAYLICK.PlaylistTrack(playlist, item);
        });
        playlist.stop_batch();
        return playlist;
    }
};
(function () {
    /**
     * class PLAYLICK.Track
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
                return PLAYLICK.mmss(this.duration);
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
     * class PLAYLICK.Playlist
     * Playlist objects have a name, array of Tracks and duration
    **/
    var Playlist = function (container, options) {
        this.options = options || {};
        
        this.id = this.options.id || PLAYLICK.next_playlist_id++;
        this.container = $('#' + container);
        this.container.empty();
        var date = new Date();
        this.name = this.options.name || "Playlist: " + date.toLocaleString();
        this.tracks = [];
        this.duration = 0;
        this.published = false;
        this.saved = false;
        // console.info("New:", this.name, this.container);
    };
    Playlist.prototype = {
        /**
         * State management
        **/
        _remove_track_from_array: function (playlist_track) {
            var index = $.inArray(playlist_track, this.tracks);
            this.tracks.splice(index, 1);
        },
        _add_track: function (playlist_track) {
            this.tracks.push(playlist_track);
            // AUTOSAVE
            this.save();
            
            if (this.options.onAdd) {
                this.options.onAdd.call(this, playlist_track);
            }
        },
        _remove_track: function (playlist_track) {
            this._remove_track_from_array(playlist_track);
            // AUTOSAVE
            this.save();
        },
        _move_track: function (playlist_track, position) {
            var current_index = $.inArray(playlist_track, this.tracks);
            var index = position - 1;
            this._remove_track_from_array(playlist_track);
            this.tracks.splice(index, 0, playlist_track);
            // AUTOSAVE
            this.save();
        },
        /**
         * PLAYLICK.Playlist->_rebuild()
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
        get_duration: function () {
            return PLAYLICK.mmss(this.duration);
        },
        toString: function () {
            var duration = this.get_duration();
            if (duration) {
                duration = ' (' + duration + ')';
            }
            return this.name + duration;
        },
        get_dom_id: function () {
            return "p_" + this.id;
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
     * class PLAYLICK.PlaylistTrack
     * PlaylistTrack objects join a Playlist with a Track
     * and have a position and element
    **/
    var PlaylistTrack = function (playlist, track) {
        this.id = PLAYLICK.next_playlist_track_id++;
        this.playlist = playlist;
        this.track = track;
        
        // Add to DOM
        this.render();
        this.element.appendTo(this.playlist.container);
        // Update playlist state
        this.playlist._add_track(this);
        // console.info('Added:', this.position, this);
    };
    PlaylistTrack.prototype = {
        remove: function () {
            // Remove from the DOM
            this.destroy();
            // Update playlist state
            this.playlist._remove_track(this);
            // console.info('Removed:', this.position, this);
        },
        move_before: function (next_playlist_track) {
            // Calculate new position
            var current_position = this.position;
            var new_position = next_playlist_track.position;
            if (current_position < new_position) {
                new_position--;
            }
            if (new_position == current_position) {
                return false;
            }
            // Move in DOM
            next_playlist_track.element.before(this.element);
            // Update playlist state
            this.playlist._move_track(this, new_position);
            // console.info('Moved:', current_position + ' -> ' + this.position, this);
        },
        move_after: function (previous_playlist_track) {
            // Calculate new position
            var current_position = this.position;
            var new_position = previous_playlist_track.position;
            if (current_position > new_position) {
                new_position++;
            }
            if (new_position == current_position) {
                return false;
            }
            // Move in DOM
            previous_playlist_track.element.after(this.element);
            // Update playlist state
            this.playlist._move_track(this, new_position);
            // console.info('Moved:', current_position + ' -> ' + this.position, this);
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
    
    PLAYLICK.Track = Track;
    PLAYLICK.Playlist = Playlist;
    PLAYLICK.PlaylistTrack = PlaylistTrack;
})();