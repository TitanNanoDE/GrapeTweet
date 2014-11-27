$_('grapeTweet').module('UI', ['Storage', 'Misc', 'Net'], function(App, done){
	
	var client= $('dom').select('.client.twitter');
    
    var { Storage, Misc, Net } = App.modules;
	
	var renderMessage= function(item, contact, insertBefore){	
		var template_default= $('dom').select('#chat-message-layout').content;
		var template_my= $('dom').select('#chat-my-message-layout').content;
		var list= $('dom').select('.message-list');
		var firstElement= $('dom').select('.page.chat .message-list li');
        var element= null;
		
		if(item.sender_id == App.account.userId){
			element= template_my.cloneNode(true);
			element.querySelector('.message').dataset.id= item.id_str;
		}else{
            element= template_default.cloneNode(true);
			element.querySelector('.user-image').style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
			element.querySelector('.message').dataset.id= item.id_str;
		}
							
//		format text
		renderEntities(item.text, item.entities, element.querySelector('.text'));
							
//		timestamp
		var date= new Date(item.created_at);
		element.querySelector('.date').textContent= date.toLocaleDateString() + ', ' + date.toLocaleTimeString();
		
		if(!insertBefore)
			list.appendChild(element);
		else
			list.insertBefore(element, firstElement);
	};
    
    var renderEntities= function(text, entities, target){
//      add medias
        if(entities.media){
            entities.media.forEach(function(item){
                if(item.type == 'photo'){
                    text= text.replace(item.url, '');
                    var img= $('dom').create('img');
                    var chatBody= $('dom').select('.page.chat .body');
                    var scrollHeightBefore= chatBody.scrollHeight;
                        
                    img.onload= function(){
                        chatBody.scrollTop= (chatBody.scrollTop / scrollHeightBefore / 100) * (chatBody.scrollHeight / 100);
                    };
                    target.appendChild(img);
                    Net.cacheImage(item.media_url).then(function(url){
                        img.src= url;
                    });
                }
            });
        }
		
//	    set text
        target.innerHTML+= text;
    };
	
	var getTimeSince= function(timeSting){
		var now= new Date();
		var from= new Date(timeSting);
		var time= new Date(now - from);

		if(time.getYear() - 70 > 0)
			return (time.getYear() - 70) + 'Y';
		else if(time.getMonth() > 0)
			return time.getMonth() + 'M';
		else if(time.getDate() - 1 > 0)
			return (time.getDate() - 1) + 'd';
		else if(time.getHours() - 1 > 0)
			return (time.getHours() - 1) + 'h';
		else if(time.getMinutes() > 0)
			return time.getMinutes() + 'm';
		else if(time.getSeconds() > 0)
			return time.getSeconds() + 's';
		else
			return 'now';
	};
	
	var interface= {
		switchSheet : function(selector){
			var activeSheet= $('dom').select('.sheet.active');
			var newSheet= $('dom').select(selector);
    
    		if(activeSheet && activeSheet != newSheet){
				client.transition('change').then(function(){
					newSheet.classList.add('active');
					activeSheet.classList.remove('active');
					$$.setTimeout(function(){
						client.classList.remove('change');
					}, 30);
				});
			}else{
				newSheet.classList.add('active');
    		}
		},
		
		pagesToLeft : function(sheet, from, to){
			$('dom').select('.sheet.'+ sheet +' .page.'+ from).classList.add('left');
			$('dom').select('.sheet.' + sheet +' .page.'+ to).classList.remove('right');
		},
		
		pagesFromLeft : function(sheet, from, to){
			$('dom').select('.sheet.' + sheet +' .page.'+ from).classList.add('right');
			$('dom').select('.sheet.'+ sheet +' .page.'+ to).classList.remove('left');
		},
		
		renderContacts : function(){
			return new $$.Promise(function(done){
				var template= $('dom').select('#contact-layout').content;
				var list= $('dom').select('.contact-list');
				
				list.innerHTML= '';
			
				Storage.getContacts().then(function(contacts){
					$$.Object.keys(contacts).forEach(function(item){
						item= contacts[item];
						var element= template.cloneNode(true);
					
						element.querySelector('.contact').dataset.userId= item.id;
						element.querySelector('.user-image').style.setProperty('background-image', 'url("'+ item.profile_image_url +'")');
						element.querySelector('.displayname').textContent= item.name;
						element.querySelector('.username').textContent= '@' + item.screen_name;
            	
						list.appendChild(element);
					});
					done();
				});
			});
		},
		
		renderChats : function(){
			return new Promise(function(done){
				Storage.getConversationsList().then(function(conversations){
					var promises= [];
				
					$$.Object.keys(conversations).forEach(function(key){
						promises.push(Storage.getMessage(conversations[key].lastMessage));
					});
					
					promises.push(Storage.getContacts());
				
					$$.Promise.all(promises).then(function(messages){
						var template= $('dom').select('#conv-layout').content;
						var list= $('dom').select('.conv-list');
						var contacts= messages.pop();
						
						list.innerHTML= '';
				
						$$.Object.keys(conversations).forEach(function(userId, index){
							var latest= messages[index];
							var user= contacts[userId];
							var conv= conversations[userId];
				
							var element= template.cloneNode(true);
			
							element.querySelector('.conv').dataset.userId= userId;
							
							if(conv.unread > 0)
								element.querySelector('.conv').classList.add('unread');
							else if(latest.sender_id == App.account.userId)
								element.querySelector('.conv').classList.add('my');
							
							element.querySelector('.user-image').style.setProperty('background-image', 'url('+ user.profile_image_url +')');
							element.querySelector('.displayname').textContent= user.name;
				
							if( (user.name + '@' + user.screen_name).length > 23)
								element.querySelector('.username').textContent= ('@' + user.screen_name).substr(0, 23-user.name.length) + '...';
							else
								element.querySelector('.username').textContent= '@' + user.screen_name;
				
							element.querySelector('.datetime').textContent= getTimeSince(latest.created_at);
							element.querySelector('.conv-body .text').textContent= ((latest.text.length <= 40) ? latest.text : latest.text.substr(0, 40) + '...');
				
							list.appendChild(element);
						});
						
						done();
					});
				});
			});
		},
		
		renderChat : function(userId){			
			return new $$.Promise(function(done){
				$$.Promise.all([Storage.getConversation(userId), Storage.getContact(userId)]).then(function(values){
					var conversation= values[0];
					var contact= values[1];
					var list= $('dom').select('.message-list');
					var userImage= $('dom').select('.page.chat .header-user-image');
					var body= $('dom').select('.page.chat .body');		
					
//					close notification for this conversation
					$$.Notification.get().then(function(list){
						list.forEach(function(item){
							if(item.tag == userId)
								item.close();
						});
					});
					
					var differentConv= (list.dataset.userId != userId);
					
//					setup page					
					if(differentConv){
						list.innerHTML= '';
						$('dom').select('.page.chat .back-title').textContent= contact.name;
							
						userImage.style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
						userImage.href= '#!/profile/'+ contact.id;
						App.dataStatus.lastChat= contact.id_str;
						list.dataset.userId= contact.id;
					}
					
					if(conversation){
                        var handle= function(messages){
				            if(messages.length > 0){
                                messages.sort(Misc.sortByDate);
                                messages.forEach(function(item){
                                    renderMessage(item, contact);
                                });
							
                                App.account.unreadMessages-= conversation.unread;
                                conversation.lastReadMessage= messages.last().id_str;
                                conversation.unread= 0;
                                Storage.storeConversation(conversation);
					
                                interface.renderFooterStatus(App.account);
                                body.scrollTop= body.scrollHeight;
                            }
                            done();
                        };
                        
						if(differentConv){
				            Storage.getMessagesChunkBefore(conversation.lastMessage, true).then(handle);
						}else{
							Storage.getNewMessagesSince(conversation.lastReadMessage).then(handle);
						}
					}else done();
				});
			});
		},
		
		renderAdditionalChunk : function(){			
			return new $$.Promise(function(done){
				var lastElement= $('dom').select('.page.chat .message-list li');
				var body= $('dom').select('.page.chat .body');		
				var scrollHeight= body.scrollHeight;
				
				if(lastElement){
					$$.Promise.all([Storage.getMessagesChunkBefore(lastElement.dataset.id, false), Storage.getContact(App.dataStatus.lastChat)]).then(function(values){
						var messages= values[0].sort(Misc.sortByDate);
						var contact= values[1];
						
						messages.reverse().forEach(function(item){
							renderMessage(item, contact, true);
						});
						
						body.scrollTop= body.scrollHeight - scrollHeight - 20;
						done();
					});
				}else{
					done();
				}
			});
		},

		renderFooterStatus : function(account){
			var label= $('dom').select('.footer .messages .count');
			if(account.unreadMessages > 0){
				label.textContent= account.unreadMessages;
				label.classList.remove('hidden');
			}else{
				label.classList.add('hidden');
			}
		}
	};
	
	done(interface);
});