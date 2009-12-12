/**
 * class CONTROLLERS.Playlist
**/
function Playlist () {
    this.playlistSidebarElem = $('#playlists');
    this.loadingPlaylistsElem = $('#loading_playlists');
    this.playlistTitleElem = $('#playlistTitle');
    this.trackListElem = $('#playlist');
    this.tracksLoadingElem = $('#tracksLoading');
    this.tracksErrorElem = $('#tracksError');
    this.listActionsElem = $('#listActions');
    this.applescriptLink = $('a#playlistApplescript');
    this.addTrackButton = $('input#add_track_button');
    this.addTrackInput = $('input#add_track_input');
    
    this.current = null;
    this.playingTrack = null;
    this.fetchAllDone = false;
}
Playlist.prototype = {
    register: function (playlist) {
        // May be needed later. See how MVC stuff goes
    },
    
    /* COUCHDB */
    couchDownHandler: function (action, result) {
        if (PLAYLICK.debug) {
            var message = "couchdb unavailable";
            if (result.error && result.error != 'unknown') {
                message = result.error+': '+result.reason;
            }
            console.warn('['+action+'] '+message);
            console.warn(result);
        }
        
        this.loadingPlaylistsElem
            .addClass('unavailable')
            .html(
                '<b>Database unavailable.</b>'
                + '<br>Your changes will not be saved. '
                + '<a href="#" onclick="CONTROLLERS.Playlist.retryCouch(); return false;">retry</a>'
            )
            .show();
    },
    couchUpHandler: function (action, response) {
        this.loadingPlaylistsElem.hide();
        this.tracksErrorElem.hide();
    },
    retryCouch: function () {
        this.loadingPlaylistsElem
            .removeClass('unavailable')
            .html(STRINGS.loading_playlists_text)
            .show();
        this.fetchAll();
    },
    
    /* CREATE */
    showCreateTitle: function () {
        this.playlistTitleElem.html(STRINGS.create_playlist_title);
    },
    
    create: function () {
        // Cancel Playdar
        PLAYDAR.cancel_playdar_resolve();
        // Unload current playlist
        if (this.current) {
            this.current.unload();
        }
        // Set a new current playlist
        this.setCurrent();
        // Show title
        this.showCreateTitle();
        // Hide playlist actions
        this.listActionsElem.hide();
        // Reset add track button
        this.addTrackButton.val(STRINGS.start_button_text);
        // Focus/select add track input
        var that = this;
        setTimeout(function () {
            that.addTrackInput.select();
        });
    },
    
    /* RETRIEVE */
    // Fetch playlists from Couch
    fetchAll: function () {
        if (this.fetchAllDone) {
            MODELS.stat_couch();
        } else {
            var elements = [];
            var that = this;
            var playlists = MODELS.Playlist.fetchAll(function callback (playlist) {
                that.register(playlist);
                elements.push(playlist.element.get()[0]);
            });
            this.playlistSidebarElem.append(elements);
            if (typeof playlists !== 'undefined') {
                this.fetchAllDone = true;
            }
        }
    },
    
    // Highlight the current playlist in the sidebar
    setCurrent: function (playlist) {
        var playlistItem;
        if (playlist) {
            this.current = playlist;
            playlistItem = playlist.element;
        } else {
            // Create the playlist object
            this.current = new MODELS.Playlist();
            this.register(this.current);
            playlistItem = $('#create_playlist').parent('li');
        }
        // Update the sidebar
        this.playlistSidebarElem.find('li').removeClass('current');
        playlistItem.addClass('current');
    },
    // Highlight the currently playing playlist in the sidebar
    setPlaying: function (playlist_track) {
        // Update the now playing track
        this.playingTrack = playlist_track;
        // Remove the current highlight from the sidebar
        this.playlistSidebarElem.find('li.p').removeClass('playing');
        if (playlist_track) {
            // Add a new highlight
            playlist_track.playlist.element.addClass('playing');
        }
    },
    
    // Load a playlist from the sidebar
    loadItem: function (playlistItem) {
        this.load(playlistItem.data('playlist'));
    },
    load: function (playlist) {
        // Cancel Playdar
        PLAYDAR.cancel_playdar_resolve();
        // Unload the current playlist
        if (this.current) {
            this.current.unload();
        }
        // Update the current playlist object
        this.setCurrent(playlist);
        // Update the title
        this.updateTitle();
        // Switch the add track button text
        this.addTrackButton.val(STRINGS.add_button_text);
        this.tracksLoadingElem.show();
        // Hide error message
        this.tracksErrorElem.hide();
        // Load tracks
        var elements = this.current.load();
        // Update the AppleScript link
        this.updateAppleScript();
        this.tracksLoadingElem.hide();
        if (elements) {
            // Add to the DOM
            this.trackListElem.append(elements);
            setTimeout(function () {
                var nowPlayingSound = Playdar.player.getNowPlaying();
                if (nowPlayingSound) {
                    PLAYDAR.updatePlaybackProgress.call(nowPlayingSound);
                }
            });
            // Resolve tracks with Playdar
            PLAYDAR.resolve_current_playlist();
        } else {
            this.tracksErrorElem.show();
        }
        // Show playlist actions
        this.listActionsElem.show();
        // Show SM2
        if (this.playingTrack && this.playingTrack.playlist === this.current) {
            PLAYDAR.showSM2Container();
        }
    },
    
    /* UPDATE */
    // Show/hide edit mode for playlist in sidebar
    toggleSidebarEditName: function (playlist_item) {
        // Toggle playlist link and form
        playlist_item.find('a.playlist').toggle();
        playlist_item.find('form.edit_playlist_form').toggle();
        // Update button
        var button = playlist_item.find('a.edit_playlist');
        if (button.html() == STRINGS.cancel_edit_playlist_text) {
            button.html(STRINGS.edit_playlist_text);
        } else {
            button.html(STRINGS.cancel_edit_playlist_text);
            // Update input and select
            var edit_input = playlist_item.find('input.playlist_name');
            edit_input.val(playlist_item.data('playlist').name);
            setTimeout(function () {
                edit_input.select();
            }, 1);
        }
    },
    updateTitle: function () {
        this.playlistTitleElem.html(this.current.titleHTML());
    },
    // Update the playlist iTunes export AppleScript (when loading a playlist or saving)
    updateAppleScript: function () {
        this.applescriptLink.attr('href', this.current.toApplescript());
    },
    
    addTrack: function (artistName, trackName) {
        var track = new MODELS.Track({
            artist: artistName,
            name: trackName
        });
        var playlist_track = this.current.add_track(track);
        this.current.save();
        this.trackListElem.append(playlist_track.element);
        // Change the start button to add
        this.addTrackButton.val(STRINGS.add_button_text);
        // Show playlist actions
        this.listActionsElem.show();
        PLAYDAR.resolve_track(playlist_track);
    },
    
    /* DELETE */
    remove: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.name)) {
            playlist.remove();
        }
    }
};