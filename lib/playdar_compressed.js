Playdar={VERSION:"0.4.2",SERVER_ROOT:"localhost",SERVER_PORT:"8888",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_POPUP_NAME:"PD_auth",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"PD_queries",QUERIES_POPUP_SIZE:{"w":640,"h":700},REFRESH_INTERVAL:null,MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,USE_SCROBBLER:true,client:null,status_bar:null,player:null,setup:function(_1){
new Playdar.Client(_1);
new Playdar.Boffin();
},setup_player:function(_2){
new Playdar.Player(_2);
}};
Playdar.DefaultListeners={onStat:function(_3){
if(_3){
}else{
}
},onAuth:function(){
},onAuthClear:function(){
},onResults:function(_4,_5){
if(_5){
if(_4.results.length){
}else{
}
}else{
}
},onTagCloud:function(_6){
},onRQL:function(_7){
},onResolveIdle:function(){
}};
Playdar.Client=function(_8,_9){
Playdar.client=this;
this.auth_token=false;
this.auth_popup=null;
this.listeners={};
this.results_handlers={};
this.resolve_qids=[];
this.last_qid="";
this.poll_counts={};
this.initialise_resolve();
this.auth_details=_8;
this.register_listeners(Playdar.DefaultListeners);
this.register_listeners(_9);
this.uuid=Playdar.Util.generate_uuid();
};
Playdar.Client.prototype={register_listener:function(_a,_b){
_b=_b||Playdar.Util.null_callback;
this.listeners[_a]=function(){
return _b.apply(Playdar.client,arguments);
};
},register_listeners:function(_c){
if(!_c){
return;
}
for(var _d in _c){
this.register_listener(_d,_c[_d]);
}
return true;
},register_results_handler:function(_e,_f){
if(_f){
this.results_handlers[_f]=_e;
}else{
this.register_listener("onResults",_e);
}
},init:function(){
if(!this.auth_token){
this.auth_token=Playdar.Util.getcookie("auth");
}
this.stat();
},stat:function(){
setTimeout(function(){
Playdar.client.check_stat_timeout();
},Playdar.STAT_TIMEOUT);
Playdar.Util.loadjs(this.get_url("stat","handle_stat"));
},check_stat_timeout:function(){
if(!this.stat_response||this.stat_response.name!="playdar"){
this.listeners.onStat(false);
}
},handle_stat:function(_10){
this.stat_response=_10;
if(Playdar.USE_STATUS_BAR){
new Playdar.StatusBar();
Playdar.status_bar.handle_stat(_10);
}
this.listeners.onStat(_10);
if(_10.authenticated){
this.listeners.onAuth();
}else{
if(this.auth_token){
this.clear_auth();
}
}
},clear_auth:function(){
if(Playdar.player){
Playdar.player.stop_all();
}
Playdar.Util.loadjs(this.get_revoke_url());
this.auth_token=false;
Playdar.Util.deletecookie("auth");
this.listeners.onAuthClear();
if(Playdar.status_bar){
Playdar.status_bar.offline();
}
},is_authed:function(){
if(this.auth_token){
return true;
}
return false;
},get_revoke_url:function(){
return this.get_base_url("/settings/auth/",{revoke:this.auth_token});
},get_auth_url:function(){
return this.get_base_url("/auth_1/",this.auth_details);
},get_auth_link_html:function(_11){
_11=_11||"Connect";
var _12="<a href=\""+this.get_auth_url()+"\" target=\""+Playdar.AUTH_POPUP_NAME+"\" onclick=\"Playdar.client.start_auth(); return false;"+"\">"+_11+"</a>";
return _12;
},get_disconnect_link_html:function(_13){
_13=_13||"Disconnect";
var _14="<a href=\""+this.get_base_url("/settings/auth/")+"\" onclick=\"Playdar.client.clear_auth(); return false;"+"\">"+_13+"</a>";
return _14;
},start_auth:function(){
if(!this.auth_popup||this.auth_popup.closed){
this.auth_popup=window.open(this.get_auth_url(),Playdar.AUTH_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE));
}else{
this.auth_popup.focus();
}
if(!this.auth_details.receiverurl){
if(Playdar.status_bar){
Playdar.status_bar.start_manual_auth();
}
}
},auth_callback:function(_15){
Playdar.Util.setcookie("auth",_15,365);
if(this.auth_popup&&!this.auth_popup.closed){
this.auth_popup.close();
this.auth_popup=null;
}
this.auth_token=_15;
this.stat();
},manual_auth_callback:function(_16){
var _17=document.getElementById(_16);
if(_17&&_17.value){
this.auth_callback(_17.value);
}
},parse_microformats:function(_18){
var _19=[];
var _1a=Playdar.Util.select(".haudio",_18);
for(var i=0;i<_1a.length;i++){
var _1c=_1a[i];
var _1d=Playdar.Util.select(".contributor",_1c);
var _1e=Playdar.Util.select(".fn",_1c);
if(_1e[0]&&_1d[0]){
var _1f={"artist":_1d[0].title||_1d[0].innerHTML,"name":_1e[0].title||_1e[0].innerHTML,"element":_1c};
_19.push(_1f);
}
}
return _19;
},autodetect:function(_20,_21){
var _22,qid;
var _24=this.parse_microformats(_21);
for(var i=0;i<_24.length;i++){
_22=_24[i];
if(_20){
qid=_20(_22);
}
Playdar.client.resolve(_22.artist,"",_22.name,qid);
}
},resolve:function(_26,_27,_28,qid,url){
var _2b={artist:_26||"",album:_27||"",track:_28||"",url:url||"",qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_2b);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _2c=this.resolution_queue.length+this.resolutions_in_progress.count;
if(_2c){
var _2d=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_2d;i++){
var _2f=this.resolution_queue.shift();
if(!_2f){
break;
}
this.resolutions_in_progress.queries[_2f.qid]=_2f;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_2f));
}
}else{
this.listeners.onResolveIdle();
}
},cancel_resolve:function(){
this.initialise_resolve();
if(Playdar.status_bar){
Playdar.status_bar.cancel_resolve();
}
},initialise_resolve:function(){
this.resolution_queue=[];
this.resolutions_in_progress={count:0,queries:{}};
},recheck_results:function(qid){
var _31={qid:qid};
this.resolutions_in_progress.queries[qid]=_31;
this.resolutions_in_progress.count++;
this.handle_resolution(_31);
},handle_resolution:function(_32){
if(this.resolutions_in_progress.queries[_32.qid]){
this.last_qid=_32.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_32.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_34,_35,_36){
var _37=this.should_stop_polling(_34);
_36=_36||this;
if(!_37){
setTimeout(function(){
_35.call(_36,_34.qid);
},Playdar.REFRESH_INTERVAL||_34.refresh_interval);
}
return _37;
},should_stop_polling:function(_38){
if(_38.refresh_interval<=0){
return true;
}
if(_38.query.solved==true){
return true;
}
if(this.poll_counts[_38.qid]>=4){
return true;
}
return false;
},handle_results:function(_39){
if(this.resolutions_in_progress.queries[_39.qid]){
var _3a=this.poll_results(_39,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_39,_3a);
}
if(this.results_handlers[_39.qid]){
this.results_handlers[_39.qid](_39,_3a);
}else{
this.listeners.onResults(_39,_3a);
}
if(_3a){
delete this.resolutions_in_progress.queries[_39.qid];
this.resolutions_in_progress.count--;
this.process_resolution_queue();
}
}
},get_last_results:function(){
if(this.last_qid){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.get_results(this.last_qid);
}
},get_base_url:function(_3b,_3c){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_3b){
url+=_3b;
}
if(_3c){
url+="?"+Playdar.Util.toQueryString(_3c);
}
return url;
},get_url:function(_3e,_3f,_40){
_40=_40||{};
_40.call_id=new Date().getTime();
_40.method=_3e;
if(!_40.jsonp){
if(_3f.join){
_40.jsonp=_3f.join(".");
}else{
_40.jsonp=this.jsonp_callback(_3f);
}
}
this.add_auth_token(_40);
return this.get_base_url("/api/",_40);
},add_auth_token:function(_41){
if(this.auth_token){
_41.auth=this.auth_token;
}
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_43){
return "Playdar.client."+_43;
},list_results:function(_44){
for(var i=0;i<_44.results.length;i++){
console.log(_44.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_46,_47){
_47=_47||{};
_47.jsonp=_47.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_47);
return Playdar.client.get_base_url("/boffin/"+_46,_47);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_48){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_48.qid);
Playdar.client.get_results(_48.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_4b){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_4b.qid);
Playdar.client.get_results(_4b.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_4c,_4d){
_4d=_4d||{};
_4d.jsonp=_4d.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_4d);
return Playdar.client.get_base_url("/audioscrobbler/"+_4c,_4d);
},start:function(_4e,_4f,_50,_51,_52,_53){
var _54={a:_4e,t:_4f,o:"P"};
if(_50){
_54["b"]=_50;
}
if(_51){
_54["l"]=_51;
}
if(_52){
_54["n"]=_52;
}
if(_53){
_54["m"]=_53;
}
Playdar.Util.loadjs(this.get_url("start",_54));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_options:function(_55,_56){
var _57=this;
return {onplay:function(){
_57.start(_55.artist,_55.track,_55.album,_55.duration);
Playdar.Util.apply_property_function(_56,"onplay",this,arguments);
},onbufferchange:function(){
if(this.isBuffering){
_57.pause();
}else{
_57.resume();
}
Playdar.Util.apply_property_function(_56,"onbufferchange",this,arguments);
},onpause:function(){
_57.pause();
Playdar.Util.apply_property_function(_56,"onpause",this,arguments);
},onresume:function(){
_57.resume();
Playdar.Util.apply_property_function(_56,"onresume",this,arguments);
},onstop:function(){
_57.stop();
Playdar.Util.apply_property_function(_56,"onstop",this,arguments);
},onfinish:function(){
_57.stop();
Playdar.Util.apply_property_function(_56,"onfinish",this,arguments);
}};
}};
Playdar.Player=function(_58){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_58;
if(Playdar.USE_SCROBBLER){
new Playdar.Scrobbler();
}
};
Playdar.Player.prototype={register_stream:function(_59,_5a){
this.streams[_59.sid]=_59;
var _5b=Playdar.Util.extend_object({id:_59.sid,url:Playdar.client.get_stream_url(_59.sid)},_5a);
if(Playdar.status_bar){
Playdar.Util.extend_object(_5b,Playdar.status_bar.get_sound_options(_59,_5a));
}
if(Playdar.scrobbler){
Playdar.Util.extend_object(_5b,Playdar.scrobbler.get_sound_options(_59,_5a));
}
return this.soundmanager.createSound(_5b);
},play_stream:function(sid){
var _5d=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_all();
if(_5d.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_5d.togglePause();
return _5d;
},stop_all:function(){
if(this.nowplayingid){
var _5e=this.soundmanager.getSoundById(this.nowplayingid);
_5e.stop();
_5e.setPosition(1);
this.nowplayingid=null;
}
if(Playdar.status_bar){
Playdar.status_bar.stop_handler();
}
},stop_stream:function(sid){
if(sid&&sid==this.nowplayingid){
this.stop_all();
return true;
}
return false;
},is_now_playing:function(){
if(this.nowplayingid){
return true;
}
return false;
},toggle_nowplaying:function(){
if(this.nowplayingid){
this.play_stream(this.nowplayingid);
}
}};
Playdar.StatusBar=function(){
Playdar.status_bar=this;
this.queries_popup=null;
this.progress_bar_width=200;
this.request_count=0;
this.pending_count=0;
this.success_count=0;
this.query_list_link=null;
this.nowplaying_query_button=null;
this.build();
};
Playdar.StatusBar.prototype={build:function(){
var _60=document.createElement("div");
_60.style.position="fixed";
_60.style.bottom=0;
_60.style.left=0;
_60.style.zIndex=100;
_60.style.width="100%";
_60.style.height="36px";
_60.style.padding="7px 0";
_60.style.borderTop="2px solid #4c7a0f";
_60.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_60.style.color="#335507";
_60.style.background="#e8f9bb";
var _61=document.createElement("div");
_61.style.padding="0 7px";
var _62="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_61.innerHTML=_62;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_61.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _63=document.createElement("p");
_63.style.margin="0";
this.track_link=document.createElement("a");
this.track_link.style.textDecoration="none";
this.artist_name=document.createElement("span");
this.artist_name.style.textTransform="uppercase";
this.artist_name.style.color="#4c7a0f";
this.track_name=document.createElement("strong");
this.track_name.style.margin="0 0 0 10px";
this.track_name.style.color="#335507";
this.track_link.appendChild(this.artist_name);
this.track_link.appendChild(this.track_name);
_63.appendChild(this.track_link);
this.playback.appendChild(_63);
var _64=document.createElement("table");
_64.setAttribute("cellpadding",0);
_64.setAttribute("cellspacing",0);
_64.setAttribute("border",0);
_64.style.color="#4c7a0f";
_64.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _65=document.createElement("tbody");
var _66=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_66.appendChild(this.track_elapsed);
var _67=document.createElement("td");
_67.style.padding="0 5px";
_67.style.verticalAlign="middle";
var _68=document.createElement("div");
_68.style.width=this.progress_bar_width+"px";
_68.style.height="9px";
_68.style.border="1px solid #4c7a0f";
_68.style.background="#fff";
_68.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_68.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_68.appendChild(this.playhead);
_68.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_67.appendChild(_68);
_66.appendChild(_67);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_66.appendChild(this.track_duration);
_65.appendChild(_66);
_64.appendChild(_65);
this.playback.appendChild(_64);
_61.appendChild(this.playback);
var _69=document.createElement("div");
_69.style.cssFloat="right";
_69.style.padding="0 8px";
_69.style.textAlign="right";
var _6a=document.createElement("p");
_6a.style.margin=0;
_6a.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_69.appendChild(_6a);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+Playdar.client.get_disconnect_link_html();
_69.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_60.appendChild(_69);
_60.appendChild(_61);
document.body.appendChild(_60);
var _6b=document.body.style.marginBottom;
if(!_6b){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_6b=css.marginBottom;
}
}
document.body.style.marginBottom=(_6b.replace("px","")-0)+36+(7*2)+2+"px";
return _60;
},ready:function(){
this.playdar_links.style.display="";
var _6d="Ready";
this.status.innerHTML=_6d;
},offline:function(){
this.playdar_links.style.display="none";
var _6e=Playdar.client.get_auth_link_html();
this.status.innerHTML=_6e;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _6f="manualAuth_"+Playdar.client.uuid;
var _70="<input type=\"text\" id=\""+_6f+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_6f+"'); return false;"+"\" />";
this.status.innerHTML=_70;
},handle_stat:function(_71){
if(_71.authenticated){
this.ready();
}else{
this.offline();
}
},get_queries_popup_url:function(){
return Playdar.STATIC_HOST+"/demos/tracks.html";
},open_queries_popup:function(){
if(this.queries_popup===null||this.queries_popup.closed){
this.queries_popup=window.open(this.get_queries_popup_url(),Playdar.QUERIES_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.QUERIES_POPUP_SIZE));
}else{
this.queries_popup.focus();
}
},show_resolution_status:function(){
if(this.query_count){
var _72=" ";
if(this.pending_count){
_72+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_72+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_72;
}
},handle_results:function(_73,_74){
if(_74){
this.pending_count--;
if(_73.results.length){
this.success_count++;
}
}
this.show_resolution_status();
},increment_requests:function(){
this.request_count++;
this.pending_count++;
this.show_resolution_status();
},cancel_resolve:function(){
this.pending_count=0;
this.show_resolution_status();
},get_sound_options:function(_75,_76){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.apply_property_function(_76,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.apply_property_function(_76,"whileloading",this,arguments);
}};
},play_handler:function(_77){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_77.sid);
this.track_link.title=_77.source;
this.track_name.innerHTML=_77.track;
this.artist_name.innerHTML=_77.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_77.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_78){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_78.position/1000));
var _79;
if(_78.readyState==3){
_79=_78.duration;
}else{
_79=_78.durationEstimate;
}
var _7a=_78.position/_79;
this.playhead.style.width=Math.round(_7a*this.progress_bar_width)+"px";
},loading_handler:function(_7b){
var _7c=_7b.bytesLoaded/_7b.bytesTotal;
this.bufferhead.style.width=Math.round(_7c*this.progress_bar_width)+"px";
},stop_handler:function(){
this.playback.style.display="none";
this.status.style.display="";
this.track_link.href="#";
this.track_link.title="";
this.track_name.innerHTML="";
this.artist_name.innerHTML="";
this.bufferhead.style.width=0;
this.playhead.style.width=0;
}};
Playdar.Util={generate_uuid:function(){
var _7d="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _7e=[];
var rnd=Math.random;
var r;
_7e[8]=_7e[13]=_7e[18]=_7e[23]="-";
_7e[14]="4";
for(var i=0;i<36;i++){
if(!_7e[i]){
r=0|rnd()*16;
_7e[i]=_7d[(i==19)?(r&3)|8:r&15];
}
}
return _7e.join("");
},toQueryPair:function(key,_83){
if(_83===null){
return key;
}
return key+"="+encodeURIComponent(_83);
},toQueryString:function(_84){
var _85=[];
for(var key in _84){
var _87=_84[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_87)=="[object Array]"){
for(var i=0;i<_87.length;i++){
_85.push(Playdar.Util.toQueryPair(key,_87[i]));
}
}else{
_85.push(Playdar.Util.toQueryPair(key,_87));
}
}
return _85.join("&");
},mmss:function(_89){
var s=_89%60;
if(s<10){
s="0"+s;
}
return Math.floor(_89/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_8d,_8e,_8f){
if(_8f){
var _90=new Date();
_90.setTime(_90.getTime()+(_8f*24*60*60*1000));
var _91="; expires="+_90.toGMTString();
}else{
var _91="";
}
document.cookie="PD_"+_8d+"="+_8e+_91+"; path=/";
},getcookie:function(_92){
var _93="PD_"+_92+"=";
var _94=document.cookie.split(";");
for(var i=0;i<_94.length;i++){
var c=_94[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_93)==0){
return c.substring(_93.length,c.length);
}
}
return null;
},deletecookie:function(_97){
Playdar.Util.setcookie(_97,"",-1);
},get_window_position:function(){
var _98={};
if(window.screenLeft){
_98.x=window.screenLeft||0;
_98.y=window.screenTop||0;
}else{
_98.x=window.screenX||0;
_98.y=window.screenY||0;
}
return _98;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_99){
var _9a=Playdar.Util.get_popup_location(_99);
return ["left="+_9a.x,"top="+_9a.y,"width="+_99.w,"height="+_99.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_9b){
var _9c=Playdar.Util.get_window_position();
var _9d=Playdar.Util.get_window_size();
return {"x":Math.max(0,_9c.x+(_9d.w-_9b.w)/2),"y":Math.max(0,_9c.y+(_9d.h-_9b.h)/2)};
},addEvent:function(obj,_9f,fn){
if(obj.attachEvent){
obj["e"+_9f+fn]=fn;
obj[_9f+fn]=function(){
obj["e"+_9f+fn](window.event);
};
obj.attachEvent("on"+_9f,obj[_9f+fn]);
}else{
obj.addEventListener(_9f,fn,false);
}
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_a2,_a3){
_a3=_a3||{};
for(var _a4 in _a3){
_a2[_a4]=_a3[_a4];
}
return _a2;
},apply_property_function:function(obj,_a6,_a7,_a8){
if(obj&&obj[_a6]){
obj[_a6].apply(_a7,_a8);
}
},log:function(_a9){
if(typeof console!="undefined"){
console.dir(_a9);
}
},null_callback:function(){
}};
Playdar.Util.addEvent(window,"unload",function(){
if(Playdar.scrobbler){
Playdar.scrobbler.stop();
}
});
(function(){
var _aa=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_ab=0,_ac=Object.prototype.toString,_ad=false;
var _ae=function(_af,_b0,_b1,_b2){
_b1=_b1||[];
var _b3=_b0=_b0||document;
if(_b0.nodeType!==1&&_b0.nodeType!==9){
return [];
}
if(!_af||typeof _af!=="string"){
return _b1;
}
var _b4=[],m,set,_b7,_b8,_b9,_ba,_bb=true,_bc=_bd(_b0);
_aa.lastIndex=0;
while((m=_aa.exec(_af))!==null){
_b4.push(m[1]);
if(m[2]){
_ba=RegExp.rightContext;
break;
}
}
if(_b4.length>1&&_be.exec(_af)){
if(_b4.length===2&&_bf.relative[_b4[0]]){
set=_c0(_b4[0]+_b4[1],_b0);
}else{
set=_bf.relative[_b4[0]]?[_b0]:_ae(_b4.shift(),_b0);
while(_b4.length){
_af=_b4.shift();
if(_bf.relative[_af]){
_af+=_b4.shift();
}
set=_c0(_af,set);
}
}
}else{
if(!_b2&&_b4.length>1&&_b0.nodeType===9&&!_bc&&_bf.match.ID.test(_b4[0])&&!_bf.match.ID.test(_b4[_b4.length-1])){
var ret=_ae.find(_b4.shift(),_b0,_bc);
_b0=ret.expr?_ae.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_b0){
var ret=_b2?{expr:_b4.pop(),set:_c2(_b2)}:_ae.find(_b4.pop(),_b4.length===1&&(_b4[0]==="~"||_b4[0]==="+")&&_b0.parentNode?_b0.parentNode:_b0,_bc);
set=ret.expr?_ae.filter(ret.expr,ret.set):ret.set;
if(_b4.length>0){
_b7=_c2(set);
}else{
_bb=false;
}
while(_b4.length){
var cur=_b4.pop(),pop=cur;
if(!_bf.relative[cur]){
cur="";
}else{
pop=_b4.pop();
}
if(pop==null){
pop=_b0;
}
_bf.relative[cur](_b7,pop,_bc);
}
}else{
_b7=_b4=[];
}
}
if(!_b7){
_b7=set;
}
if(!_b7){
throw "Syntax error, unrecognized expression: "+(cur||_af);
}
if(_ac.call(_b7)==="[object Array]"){
if(!_bb){
_b1.push.apply(_b1,_b7);
}else{
if(_b0&&_b0.nodeType===1){
for(var i=0;_b7[i]!=null;i++){
if(_b7[i]&&(_b7[i]===true||_b7[i].nodeType===1&&_c6(_b0,_b7[i]))){
_b1.push(set[i]);
}
}
}else{
for(var i=0;_b7[i]!=null;i++){
if(_b7[i]&&_b7[i].nodeType===1){
_b1.push(set[i]);
}
}
}
}
}else{
_c2(_b7,_b1);
}
if(_ba){
_ae(_ba,_b3,_b1,_b2);
_ae.uniqueSort(_b1);
}
return _b1;
};
_ae.uniqueSort=function(_c7){
if(_c8){
_ad=false;
_c7.sort(_c8);
if(_ad){
for(var i=1;i<_c7.length;i++){
if(_c7[i]===_c7[i-1]){
_c7.splice(i--,1);
}
}
}
}
};
_ae.matches=function(_ca,set){
return _ae(_ca,null,null,set);
};
_ae.find=function(_cc,_cd,_ce){
var set,_d0;
if(!_cc){
return [];
}
for(var i=0,l=_bf.order.length;i<l;i++){
var _d3=_bf.order[i],_d0;
if((_d0=_bf.match[_d3].exec(_cc))){
var _d4=RegExp.leftContext;
if(_d4.substr(_d4.length-1)!=="\\"){
_d0[1]=(_d0[1]||"").replace(/\\/g,"");
set=_bf.find[_d3](_d0,_cd,_ce);
if(set!=null){
_cc=_cc.replace(_bf.match[_d3],"");
break;
}
}
}
}
if(!set){
set=_cd.getElementsByTagName("*");
}
return {set:set,expr:_cc};
};
_ae.filter=function(_d5,set,_d7,not){
var old=_d5,_da=[],_db=set,_dc,_dd,_de=set&&set[0]&&_bd(set[0]);
while(_d5&&set.length){
for(var _df in _bf.filter){
if((_dc=_bf.match[_df].exec(_d5))!=null){
var _e0=_bf.filter[_df],_e1,_e2;
_dd=false;
if(_db==_da){
_da=[];
}
if(_bf.preFilter[_df]){
_dc=_bf.preFilter[_df](_dc,_db,_d7,_da,not,_de);
if(!_dc){
_dd=_e1=true;
}else{
if(_dc===true){
continue;
}
}
}
if(_dc){
for(var i=0;(_e2=_db[i])!=null;i++){
if(_e2){
_e1=_e0(_e2,_dc,i,_db);
var _e4=not^!!_e1;
if(_d7&&_e1!=null){
if(_e4){
_dd=true;
}else{
_db[i]=false;
}
}else{
if(_e4){
_da.push(_e2);
_dd=true;
}
}
}
}
}
if(_e1!==undefined){
if(!_d7){
_db=_da;
}
_d5=_d5.replace(_bf.match[_df],"");
if(!_dd){
return [];
}
break;
}
}
}
if(_d5==old){
if(_dd==null){
throw "Syntax error, unrecognized expression: "+_d5;
}else{
break;
}
}
old=_d5;
}
return _db;
};
var _bf=_ae.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_e5){
return _e5.getAttribute("href");
}},relative:{"+":function(_e6,_e7,_e8){
var _e9=typeof _e7==="string",_ea=_e9&&!(/\W/).test(_e7),_eb=_e9&&!_ea;
if(_ea&&!_e8){
_e7=_e7.toUpperCase();
}
for(var i=0,l=_e6.length,_ee;i<l;i++){
if((_ee=_e6[i])){
while((_ee=_ee.previousSibling)&&_ee.nodeType!==1){
}
_e6[i]=_eb||_ee&&_ee.nodeName===_e7?_ee||false:_ee===_e7;
}
}
if(_eb){
_ae.filter(_e7,_e6,true);
}
},">":function(_ef,_f0,_f1){
var _f2=typeof _f0==="string";
if(_f2&&!(/\W/).test(_f0)){
_f0=_f1?_f0:_f0.toUpperCase();
for(var i=0,l=_ef.length;i<l;i++){
var _f5=_ef[i];
if(_f5){
var _f6=_f5.parentNode;
_ef[i]=_f6.nodeName===_f0?_f6:false;
}
}
}else{
for(var i=0,l=_ef.length;i<l;i++){
var _f5=_ef[i];
if(_f5){
_ef[i]=_f2?_f5.parentNode:_f5.parentNode===_f0;
}
}
if(_f2){
_ae.filter(_f0,_ef,true);
}
}
},"":function(_f7,_f8,_f9){
var _fa=_ab++,_fb=dirCheck;
if(!_f8.match(/\W/)){
var _fc=_f8=_f9?_f8:_f8.toUpperCase();
_fb=dirNodeCheck;
}
_fb("parentNode",_f8,_fa,_f7,_fc,_f9);
},"~":function(_fd,_fe,_ff){
var _100=_ab++,_101=dirCheck;
if(typeof _fe==="string"&&!_fe.match(/\W/)){
var _102=_fe=_ff?_fe:_fe.toUpperCase();
_101=dirNodeCheck;
}
_101("previousSibling",_fe,_100,_fd,_102,_ff);
}},find:{ID:function(_103,_104,_105){
if(typeof _104.getElementById!=="undefined"&&!_105){
var m=_104.getElementById(_103[1]);
return m?[m]:[];
}
},NAME:function(_107,_108,_109){
if(typeof _108.getElementsByName!=="undefined"){
var ret=[],_10b=_108.getElementsByName(_107[1]);
for(var i=0,l=_10b.length;i<l;i++){
if(_10b[i].getAttribute("name")===_107[1]){
ret.push(_10b[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_10e,_10f){
return _10f.getElementsByTagName(_10e[1]);
}},preFilter:{CLASS:function(_110,_111,_112,_113,not,_115){
_110=" "+_110[1].replace(/\\/g,"")+" ";
if(_115){
return _110;
}
for(var i=0,elem;(elem=_111[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_110)>=0)){
if(!_112){
_113.push(elem);
}
}else{
if(_112){
_111[i]=false;
}
}
}
}
return false;
},ID:function(_118){
return _118[1].replace(/\\/g,"");
},TAG:function(_119,_11a){
for(var i=0;_11a[i]===false;i++){
}
return _11a[i]&&_bd(_11a[i])?_119[1]:_119[1].toUpperCase();
},CHILD:function(_11c){
if(_11c[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_11c[2]=="even"&&"2n"||_11c[2]=="odd"&&"2n+1"||!(/\D/).test(_11c[2])&&"0n+"+_11c[2]||_11c[2]);
_11c[2]=(test[1]+(test[2]||1))-0;
_11c[3]=test[3]-0;
}
_11c[0]=_ab++;
return _11c;
},ATTR:function(_11e,_11f,_120,_121,not,_123){
var name=_11e[1].replace(/\\/g,"");
if(!_123&&_bf.attrMap[name]){
_11e[1]=_bf.attrMap[name];
}
if(_11e[2]==="~="){
_11e[4]=" "+_11e[4]+" ";
}
return _11e;
},PSEUDO:function(_125,_126,_127,_128,not){
if(_125[1]==="not"){
if(_125[3].match(_aa).length>1||(/^\w/).test(_125[3])){
_125[3]=_ae(_125[3],null,null,_126);
}else{
var ret=_ae.filter(_125[3],_126,_127,true^not);
if(!_127){
_128.push.apply(_128,ret);
}
return false;
}
}else{
if(_bf.match.POS.test(_125[0])||_bf.match.CHILD.test(_125[0])){
return true;
}
}
return _125;
},POS:function(_12b){
_12b.unshift(true);
return _12b;
}},filters:{enabled:function(elem){
return elem.disabled===false&&elem.type!=="hidden";
},disabled:function(elem){
return elem.disabled===true;
},checked:function(elem){
return elem.checked===true;
},selected:function(elem){
elem.parentNode.selectedIndex;
return elem.selected===true;
},parent:function(elem){
return !!elem.firstChild;
},empty:function(elem){
return !elem.firstChild;
},has:function(elem,i,_134){
return !!_ae(_134[3],elem).length;
},header:function(elem){
return (/h\d/i).test(elem.nodeName);
},text:function(elem){
return "text"===elem.type;
},radio:function(elem){
return "radio"===elem.type;
},checkbox:function(elem){
return "checkbox"===elem.type;
},file:function(elem){
return "file"===elem.type;
},password:function(elem){
return "password"===elem.type;
},submit:function(elem){
return "submit"===elem.type;
},image:function(elem){
return "image"===elem.type;
},reset:function(elem){
return "reset"===elem.type;
},button:function(elem){
return "button"===elem.type||elem.nodeName.toUpperCase()==="BUTTON";
},input:function(elem){
return (/input|select|textarea|button/i).test(elem.nodeName);
}},setFilters:{first:function(elem,i){
return i===0;
},last:function(elem,i,_144,_145){
return i===_145.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_14c){
return i<_14c[3]-0;
},gt:function(elem,i,_14f){
return i>_14f[3]-0;
},nth:function(elem,i,_152){
return _152[3]-0==i;
},eq:function(elem,i,_155){
return _155[3]-0==i;
}},filter:{PSEUDO:function(elem,_157,i,_159){
var name=_157[1],_15b=_bf.filters[name];
if(_15b){
return _15b(elem,i,_157,_159);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_157[3])>=0;
}else{
if(name==="not"){
var not=_157[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_15f){
var type=_15f[1],node=elem;
switch(type){
case "only":
case "first":
while(node=node.previousSibling){
if(node.nodeType===1){
return false;
}
}
if(type=="first"){
return true;
}
node=elem;
case "last":
while(node=node.nextSibling){
if(node.nodeType===1){
return false;
}
}
return true;
case "nth":
var _162=_15f[2],last=_15f[3];
if(_162==1&&last==0){
return true;
}
var _164=_15f[0],_165=elem.parentNode;
if(_165&&(_165.sizcache!==_164||!elem.nodeIndex)){
var _166=0;
for(node=_165.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_166;
}
}
_165.sizcache=_164;
}
var diff=elem.nodeIndex-last;
if(_162==0){
return diff==0;
}else{
return (diff%_162==0&&diff/_162>=0);
}
}
},ID:function(elem,_169){
return elem.nodeType===1&&elem.getAttribute("id")===_169;
},TAG:function(elem,_16b){
return (_16b==="*"&&elem.nodeType===1)||elem.nodeName===_16b;
},CLASS:function(elem,_16d){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_16d)>-1;
},ATTR:function(elem,_16f){
var name=_16f[1],_171=_bf.attrHandle[name]?_bf.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_172=_171+"",type=_16f[2],_174=_16f[4];
return _171==null?type==="!=":type==="="?_172===_174:type==="*="?_172.indexOf(_174)>=0:type==="~="?(" "+_172+" ").indexOf(_174)>=0:!_174?_172&&_171!==false:type==="!="?_172!=_174:type==="^="?_172.indexOf(_174)===0:type==="$="?_172.substr(_172.length-_174.length)===_174:type==="|="?_172===_174||_172.substr(0,_174.length+1)===_174+"-":false;
},POS:function(elem,_176,i,_178){
var name=_176[2],_17a=_bf.setFilters[name];
if(_17a){
return _17a(elem,i,_176,_178);
}
}}};
var _be=_bf.match.POS;
for(var type in _bf.match){
_bf.match[type]=new RegExp(_bf.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _c2=function(_17c,_17d){
_17c=Array.prototype.slice.call(_17c);
if(_17d){
_17d.push.apply(_17d,_17c);
return _17d;
}
return _17c;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_c2=function(_17e,_17f){
var ret=_17f||[];
if(_ac.call(_17e)==="[object Array]"){
Array.prototype.push.apply(ret,_17e);
}else{
if(typeof _17e.length==="number"){
for(var i=0,l=_17e.length;i<l;i++){
ret.push(_17e[i]);
}
}else{
for(var i=0;_17e[i];i++){
ret.push(_17e[i]);
}
}
}
return ret;
};
}
var _c8;
if(document.documentElement.compareDocumentPosition){
_c8=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_ad=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_c8=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_ad=true;
}
return ret;
};
}else{
if(document.createRange){
_c8=function(a,b){
var _18b=a.ownerDocument.createRange(),_18c=b.ownerDocument.createRange();
_18b.selectNode(a);
_18b.collapse(true);
_18c.selectNode(b);
_18c.collapse(true);
var ret=_18b.compareBoundaryPoints(Range.START_TO_END,_18c);
if(ret===0){
_ad=true;
}
return ret;
};
}
}
}
(function(){
var form=document.createElement("div"),id="script"+(new Date).getTime();
form.innerHTML="<a name='"+id+"'/>";
var root=document.documentElement;
root.insertBefore(form,root.firstChild);
if(!!document.getElementById(id)){
_bf.find.ID=function(_191,_192,_193){
if(typeof _192.getElementById!=="undefined"&&!_193){
var m=_192.getElementById(_191[1]);
return m?m.id===_191[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_191[1]?[m]:undefined:[];
}
};
_bf.filter.ID=function(elem,_196){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_196;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_bf.find.TAG=function(_199,_19a){
var _19b=_19a.getElementsByTagName(_199[1]);
if(_199[1]==="*"){
var tmp=[];
for(var i=0;_19b[i];i++){
if(_19b[i].nodeType===1){
tmp.push(_19b[i]);
}
}
_19b=tmp;
}
return _19b;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_bf.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _19f=_ae,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_ae=function(_1a1,_1a2,_1a3,seed){
_1a2=_1a2||document;
if(!seed&&_1a2.nodeType===9&&!_bd(_1a2)){
try{
return _c2(_1a2.querySelectorAll(_1a1),_1a3);
}
catch(e){
}
}
return _19f(_1a1,_1a2,_1a3,seed);
};
for(var prop in _19f){
_ae[prop]=_19f[prop];
}
})();
}
if(document.getElementsByClassName&&document.documentElement.getElementsByClassName){
(function(){
var div=document.createElement("div");
div.innerHTML="<div class='test e'></div><div class='test'></div>";
if(div.getElementsByClassName("e").length===0){
return;
}
div.lastChild.className="e";
if(div.getElementsByClassName("e").length===1){
return;
}
_bf.order.splice(1,0,"CLASS");
_bf.find.CLASS=function(_1a7,_1a8,_1a9){
if(typeof _1a8.getElementsByClassName!=="undefined"&&!_1a9){
return _1a8.getElementsByClassName(_1a7[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1ac,_1ad,_1ae,_1af){
var _1b0=dir=="previousSibling"&&!_1af;
for(var i=0,l=_1ad.length;i<l;i++){
var elem=_1ad[i];
if(elem){
if(_1b0&&elem.nodeType===1){
elem.sizcache=_1ac;
elem.sizset=i;
}
elem=elem[dir];
var _1b4=false;
while(elem){
if(elem.sizcache===_1ac){
_1b4=_1ad[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1af){
elem.sizcache=_1ac;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1b4=elem;
break;
}
elem=elem[dir];
}
_1ad[i]=_1b4;
}
}
}
function dirCheck(dir,cur,_1b7,_1b8,_1b9,_1ba){
var _1bb=dir=="previousSibling"&&!_1ba;
for(var i=0,l=_1b8.length;i<l;i++){
var elem=_1b8[i];
if(elem){
if(_1bb&&elem.nodeType===1){
elem.sizcache=_1b7;
elem.sizset=i;
}
elem=elem[dir];
var _1bf=false;
while(elem){
if(elem.sizcache===_1b7){
_1bf=_1b8[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1ba){
elem.sizcache=_1b7;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1bf=true;
break;
}
}else{
if(_ae.filter(cur,[elem]).length>0){
_1bf=elem;
break;
}
}
}
elem=elem[dir];
}
_1b8[i]=_1bf;
}
}
}
var _c6=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _bd=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _c0=function(_1c5,_1c6){
var _1c7=[],_1c8="",_1c9,root=_1c6.nodeType?[_1c6]:_1c6;
while((_1c9=_bf.match.PSEUDO.exec(_1c5))){
_1c8+=_1c9[0];
_1c5=_1c5.replace(_bf.match.PSEUDO,"");
}
_1c5=_bf.relative[_1c5]?_1c5+"*":_1c5;
for(var i=0,l=root.length;i<l;i++){
_ae(_1c5,root[i],_1c7);
}
return _ae.filter(_1c8,_1c7);
};
Playdar.Util.select=_ae;
})();

