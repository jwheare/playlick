/* Strings */
var STRINGS = {
    start_button_text: $('#add_track_button').val(),
    add_button_text: 'Add',
    edit_playlist_text: 'edit',
    cancel_edit_playlist_text: 'cancel',
    loading_flash_text: $('#playdar').html(),
    loading_flash_error_text: 'Flash player unavailable',
    loading_playdar_text: 'Checking for Playdar…',
    connect_to_playdar_text: 'Connect to Playdar',
    disconnect_from_playdar_text: 'Disconnect from Playdar',
    playdar_unavailable_text: '<a href="http://www.playdar.org/">Playdar unavailable</a>. <a href="#" onclick="$(\'#playdar\').html(STRINGS.loading_playdar_text); Playdar.client.go(); return false;">retry</a>',
    create_playlist_title: $('#playlistTitle').html(),
    loading_playlists_text: $('#loading_playlists').html()
};
