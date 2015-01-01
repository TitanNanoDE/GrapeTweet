$_('grapeTweet').module('Net', ['Misc', 'Storage'], function(App, done){

	var AsyncLoop= $('classes').AsyncLoop;

    var { Misc, Storage } = App.modules;

	var interface= {

//		download existing direct messages
		downloadDirectMessages : function(){
			return new $$.Promise(function(done){
				var max_id_in= 0;
				var max_id_out= 0;
				var conversations= {};

				var loopIn= new AsyncLoop(function(next, exit){
					var request= null;

					if(max_id_in === 0)
						request= App.twitterSocket.get('/1.1/direct_messages.json', { count : 200 });
					else
						request= App.twitterSocket.get('/1.1/direct_messages.json', { max_id : max_id_in, count : 200 });

					request.then(function(data){
						data= $$.JSON.parse(data);

						if(max_id_in !== 0)
							data.shift();

						if(data.length === 0)
							return exit();

						data.forEach(function(item){
							delete item.recipient;
							delete item.sender;

							if(App.dataStatus.lastDM_in === ''){
								App.dataStatus.lastDM_in= item.id_str;
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
						request= App.twitterSocket.get('/1.1/direct_messages/sent.json', { count : 200 });
					else
						request= App.twitterSocket.get('/1.1/direct_messages/sent.json', { max_id : max_id_out, count : 200 });

					request.then(function(data){
						data= $$.JSON.parse(data);

						if(max_id_out !== 0)
							data.shift();

						if(data.length === 0)
							return exit();

						data.forEach(function(item){
							delete item.recipient;
							delete item.sender;

							if(App.dataStatus.lastDM_out === ''){
								App.dataStatus.lastDM_out= item.id_str;
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
						conversations[key].sort(Misc.sortByDate);
						conversations[key].forEach(function(message, index){
							message.last= (index-1 > -1) ? conversations[key][index-1].id_str : null;
							message.next= (index+1 < conversations[key].length) ? conversations[key][index+1].id_str : null;
							Storage.storeMessage(message).catch($$.console.log);
						});

						Storage.storeConversation(App.createConversation(key, conversations[key].last().id_str, 0));
					});

					done();
				});
			});
		},

//		fetch the new direct messages
		fetchNewMessages : function(){
			return new Promise(function(){

				var loopIn= new AsyncLoop(function(next, exit){
					var request= App.twitterSocket.get('/1.1/direct_messages.json', { since_id : App.dataStatus.lastDM_in, count : 200 });

					request.then(function(data){
						data= $$.JSON.parse(data);

						if(data.length === 0)
							return exit();

						data.forEach(function(item, index){
							delete item.recipient;
							delete item.sender;

							if(index === 0){
								App.dataStatus.lastDM_in= item.id_str;
							}

							Storage.storeMessage(item).catch(function(e){
								$$.console.log(e);
							});
						});

						next();
					});

					request.catch(exit);
				});

				var loopOut= new AsyncLoop(function(next, exit){
					var request= App.twitterSocket.get('/1.1/direct_messages/sent.json', { since_id : App.dataStatus.lastDM_out, count : 200 });

					request.then(function(data){
						data= $$.JSON.parse(data);

						if(data.length === 0)
							return exit();

						data.forEach(function(item, index){
							delete item.recipient;
							delete item.sender;

							if(index === 0){
								App.dataStatus.lastDM_out= item.id_str;
							}
							var convId= (item.sender_id != App.account.userId) ? item.sender_id : item.recipient_id;

				            Storage.getConversation(convId).then(function(conversation){
								App.integrateIntoMessagesChain(item, conversation);
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
		syncContacts : function(){
    		return new $$.Promise(function(success){
				var following= App.syncStatus.contacts.followingCache;
				var follower= App.syncStatus.contacts.followerCache;
				var contactsList= App.syncStatus.contacts.contactsCache;

				var followerLoop= new AsyncLoop(function(next, exit){
                    var request= null;

					if(App.syncStatus.contacts.nextFollowerCursor != '0')
				        request= App.twitterSocket.get('/1.1/followers/ids.json', { user_id : App.account.userId, cursor : App.syncStatus.contacts.nextFollowerCursor });
					else{
						return exit();
					}

					request.then(function(data){
						data= $$.JSON.parse(data);

						follower= follower.concat(data.ids);
						App.syncStatus.apply({
							contacts : {
								nextFollowerCursor : data.next_cursor
							}
						});
						return next();
					});

					request.catch(function(e){
						App.syncStatus.apply({
							contacts : {
								followerCache : follower
							}
						});
						var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
						$$.setTimeout(function(){ interface.syncContacts(); }, timeout);
						return exit();
					});
				});

				var followingLoop= new AsyncLoop(function(next, exit){
					var request= null;

                    if(App.syncStatus.contacts.nextFollowingCursor != '0')
						request= App.twitterSocket.get('/1.1/friends/ids.json', { user_id : App.account.userId, cursor : App.syncStatus.contacts.nextFollowingCursor });
					else{
						return exit();
					}

					request.then(function(data){
						data= $$.JSON.parse(data);

						following= following.concat(data.ids);
						App.syncStatus.apply({
							contacts : {
								nextFollowingCursor : data.next_cursor
							}
						});
						next();
					});

					request.catch(function(e){
						App.syncStatus.apply({
							contacts : {
								followingCache : follower
							}
						});
						var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
						$$.setTimeout(function(){ interface.syncContacts(); }, timeout);
						exit();
					});
				});

				var userInfoLoop= new AsyncLoop(function(next, exit){
					var list= null;

					if(contactsList.length > 0){

						App.syncStatus.apply({
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

						var request= App.twitterSocket.get('/1.1/users/lookup.json', { user_id : list.join(','), include_entities : false });

						request.then(function(contacts){
							contacts= $$.JSON.parse(contacts);

							contacts.forEach(function(item){
				                Storage.storeContact(item);
							});
							next();
						});

						request.catch(function(e){
							App.syncStatus.apply({
								contacts : {
									contactsCache : contactsList
								}
							});
							var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
							$$.setTimeout(function(){ interface.syncContacts(); }, timeout);
							exit();
						});
					}else{
						App.syncStatus.apply({
							contacts : {
								fetchingInfo : false
							}
						});
						return exit();
					}
				});

				var scheduleNext= function(){
					$$.setTimeout(function(){ interface.syncContacts(); }, untilNextSync);

					untilNextSync= Math.round(untilNextSync / 1000);
					if(untilNextSync < 60)
						untilNextSync= untilNextSync + ' seconds';
					else
						untilNextSync= Math.round(untilNextSync / 60) + ' minutes';

					$$.console.log('contacts are synchronized again in ' + untilNextSync + '!');
                    success();
				};

				var timeout= Date.now() - App.syncStatus.contacts.lastSync;
				var untilNextSync= 1800000 - timeout;
				untilNextSync= ((untilNextSync > 0) ? untilNextSync : 1800000);

//				only sync every 30 minutes
				if( timeout >  1800000 || App.syncStatus.contacts.fetchingInfo || App.syncStatus.contacts.nextFollowerCursor != '-1'){

//					start or continue fetching contacts ids unless we have pending contact info requests
					if(!App.syncStatus.contacts.fetchingInfo){
						$$.Promise.all([followerLoop.incalculable(), followingLoop.incalculable()]).then(function(){

//							check if download is complete
							if(App.syncStatus.contacts.nextFollowingCursor == '0' && App.syncStatus.contacts.nextFollowerCursor == '0'){
								App.syncStatus.apply({
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

		cacheImage : function(url){
			return new $$.Promise(function(done){
				if(App.cache.images[url])
					done(App.cache.images[url]);
				else{
					App.twitterSocket.download(url, true).then(function(blob){
						var blob_url= $$.URL.createObjectURL(blob);
						App.cache.images[url]= [blob_url, blob];
						done([blob_url, blob]);
					});
				}
			});
		},

		sendDirectMessage : function(text){
			return new $$.Promise(function(done){
				var request= App.twitterSocket.request('/1.1/direct_messages/new.json', { user_id : App.dataStatus.lastChat, text : text });

				$$.Promise.all([request, Storage.getConversation(App.dataStatus.lastChat)]).then(function(values){
					var message= $$.JSON.parse(values[0]);
					var conversation= values[1];

					message.placeholder= true;

					App.integrateIntoMessagesChain(message, conversation).then(done);
				});
				request.catch(function(e){
					$$.console.error(e);
				});
			});
		},

		uploadMedia : function(blob, direct_message, onprogress){
			return new $$.Promise(function(done){
				App.twitterSocket.upload('https://upload.twitter.com/1.1/media/upload.json', blob, onprogress, true).then(function(data){
					var media_id= JSON.parse(data).media_id_string;
					data= {
						user_id : App.dataStatus.lastChat,
						include_entities : '1',
						include_user_entities: '1',
						send_error_codes :'1'
					};

					if(direct_message){
						data.text= '';
						data.media_id= media_id;
					}else{
						data.status= '';
						data.media_ids= media_id;
					}

					var request= App.twitterSocket.request((direct_message ? '/1.1/direct_messages/new.json' : '/1.1/statuses/update.json'), data);

					$$.Promise.all([request, Storage.getConversation(App.dataStatus.lastChat)]).then(function(values){
						if(direct_message){
							var message= $$.JSON.parse(values[0]);
							var conversation= values[1];
							message.placeholder= true;

							App.integrateIntoMessagesChain(message, conversation).then(done);
						}else{
							done();
						}
					});

					request.catch(function(e){
						$$.console.log(e);
					});
				}, function(e){
					$$.console.error(e);
				});
			});
		},

		fetchNewHomeTweets : function(timeline){
			return new $$.Promise(function(done, error){
                var data= { count : 100 };
                if(timeline.last) data.since_id= timeline.last;
				App.twitterSocket.get('/1.1/statuses/home_timeline.json', data).then(function(tweets){
					tweets= $$.JSON.parse(tweets).reverse();
                    tweets.forEach(function(item){
                        App.integrateIntoTimeline(item, timeline);
                    });
					done();
				},
                function(e){
                    $$.console.error(e);
                    error();
                });
			});
		}
	};

    done(interface);
});
