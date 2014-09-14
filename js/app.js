$_('grapeTweet').main(function(){
  
 	var app= this;
	var OAuthClient= $('connections').classes.OAuthClient;
	var Socket= $('connections').classes.Socket;
	
	var defaultSize= {
		height : $$.innerHeight,
		width : $$.innerWidth
	};
  
  	this.twitterSocket= new OAuthClient('twitter', 'https://api.twitter.com', 'gC7HaQ7T4u8HYGgRIhiLz0xGs', 'vNOVVig70BQl0pXjzpaU7Mf88Jd6O2gzTQ6FavnGUTalGtnMM1', { mozSystem : true });
	this.pushServer= new Socket(Socket.HTTP, 'http://192.168.16.149:8080',  { mozSystem : true });
	this.messageInSound= new $$.Audio('/sounds/recived.mp3');
	this.messageOutSound= new $$.Audio('/sounds/sent.mp3');
	
	$$.app= this;
  
  	this.account= {
		name : 'account',
		unreadMessages : 0,
		userId : 0,
		push : false,
		pushServerId : 0,
		pushEndpoint : ''
	};
	
	this.dataStatus= {
		name : 'dataStatus',
		lastDM_in : '',
		lastDM_out : '',
		lastChat : '',
		lastTweets : [],
		conversationsStatus : {}
	};
	
	this.syncStatus= {
		name : 'syncStatus',
		contacts : {
			fetchingInfo : false,
			nextFollowingCursor : '-1',
			nextFollowerCursor : '-1',
			nextContact : '',
			lastSync : '',
			followerCache : [],
			followingCache : [],
			contactsCache : []
		}	
	};
	
	this.cache= {
		images : {}
	};
	
	this.jobs= [];
	
	var objectReplace= function(target, update){
		$$.Object.keys(update).forEach(function(item){
			if(typeof update[item] == 'object' && !$$.Array.isArray(update[item]) && update[item] != null)
				objectReplace(target[item], update[item]);
			else
				target[item]= update[item];
		});
	};

	var notificationClick= function(e){
		app.openChat(e.target.tag);
		app.show();
	};
	
	var requestNewEndpoint= function(){
		if(!app.account.push){
			var requestPush= $$.navigator.push.register();
	
			requestPush.onsuccess= function(){
				app.pushServer.request('/register', $$.JSON.stringify({ endpoint : requestPush.result })).then(function(data){
					data= $$.JSON.parse(data);
					app.pushServer.request('/verify', $$.JSON.stringify({
						id : data.clientId,
						x1 : app.twitterSocket.exposeToken()[0],
						x2 : app.twitterSocket.exposeToken()[1]
					})).then(function(){
						app.setState({ name : 'account', pushServerId : data.clientId, push : true, pushEndpoint : requestPush.result });
						$$.console.log('push-server successfully registered!');
					});
				});
				$$.console.log('push-server registeration requested...');
			};
			
			requestPush.onerror= function(e){
				$$.console.error('D: we couldn\'t get a new endpoint!! ' + $$.JSON.stringify(e));
			};
		}else{
			$$.navigator.push.registrations().onsuccess= function(){
				this.result.forEach(function(item){
					$$.navigator.push.unregister(item.pushEndpoint);
				});
				
				var request= $$.navigator.push.register();
				
				request.onsuccess= function(){
					app.pushServer.request('/updateEndpoint', $$.JSON.stringify({ id : app.account.pushServerId, endpoint : request.result })).then(function(data){
						data= $$.JSON.parse(data);
						
						if(data.status != 'failed'){
							app.setState({ name : 'account', pushEndpoint : request.result });
							$$.console.log('push-endpoint successfully updated!');
						}else{
							$$.console.error('push-endpoint update failed');
						}
					});
				};
				
				request.onerror= function(e){
					$$.console.error('D: we couldn\'t get a new endpoint!! ' + $$.JSON.stringify(e));
				};
				
				$$.console.log('push-enpoint update requested...');
			};
			
		}
	};
	
	app.endpoint= requestNewEndpoint;
	
	app.openChat= function(e){
		var id = ((e.target) ? e.target.dataset.userId : e);
		
		app.ui.renderChat(app, id).then(function(){
			$$.location.hash= '#!/messages/chat';
		});
	};
	
	this.setState= function(update){
		var name= update.name;
		delete update.name;
		objectReplace(app[name], update);
		app.storage.saveApplicationState(app[name]);
	};
	
	this.loadTimeline= function(){
    	this.twitterSocket.request('/statuses/home_timeline.json', { count : 50, include_entities : 'true'});
  	};
	
	this.notify= function(message){
		if(message.sender_id != app.account.userId){
			app.ui.renderConversations(app);
			
			var count= app.account.unreadMessages;
			if(count > 0)
				count++;
			else
				count= 1;
			app.setState({
				name : 'account',
				unreadMessages : count
			});
			app.ui.renderFooterStatus(app.account);
			
			if($$.document.hidden || $$.location.hash.indexOf('/messages') < 0){
				var notification= new $$.Notification(message.sender.name, {
					body : message.text.substr(0, 40),
					tag : message.sender_id,
					icon : message.sender.profile_image_url
				});
		
				notification.addEventListener('click', notificationClick, false);
			}else{
				app.messageInSound.play();
			}
		}else if(!$$.document.hidden){
			app.messageOutSound.play();
		}
	};
	
	this.show= function(){
		if($$.document.hidden){
			$$.navigator.mozApps.getSelf().onsuccess= function(e){
				e.target.result.launch();
    		};
  		}	
	};
	
//	mouse events for lists
	$('dom').select('.conv-list').addEventListener('click', app.openChat, false);
	$('dom').select('.contact-list').addEventListener('click', app.openChat, false);
  
	$('dom').selectAll('.tweet-list .tweet').forEach(function(item){
		item.addEventListener('click', function(){
			if(this.classList.contains('collapsed'))
				this.classList.remove('collapsed');
			else
				this.classList.add('collapsed');
		}, false);	
	});
	
//	listen for keyboard
	$$.addEventListener('resize', function(){
		
//		keyboard is open
		if($$.innerHeight < defaultSize.height && $$.innerWidth == defaultSize.width){
//			splash screen
			$('dom').select('.splash .logo').classList.add('hidden');
			
//			chat
			$('dom').select('.client').classList.add('footer-closed');
			var chatbody= $('dom').select('.chat .body');
			chatbody.scrollTop= chatbody.scrollTopMax;
	
//		keyboard is closed
		}else{
//			splash screen
			$('dom').select('.splash .logo').classList.remove('hidden');
			
//			chat
			$('dom').select('.client').classList.remove('footer-closed');
		}
	}, false);
  
//	top level navigation 
  	$('hash').mount(['/', '/streams', '/messages', '/notifications', '/find', '/settings'], function(path){
		var sheet= path.split('/')[1];
		sheet= (sheet === '') ? 'streams' : sheet;
    
		$('dom').select('.footer .'+sheet).classList.add('active');
    	app.ui.switchSheet('.sheet.'+sheet);
  	}, function(path){
    	var sheet= path.split('/')[1];
		sheet= (sheet === '') ? 'streams' : sheet;
    
		$('dom').select('.footer .'+sheet).classList.remove('active');
	});
  
// 	messages navigation
  	$('hash').mount('/messages/contacts', function(){
		$('dom').select('.sheet.messages .contacts').classList.remove('right');
	}, function(){
		$('dom').select('.sheet.messages .contacts').classList.add('right');
  	}, true);
	
  	$('hash').mount('/messages/chat', function(){
		app.ui.pagesToLeft('messages', 'conversations', 'chat');
	}, function(){
		app.ui.renderConversations(app);
		app.ui.pagesFromLeft('messages', 'chat', 'conversations');
  	}, true);
  
// 	settings
  	$('hash').mount('/settings/about', function(){
		app.ui.pagesToLeft('settings', 'main', 'about');
	}, function(){
		app.ui.pagesFromLeft('settings', 'about', 'main');
  	}, true);
  
// 	profile
  	$('hash').mount('/profile', function(){
    	$('dom').select('.sheet.profile').classList.remove('bottom');
  	}, function(){
		$('dom').select('.sheet.profile').classList.add('bottom');
	});
  
// 	check the current login  
	(new $$.Promise(function(done){
		if(!app.twitterSocket.isLoggedIn()){
    	
			app.twitterSocket.requestToken('/oauth/request_token', 'oob').then(function(){
				$('dom').select('.splash .signIn').classList.remove('hidden');
			});
    
			$('dom').select('.splash .signIn').addEventListener('click', function(){
				app.twitterSocket.authenticate('/oauth/authenticate');
				var verify= $('dom').select('.splash .verify');
				var code= $('dom').select('.splash .code');
        
				$('dom').select('.splash .signIn').classList.add('hidden');
				code.classList.remove('hidden');
				verify.classList.remove('hidden');
        
				verify.addEventListener('click', function(){
					app.twitterSocket.verify('/oauth/access_token', code.value).then(function(userId){
						app.setState({
							name : 'account',
							userId : userId
						});
						done();
					});
				}, false);
			}, false);
    
  		}else{
			done();
		}
	})).then(function(){
		$('dom').select('.splash .loading').classList.remove('hidden');
		
		app.jobs.push(new Promise(function(done){			
			app.storage.checkDirectMessages().then(function(directMessagesStored){
				if(!directMessagesStored)
					app.net.downloadDirectMessages(app).then(done);
				else
					done();
			});
		}));
		
		app.jobs.push(new Promise(function(done){
			$$.Promise.all([
				app.storage.getApplicationState('account'), 
				app.storage.getApplicationState('dataStatus'), 
				app.storage.getApplicationState('syncStatus')
			]).then(function(values){
				values.forEach(function(item){
					if(item)
						app.setState(item);
				});
				
				app.net.syncContacts(app).then(done);
			});
		}));
		
		$$.Promise.all(app.jobs).then(function(){
			app.jobs= [];
		
			app.jobs.push(app.ui.renderConversations(app));
			app.jobs.push(new $$.Promise(function(done){
				$('hash').restore();
			
				if($$.location.hash.indexOf('/chat') > -1)
					app.ui.renderChat(app, app.dataStatus.lastChat).then(done);
				else
					done();
			}));
			
			$$.navigator.mozSetMessageHandler('push-register', function(){
				requestNewEndpoint();
			});
			
			if(!app.account.push){
				requestNewEndpoint();
			}else{
				$$.console.log('push server already registered!');	 
			}
    	
			$$.Promise.all(app.jobs).then(function(){
//				the app is ready, so we are ready to handle pushs 
				$$.navigator.mozSetMessageHandler('push', function(e){
					$$.console.log('new push version: '+ e.version);
					app.pushServer.request('/pull', $$.JSON.stringify({ id : app.account.pushServerId })).then(function(record){
						record= $$.JSON.parse(record);
						record.forEach(function(item){
							if(item.type == 'direct_message'){
								app.storage.storeMessage(item).then(function(){
									var chatPage= $('dom').select('.message-list');
									if(item.sender_id == chatPage.dataset.userId || item.recipient_id == chatPage.dataset.userId)
										app.ui.renderChat(app, chatPage.dataset.userId);
								});
								app.notify(item);
							}else if(item.type == 'server_crash'){
								app.pushServer.request('/reverify', $$.JSON.stringify({
									id : app.account.pushServerId,
									x1 : app.twitterSocket.exposeToken()[0],
									x2 : app.twitterSocket.exposeToken()[1]
								})).then();
							}
						});
					});
				});
				
// 				everything is done we can open the UI.
				$('dom').select('.splash .loading').classList.add('hidden');
				$('dom').select('.client').classList.remove('right');
				$('dom').select('.splash').transition('left').then(function(){
					$('dom').select('.splash').classList.add('hidden');
				});
			});
		});
	});
});
