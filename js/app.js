$('application').new('socialOn');

$_('socialOn').main(function(){
  
 	var app= this;
	var OAuthClient= $('connections').classes.OAuthClient;
	var AsyncLoop= $('classes').AsyncLoop;
	
	var defaultSize= {
		height : $$.innerHeight,
		width : $$.innerWidth
	};
  
	this.twitterUI= $('dom').select('.client.twitter');
  	this.twitterSocket= new OAuthClient('twitter', 'https://api.twitter.com', 'gC7HaQ7T4u8HYGgRIhiLz0xGs', 'vNOVVig70BQl0pXjzpaU7Mf88Jd6O2gzTQ6FavnGUTalGtnMM1', { mozSystem : true });
	
	$$.app= this;
  
  	this.account= {
		userId : null,
		contacts : {},
		conversations : {},
		lastDM_in : '',
		lastDM_out : '',
	};
	
	this.UI= {
		pagesToLeft : function(sheet, from, to){
			$('dom').select('.sheet.'+ sheet +' .page.'+ from).classList.add('left');
			$('dom').select('.sheet.' + sheet +' .page.'+ to).classList.remove('right');
		},
		pagesFromLeft : function(sheet, from, to){
			$('dom').select('.sheet.' + sheet +' .page.'+ from).classList.add('right');
			$('dom').select('.sheet.'+ sheet +' .page.'+ to).classList.remove('left');
		}
	};
    
	this.switchSheet= function(selector){
		var activeSheet= $('dom').select('.sheet.active');
		var newSheet= $('dom').select(selector);
    
    	if(activeSheet && activeSheet != newSheet){
			app.twitterUI.transition('change').then(function(){
        	newSheet.classList.add('active');
				activeSheet.classList.remove('active');
				$$.setTimeout(function(){
					app.twitterUI.classList.remove('change');
				}, 30);
      		});
    	}else{
			newSheet.classList.add('active');
    	}
  	};
  
	this.loadTimeline= function(){
    	this.twitterSocket.request('/statuses/home_timeline.json', { count : 50, include_entities : 'true'});
  	};
	
	this.loadContacts= function(){
    	return new $$.Promise(function(success){
			$$.Promise.all([app.twitterSocket.get('/1.1/friends/ids.json', { user_id : app.account.userId }), app.twitterSocket.get('/1.1/followers/ids.json', { user_id : app.account.userId })]).then(function(values){
        		var following= $$.JSON.parse(values[0]).ids;
        		var follower= $$.JSON.parse(values[1]).ids;
        		var contacts= [];
        		var getList= [];
        		var idList= [];
        
//      		isolating contacts
        		if(following.length == Math.min(following.length, follower.length)){
					following.forEach(function(item){
						if(follower.indexOf(item) > -1)
							contacts.push(item);
					});
				}else{
					follower.forEach(function(item){
            			if(following.indexOf(item) > -1)
							contacts.push(item);
					});
				}
        
//  	    	loading contacts infos
				var i= 0;
				while(i < contacts.length){
					if(idList.length < 100){
						idList.push(contacts[i]);
					}else{
						getList.push(app.twitterSocket.get('/1.1/users/lookup.json', { user_id : idList.join(','), include_entities : false }));
						idList= [];
						idList.push(contacts[i]);
					}
					i++;
				}
        
				if(idList.length > 0)
					getList.push(app.twitterSocket.get('/1.1/users/lookup.json', { user_id : idList.join(','), include_entities : false }));
        
				$$.Promise.all(getList).then(function(values){
					var contactsInfos= [];
          
					values.forEach(function(item){
						contactsInfos= contactsInfos.concat($$.JSON.parse(item));
					});
          
					contactsInfos.forEach(function(item){
						app.account.contacts[item.id]= item;
					});

//  		      	done, all contacts loaded
					success();
				});
			});
		});	
	};
	
	this.loadDirectMessages= function(){
		return new $$.Promise(function(done){
			var max_id_in= 0;
			var max_id_out= 0;
			
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
          
						if(!app.account.conversations[item.sender_id])
							app.account.conversations[item.sender_id]= [];
					
						if(app.account.lastDM_in === '')
							app.account.lastDM_in= item.id_str;
					
						app.account.conversations[item.sender_id].push(item);	
						max_id_in= item.id_str;
					});
					
					next();
				});
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
          
						if(!app.account.conversations[item.recipient_id])
							app.account.conversations[item.recipient_id]= [];
					
						if(app.account.lastDM_out === '')
							app.account.lastDM_out= item.id_str;
					
						app.account.conversations[item.recipient_id].push(item);	
						max_id_out= item.id_str;
					});
					
					next();
				});
			});
			
			$$.Promise.all([loopIn.incalculable(), loopOut.incalculable()]).then(function(){
				var convs= app.account.conversations;
			
//				sort messages
				$$.Object.keys(convs).forEach(function(item){
					var current= convs[item];
					
					current= current.sort(function(a, b){
						return (( (new $$.Date(a.created_at)).getTime() > (new $$.Date(b.created_at)).getTime() ) ? 1 : -1);
					});
				});
				done();
			});
		});
	};
	
	this.renderContacts= function(){
		var template= $('dom').select('#contact-layout').content;
		var list= $('dom').select('.contact-list');
		$$.Object.keys(app.account.contacts).forEach(function(item){
			var element= template.cloneNode(true);
			item= app.account.contacts[item];
        	    
			element.querySelector('.contact').dataset.userId= item.id;
			element.querySelector('.user-image').style.setProperty('background-image', 'url("'+ item.profile_image_url +'")');
			element.querySelector('.displayname').textContent= item.name;
			element.querySelector('.username').textContent= '@' + item.screen_name;
            
			list.appendChild(element);
		});
	};
	
	this.renderConversations= function(){
		var convs= app.account.conversations;
		var template= $('dom').select('#conv-layout').content;
		var list= $('dom').select('.conv-list');
		
		$$.Object.keys(convs).forEach(function(userId){
			var latest= app.account.conversations[userId].last();
			var user= app.account.contacts[userId];
			
			var element= template.cloneNode(true);
			
			element.querySelector('.conv').dataset.userId= userId;
			if(latest.sender_id == app.account.userId) element.querySelector('.conv').classList.add('read');
			element.querySelector('.user-image').style.setProperty('background-image', 'url('+ user.profile_image_url +')');
			element.querySelector('.displayname').textContent= user.name;
			
			if( (user.name + '@' + user.screen_name).length > 23)
				element.querySelector('.username').textContent= ('@' + user.screen_name).substr(0, 23-user.name.length) + '...';
			else
				element.querySelector('.username').textContent= '@' + user.screen_name;
			
			element.querySelector('.datetime').textContent= '0h';
			element.querySelector('.conv-body .text').textContent= latest.text.substr(0, 40) + '...';
		
			list.appendChild(element);
		});
	};
	
	this.renderChat= function(userId){
		var conversation= app.account.conversations[userId];
		var contact= app.account.contacts[userId];
		var userImage= $('dom').select('.page.chat .header-user-image');
		var template_default= $('dom').select('#chat-message-layout').content;
		var template_my= $('dom').select('#chat-my-message-layout').content;
		var list= $('dom').select('.message-list');
		var body= $('dom').select('.page.chat .body');
		
		$('dom').select('.page.chat .back-title').textContent= contact.name;
		
		if(list.dataset.userId != contact.id){
			list.dataset.userId= contact.id;
			userImage.style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
			userImage.href= '#!/profile/'+ contact.id;
		
			list.innerHTML= '';
			
			if(conversation){
				conversation.forEach(function(item){
					if(item.sender_id == app.account.userId){
						var element= template_my.cloneNode(true);
					}else{
						var element= template_default.cloneNode(true);
						element.querySelector('.user-image').style.setProperty('background-image', 'url('+ app.account.contacts[userId].profile_image_url +')');
					}
					
//					format text
					app.renderEntities(item.text, item.entities, element.querySelector('.text'));
					
					list.appendChild(element);
				});
			}
		
			body.scrollTop= body.scrollTopMax;
		}
	};
	
	this.renderEntities= function(text, entities, target){
//		add medias
		if(entities.media){
			entities.media.forEach(function(item){
				if(item.type == 'photo'){
					text= text.replace(item.url, '');
					var img= $('dom').create('img');
					img.src= item.media_url;
					target.appendChild(img);
				}
			});
		}
		
//		set text
		target.appendChild($$.document.createTextNode(text));
	};
  
	this.ready= function(){
		$$.Promise.all([this.loadContacts(), this.loadDirectMessages()]).then(function(){
			
			app.renderContacts();
			app.renderConversations();
			$('hash').restore();
			
			if($$.location.hash.indexOf('/chat/') > -1)
				app.renderChat($$.location.hash.split('/').last());
    
// 			everything is done we can open the UI.
			$('dom').select('.client').classList.remove('right');
			$('dom').select('.splash').transition('left').then(function(){
				$('dom').select('.splash').classList.add('hidden');
			});
		});
	};
	
//	mouse events for lists
	$('dom').select('.conv-list').addEventListener('click', function(e){
		app.renderChat(e.target.dataset.userId);
		$$.location.hash= '#!/messages/chat';
	}, false);
	
	$('dom').select('.contact-list').addEventListener('click', function(e){
		app.renderChat(e.target.dataset.userId);
		$$.location.hash= '#!/messages/chat';
	});
  
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
		if($$.innerHeight < defaultSize.height && $$.innerWidth == defaultSize.width){
			$('dom').select('.client').classList.add('footer-closed');
			var chatbody= $('dom').select('.chat .body');
			chatbody.scrollTop= chatbody.scrollTopMax;
		}else
			$('dom').select('.client').classList.remove('footer-closed');
	}, false);
  
//	top level navigation 
  	$('hash').mount(['/', '/streams', '/messages', '/notifications', '/find', '/settings'], function(path){
		var sheet= path.split('/')[1];
		sheet= (sheet === '') ? 'streams' : sheet;
    
		$('dom').select('.footer .'+sheet).classList.add('active');
    	app.switchSheet('.sheet.'+sheet);
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
		app.UI.pagesToLeft('messages', 'conversations', 'chat');
	}, function(){
		app.UI.pagesFromLeft('messages', 'chat', 'conversations');
  	}, true);
  
// 	settings
  	$('hash').mount('/settings/about', function(){
		app.UI.pagesToLeft('settings', 'main', 'about');
	}, function(){
		app.UI.pagesFromLeft('settings', 'about', 'main');
  	}, true);
  
// 	profile
  	$('hash').mount('/profile', function(){
    	$('dom').select('.sheet.profile').classList.remove('bottom');
  	}, function(){
		$('dom').select('.sheet.profile').classList.add('bottom');
	});
  
// 	checking the current login  
  	if(!this.twitterSocket.isLoggedIn()){
    	
		this.twitterSocket.requestToken('/oauth/request_token', 'oob').then(function(){
			$('dom').select('.splash .signIn').classList.remove('hidden');
    	});
    
    	$('dom').select('.splash .signIn').addEventListener('click', function(){
			app.twitterSocket.authenticate('/oauth/authenticate');
			var verify= $('dom').select('.splash .verify');
			var code= $('dom').select('.splash .code');
        
			$('dom').select('.splash .signIn').classList.add('hidden');
			code.classList.remove('hidden');
			verify.classList.remove('hidden');
        
			code.addEventListener('focus', function(){
				$('dom').select('.splash .logo').classList.add('hidden');
			}, false);
      		code.onblur= function(){
				$('dom').select('.splash .logo').classList.remove('hidden');
			};
        
			verify.addEventListener('click', function(){
				app.twitterSocket.verify('/oauth/access_token', code.value).then(function(userId){
					app.account.userId= userId;
					$$.localStorage.setItem('account.userid', userId);
					app.ready();
				});
			}, false);
		}, false);
    
  	}else{
		app.account.userId= $$.localStorage.getItem('account.userid');
		app.ready();
	}
  
});