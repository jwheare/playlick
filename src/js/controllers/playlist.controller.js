/**
 * class CONTROLLERS.Playlist
**/
function Playlist () {
    this.playlistSidebarLists = $('.playlists');
    this.playlistsSidebarList = $('#playlists');
    this.albumsSidebarTitleElem = $('h1#albumsTitle');
    this.albumsSidebarList = $('#albums');
    this.subscriptionsSidebarTitleElem = $('h1#subscriptionsTitle');
    this.subscriptionsSidebarList = $('#subscriptions');
    this.synchedSidebarTitleElem = $('h1#synchedTitle');
    this.synchedSidebarList = $('#synched');
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
    this.mainImporters = $('#mainImporters');
    
    this.current = null;
    this.playingTrack = null;
    this.fetchAllDone = false;
}
Playlist.prototype = {
    register: function (playlist) {
        playlist.save();
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
        // Set a new current playlist
        this.setCurrent();
        // Metadata
        this.hideMetadata();
        // Show add track details
        this.addTrackTable.show();
    },
    
    onCreate: function (playlist) {
        // Add to sidebar
        if (playlist.isAlbum()) {
            this.albumsSidebarList.append(playlist.element);
            this.albumsSidebarTitleElem.show();
        } else if (playlist.isSynched()) {
            this.synchedSidebarList.append(playlist.element);
            this.synchedSidebarTitleElem.show();
        } else if (playlist.isSubscription()) {
            this.subscriptionsSidebarList.append(playlist.element);
            this.subscriptionsSidebarTitleElem.show();
        } else {
            this.playlistsSidebarList.append(playlist.element);
        }
    },
    
    /* RETRIEVE */
    // Fetch playlists from Couch
    fetchAll: function () {
        if (this.fetchAllDone) {
            MODELS.stat_couch();
        } else {
            var playlistElements = [];
            var albumElements = [];
            var synchedElements = [];
            var subscriptionElements = [];
            var that = this;
            var playlists = MODELS.Playlist.fetchAll(function callback (playlist) {
                that.checkSubscription(playlist);
                var element = playlist.element.get()[0];
                if (playlist.isAlbum()) {
                    albumElements.push(element);
                } else if (playlist.isSynched()) {
                    synchedElements.push(element);
                } else if (playlist.isSubscription()) {
                    subscriptionElements.push(element);
                } else {
                    playlistElements.push(element);
                }
            });
            if (playlistElements.length) {
                this.playlistsSidebarList.append(playlistElements);
            }
            if (subscriptionElements.length) {
                this.subscriptionsSidebarTitleElem.show();
                this.subscriptionsSidebarList.append(subscriptionElements);
            }
            if (synchedElements.length) {
                this.synchedSidebarTitleElem.show();
                this.synchedSidebarList.append(synchedElements);
            }
            if (albumElements.length) {
                this.albumsSidebarTitleElem.show();
                this.albumsSidebarList.append(albumElements);
            }
            if (playlists === undefined) {
                this.fetchAllDone = true;
            }
        }
    },
    
    // Highlight the current playlist in the sidebar
    setCurrent: function (playlist) {
        // Unload any current playlist
        if (this.current && this.current != playlist) {
            this.current.unload();
        }
        var playlistItem;
        if (playlist) {
            this.current = playlist;
            playlistItem = playlist.element;
            // Update metadata and update sidebar
            this.loadMetadata();
            this.updateSidebarTitle(playlist);
        } else {
            // Create the playlist object
            this.current = new MODELS.Playlist();
            playlistItem = this.createLink.parent('li');
        }
        // Update the sidebar
        this.playlistSidebarLists.find('li').removeClass('current');
        playlistItem.addClass('current');
    },
    // Highlight the currently playing playlist in the sidebar
    setPlaying: function (playlist_track) {
        // Update the now playing track
        this.playingTrack = playlist_track;
        // Remove the current highlight from the sidebar
        this.playlistSidebarLists.find('li.p').removeClass('playing');
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
        if (this.current == playlist) {
            // Already loaded, just resolve
            PLAYDAR.resolve_current_playlist();
            return;
        }
        // Cancel Playdar
        PLAYDAR.cancel_playdar_resolve();
        // Update the current playlist object
        this.setCurrent(playlist);
        // Hide add track details
        this.addTrackTable.hide();
        // Hide footer and add track form while loading tracks
        this.hideFooter();
        this.addTrackForm.hide();
        // Load tracks
        this.loadTracks();
        // Show footer and add track form again
        this.showFooter();
        if (playlist.isEditable()) {
            this.addTrackForm.show();
        }
    },
    
    loadMetadata: function () {
        // Header
        this.loadHeader();
        // Footer
        this.loadFooter();
        // Hide main importers
        this.mainImporters.hide();
    },
    hideMetadata: function () {
        // Header
        this.showCreateTitle();
        // Footer
        this.hideFooter();
        // Show add track form
        this.addTrackForm.show();
        // Show main importers
        this.mainImporters.show();
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
    buildEditField: function (inputId, name, label, value, textarea) {
        var field = $('<p class="field">')
            .append($('<label>')
                .attr('for', inputId)
                .text(label))
            .append('<br>');
        if (textarea) {
            field.append($('<textarea>')
                .attr('rows', 5)
                .attr('id', inputId)
                .attr('name', name)
                .text(value));
        } else {
            field.append($('<input type="text">')
                .attr('id', inputId)
                .attr('name', name)
                .val(value));
        }
        return field;
    },
    buildEditForm: function () {
        var that = this;
        this.editForm = $('<form id="playlistEditForm">').hide().submit(function (e) {
            e.preventDefault();
            var params = UTIL.serializeForm(this);
            that.current.title        = params.title;
            that.current.url         = params.url;
            that.current.subtitle    = params.subtitle;
            that.current.description = params.description;
            that.current.image       = params.image;
            that.current.copyright   = params.copyright;
            that.current.save();
        }).keydown(function (e) {
            if (e.keyCode == 27) {
                that.toggleEditForm();
            }
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
            .append(this.buildEditField('playlistEditDescription', 'description', 'Description', this.current.description, true))
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
    showFooter: function () {
        this.footerElem.show();
        this.actionsElem.show();
    },
    loadCopyright: function () {
        var escapedCopyright = $('<div>').html(this.current.copyright).text();
        var copyright = UTIL.autoLink(escapedCopyright);
        this.copyrightElem.html(copyright ? '© ' + copyright : '');
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
            // Enable/disable sortable
            if (this.current.isEditable()) {
                this.trackListElem.sortable('enable');
            } else {
                this.trackListElem.sortable('disable');
            }
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
            edit_input.val(playlist_item.data('playlist').toString());
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
        playlist.element.find('a.playlist span').text(UTIL.truncateString(playlist.toString()));
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
            this.current.title = playlistName;
        }
        // Save
        this.current.save();
        // Add the track to the playlist in the DOM
        this.trackListElem.append(playlist_track.element);
        // Resolve
        PLAYDAR.resolve_track(playlist_track);
    },
    
    onSave: function (playlist) {
        if (playlist == this.current) {
            this.setCurrent(playlist);
            PLAYDAR.showSM2Container();
        }
    },
    
    /* SUBSCRIPTIONS */
    subscriptionQueue: 0,
    synchedQueue: 0,
    queueSync: function (playlist) {
        if (playlist.isSynched()) {
            this.synchedQueue++;
            this.synchedSidebarTitleElem.addClass('progress');
        } else {
            this.subscriptionQueue++;
            this.subscriptionsSidebarTitleElem.addClass('progress');
        }
    },
    consumeSyncQueue: function (playlist) {
        if (playlist.isSynched()) {
            this.synchedQueue--;
            if (!this.synchedQueue) {
                this.synchedSidebarTitleElem.removeClass('progress');
            }
        } else {
            this.subscriptionQueue--;
            if (!this.subscriptionQueue) {
                this.subscriptionsSidebarTitleElem.removeClass('progress');
            }
        }
    },
    checkSubscription: function (playlist) {
        if (!playlist.isSubscription()) {
            // Not a subscription
            return;
        }
        var sub = playlist.subscription;
        // Make a copy of the args so we don't modify the original
        var args = sub.arguments.slice();
        // Add callback and exception handler to the arguments
        var that = this;
        args.push(function callback (newPlaylist) {
            // compare with saved playlist and update/warn for conflicts?
            var diff = playlist.diffTracks(newPlaylist);
            var added = [];
            for (var field in diff) {
                if (diff[field].change === true) {
                    added.push(diff[field].track);
                }
            }
            if (added.length) {
                playlist.setLastSyncDate();
                if (playlist.isSynched()) {
                    playlist.reset_tracks(newPlaylist.tracks);
                    playlist.reload();
                } else {
                    // Prepend the new tracks
                    UTIL.sortByMethod(added, 'get_position', true);
                    $.each(added, function (i, playlist_track) {
                        playlist.add_track(playlist_track.track, {
                            unplayed: true
                        }, true);
                    });
                    playlist.save();
                }
                playlist.element.find('.playlist').effect('highlight', {
                    color: '#6ea31e'
                }, 100);
                // TODO message that shit
            }
            that.consumeSyncQueue(playlist);
        });
        args.push(function exceptionHandler (exception) {
            // show a warning icon and message?
            // console.warn(exception);
            exception.diagnose();
            that.consumeSyncQueue(playlist);
        });
        this.queueSync(playlist);
        // console.log(playlist.toString(), playlist.lastSync ? playlist.lastSync.toLocaleString() : '');
        IMPORTERS[sub.namespace][sub.method].apply(this, args);
    },
    
    /* UNLOAD */
    onUnload : function (playlist) {
        PLAYDAR.hideSM2Container();
    },
    
    /* DELETE */
    remove: function (playlist) {
        if (confirm('Are you sure you want to delete this playlist:\n\n' + playlist.toString())) {
            playlist.remove();
            return true;
        }
        return false;
    },
    removeCurrent: function () {
        return this.remove(this.current);
    },
    
    onDelete: function (playlist) {
        if (this.playingTrack && playlist == this.playingTrack.playlist) {
            PLAYDAR.stopPlaySession();
        }
        if (playlist.isAlbum()) {
            if (!this.albumsSidebarList.find('li').size()) {
                this.albumsSidebarTitleElem.hide();
            }
        } else if (playlist.isSynched()) {
            if (!this.synchedSidebarList.find('li').size()) {
                this.synchedSidebarTitleElem.hide();
            }
        } else if (playlist.isSubscription()) {
            if (!this.subscriptionsSidebarList.find('li').size()) {
                this.subscriptionsSidebarTitleElem.hide();
            }
        }
        if (playlist == this.current) {
            this.create();
        }
    }
};
