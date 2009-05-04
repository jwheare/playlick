Playdar={VERSION:"0.4.2",SERVER_ROOT:"localhost",SERVER_PORT:"8888",STATIC_HOST:"http://www.playdar.org",STAT_TIMEOUT:2000,AUTH_POPUP_NAME:"PD_auth",AUTH_POPUP_SIZE:{"w":500,"h":260},QUERIES_POPUP_NAME:"PD_queries",QUERIES_POPUP_SIZE:{"w":640,"h":700},MAX_CONCURRENT_RESOLUTIONS:5,USE_STATUS_BAR:true,client:null,status_bar:null,player:null,setup:function(_1){
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
},get_revoke_url:function(){
return this.get_base_url("/settings/auth/",{revoke:this.auth_token});
},get_auth_url:function(){
return this.get_base_url("/auth_1/",this.auth_details);
},get_auth_link_html:function(_11){
_11=_11||"Connect";
var _12="<a href=\""+this.get_auth_url()+"\" target=\""+Playdar.AUTH_POPUP_NAME+"\" onclick=\"Playdar.client.start_auth(); return false;"+"\">"+_11+"</a>";
return _12;
},start_auth:function(){
if(this.auth_popup===null||this.auth_popup.closed){
this.auth_popup=window.open(this.get_auth_url(),Playdar.AUTH_POPUP_NAME,Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE));
}else{
this.auth_popup.focus();
}
if(!this.auth_details.receiverurl){
if(Playdar.status_bar){
Playdar.status_bar.start_manual_auth();
}
}
},auth_callback:function(_13){
Playdar.Util.setcookie("auth",_13,365);
if(this.auth_popup!==null&&!this.auth_popup.closed){
this.auth_popup.close();
}
this.auth_token=_13;
this.stat();
},manual_auth_callback:function(_14){
var _15=document.getElementById(_14);
if(_15&&_15.value){
this.auth_callback(_15.value);
}
},parse_microformats:function(_16){
var _17=[];
var _18=Playdar.Util.select(".haudio",_16);
for(var i=0;i<_18.length;i++){
var _1a=_18[i];
var _1b=Playdar.Util.select(".contributor",_1a);
var _1c=Playdar.Util.select(".fn",_1a);
if(_1c[0]&&_1b[0]){
var _1d={"artist":_1b[0].innerHTML,"name":_1c[0].innerHTML,"element":_1a};
_17.push(_1d);
}
}
return _17;
},autodetect:function(_1e,_1f){
var _20,qid;
var _22=this.parse_microformats(_1f);
for(var i=0;i<_22.length;i++){
_20=_22[i];
if(_1e){
qid=_1e(_20);
}
Playdar.client.resolve(_20.artist,"",_20.name,qid);
}
},resolve:function(art,alb,trk,qid){
var _28={artist:art,album:alb,track:trk,qid:qid||Playdar.Util.generate_uuid()};
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.resolution_queue.push(_28);
this.process_resolution_queue();
},process_resolution_queue:function(){
if(this.resolutions_in_progress.count>=Playdar.MAX_CONCURRENT_RESOLUTIONS){
return false;
}
var _29=Playdar.MAX_CONCURRENT_RESOLUTIONS-this.resolutions_in_progress.count;
for(var i=1;i<=_29;i++){
var _2b=this.resolution_queue.shift();
if(!_2b){
break;
}
this.resolutions_in_progress.queries[_2b.qid]=_2b;
this.resolutions_in_progress.count++;
Playdar.Util.loadjs(this.get_url("resolve","handle_resolution",_2b));
}
},cancel_resolve:function(){
this.initialise_resolve();
if(Playdar.status_bar){
Playdar.status_bar.cancel_resolve();
}
},initialise_resolve:function(){
this.resolution_queue=[];
this.resolutions_in_progress={count:0,queries:{}};
},handle_resolution:function(_2c){
if(this.resolutions_in_progress.queries[_2c.qid]){
this.last_qid=_2c.qid;
this.resolve_qids.push(this.last_qid);
this.get_results(_2c.qid);
}
},get_results:function(qid){
if(this.resolutions_in_progress.queries[qid]){
if(!this.poll_counts[qid]){
this.poll_counts[qid]=0;
}
this.poll_counts[qid]++;
Playdar.Util.loadjs(this.get_url("get_results","handle_results",{qid:qid,poll:this.poll_counts[qid]}));
}
},poll_results:function(_2e,_2f,_30){
var _31=this.should_stop_polling(_2e);
_30=_30||this;
if(!_31){
setTimeout(function(){
_2f.call(_30,_2e.qid);
},_2e.refresh_interval);
}
return _31;
},should_stop_polling:function(_32){
if(_32.refresh_interval<=0){
return true;
}
if(_32.query.solved==true){
return true;
}
if(this.poll_counts[_32.qid]>=4){
return true;
}
return false;
},handle_results:function(_33){
if(this.resolutions_in_progress.queries[_33.qid]){
var _34=this.poll_results(_33,this.get_results);
if(Playdar.status_bar){
Playdar.status_bar.handle_results(_33,_34);
}
if(_34){
delete this.resolutions_in_progress.queries[_33.qid];
this.resolutions_in_progress.count--;
this.process_resolution_queue();
}
if(this.results_handlers[_33.qid]){
this.results_handlers[_33.qid](_33,_34);
}else{
this.listeners.onResults(_33,_34);
}
}
},get_last_results:function(){
if(this.last_qid){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
this.get_results(this.last_qid);
}
},get_base_url:function(_35,_36){
var url="http://"+Playdar.SERVER_ROOT+":"+Playdar.SERVER_PORT;
if(_35){
url+=_35;
}
if(_36){
url+="?"+Playdar.Util.toQueryString(_36);
}
return url;
},get_url:function(_38,_39,_3a){
_3a=_3a||{};
_3a.method=_38;
if(!_3a.jsonp){
if(_39.join){
_3a.jsonp=_39.join(".");
}else{
_3a.jsonp=this.jsonp_callback(_39);
}
}
this.add_auth_token(_3a);
return this.get_base_url("/api/",_3a);
},add_auth_token:function(_3b){
if(this.auth_token){
_3b.auth=this.auth_token;
}
},get_stream_url:function(sid){
return this.get_base_url("/sid/"+sid);
},jsonp_callback:function(_3d){
return "Playdar.client."+_3d;
},list_results:function(_3e){
for(var i=0;i<_3e.results.length;i++){
console.log(_3e.results[i].name);
}
}};
Playdar.Boffin=function(){
Playdar.boffin=this;
};
Playdar.Boffin.prototype={get_url:function(_40,_41){
_41=_41||{};
_41.jsonp=_41.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_41);
return Playdar.client.get_base_url("/boffin/"+_40,_41);
},get_tagcloud:function(){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
Playdar.Util.loadjs(this.get_url("tagcloud",{jsonp:"Playdar.boffin.handle_tagcloud"}));
},handle_tagcloud:function(_42){
Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud,_42.qid);
Playdar.client.get_results(_42.qid);
},get_tag_rql:function(tag){
if(Playdar.status_bar){
Playdar.status_bar.increment_requests();
}
Playdar.client.resolutions_in_progress++;
var rql="tag:\""+tag+"\"";
Playdar.Util.loadjs(this.get_url("rql/"+encodeURIComponent(rql),{jsonp:"Playdar.boffin.handle_rql"}));
},handle_rql:function(_45){
Playdar.client.register_results_handler(Playdar.client.listeners.onRQL,_45.qid);
Playdar.client.get_results(_45.qid);
}};
Playdar.Scrobbler=function(){
Playdar.scrobbler=this;
};
Playdar.Scrobbler.prototype={get_url:function(_46,_47){
_47=_47||{};
_47.jsonp=_47.jsonp||"Playdar.Util.null_callback";
Playdar.client.add_auth_token(_47);
return Playdar.client.get_base_url("/audioscrobbler/"+_46,_47);
},start:function(_48,_49,_4a,_4b,_4c,_4d){
var _4e={a:_48,t:_49,o:"P"};
if(_4a){
_4e["b"]=_4a;
}
if(_4b){
_4e["l"]=_4b;
}
if(_4c){
_4e["n"]=_4c;
}
if(_4d){
_4e["m"]=_4d;
}
Playdar.Util.loadjs(this.get_url("start",_4e));
},stop:function(){
Playdar.Util.loadjs(this.get_url("stop"));
},pause:function(){
Playdar.Util.loadjs(this.get_url("pause"));
},resume:function(){
Playdar.Util.loadjs(this.get_url("resume"));
},get_sound_options:function(_4f,_50){
var _51=this;
return {onplay:function(){
_51.start(_4f.artist,_4f.track,_4f.album,_4f.duration);
Playdar.Util.apply_property_function(_50,"onplay",this,arguments);
},onbufferchange:function(){
if(this.isBuffering){
_51.pause();
}else{
_51.resume();
}
Playdar.Util.apply_property_function(_50,"onbufferchange",this,arguments);
},onpause:function(){
_51.pause();
Playdar.Util.apply_property_function(_50,"onpause",this,arguments);
},onresume:function(){
_51.resume();
Playdar.Util.apply_property_function(_50,"onresume",this,arguments);
},onstop:function(){
_51.stop();
Playdar.Util.apply_property_function(_50,"onstop",this,arguments);
},onfinish:function(){
_51.stop();
Playdar.Util.apply_property_function(_50,"onfinish",this,arguments);
}};
}};
Playdar.Player=function(_52){
Playdar.player=this;
this.streams={};
this.nowplayingid=null;
this.soundmanager=_52;
new Playdar.Scrobbler();
};
Playdar.Player.prototype={register_stream:function(_53,_54){
this.streams[_53.sid]=_53;
var _55=Playdar.Util.extend_object({id:_53.sid,url:Playdar.client.get_stream_url(_53.sid)},_54);
if(Playdar.status_bar){
Playdar.Util.extend_object(_55,Playdar.status_bar.get_sound_options(_53,_54));
}
if(Playdar.scrobbler){
Playdar.Util.extend_object(_55,Playdar.scrobbler.get_sound_options(_53,_54));
}
return this.soundmanager.createSound(_55);
},play_stream:function(sid){
var _57=this.soundmanager.getSoundById(sid);
if(this.nowplayingid!=sid){
this.stop_all();
if(_57.playState==0){
this.nowplayingid=sid;
if(Playdar.status_bar){
Playdar.status_bar.play_handler(this.streams[sid]);
}
}
}
_57.togglePause();
return _57;
},stop_all:function(){
if(this.nowplayingid){
var _58=this.soundmanager.getSoundById(this.nowplayingid);
_58.stop();
_58.setPosition(1);
this.nowplayingid=null;
}
if(Playdar.status_bar){
Playdar.status_bar.stop_handler();
}
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
var _59=document.createElement("div");
_59.style.position="fixed";
_59.style.bottom=0;
_59.style.left=0;
_59.style.zIndex=100;
_59.style.width="100%";
_59.style.height="36px";
_59.style.padding="7px 0";
_59.style.borderTop="2px solid #4c7a0f";
_59.style.font="normal 13px/18px \"Calibri\", \"Lucida Grande\", sans-serif";
_59.style.color="#335507";
_59.style.background="#e8f9bb";
var _5a=document.createElement("div");
_5a.style.padding="0 7px";
var _5b="<img src=\""+Playdar.STATIC_HOST+"/static/playdar_logo_32x32.png\" width=\"32\" height=\"32\" style=\"vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;\" />";
_5a.innerHTML=_5b;
this.status=document.createElement("p");
this.status.style.margin="0";
this.status.style.padding="0 8px";
this.status.style.lineHeight="36px";
this.status.style.fontSize="15px";
_5a.appendChild(this.status);
this.playback=document.createElement("div");
this.playback.style.padding="0 7px";
this.playback.style.display="none";
var _5c=document.createElement("p");
_5c.style.margin="0";
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
_5c.appendChild(this.track_link);
this.playback.appendChild(_5c);
var _5d=document.createElement("table");
_5d.setAttribute("cellpadding",0);
_5d.setAttribute("cellspacing",0);
_5d.setAttribute("border",0);
_5d.style.color="#4c7a0f";
_5d.style.font="normal 10px/16px \"Verdana\", sans-serif";
var _5e=document.createElement("tbody");
var _5f=document.createElement("tr");
this.track_elapsed=document.createElement("td");
this.track_elapsed.style.verticalAlign="middle";
_5f.appendChild(this.track_elapsed);
var _60=document.createElement("td");
_60.style.padding="0 5px";
_60.style.verticalAlign="middle";
var _61=document.createElement("div");
_61.style.width=this.progress_bar_width+"px";
_61.style.height="9px";
_61.style.border="1px solid #4c7a0f";
_61.style.background="#fff";
_61.style.position="relative";
this.bufferhead=document.createElement("div");
this.bufferhead.style.position="absolute";
this.bufferhead.style.width=0;
this.bufferhead.style.height="9px";
this.bufferhead.style.background="#d2f380";
_61.appendChild(this.bufferhead);
this.playhead=document.createElement("div");
this.playhead.style.position="absolute";
this.playhead.style.width=0;
this.playhead.style.height="9px";
this.playhead.style.background="#6ea31e";
_61.appendChild(this.playhead);
_61.onclick=function(){
Playdar.player.toggle_nowplaying();
};
_60.appendChild(_61);
_5f.appendChild(_60);
this.track_duration=document.createElement("td");
this.track_duration.style.verticalAlign="middle";
_5f.appendChild(this.track_duration);
_5e.appendChild(_5f);
_5d.appendChild(_5e);
this.playback.appendChild(_5d);
_5a.appendChild(this.playback);
var _62=document.createElement("div");
_62.style.cssFloat="right";
_62.style.padding="0 8px";
_62.style.textAlign="right";
var _63=document.createElement("p");
_63.style.margin=0;
_63.innerHTML="<a href=\""+Playdar.client.get_base_url()+"\" target=\"_blank\">Settings</a>";
_62.appendChild(_63);
this.playdar_links=document.createElement("p");
this.playdar_links.style.margin=0;
this.playdar_links.innerHTML="<a href=\""+this.get_queries_popup_url()+"\" target=\""+Playdar.QUERIES_POPUP_NAME+"\" onclick=\"Playdar.status_bar.open_queries_popup(); return false;"+"\">Tracks</a>"+" | "+"<a href=\"#\" onclick=\"Playdar.client.clear_auth(); return false;\">Disconnect</a>";
_62.appendChild(this.playdar_links);
this.query_count=document.createElement("span");
this.query_count.style.margin="0 5px 0 5px";
this.query_count.style.fontSize="11px";
this.query_count.style.fontWeight="normal";
this.query_count.style.color="#6ea31e";
this.playdar_links.insertBefore(this.query_count,this.playdar_links.firstChild);
_59.appendChild(_62);
_59.appendChild(_5a);
document.body.appendChild(_59);
var _64=document.body.style.marginBottom;
if(!_64){
var css=document.defaultView.getComputedStyle(document.body,null);
if(css){
_64=css.marginBottom;
}
}
document.body.style.marginBottom=(_64.replace("px","")-0)+36+(7*2)+2+"px";
return _59;
},ready:function(){
this.playdar_links.style.display="";
var _66="Ready";
this.status.innerHTML=_66;
},offline:function(){
this.playdar_links.style.display="none";
var _67=Playdar.client.get_auth_link_html();
this.status.innerHTML=_67;
},start_manual_auth:function(){
this.playdar_links.style.display="none";
var _68="manualAuth_"+Playdar.client.uuid;
var _69="<input type=\"text\" id=\""+_68+"\" />"+" <input type=\"submit\" value=\"Allow access to Playdar\""+" onclick=\"Playdar.client.manual_auth_callback('"+_68+"'); return false;"+"\" />";
this.status.innerHTML=_69;
},handle_stat:function(_6a){
if(_6a.authenticated){
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
var _6b=" ";
if(this.pending_count){
_6b+=this.pending_count+" <img src=\""+Playdar.STATIC_HOST+"/static/track_throbber.gif\" width=\"16\" height=\"16\" style=\"vertical-align: middle; margin: -2px 2px 0 2px\"/> ";
}
_6b+=" "+this.success_count+"/"+this.request_count;
this.query_count.innerHTML=_6b;
}
},handle_results:function(_6c,_6d){
if(_6d){
this.pending_count--;
if(_6c.results.length){
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
},get_sound_options:function(_6e,_6f){
return {whileplaying:function(){
Playdar.status_bar.playing_handler(this);
Playdar.Util.apply_property_function(_6f,"whileplaying",this,arguments);
},whileloading:function(){
Playdar.status_bar.loading_handler(this);
Playdar.Util.apply_property_function(_6f,"whileloading",this,arguments);
}};
},play_handler:function(_70){
this.track_elapsed.innerHTML=Playdar.Util.mmss(0);
this.track_link.href=Playdar.client.get_stream_url(_70.sid);
this.track_link.title=_70.source;
this.track_name.innerHTML=_70.track;
this.artist_name.innerHTML=_70.artist;
this.track_duration.innerHTML=Playdar.Util.mmss(_70.duration);
this.status.style.display="none";
this.playback.style.display="";
},playing_handler:function(_71){
this.track_elapsed.innerHTML=Playdar.Util.mmss(Math.round(_71.position/1000));
var _72;
if(_71.readyState==3){
_72=_71.duration;
}else{
_72=_71.durationEstimate;
}
var _73=_71.position/_72;
this.playhead.style.width=Math.round(_73*this.progress_bar_width)+"px";
},loading_handler:function(_74){
var _75=_74.bytesLoaded/_74.bytesTotal;
this.bufferhead.style.width=Math.round(_75*this.progress_bar_width)+"px";
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
var _76="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
var _77=[];
var rnd=Math.random;
var r;
_77[8]=_77[13]=_77[18]=_77[23]="-";
_77[14]="4";
for(var i=0;i<36;i++){
if(!_77[i]){
r=0|rnd()*16;
_77[i]=_76[(i==19)?(r&3)|8:r&15];
}
}
return _77.join("");
},toQueryPair:function(key,_7c){
if(_7c===null){
return key;
}
return key+"="+encodeURIComponent(_7c);
},toQueryString:function(_7d){
var _7e=[];
for(var key in _7d){
var _80=_7d[key];
key=encodeURIComponent(key);
if(Object.prototype.toString.call(_80)=="[object Array]"){
for(var i=0;i<_80.length;i++){
_7e.push(Playdar.Util.toQueryPair(key,_80[i]));
}
}else{
_7e.push(Playdar.Util.toQueryPair(key,_80));
}
}
return _7e.join("&");
},mmss:function(_82){
var s=_82%60;
if(s<10){
s="0"+s;
}
return Math.floor(_82/60)+":"+s;
},loadjs:function(url){
var s=document.createElement("script");
s.src=url;
document.getElementsByTagName("head")[0].appendChild(s);
},setcookie:function(_86,_87,_88){
if(_88){
var _89=new Date();
_89.setTime(_89.getTime()+(_88*24*60*60*1000));
var _8a="; expires="+_89.toGMTString();
}else{
var _8a="";
}
document.cookie="PD_"+_86+"="+_87+_8a+"; path=/";
},getcookie:function(_8b){
var _8c="PD_"+_8b+"=";
var _8d=document.cookie.split(";");
for(var i=0;i<_8d.length;i++){
var c=_8d[i];
while(c.charAt(0)==" "){
c=c.substring(1,c.length);
}
if(c.indexOf(_8c)==0){
return c.substring(_8c.length,c.length);
}
}
return null;
},deletecookie:function(_90){
Playdar.Util.setcookie(_90,"",-1);
},get_window_position:function(){
var _91={};
if(window.screenLeft){
_91.x=window.screenLeft||0;
_91.y=window.screenTop||0;
}else{
_91.x=window.screenX||0;
_91.y=window.screenY||0;
}
return _91;
},get_window_size:function(){
return {"w":(window&&window.innerWidth)||(document&&document.documentElement&&document.documentElement.clientWidth)||(document&&document.body&&document.body.clientWidth)||0,"h":(window&&window.innerHeight)||(document&&document.documentElement&&document.documentElement.clientHeight)||(document&&document.body&&document.body.clientHeight)||0};
},get_popup_options:function(_92){
var _93=Playdar.Util.get_popup_location(_92);
return ["left="+_93.x,"top="+_93.y,"width="+_92.w,"height="+_92.h,"location=yes","toolbar=no","menubar=yes","status=yes","resizable=yes","scrollbars=yes"].join(",");
},get_popup_location:function(_94){
var _95=Playdar.Util.get_window_position();
var _96=Playdar.Util.get_window_size();
return {"x":Math.max(0,_95.x+(_96.w-_94.w)/2),"y":Math.max(0,_95.y+(_96.h-_94.h)/2)};
},getTarget:function(e){
e=e||window.event;
return e.target||e.srcElement;
},extend_object:function(_98,_99){
_99=_99||{};
for(var _9a in _99){
_98[_9a]=_99[_9a];
}
return _98;
},apply_property_function:function(obj,_9c,_9d,_9e){
if(obj&&obj[_9c]){
obj[_9c].apply(_9d,_9e);
}
},log:function(_9f){
if(typeof console!="undefined"){
console.dir(_9f);
}
},null_callback:function(){
}};
(function(){
var _a0=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?/g,_a1=0,_a2=Object.prototype.toString,_a3=false;
var _a4=function(_a5,_a6,_a7,_a8){
_a7=_a7||[];
var _a9=_a6=_a6||document;
if(_a6.nodeType!==1&&_a6.nodeType!==9){
return [];
}
if(!_a5||typeof _a5!=="string"){
return _a7;
}
var _aa=[],m,set,_ad,_ae,_af,_b0,_b1=true,_b2=_b3(_a6);
_a0.lastIndex=0;
while((m=_a0.exec(_a5))!==null){
_aa.push(m[1]);
if(m[2]){
_b0=RegExp.rightContext;
break;
}
}
if(_aa.length>1&&_b4.exec(_a5)){
if(_aa.length===2&&_b5.relative[_aa[0]]){
set=_b6(_aa[0]+_aa[1],_a6);
}else{
set=_b5.relative[_aa[0]]?[_a6]:_a4(_aa.shift(),_a6);
while(_aa.length){
_a5=_aa.shift();
if(_b5.relative[_a5]){
_a5+=_aa.shift();
}
set=_b6(_a5,set);
}
}
}else{
if(!_a8&&_aa.length>1&&_a6.nodeType===9&&!_b2&&_b5.match.ID.test(_aa[0])&&!_b5.match.ID.test(_aa[_aa.length-1])){
var ret=_a4.find(_aa.shift(),_a6,_b2);
_a6=ret.expr?_a4.filter(ret.expr,ret.set)[0]:ret.set[0];
}
if(_a6){
var ret=_a8?{expr:_aa.pop(),set:_b8(_a8)}:_a4.find(_aa.pop(),_aa.length===1&&(_aa[0]==="~"||_aa[0]==="+")&&_a6.parentNode?_a6.parentNode:_a6,_b2);
set=ret.expr?_a4.filter(ret.expr,ret.set):ret.set;
if(_aa.length>0){
_ad=_b8(set);
}else{
_b1=false;
}
while(_aa.length){
var cur=_aa.pop(),pop=cur;
if(!_b5.relative[cur]){
cur="";
}else{
pop=_aa.pop();
}
if(pop==null){
pop=_a6;
}
_b5.relative[cur](_ad,pop,_b2);
}
}else{
_ad=_aa=[];
}
}
if(!_ad){
_ad=set;
}
if(!_ad){
throw "Syntax error, unrecognized expression: "+(cur||_a5);
}
if(_a2.call(_ad)==="[object Array]"){
if(!_b1){
_a7.push.apply(_a7,_ad);
}else{
if(_a6&&_a6.nodeType===1){
for(var i=0;_ad[i]!=null;i++){
if(_ad[i]&&(_ad[i]===true||_ad[i].nodeType===1&&_bc(_a6,_ad[i]))){
_a7.push(set[i]);
}
}
}else{
for(var i=0;_ad[i]!=null;i++){
if(_ad[i]&&_ad[i].nodeType===1){
_a7.push(set[i]);
}
}
}
}
}else{
_b8(_ad,_a7);
}
if(_b0){
_a4(_b0,_a9,_a7,_a8);
_a4.uniqueSort(_a7);
}
return _a7;
};
_a4.uniqueSort=function(_bd){
if(_be){
_a3=false;
_bd.sort(_be);
if(_a3){
for(var i=1;i<_bd.length;i++){
if(_bd[i]===_bd[i-1]){
_bd.splice(i--,1);
}
}
}
}
};
_a4.matches=function(_c0,set){
return _a4(_c0,null,null,set);
};
_a4.find=function(_c2,_c3,_c4){
var set,_c6;
if(!_c2){
return [];
}
for(var i=0,l=_b5.order.length;i<l;i++){
var _c9=_b5.order[i],_c6;
if((_c6=_b5.match[_c9].exec(_c2))){
var _ca=RegExp.leftContext;
if(_ca.substr(_ca.length-1)!=="\\"){
_c6[1]=(_c6[1]||"").replace(/\\/g,"");
set=_b5.find[_c9](_c6,_c3,_c4);
if(set!=null){
_c2=_c2.replace(_b5.match[_c9],"");
break;
}
}
}
}
if(!set){
set=_c3.getElementsByTagName("*");
}
return {set:set,expr:_c2};
};
_a4.filter=function(_cb,set,_cd,not){
var old=_cb,_d0=[],_d1=set,_d2,_d3,_d4=set&&set[0]&&_b3(set[0]);
while(_cb&&set.length){
for(var _d5 in _b5.filter){
if((_d2=_b5.match[_d5].exec(_cb))!=null){
var _d6=_b5.filter[_d5],_d7,_d8;
_d3=false;
if(_d1==_d0){
_d0=[];
}
if(_b5.preFilter[_d5]){
_d2=_b5.preFilter[_d5](_d2,_d1,_cd,_d0,not,_d4);
if(!_d2){
_d3=_d7=true;
}else{
if(_d2===true){
continue;
}
}
}
if(_d2){
for(var i=0;(_d8=_d1[i])!=null;i++){
if(_d8){
_d7=_d6(_d8,_d2,i,_d1);
var _da=not^!!_d7;
if(_cd&&_d7!=null){
if(_da){
_d3=true;
}else{
_d1[i]=false;
}
}else{
if(_da){
_d0.push(_d8);
_d3=true;
}
}
}
}
}
if(_d7!==undefined){
if(!_cd){
_d1=_d0;
}
_cb=_cb.replace(_b5.match[_d5],"");
if(!_d3){
return [];
}
break;
}
}
}
if(_cb==old){
if(_d3==null){
throw "Syntax error, unrecognized expression: "+_cb;
}else{
break;
}
}
old=_cb;
}
return _d1;
};
var _b5=_a4.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF_-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(_db){
return _db.getAttribute("href");
}},relative:{"+":function(_dc,_dd,_de){
var _df=typeof _dd==="string",_e0=_df&&!(/\W/).test(_dd),_e1=_df&&!_e0;
if(_e0&&!_de){
_dd=_dd.toUpperCase();
}
for(var i=0,l=_dc.length,_e4;i<l;i++){
if((_e4=_dc[i])){
while((_e4=_e4.previousSibling)&&_e4.nodeType!==1){
}
_dc[i]=_e1||_e4&&_e4.nodeName===_dd?_e4||false:_e4===_dd;
}
}
if(_e1){
_a4.filter(_dd,_dc,true);
}
},">":function(_e5,_e6,_e7){
var _e8=typeof _e6==="string";
if(_e8&&!(/\W/).test(_e6)){
_e6=_e7?_e6:_e6.toUpperCase();
for(var i=0,l=_e5.length;i<l;i++){
var _eb=_e5[i];
if(_eb){
var _ec=_eb.parentNode;
_e5[i]=_ec.nodeName===_e6?_ec:false;
}
}
}else{
for(var i=0,l=_e5.length;i<l;i++){
var _eb=_e5[i];
if(_eb){
_e5[i]=_e8?_eb.parentNode:_eb.parentNode===_e6;
}
}
if(_e8){
_a4.filter(_e6,_e5,true);
}
}
},"":function(_ed,_ee,_ef){
var _f0=_a1++,_f1=dirCheck;
if(!_ee.match(/\W/)){
var _f2=_ee=_ef?_ee:_ee.toUpperCase();
_f1=dirNodeCheck;
}
_f1("parentNode",_ee,_f0,_ed,_f2,_ef);
},"~":function(_f3,_f4,_f5){
var _f6=_a1++,_f7=dirCheck;
if(typeof _f4==="string"&&!_f4.match(/\W/)){
var _f8=_f4=_f5?_f4:_f4.toUpperCase();
_f7=dirNodeCheck;
}
_f7("previousSibling",_f4,_f6,_f3,_f8,_f5);
}},find:{ID:function(_f9,_fa,_fb){
if(typeof _fa.getElementById!=="undefined"&&!_fb){
var m=_fa.getElementById(_f9[1]);
return m?[m]:[];
}
},NAME:function(_fd,_fe,_ff){
if(typeof _fe.getElementsByName!=="undefined"){
var ret=[],_101=_fe.getElementsByName(_fd[1]);
for(var i=0,l=_101.length;i<l;i++){
if(_101[i].getAttribute("name")===_fd[1]){
ret.push(_101[i]);
}
}
return ret.length===0?null:ret;
}
},TAG:function(_104,_105){
return _105.getElementsByTagName(_104[1]);
}},preFilter:{CLASS:function(_106,_107,_108,_109,not,_10b){
_106=" "+_106[1].replace(/\\/g,"")+" ";
if(_10b){
return _106;
}
for(var i=0,elem;(elem=_107[i])!=null;i++){
if(elem){
if(not^(elem.className&&(" "+elem.className+" ").indexOf(_106)>=0)){
if(!_108){
_109.push(elem);
}
}else{
if(_108){
_107[i]=false;
}
}
}
}
return false;
},ID:function(_10e){
return _10e[1].replace(/\\/g,"");
},TAG:function(_10f,_110){
for(var i=0;_110[i]===false;i++){
}
return _110[i]&&_b3(_110[i])?_10f[1]:_10f[1].toUpperCase();
},CHILD:function(_112){
if(_112[1]=="nth"){
var test=/(-?)(\d*)n((?:\+|-)?\d*)/.exec(_112[2]=="even"&&"2n"||_112[2]=="odd"&&"2n+1"||!(/\D/).test(_112[2])&&"0n+"+_112[2]||_112[2]);
_112[2]=(test[1]+(test[2]||1))-0;
_112[3]=test[3]-0;
}
_112[0]=_a1++;
return _112;
},ATTR:function(_114,_115,_116,_117,not,_119){
var name=_114[1].replace(/\\/g,"");
if(!_119&&_b5.attrMap[name]){
_114[1]=_b5.attrMap[name];
}
if(_114[2]==="~="){
_114[4]=" "+_114[4]+" ";
}
return _114;
},PSEUDO:function(_11b,_11c,_11d,_11e,not){
if(_11b[1]==="not"){
if(_11b[3].match(_a0).length>1||(/^\w/).test(_11b[3])){
_11b[3]=_a4(_11b[3],null,null,_11c);
}else{
var ret=_a4.filter(_11b[3],_11c,_11d,true^not);
if(!_11d){
_11e.push.apply(_11e,ret);
}
return false;
}
}else{
if(_b5.match.POS.test(_11b[0])||_b5.match.CHILD.test(_11b[0])){
return true;
}
}
return _11b;
},POS:function(_121){
_121.unshift(true);
return _121;
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
},has:function(elem,i,_12a){
return !!_a4(_12a[3],elem).length;
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
},last:function(elem,i,_13a,_13b){
return i===_13b.length-1;
},even:function(elem,i){
return i%2===0;
},odd:function(elem,i){
return i%2===1;
},lt:function(elem,i,_142){
return i<_142[3]-0;
},gt:function(elem,i,_145){
return i>_145[3]-0;
},nth:function(elem,i,_148){
return _148[3]-0==i;
},eq:function(elem,i,_14b){
return _14b[3]-0==i;
}},filter:{PSEUDO:function(elem,_14d,i,_14f){
var name=_14d[1],_151=_b5.filters[name];
if(_151){
return _151(elem,i,_14d,_14f);
}else{
if(name==="contains"){
return (elem.textContent||elem.innerText||"").indexOf(_14d[3])>=0;
}else{
if(name==="not"){
var not=_14d[3];
for(var i=0,l=not.length;i<l;i++){
if(not[i]===elem){
return false;
}
}
return true;
}
}
}
},CHILD:function(elem,_155){
var type=_155[1],node=elem;
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
var _158=_155[2],last=_155[3];
if(_158==1&&last==0){
return true;
}
var _15a=_155[0],_15b=elem.parentNode;
if(_15b&&(_15b.sizcache!==_15a||!elem.nodeIndex)){
var _15c=0;
for(node=_15b.firstChild;node;node=node.nextSibling){
if(node.nodeType===1){
node.nodeIndex=++_15c;
}
}
_15b.sizcache=_15a;
}
var diff=elem.nodeIndex-last;
if(_158==0){
return diff==0;
}else{
return (diff%_158==0&&diff/_158>=0);
}
}
},ID:function(elem,_15f){
return elem.nodeType===1&&elem.getAttribute("id")===_15f;
},TAG:function(elem,_161){
return (_161==="*"&&elem.nodeType===1)||elem.nodeName===_161;
},CLASS:function(elem,_163){
return (" "+(elem.className||elem.getAttribute("class"))+" ").indexOf(_163)>-1;
},ATTR:function(elem,_165){
var name=_165[1],_167=_b5.attrHandle[name]?_b5.attrHandle[name](elem):elem[name]!=null?elem[name]:elem.getAttribute(name),_168=_167+"",type=_165[2],_16a=_165[4];
return _167==null?type==="!=":type==="="?_168===_16a:type==="*="?_168.indexOf(_16a)>=0:type==="~="?(" "+_168+" ").indexOf(_16a)>=0:!_16a?_168&&_167!==false:type==="!="?_168!=_16a:type==="^="?_168.indexOf(_16a)===0:type==="$="?_168.substr(_168.length-_16a.length)===_16a:type==="|="?_168===_16a||_168.substr(0,_16a.length+1)===_16a+"-":false;
},POS:function(elem,_16c,i,_16e){
var name=_16c[2],_170=_b5.setFilters[name];
if(_170){
return _170(elem,i,_16c,_16e);
}
}}};
var _b4=_b5.match.POS;
for(var type in _b5.match){
_b5.match[type]=new RegExp(_b5.match[type].source+(/(?![^\[]*\])(?![^\(]*\))/).source);
}
var _b8=function(_172,_173){
_172=Array.prototype.slice.call(_172);
if(_173){
_173.push.apply(_173,_172);
return _173;
}
return _172;
};
try{
Array.prototype.slice.call(document.documentElement.childNodes);
}
catch(e){
_b8=function(_174,_175){
var ret=_175||[];
if(_a2.call(_174)==="[object Array]"){
Array.prototype.push.apply(ret,_174);
}else{
if(typeof _174.length==="number"){
for(var i=0,l=_174.length;i<l;i++){
ret.push(_174[i]);
}
}else{
for(var i=0;_174[i];i++){
ret.push(_174[i]);
}
}
}
return ret;
};
}
var _be;
if(document.documentElement.compareDocumentPosition){
_be=function(a,b){
var ret=a.compareDocumentPosition(b)&4?-1:a===b?0:1;
if(ret===0){
_a3=true;
}
return ret;
};
}else{
if("sourceIndex" in document.documentElement){
_be=function(a,b){
var ret=a.sourceIndex-b.sourceIndex;
if(ret===0){
_a3=true;
}
return ret;
};
}else{
if(document.createRange){
_be=function(a,b){
var _181=a.ownerDocument.createRange(),_182=b.ownerDocument.createRange();
_181.selectNode(a);
_181.collapse(true);
_182.selectNode(b);
_182.collapse(true);
var ret=_181.compareBoundaryPoints(Range.START_TO_END,_182);
if(ret===0){
_a3=true;
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
_b5.find.ID=function(_187,_188,_189){
if(typeof _188.getElementById!=="undefined"&&!_189){
var m=_188.getElementById(_187[1]);
return m?m.id===_187[1]||typeof m.getAttributeNode!=="undefined"&&m.getAttributeNode("id").nodeValue===_187[1]?[m]:undefined:[];
}
};
_b5.filter.ID=function(elem,_18c){
var node=typeof elem.getAttributeNode!=="undefined"&&elem.getAttributeNode("id");
return elem.nodeType===1&&node&&node.nodeValue===_18c;
};
}
root.removeChild(form);
})();
(function(){
var div=document.createElement("div");
div.appendChild(document.createComment(""));
if(div.getElementsByTagName("*").length>0){
_b5.find.TAG=function(_18f,_190){
var _191=_190.getElementsByTagName(_18f[1]);
if(_18f[1]==="*"){
var tmp=[];
for(var i=0;_191[i];i++){
if(_191[i].nodeType===1){
tmp.push(_191[i]);
}
}
_191=tmp;
}
return _191;
};
}
div.innerHTML="<a href='#'></a>";
if(div.firstChild&&typeof div.firstChild.getAttribute!=="undefined"&&div.firstChild.getAttribute("href")!=="#"){
_b5.attrHandle.href=function(elem){
return elem.getAttribute("href",2);
};
}
})();
if(document.querySelectorAll){
(function(){
var _195=_a4,div=document.createElement("div");
div.innerHTML="<p class='TEST'></p>";
if(div.querySelectorAll&&div.querySelectorAll(".TEST").length===0){
return;
}
_a4=function(_197,_198,_199,seed){
_198=_198||document;
if(!seed&&_198.nodeType===9&&!_b3(_198)){
try{
return _b8(_198.querySelectorAll(_197),_199);
}
catch(e){
}
}
return _195(_197,_198,_199,seed);
};
for(var prop in _195){
_a4[prop]=_195[prop];
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
_b5.order.splice(1,0,"CLASS");
_b5.find.CLASS=function(_19d,_19e,_19f){
if(typeof _19e.getElementsByClassName!=="undefined"&&!_19f){
return _19e.getElementsByClassName(_19d[1]);
}
};
})();
}
function dirNodeCheck(dir,cur,_1a2,_1a3,_1a4,_1a5){
var _1a6=dir=="previousSibling"&&!_1a5;
for(var i=0,l=_1a3.length;i<l;i++){
var elem=_1a3[i];
if(elem){
if(_1a6&&elem.nodeType===1){
elem.sizcache=_1a2;
elem.sizset=i;
}
elem=elem[dir];
var _1aa=false;
while(elem){
if(elem.sizcache===_1a2){
_1aa=_1a3[elem.sizset];
break;
}
if(elem.nodeType===1&&!_1a5){
elem.sizcache=_1a2;
elem.sizset=i;
}
if(elem.nodeName===cur){
_1aa=elem;
break;
}
elem=elem[dir];
}
_1a3[i]=_1aa;
}
}
}
function dirCheck(dir,cur,_1ad,_1ae,_1af,_1b0){
var _1b1=dir=="previousSibling"&&!_1b0;
for(var i=0,l=_1ae.length;i<l;i++){
var elem=_1ae[i];
if(elem){
if(_1b1&&elem.nodeType===1){
elem.sizcache=_1ad;
elem.sizset=i;
}
elem=elem[dir];
var _1b5=false;
while(elem){
if(elem.sizcache===_1ad){
_1b5=_1ae[elem.sizset];
break;
}
if(elem.nodeType===1){
if(!_1b0){
elem.sizcache=_1ad;
elem.sizset=i;
}
if(typeof cur!=="string"){
if(elem===cur){
_1b5=true;
break;
}
}else{
if(_a4.filter(cur,[elem]).length>0){
_1b5=elem;
break;
}
}
}
elem=elem[dir];
}
_1ae[i]=_1b5;
}
}
}
var _bc=document.compareDocumentPosition?function(a,b){
return a.compareDocumentPosition(b)&16;
}:function(a,b){
return a!==b&&(a.contains?a.contains(b):true);
};
var _b3=function(elem){
return elem.nodeType===9&&elem.documentElement.nodeName!=="HTML"||!!elem.ownerDocument&&elem.ownerDocument.documentElement.nodeName!=="HTML";
};
var _b6=function(_1bb,_1bc){
var _1bd=[],_1be="",_1bf,root=_1bc.nodeType?[_1bc]:_1bc;
while((_1bf=_b5.match.PSEUDO.exec(_1bb))){
_1be+=_1bf[0];
_1bb=_1bb.replace(_b5.match.PSEUDO,"");
}
_1bb=_b5.relative[_1bb]?_1bb+"*":_1bb;
for(var i=0,l=root.length;i<l;i++){
_a4(_1bb,root[i],_1bd);
}
return _a4.filter(_1be,_1bd);
};
Playdar.Util.select=_a4;
})();

