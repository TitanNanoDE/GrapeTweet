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

							if(App.DataStatus.DMs.lastIn === ''){
								App.DataStatus.DMs.lastIn= item.id_str;
                                App.DataStatus.save();
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
							delete item.sender;

							if(App.DataStatus.DMs.lastOut === ''){
								App.DataStatus.DMs.lastOut= item.id_str;
                                App.DataStatus.save();
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

						App.Conversations.record[key]= App.createConversation(key, conversations[key].last(), 0);
					});

                    App.Conversations.save();

					done();
				});
			});
		},

//		fetch the new direct messages
		fetchNewMessages : function(){
			return new Promise(function(){
				var messagesIn= [];
				var messagesOut= [];

				var loopIn= new AsyncLoop(function(next, exit){
					var request= App.twitterSocket.get('/1.1/direct_messages.json', { since_id : App.DataStatus.DMs.lastIn, count : 200 });

					request.then(function(data){
						data= $$.JSON.parse(data);

						if(data.length === 0)
							return exit();

						data.forEach(function(item){
							delete item.recipient;
							messagesIn.push(item);
						});

                        App.DataStatus.DMs.lastIn= messagesIn.last().id_str;

						next();
					});

					request.catch(exit);
				});

				var loopOut= new AsyncLoop(function(next, exit){
					var request= App.twitterSocket.get('/1.1/direct_messages/sent.json', { since_id : App.DataStatus.DMs.lastOut, count : 200 });

					request.then(function(data){
						data= $$.JSON.parse(data);

						if(data.length === 0)
							return exit();

						data.forEach(function(item){
							delete item.sender;
							messagesOut.push(item);
						});

                        App.DataStatus.DMs.lastOut= messagesOut.last().id_str;

						next();
					});

					request.catch(exit);
				});

				$$.Promise.all([loopIn.incalculable(), loopOut.incalculable()]).then(function(){
					var queue= [];
					messagesIn.sort(Misc.sortByDate);
					messagesOut.sort(Misc.sortByDate);

					messagesIn.concat(messagesOut).sort(Misc.sortByDate).forEach(function(message){
						var convId= (message.sender_id != App.Account.userId ? message.sender_id : message.recipient_id);
						Storage.getConversation(convId).then(function(conversation){
							queue.push(App.integrateIntoMessagesChain(message, conversation));
						});
					});

					$$.Promise.all(queue).then(done);
				});
			});
		},

//		synchonizing contacts
		syncContacts : function(){
    		return new $$.Promise(function(success){
				var following= App.DataStatus.contacts.followingCache;
				var follower= App.DataStatus.contacts.followerCache;
				var contactsList= App.DataStatus.contacts.contactsCache;

				var followerLoop= new AsyncLoop(function(next, exit){
                    var request= null;

					if(App.DataStatus.contacts.nextFollowerCursor != '0')
				        request= App.twitterSocket.get('/1.1/followers/ids.json', { user_id : App.Account.userId, cursor : App.DataStatus.contacts.nextFollowerCursor });
					else{
						return exit();
					}

					request.then(function(data){
						data= $$.JSON.parse(data);

						follower= follower.concat(data.ids);
						App.DataStatus.contacts.nextFollowerCursor= data.next_cursor;
                        App.DataStatus.save();
						return next();
					});

					request.catch(function(e){
						App.DataStatus.contacts.followerCache= follower;
                        App.DataStatus.save();

						var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
						$$.setTimeout(function(){ interface.syncContacts(); }, timeout);

						return exit();
					});
				});

				var followingLoop= new AsyncLoop(function(next, exit){
					var request= null;

                    if(App.DataStatus.contacts.nextFollowingCursor != '0')
						request= App.twitterSocket.get('/1.1/friends/ids.json', { user_id : App.Account.userId, cursor : App.DataStatus.contacts.nextFollowingCursor });
					else{
						return exit();
					}

					request.then(function(data){
						data= $$.JSON.parse(data);

						following= following.concat(data.ids);
						App.DataStatus.contacts.nextFollowingCursor= data.next_cursor;
                        App.DataStatus.save();

						next();
					});

					request.catch(function(e){
						App.objectReplace(App.DataStatus, {
							contacts : {
								followingCache : follower
							}
						});

                        App.DataStatus.contacts.followingCache= follower;
                        App.DataStatus.save();

						var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
						$$.setTimeout(function(){ interface.syncContacts(); }, timeout);

                        exit();
					});
				});

				var userInfoLoop= new AsyncLoop(function(next, exit){
					var list= null;

					if(contactsList.length > 0){

						App.DataStatus.contacts.fetchingInfo= true;
                        App.DataStatus.save();

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

						request.then(function(contactsRaw){
							var contacts= {};

                            $$.JSON.parse(contactsRaw).forEach(function(item){
                                contacts[item.id_str]= item;
                            });

							App.Contacts.record= contacts;
                            App.Contacts.save();

							next();
						});

						request.catch(function(e){
							App.DataStatus.contacts.contactsCache= contactsList;
                            App.DataStatus.save();

							var timeout= ($$.parseInt(e.nextTry) * 1000) - $$.Date.now();
							$$.setTimeout(function(){ interface.syncContacts(); }, timeout);

                            exit();
						});
					}else{
						App.DataStatus.contacts.fetchingInfo= false;
                        App.DataStatus.save();

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

				var timeout= Date.now() - App.DataStatus.contacts.lastSync;
				var untilNextSync= 1800000 - timeout;
				untilNextSync= ((untilNextSync > 0) ? untilNextSync : 1800000);

//				only sync every 30 minutes
				if( timeout >  1800000 || App.DataStatus.contacts.fetchingInfo || App.DataStatus.contacts.nextFollowerCursor != '-1'){

//					start or continue fetching contacts ids unless we have pending contact info requests
					if(!App.DataStatus.contacts.fetchingInfo){
						$$.Promise.all([followerLoop.incalculable(), followingLoop.incalculable()]).then(function(){

//							check if download is complete
							if(App.DataStatus.contacts.nextFollowingCursor == '0' && App.DataStatus.contacts.nextFollowerCursor == '0'){
								App.DataStatus.contacts.nextFollowingCursor= '-1';
								App.DataStatus.contacts.nextFollowerCursor= '-1';
								App.DataStatus.contacts.lastSync= $$.Date.now();

                                App.DataStatus.save();
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

		downloadImage : function(url){
			return new $$.Promise(function(done){
                App.twitterSocket.download(url, true).then(function(blob){
                    var blob_url= $$.URL.createObjectURL(blob);
                    done({ url : blob_url, blob : blob });
                });
			});
		},

		sendDirectMessage : function(text){
			return new $$.Promise(function(done){
				var request= App.twitterSocket.request('/1.1/direct_messages/new.json', { user_id : App.DataStatus.DMs.lastChat, text : text });

				$$.Promise.all([request, Storage.getConversation(App.DataStatus.DMs.lastChat)]).then(function(values){
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
						user_id : App.DataStatus.DMs.lastChat,
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

					$$.Promise.all([request, Storage.getConversation(App.DataStatus.DMs.lastChat)]).then(function(values){
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
		},

        pullPushMessages : function(){
            return App.pushServerSocket.request('/pull', $$.JSON.stringify({ id : App.PushServer.id }));
        }
	};

    done(interface);
});
