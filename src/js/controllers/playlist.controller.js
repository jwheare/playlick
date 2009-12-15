/**
 * class CONTROLLERS.Playlist
**/
function Playlist () {
    this.playlistSidebarElem = $('#playlists');
    this.loadingPlaylistsElem = $('#loading_playlists');
    this.createTitleElem = $('#createPlaylist');
    this.headerElem = $('#playlistHeader');
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
        this.headerElem.hide();
        this.createTitleElem.show();
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
        // Metadata
        this.hideMetadata();
        // Show add track details
        this.addTrackTable.show();
    },
    
    onCreate: function (playlist) {
        // Add to sidebar
        this.playlistSidebarElem.append(playlist.element);
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
        // Load metadata
        this.loadMetadata();
        // Load tracks
        this.loadTracks();
    },
    
    loadMetadata: function () {
        // Header
        this.loadHeader();
        // Footer
        this.loadFooter();
    },
    hideMetadata: function () {
        // Header
        this.showCreateTitle();
        // Footer
        this.hideFooter();
    },
    
    loadHeader: function () {
        this.createTitleElem.hide();
        this.buildHeaderElem();
    },
    buildHeaderElem: function () {
        this.headerElem.html(this.buildEditElem());
        this.headerElem.append(this.buildMetadataElem());
        this.headerElem.append(this.buildEditForm());
        this.headerElem.show();
    },
    buildEditElem: function () {
        var that = this;
        var editButton = $('<a href="#">')
            .append($('<img>')
                .attr('src', 'pencil.png')
                .attr('width', 16)
                .attr('height', 16)
                .attr('alt', 'Edit'))
            .click(function (e) {
                e.preventDefault();
                that.toggleEditForm();
            });
        var deleteButton = $('<a href="#">')
            .append($('<img>')
                .attr('src', 'bin_closed.png')
                .attr('width', 16)
                .attr('height', 16)
                .attr('alt', 'Delete'))
            .click(function (e) {
                e.preventDefault();
                that.removeCurrent();
            });
        this.editButtons = $('<div id="playlistEdit">')
            .append(editButton)
            .append(' ')
            .append(deleteButton);
        return this.editButtons;
    },
    buildMetadataElem: function () {
        this.metadataElem = $('<div id="playlistMetadata">');
        // Add an image
        if (this.current.image) {
            this.metadataElem.append($('<img class="image">').attr('src', this.current.image));
        }
        
        var title = $('<h1>');
        var titleText = this.current.toString();
        if (this.current.url) {
            title.append(
                $('<a>').attr('href', this.current.url).text(titleText)
            );
        } else {
            title.text(titleText);
        }
        this.metadataElem.append(title);
        
        if (this.current.subtitle) {
            this.metadataElem.append($('<p class="subtitle">').text(this.current.subtitle));
        }
        if (this.current.description) {
            // Autolink description
            var escapedDescription = $('<div>').html(this.current.description).text();
            var description = $('<p class="description">').html(UTIL.autoLink(escapedDescription));
            this.metadataElem.append(description);
        }
        return this.metadataElem;
    },
    buildEditField: function (inputId, name, label, value) {
        return $('<p class="field">')
            .append($('<label>')
                .attr('for', inputId)
                .text(label))
            .append('<br>')
            .append($('<input type="text">')
                .attr('id', inputId)
                .attr('name', name)
                .val(value));
    },
    buildEditForm: function () {
        var that = this;
        this.editForm = $('<form id="playlistEditForm">').hide().submit(function (e) {
            e.preventDefault();
            var params = UTIL.serializeForm(this);
            that.current.name        = params.title;
            that.current.url         = params.url;
            that.current.subtitle    = params.subtitle;
            that.current.description = params.description;
            that.current.image       = params.image;
            that.current.copyright   = params.copyright;
            that.current.save();
        });
        var editSave = $('<p class="submit">')
            .append($('<input type="submit">').val('Save'))
            .append(' or ')
            .append($('<a href="#">').text('Cancel').click(function (e) {
                e.preventDefault();
                that.toggleEditForm();
            }));
        this.editForm
            .append(this.buildEditField('playlistEditTitle',       'title',       'Title',       this.current.toString()))
            .append(this.buildEditField('playlistEditUrl',         'url',         'Info URL',    this.current.url))
            .append(this.buildEditField('playlistEditSubtitle',    'subtitle',    'Subtitle',    this.current.subtitle))
            .append(this.buildEditField('playlistEditDescription', 'description', 'Description', this.current.description))
            .append(this.buildEditField('playlistEditImage',       'image',       'Image URL',   this.current.image))
            .append(this.buildEditField('playlistEditCopyright',   'copyright',   'Copyright',   this.current.copyright))
            .append(editSave);
        return this.editForm;
    },
    
    loadFooter: function () {
        this.loadCopyright();
        this.loadSource();
        this.footerElem.show();
        this.loadAppleScript();
        this.actionsElem.show();
    },
    hideFooter: function () {
        this.footerElem.hide();
        this.actionsElem.hide();
    },
    loadCopyright: function () {
        var escapedCopyright = $('<div>').html(this.current.copyright).text();
        this.copyrightElem.html(UTIL.autoLink(escapedCopyright) || '');
    },
    loadSource: function () {
        if (this.current.source) {
            this.sourceLink
                .attr('href', this.current.source)
                .text(Playdar.Util.location_from_url(this.current.source).host);
            this.sourceElem.show();
        } else {
            this.sourceElem.hide();
        }
    },
    // Update the playlist iTunes export AppleScript (when loading a playlist or saving)
    loadAppleScript: function () {
        this.applescriptLink.attr('href', this.current.toApplescript());
    },
    
    loadTracks: function () {
        // Show loading message
        this.tracksLoadingElem.show();
        // Hide error message
        this.tracksErrorElem.hide();
        // Load tracks
        var elements = this.current.load();
        this.tracksLoadingElem.hide();
        if (elements) {
            // Add to the DOM
            this.trackListElem.append(elements);
            // Set loading/playback progress bars correctly
            setTimeout(function () {
                var nowPlayingSound = Playdar.player.getNowPlaying();
                if (nowPlayingSound) {
                    PLAYDAR.updatePlaybackProgress.call(nowPlayingSound);
                    PLAYDAR.updateLoadProgress.call(nowPlayingSound);
                }
            });
            // Resolve tracks with Playdar
            PLAYDAR.resolve_current_playlist();
            // Show SM2 if the current playing track is in this playlist
            if (this.playingTrack && this.playingTrack.playlist === this.current) {
                PLAYDAR.showSM2Container();
            }
        } else {
            this.tracksErrorElem.show();
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
            });
        }
    },
    toggleEditForm: function () {
        this.metadataElem.toggle();
        this.editForm.toggle();
        setTimeout(function () {
            $('#playlistEditTitle').focus().select();
        });
    },
    updateSidebarTitle: function (playlist) {
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
            this.loadCopyright();
        }
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
            this.current.name = playlistName;
        }
        // Save
        this.current.save();
        // Add the track to the playlist in the DOM
        this.trackListElem.append(playlist_track.element);
        // Show playlist actions and footer
        this.loadFooter();
        // Resolve
        PLAYDAR.resolve_track(playlist_track);
    },
    
    onSave: function (playlist) {
        if (playlist == this.current) {
            this.loadMetadata();
            this.updateSidebarTitle(playlist);
            PLAYDAR.showSM2Container();
        }
    },
    
    /* UNLOAD */
    onUnload : function (playlist) {
        PLAYDAR.hideSM2Container();
    },
    
    /* DELETE */
    remove: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.name)) {
            playlist.remove();
            return true;
        }
        return false;
    },
    removeCurrent: function () {
        return this.remove(this.current);
    },
    
    onDelete: function (playlist) {
        if (playlist == this.current) {
            this.create();
        }
        if (this.playingTrack && playlist == this.playingTrack.playlist) {
            PLAYDAR.stopPlaySession();
        }
    }
};
