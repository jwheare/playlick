/**
 * class CONTROLLERS.Playlist
**/
function Playlist () {
    this.playlistTitleElem = $('#playlistTitle');
    this.trackListElem = $('#playlist');
    this.tracksLoadingElem = $('#tracksLoading');
    this.tracksErrorElem = $('#tracksError');
    this.listActionsElem = $('#listActions');
    this.applescriptLink = $('a#playlistApplescript');
    this.addTrackButton = $('input#add_track_button');
    this.addTrackInput = $('input#add_track_input');
    
    this.current = null;
}
Playlist.prototype = {
    showCreateTitle: function () {
        this.playlistTitleElem.html(STRINGS.create_playlist_title);
    },
    updateTitle: function () {
        this.playlistTitleElem.html(this.current.titleHTML());
    },
    // Update the playlist iTunes export AppleScript (when loading a playlist or saving)
    updateAppleScript: function () {
        this.applescriptLink.attr('href', this.current.toApplescript());
    },
    
    create: function () {
        // Cancel Playdar
        PLAYDAR.cancel_playdar_resolve();
        // Update current sidebar item
        PLAYLICK.set_current_playlist_item($('#create_playlist').parent('li'));
        // Reset the playlist view
        this.trackListElem.empty();
        // Hide playlist actions
        this.listActionsElem.hide();
        // Show title
        this.showCreateTitle();
        // Reset add track button
        this.addTrackButton.val(STRINGS.start_button_text);
        // Select input
        setTimeout(function () {
            CONTROLLERS.Playlist.addTrackInput.select();
        }, 1);
        // Create the playlist object
        
        this.current = new MODELS.Playlist();
        PLAYLICK.registerPlaylist(this.current);
    }
};