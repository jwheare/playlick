/**
 * class CONTROLLERS.Playlist
**/
function Playlist () {
    this.playlistSidebarElem = $('#playlists');
    this.loadingPlaylistsElem = $('#loading_playlists');
    this.titleElem = $('#playlistTitle');
    this.copyrightElem = $('span#playlistCopyright');
    this.sourceElem = $('#playlistSource');
    this.sourceLink = $('a#playlistSourceLink');
    this.trackListElem = $('#playlist');
    this.tracksLoadingElem = $('#tracksLoading');
    this.tracksErrorElem = $('#tracksError');
    this.footerElem = $('#listFooter');
    this.actionsElem = $('#listActions');
    this.applescriptLink = $('a#playlistApplescript');
    this.createLink = $('#create_playlist');
    this.addTrackButton = $('a#addTrackButton');
    this.addTrackCancel = $('a#addTrackCancel');
    this.addTrackTable = $('table#addTrackTable');
    this.addTrackForm = $('form#addTrackForm');
    this.addTrackSearchInput = $('input#addTrackSearchInput');
    
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
        this.titleElem.html(STRINGS.create_playlist_title);
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
        // Show add track details
        this.addTrackTable.show();
        // Show title
        this.showCreateTitle();
        // Hide playlist actions and footer
        this.footerElem.hide();
        this.actionsElem.hide();
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
            playlistItem = this.createLink.parent('li');
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
        // Hide add track details
        this.addTrackTable.hide();
        // Update the title
        this.updateTitle(playlist);
        // Update the copyright
        this.updateCopyright(playlist);
        // Update the source
        this.updateSource(playlist);
        // Show loading message
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
                    PLAYDAR.updateLoadProgress.call(nowPlayingSound);
                }
            });
            // Resolve tracks with Playdar
            PLAYDAR.resolve_current_playlist();
        } else {
            this.tracksErrorElem.show();
        }
        // Show playlist actions and footer
        this.footerElem.show();
        this.actionsElem.show();
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
                edit_input.focus().select();
            }, 1);
        }
    },
    updateTitle: function (playlist, title) {
        // Update playlist title
        if (title) {
            playlist.set_name(title);
        }
        // Update current title
        if (this.current == playlist) {
            this.titleElem.html(playlist.titleHTML());
        }
        // Update sidebar title
        playlist.element.find('a.playlist').text(UTIL.truncateString(playlist.toString()));
    },
    updateCopyright: function (playlist, copyright) {
        // Update playlist copyright
        if (copyright) {
            playlist.copyright = copyright;
            playlist.save();
        }
        // Update current copyright
        if (this.current == playlist) {
            this.copyrightElem.text(playlist.copyright || '');
        }
        
    },
    updateSource: function (playlist) {
        if (this.current == playlist) {
            if (playlist.source) {
                this.sourceLink
                    .attr('href', playlist.source)
                    .text(Playdar.Util.location_from_url(playlist.source).host);
                this.sourceElem.show();
            } else {
                this.sourceElem.hide();
            }
        }
    },
    // Update the playlist iTunes export AppleScript (when loading a playlist or saving)
    updateAppleScript: function () {
        this.applescriptLink.attr('href', this.current.toApplescript());
    },
    
    addTrack: function (artistName, trackName, albumName, url) {
        var track = new MODELS.Track({
            artist: artistName,
            name: trackName,
            album: albumName,
            url: url
        });
        var playlist_track = this.current.add_track(track);
        // Set the playlist name if this is the first track and we supplied an album
        if (albumName && playlist_track.get_position() == 1) {
            var playlistName = albumName;
            if (artistName) {
                playlistName = artistName + ' - ' + playlistName;
            }
            // Autosaves
            this.updateTitle(this.current, playlistName);
        } else {
            // Update title display
            this.updateTitle(this.current);
            // Save
            this.current.save();
        }
        // Add the track to the playlist in the DOM
        this.trackListElem.append(playlist_track.element);
        // Show playlist actions and footer
        this.footerElem.show();
        this.actionsElem.show();
        // Resolve
        PLAYDAR.resolve_track(playlist_track);
    },
    
    /* DELETE */
    remove: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.name)) {
            playlist.remove();
        }
    }
};