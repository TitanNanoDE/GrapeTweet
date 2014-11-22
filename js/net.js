$_('grapeTweet').module('net', function(done){
	
	var AsyncLoop= $('classes').AsyncLoop;

	done({
		
//		download existing direct messages
		downloadDirectMessages : function(app){
			return new $$.Promise(function(done){
				var max_id_in= 0;
				var max_id_out= 0;
				var conversations= {};
			
				var loopIn= new AsyncLoop(function(next, exit){
					var request= null;

					if(max_id_in === 0)
						request= app.twitterSocket.get('/1.1/direct_messages.json', { count : 200 });
					else
						request= app.twitterSocket.get('/1.1/direct_messages.json', { max_id : max_id_in, count : 200 });
      	
					request.then(function(data){
						data= $$.JSON.parse(data);
						
						if(max_id_in !== 0)
							data.shift();
					
						if(data.length === 0)
							return exit();
				
						data.forEach(function(item){
							delete item.recipient;
							delete item.sender;
					
							if(app.dataStatus.lastDM_in === ''){
								app.dataStatus.lastDM_in= item.id_str;
							}	
							
							conversations[item.sender_id]= conversations[item.sender_id] || [];
							conversations[item.sender_id].push(item);

							
							max_id_in= item.id_str;
						});
					
						next();
					});
					
					request.catch(exit);
				});
			
				var loopOut= new AsyncLoop(function(next, exit){
					var request= null;
					
					if(max_id_out === 0)
						request= app.twitterSocket.get('/1.1/direct_messages/sent.json', { count : 200 });
					else
						request= app.twitterSocket.get('/1.1/direct_messages/sent.json', { max_id : max_id_out, count : 200 });
      		
					request.then(function(data){
						data= $$.JSON.parse(data);
					
						if(max_id_out !== 0)
							data.shift();
					
						if(data.length === 0)
							return exit();
					
						data.forEach(function(item){
							delete item.recipient;
							delete item.sender;
						
							if(app.dataStatus.lastDM_out === ''){
								app.dataStatus.lastDM_out= item.id_str;
							}
					
							conversations[item.recipient_id]= conversations[item.recipient_id] || [];
							conversations[item.recipient_id].push(item);

							max_id_out= item.id_str;
						});
					
						next();
					});
					
					request.catch(exit);
				});
			
				$$.Promise.all([loopIn.incalculable(), loopOut.incalculable()]).then(function(){
					$$.Object.keys(conversations).forEach(function(key){
						conversations[key].sort(app.misc.sortByDate);
						conversations[key].forEach(function(message, index){
							message.last= (index-1 > -1) ? conversations[key][index-1].id_str : null;
							message.next= (index+1 < conversations[key].length) ? conversations[key][index+1].id_str : null;
							app.storage.storeMessage(message).catch($$.console.log);
						});
						
						app.storage.storeConversation(app.createConversation(key, conversations[key].last().id_str, 0));
					});
					
					done();
				});
			});
		},
		
//		fetch the new direct messages
		fetchNewMessages : function(app){
			return new Promise(function(){
				
				var loopIn= new AsyncLoop(function(next, exit){
					var request= app.twitterSocket.get('/1.1/direct_messages.json', { since_id : app.dataStatus.lastDM_in, count : 200 });
      	
					request.then(function(data){
						data= $$.JSON.parse(data);
					
						if(data.length === 0)
							return exit();
				
						data.forEach(function(item, index){
							delete item.recipient;
							delete item.sender;
					
							if(index === 0){
								app.dataStatus.lastDM_in= item.id_str;
							}	
							
							app.storage.storeMessage(item).catch(function(e){
								$$.console.log(e);
							});
						});
					
						next();
					});
					
					request.catch(exit);
				});
			
				var loopOut= new AsyncLoop(function(next, exit){
					var request= app.twitterSocket.get('/1.1/direct_messages/sent.json', { since_id : app.dataStatus.lastDM_out, count : 200 });
      		
					request.then(function(data){
						data= $$.JSON.parse(data);
					
						if(data.length === 0)
							return exit();
					
						data.forEach(function(item, index){
							delete item.recipient;
							delete item.sender;
						
							if(index === 0){
								app.dataStatus.lastDM_out= item.id_str;
							}
							var convId= (item.sender_id != app.account.userId) ? item.sender_id : item.recipient_id;
							
							app.storage.getConversation(convId).then(function(conversation){
								app.integrateIntoMessagesChain(item, conversation);
							});
						});
					
						next();
					});
					
					request.catch(exit);
				});
				
				$$.Promise.all([loopIn.incalculable(), loopOut.incalculable()]).then(done);
			});
		},
		
//		synchonizing contacts
		syncContacts : function(app){
    		return new $$.Promise(function(success){
				var following= app.syncStatus.contacts.followingCache;
				var follower= app.syncStatus.contacts.followerCache;
				var contactsList= app.syncStatus.contacts.contactsCache;
				
				var followerLoop= new AsyncLoop(function(next, exit){
                    var request= null;

					if(app.syncStatus.contacts.nextFollowerCursor != '0')
				        request= app.twitterSocket.get('/1.1/followers/ids.json', { user_id : app.account.userId, cursor : app.syncStatus.contacts.nextFollowerCursor });
					else{
						return exit();
					}
					
					request.then(function(data){
						data= $$.JSON.parse(data);
					
						follower= follower.concat(data.ids);
						app.syncStatus.apply({
							contacts : {
								nextFollowerCursor : data.next_cursor
							}
						});
						return next();
					});
						
					request.catch(function(e){
						app.syncStatus.apply({
							contacts : {
								followerCache : follower
							}
						});
						var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
						$$.setTimeout(function(){ app.net.syncContacts(app); }, timeout);
						return exit();
					});
				});
					
				var followingLoop= new AsyncLoop(function(next, exit){
					var request= null;

                    if(app.syncStatus.contacts.nextFollowingCursor != '0')
						request= app.twitterSocket.get('/1.1/friends/ids.json', { user_id : app.account.userId, cursor : app.syncStatus.contacts.nextFollowingCursor });
					else{
						return exit();
					}
				
					request.then(function(data){
						data= $$.JSON.parse(data);
					
						following= following.concat(data.ids);
						app.syncStatus.apply({
							contacts : {
								nextFollowingCursor : data.next_cursor
							}
						});
						next();
					});
					
					request.catch(function(e){
						app.syncStatus.apply({
							contacts : {
								followingCache : follower
							}
						});
						var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
						$$.setTimeout(function(){ app.net.syncContacts(app); }, timeout);
						exit();
					});
				});
				
				var userInfoLoop= new AsyncLoop(function(next, exit){
					var list= null;
					
					if(contactsList.length > 0){
						
						app.syncStatus.apply({
							contacts : {
								fetchingInfo : true
							}
						});
						
						if(contactsList.length > 100){
							list= [];
							for(var i= 0; i <= 100; i++){
								list.push(contactsList.shift());
							}
						}else{
							list= contactsList;
							contactsList= [];
						}
						
						var request= app.twitterSocket.get('/1.1/users/lookup.json', { user_id : list.join(','), include_entities : false });
						
						request.then(function(contacts){
							contacts= $$.JSON.parse(contacts);
							
							contacts.forEach(function(item){
								app.storage.storeContact(item);
							});
							next();
						});
						
						request.catch(function(e){
							app.syncStatus.apply({
								contacts : {
									contactsCache : contactsList
								}
							});
							var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
							$$.setTimeout(function(){ app.net.syncContacts(app); }, timeout);
							exit();
						});
					}else{
						app.syncStatus.apply({
							contacts : {
								fetchingInfo : false
							}
						});
						return exit();
					}
				});
				
				var scheduleNext= function(){
					$$.setTimeout(function(){ app.net.syncContacts(app); }, untilNextSync);
				
					untilNextSync= Math.round(untilNextSync / 1000);
					if(untilNextSync < 60)
						untilNextSync= untilNextSync + ' seconds';
					else
						untilNextSync= Math.round(untilNextSync / 60) + ' minutes';
					
					$$.console.log('contacts are synchronized again in ' + untilNextSync + '!');
					app.ui.renderContacts(app).then(success);
				};
				
				var timeout= Date.now() - app.syncStatus.contacts.lastSync;
				var untilNextSync= 1800000 - timeout;
				untilNextSync= ((untilNextSync > 0) ? untilNextSync : 1800000);
				
//				only sync every 30 minutes
				if( timeout >  1800000 || app.syncStatus.contacts.fetchingInfo || app.syncStatus.contacts.nextFollowerCursor != '-1'){
					
//					start or continue fetching contacts ids unless we have pending contact info requests
					if(!app.syncStatus.contacts.fetchingInfo){
						$$.Promise.all([followerLoop.incalculable(), followingLoop.incalculable()]).then(function(){
						
//							check if download is complete
							if(app.syncStatus.contacts.nextFollowingCursor == '0' && app.syncStatus.contacts.nextFollowerCursor == '0'){
								app.syncStatus.apply({
									contacts : {
										nextFollowingCursor : '-1',
										nextFollowerCursor : '-1',
										lastSync : $$.Date.now()
									}
								});
							}
						
//      					isolating contacts
							if(following.length == Math.min(following.length, follower.length)){
								following.forEach(function(item){
									if(follower.indexOf(item) > -1)
										contactsList.push(item);
								});
							}else{
								follower.forEach(function(item){
									if(following.indexOf(item) > -1)
										contactsList.push(item);
								});
							}
						
							userInfoLoop.incalculable().then(scheduleNext);
						});
					}else{
						userInfoLoop.incalculable().then(scheduleNext);
					}
					$$.console.log('contacts just synced!');
				}else{
					scheduleNext();
				}
			});
		},
		
		cacheImage : function(url, app){
			return new $$.Promise(function(done){
				if(app.cache.images[url])
					done(app.cache.images[url]);
				else{
					app.twitterSocket.download(url, true).then(function(blob){
						var blob_url= $$.URL.createObjectURL(blob);
						app.cache.images[url]= blob_url;
						done(blob_url);
					});
				}
			});
		},
		
		sendDirectMessage : function(app, text){
			return new $$.Promise(function(done){
				var request= app.twitterSocket.request('/1.1/direct_messages/new.json', { user_id : app.dataStatus.lastChat, text : text });
				
				$$.Promise.all([request, app.storage.getConversation(app.dataStatus.lastChat)]).then(function(values){
					var message= $$.JSON.parse(values[0]);
					var conversation= values[1];
					
					message.placeholder= true;
					
					app.integrateIntoMessagesChain(message, conversation).then(function(){
						app.ui.renderChat(app, app.dataStatus.lastChat).then(done);
					});
				});
				request.catch(function(e){
					$$.console.error(e);
				});
			});
		},
		
		fetchNewHomeTweets : function(app){
			return new $$.Promise(function(done){
				app.twitterSocket.get('/1.1/statuses/home_timeline.json', { trim_user : true,  count : 100, since_id : app.dataStatus.lastTweets.timeline }).then(function(tweets){
					tweets= $$.JSON.parse(tweets);

					done();
				});
			});
		}
	});
});