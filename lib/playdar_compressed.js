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
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_9f,_a0){
_a0=_a0||{};
for(var _a1 in _a0){
_9f[_a1]=_a0[_a1];
}
return _9f;
},apply_property_function:function(obj,_a3,_a4,_a5){
if(obj&&obj[_a3]){
obj[_a3].apply(_a4,_a5);
}
},log:function(_a6){
if(typeof console!="undefined"){
console.dir(_a6);
}
},null_callback:function(){
}};
(function(){
var _a7=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_a8=0,_a9=Object.prototype.toString,_aa=false;
var _ab=function(_ac,_ad,_ae,_af){
_ae=_ae||[];
var _b0=_ad=_ad||document;
if(_ad.nodeType!==1&&_ad.nodeType!==9){
return [];
}
if(!_ac||typeof _ac!=="string"){
return _ae;
}
var _b1=[],m,set,_b4,_b5,_b6,_b7,_b8=true,_b9=_ba(_ad);
_a7.lastIndex=0;
while((m=_a7.exec(_ac))!==null){
_b1.push(m[1]);
if(m[2]){
_b7=RegExp.rightContext;
break;
}
}
if(_b1.length>1&&_bb.exec(_ac)){
if(_b1.length===2&&_bc.relative[_b1[0]]){
set=_bd(_b1[0]+_b1[1],_ad);
}else{
set=_bc.relative[_b1[0]]?[_ad]:_ab(_b1.shift(),_ad);
while(_b1.length){
_ac=_b1.shift();
if(_bc.relative[_ac]){
_ac+=_b1.shift();
}
set=_bd(_ac,set);
}
}
}else{
if(!_af&&_b1.length>1&&_ad.nodeType===9&&!_b9&&_bc.match.ID.test(_b1[0])&&!_bc.match.ID.test(_b1[_b1.length-1])){
var ret=_ab.find(_b1.shift(),_ad,_b9);
_ad=ret.expr?_ab.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_ad){
var ret=_af?{expr:_b1.pop(),set:_bf(_af)}:_ab.find(_b1.pop(),_b1.length===1&&(_b1[0]==="~"||_b1[0]==="+")&&_ad.parentNode?_ad.parentNode:_ad,_b9);
set=ret.expr?_ab.filter(ret.expr,ret.set):ret.set;
if(_b1.length>0){
_b4=_bf(set);
}else{
_b8=false;
}
while(_b1.length){
var cur=_b1.pop(),pop=cur;
if(!_bc.relative[cur]){
cur="";
}else{
pop=_b1.pop();
}
if(pop==null){
pop=_ad;
}
_bc.relative[cur](_b4,pop,_b9);
}
}else{
_b4=_b1=[];
}
}
if(!_b4){
_b4=set;
}
if(!_b4){
throw "Syntax error, unrecognized expression: "+(cur||_ac);
}
if(_a9.call(_b4)==="[object Array]"){
if(!_b8){
_ae.push.apply(_ae,_b4);
}else{
if(_ad&&_ad.nodeType===1){
for(var i=0;_b4[i]!=null;i++){
if(_b4[i]&&(_b4[i]===true||_b4[i].nodeType===1&&_c3(_ad,_b4[i]))){
_ae.push(set[i]);
}
}
}else{
for(var i=0;_b4[i]!=null;i++){
if(_b4[i]&&_b4[i].nodeType===1){
_ae.push(set[i]);
}
}
}
}
}else{
_bf(_b4,_ae);
}
if(_b7){
_ab(_b7,_b0,_ae,_af);
_ab.uniqueSort(_ae);
}
return _ae;
};
_ab.uniqueSort=function(_c4){
if(_c5){
_aa=false;
_c4.sort(_c5);
if(_aa){
for(var i=1;i<_c4.length;i++){
if(_c4[i]===_c4[i-1]){
_c4.splice(i--,1);
}
}
}
}
};
_ab.matches=function(_c7,set){
return _ab(_c7,null,null,set);
};
_ab.find=function(_c9,_ca,_cb){
var set,_cd;
if(!_c9){
return [];
}
for(var i=0,l=_bc.order.length;i<l;i++){
var _d0=_bc.order[i],_cd;
if((_cd=_bc.match[_d0].exec(_c9))){
var _d1=RegExp.leftContext;
if(_d1.substr(_d1.length-1)!=="\\"){
_cd[1]=(_cd[1]||"").replace(/\\/g,"");
set=_bc.find[_d0](_cd,_ca,_cb);
if(set!=null){
_c9=_c9.replace(_bc.match[_d0],"");
break;
}
}
}
}
if(!set){
set=_ca.getElementsByTagName("*");
}
return {set:set,expr:_c9};
};
_ab.filter=function(_d2,set,_d4,not){
var old=_d2,_d7=[],_d8=set,_d9,_da,_db=set&&set[0]&&_ba(set[0]);
while(_d2&&set.length){
for(var _dc in _bc.filter){
if((_d9=_bc.match[_dc].exec(_d2))!=null){
var _dd=_bc.filter[_dc],_de,_df;
_da=false;
if(_d8==_d7){
_d7=[];
}
if(_bc.preFilter[_dc]){
_d9=_bc.preFilter[_dc](_d9,_d8,_d4,_d7,not,_db);
if(!_d9){
_da=_de=true;
}else{
if(_d9===true){
continue;
}
}
}
if(_d9){
for(var i=0;(_df=_d8[i])!=null;i++){
if(_df){
_de=_dd(_df,_d9,i,_d8);
var _e1=not^!!_de;
if(_d4&&_de!=null){
if(_e1){
_da=true;
}else{
_d8[i]=false;
}
}else{
if(_e1){
_d7.push(_df);
_da=true;
}
}
}
}
}
if(_de!==undefined){
if(!_d4){
_d8=_d7;
}
_d2=_d2.replace(_bc.match[_dc],"");
if(!_da){
return [];
}
break;
}
}
}
if(_d2==old){
if(_da==null){
throw "Syntax error, unrecognized expression: "+_d2;
}else{
break;
}
}
old=_d2;
}
return _d8;
};
var _bc=_ab.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_e2){
return _e2.getAttribute("href");
}},relative:{"+":function(_e3,_e4,_e5){
var _e6=typeof _e4==="string",_e7=_e6&&!(/\W/).test(_e4),_e8=_e6&&!_e7;
if(_e7&&!_e5){
_e4=_e4.toUpperCase();
}
for(var i=0,l=_e3.length,_eb;i<l;i++){
if((_eb=_e3[i])){
while((_eb=_eb.previousSibling)&&_eb.nodeType!==1){
}
_e3[i]=_e8||_eb&&_eb.nodeName===_e4?_eb||false:_eb===_e4;
}
}
if(_e8){
_ab.filter(_e4,_e3,true);
}
},">":function(_ec,_ed,_ee){
var _ef=typeof _ed==="string";
if(_ef&&!(/\W/).test(_ed)){
_ed=_ee?_ed:_ed.toUpperCase();
for(var i=0,l=_ec.length;i<l;i++){
var _f2=_ec[i];
if(_f2){
var _f3=_f2.parentNode;
_ec[i]=_f3.nodeName===_ed?_f3:false;
}
}
}else{
for(var i=0,l=_ec.length;i<l;i++){
var _f2=_ec[i];
if(_f2){
_ec[i]=_ef?_f2.parentNode:_f2.parentNode===_ed;
}
}
if(_ef){
_ab.filter(_ed,_ec,true);
}
}
},"":function(_f4,_f5,_f6){
var _f7=_a8++,_f8=dirCheck;
if(!_f5.match(/\W/)){
var _f9=_f5=_f6?_f5:_f5.toUpperCase();
_f8=dirNodeCheck;
}
_f8("parentNode",_f5,_f7,_f4,_f9,_f6);
},"~":function(_fa,_fb,_fc){
var _fd=_a8++,_fe=dirCheck;
if(typeof _fb==="string"&&!_fb.match(/\W/)){
var _ff=_fb=_fc?_fb:_fb.toUpperCase();
_fe=dirNodeCheck;
}
_fe("previousSibling",_fb,_fd,_fa,_ff,_fc);
}},find:{ID:function(_100,_101,_102){
if(typeof _101.getElementById!=="undefined"&&!_102){
var m=_101.getElementById(_100[1]);
return m?[m]:[];
}
},NAME:function(_104,_105,_106){
if(typeof _105.getElementsByName!=="undefined"){
var ret=[],_108=_105.getElementsByName(_104[1]);
for(var i=0,l=_108.length;i<l;i++){
if(_108[i].getAttribute("name")===_104[1]){
ret.push(_108[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_10b,_10c){
return _10c.getElementsByTagName(_10b[1]);
}},preFilter:{CLASS:function(_10d,_10e,_10f,_110,not,_112){
_10d=" "+_10d[1].replace(/\\/g,"")+" ";
if(_112){
return _10d;
}
for(var i=0,elem;(elem=_10e[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_10d)>=0)){
if(!_10f){
_110.push(elem);
}
}else{
if(_10f){
_10e[i]=false;
}
}
}
}
return false;
},ID:function(_115){
return _115[1].replace(/\\/g,"");
},TAG:function(_116,_117){
for(var i=0;_117[i]===false;i++){
}
return _117[i]&&_ba(_117[i])?_116[1]:_116[1].toUpperCase();
},CHILD:function(_119){
if(_119[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_119[2]=="even"&&"2n"||_119[2]=="odd"&&"2n+1"||!(/\D/).test(_119[2])&&"0n+"+_119[2]||_119[2]);
_119[2]=(test[1]+(test[2]||1))-0;
_119[3]=test[3]-0;
}
_119[0]=_a8++;
return _119;
},ATTR:function(_11b,_11c,_11d,_11e,not,_120){
var name=_11b[1].replace(/\\/g,"");
if(!_120&&_bc.attrMap[name]){
_11b[1]=_bc.attrMap[name];
}
if(_11b[2]==="~="){
_11b[4]=" "+_11b[4]+" ";
}
return _11b;
},PSEUDO:function(_122,_123,_124,_125,not){
if(_122[1]==="not"){
if(_122[3].match(_a7).length>1||(/^\w/).test(_122[3])){
_122[3]=_ab(_122[3],null,null,_123);
}else{
var ret=_ab.filter(_122[3],_123,_124,true^not);
if(!_124){
_125.push.apply(_125,ret);
}
return false;
}
}else{
if(_bc.match.POS.test(_122[0])||_bc.match.CHILD.test(_122[0])){
return true;
}
}
return _122;
},POS:function(_128){
_128.unshift(true);
return _128;
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
},has:function(elem,i,_131){
return !!_ab(_131[3],elem).length;
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
},last:function(elem,i,_141,_142){
return i===_142.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_149){
return i<_149[3]-0;
},gt:function(elem,i,_14c){
return i>_14c[3]-0;
},nth:function(elem,i,_14f){
return _14f[3]-0==i;
},eq:function(elem,i,_152){
return _152[3]-0==i;
}},filter:{PSEUDO:function(elem,_154,i,_156){
var name=_154[1],_158=_bc.filters[name];
if(_158){
return _158(elem,i,_154,_156);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_154[3])>=0;
}else{
if(name==="not"){
var not=_154[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_15c){
var type=_15c[1],node=elem;
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
var _15f=_15c[2],last=_15c[3];
if(_15f==1&&last==0){
return true;
}
var _161=_15c[0],_162=elem.parentNode;
if(_162&&(_162.sizcache!==_161||!elem.nodeIndex)){
var _163=0;
for(node=_162.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_163;
}
}
_162.sizcache=_161;
}
var diff=elem.nodeIndex-last;
if(_15f==0){
return diff==0;
}else{
return (diff%_15f==0&&diff/_15f>=0);
}
}
},ID:function(elem,_166){
return elem.nodeType===1&&elem.getAttribute("id")===_166;
},TAG:function(elem,_168){
return (_168==="*"&&elem.nodeType===1)||elem.nodeName===_168;
},CLASS:function(elem,_16a){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_16a)>-1;
},ATTR:function(elem,_16c){
var name=_16c[1],_16e=_bc.attrHandle[name]?_bc.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_16f=_16e+"",type=_16c[2],_171=_16c[4];
return _16e==null?type==="!=":type==="="?_16f===_171:type==="*="?_16f.indexOf(_171)>=0:type==="~="?(" "+_16f+" ").indexOf(_171)>=0:!_171?_16f&&_16e!==false:type==="!="?_16f!=_171:type==="^="?_16f.indexOf(_171)===0:type==="$="?_16f.substr(_16f.length-_171.length)===_171:type==="|="?_16f===_171||_16f.substr(0,_171.length+1)===_171+"-":false;
},POS:function(elem,_173,i,_175){
var name=_173[2],_177=_bc.setFilters[name];
if(_177){
return _177(elem,i,_173,_175);
}
}}};
var _bb=_bc.match.POS;
for(var type in _bc.match){
_bc.match[type]=new RegExp(_bc.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _bf=function(_179,_17a){
_179=Array.prototype.slice.call(_179);
if(_17a){
_17a.push.apply(_17a,_179);
return _17a;
}
return _179;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_bf=function(_17b,_17c){
var ret=_17c||[];
if(_a9.call(_17b)==="[object Array]"){
Array.prototype.push.apply(ret,_17b);
}else{
if(typeof _17b.length==="number"){
for(var i=0,l=_17b.length;i<l;i++){
ret.push(_17b[i]);
}
}else{
for(var i=0;_17b[i];i++){
ret.push(_17b[i]);
}
}
}
return ret;
};
}
var _c5;
if(document.documentElement.compareDocumentPosition){
_c5=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_aa=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_c5=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_aa=true;
}
return ret;
};
}else{
if(document.createRange){
_c5=function(a,b){
var _188=a.ownerDocument.createRange(),_189=b.ownerDocument.createRange();
_188.selectNode(a);
_188.collapse(true);
_189.selectNode(b);
_189.collapse(true);
var ret=_188.compareBoundaryPoints(Range.START_TO_END,_189);
if(ret===0){
_aa=true;
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
_bc.find.ID=function(_18e,_18f,_190){
if(typeof _18f.getElementById!=="undefined"&&!_190){
var m=_18f.getElementById(_18e[1]);
return m?m.id===_18e[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_18e[1]?[m]:undefined:[];
}
};
_bc.filter.ID=function(elem,_193){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_193;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_bc.find.TAG=function(_196,_197){
var _198=_197.getElementsByTagName(_196[1]);
if(_196[1]==="*"){
var tmp=[];
for(var i=0;_198[i];i++){
if(_198[i].nodeType===1){
tmp.push(_198[i]);
}
}
_198=tmp;
}
return _198;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_bc.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _19c=_ab,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_ab=function(_19e,_19f,_1a0,seed){
_19f=_19f||document;
if(!seed&&_19f.nodeType===9&&!_ba(_19f)){
try{
return _bf(_19f.querySelectorAll(_19e),_1a0);
}
catch(e){
}
}
return _19c(_19e,_19f,_1a0,seed);
};
for(var prop in _19c){
_ab[prop]=_19c[prop];
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
_bc.order.splice(1,0,"CLASS");
_bc.find.CLASS=function(_1a4,_1a5,_1a6){
if(typeof _1a5.getElementsByClassName!=="undefined"&&!_1a6){
return _1a5.getElementsByClassName(_1a4[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1a9,_1aa,_1ab,_1ac){
var _1ad=dir=="previousSibling"&&!_1ac;
for(var i=0,l=_1aa.length;i<l;i++){
var elem=_1aa[i];
if(elem){
if(_1ad&&elem.nodeType===1){
elem.sizcache=_1a9;
elem.sizset=i;
}
elem=elem[dir];
var _1b1=false;
while(elem){
if(elem.sizcache===_1a9){
_1b1=_1aa[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1ac){
elem.sizcache=_1a9;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1b1=elem;
break;
}
elem=elem[dir];
}
_1aa[i]=_1b1;
}
}
}
function dirCheck(dir,cur,_1b4,_1b5,_1b6,_1b7){
var _1b8=dir=="previousSibling"&&!_1b7;
for(var i=0,l=_1b5.length;i<l;i++){
var elem=_1b5[i];
if(elem){
if(_1b8&&elem.nodeType===1){
elem.sizcache=_1b4;
elem.sizset=i;
}
elem=elem[dir];
var _1bc=false;
while(elem){
if(elem.sizcache===_1b4){
_1bc=_1b5[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1b7){
elem.sizcache=_1b4;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1bc=true;
break;
}
}else{
if(_ab.filter(cur,[elem]).length>0){
_1bc=elem;
break;
}
}
}
elem=elem[dir];
}
_1b5[i]=_1bc;
}
}
}
var _c3=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _ba=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _bd=function(_1c2,_1c3){
var _1c4=[],_1c5="",_1c6,root=_1c3.nodeType?[_1c3]:_1c3;
while((_1c6=_bc.match.PSEUDO.exec(_1c2))){
_1c5+=_1c6[0];
_1c2=_1c2.replace(_bc.match.PSEUDO,"");
}
_1c2=_bc.relative[_1c2]?_1c2+"*":_1c2;
for(var i=0,l=root.length;i<l;i++){
_ab(_1c2,root[i],_1c4);
}
return _ab.filter(_1c5,_1c4);
};
Playdar.Util.select=_ab;
})();

